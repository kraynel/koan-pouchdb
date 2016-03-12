'use strict';

/**
 * Password based login and OAuth login functions.
 */

var qs = require('querystring'),
    route = require('koa-route'),
    jwt = require('koa-jwt'),
    request = require('co-request'),
    config = require('../config/config'),
    pouchdb = require('../config/pouchdb');

// register koa routes
exports.init = function (app) {
  app.use(route.post('/login', login));
  app.use(route.get('/login/facebook', facebookLogin));
  app.use(route.get('/login/facebook/callback', facebookCallback));
  app.use(route.get('/login/google', googleLogin));
  app.use(route.get('/login/google/callback', googleCallback));
};

function *getUserByEmail(emailToFind) {
  yield pouchdb.users.createIndex({
    index: {
      fields: ['email']
    }
  })
  var queryResults = yield pouchdb.users.find({
    selector: {email: emailToFind}
  });
  if(queryResults.docs.length > 0) {
    return queryResults.docs[0];
  }
}

/**
 * Receives the user credentials and returns a JSON Web Token along with user profile info in JSON format.
 */
function *login() {
  var credentials = this.request.body;
  var user = yield getUserByEmail(credentials.email);
  if(!user) {
    this.throw(401, 'Incorrect e-mail address.');
  } else if (user.password !== credentials.password) {
    this.throw(401, 'Incorrect password.');
  } else {
    delete user.password;
    user.picture = '/api/users/' + user._id + '/picture';
  }

  // sign and send the token along with the user info
  var token = jwt.sign(user, config.app.secret, {expiresInMinutes: 90 * 24 * 60 /* 90 days */});
  this.body = {token: token, user: user};
}

/**
 * Facebook OAuth 2.0 login endpoint.
 */
function *facebookLogin() {
  this.redirect(
          'https://www.facebook.com/dialog/oauth?client_id=' + config.oauth.facebook.clientId +
          '&redirect_uri=' + config.oauth.facebook.callbackUrl + '&response_type=code&scope=email');
}

/**
 * Facebook OAuth 2.0 callback endpoint.
 */
function *facebookCallback() {
  if (this.query.error) {
    this.redirect('/login');
    return;
  }

  // get an access token from facebook in exchange for oauth code
  var tokenResponse = yield request.get(
          'https://graph.facebook.com/oauth/access_token?client_id=' + config.oauth.facebook.clientId +
          '&redirect_uri=' + config.oauth.facebook.callbackUrl +
          '&client_secret=' + config.oauth.facebook.clientSecret +
          '&code=' + this.query.code);
  var token = qs.parse(tokenResponse.body);
  if (!token.access_token) {
    this.redirect('/login');
    return;
  }

  // get user profile (including email address) from facebook and save user data in our database if necessary
  var profileResponse = yield request.get('https://graph.facebook.com/me?fields=name,email,picture&access_token=' + token.access_token);
  var profile = JSON.parse(profileResponse.body);

  var user = yield getUserByEmail(profile.email);
  console.log('FB existing user?', user);
  if (!user) {
    user = {
      email: profile.email,
      name: profile.name,
      picture: (yield request.get(profile.picture.data.url, {encoding: 'base64'})).body
    };
    var results = yield pouchdb.users.post(user);
  }
  user.id = user._id;
  delete user._id;
  // redirect the user to index page along with user profile object as query string
  user.picture = '/api/users/' + user.id + '/picture';
  var token = jwt.sign(user, config.app.secret, {expiresInMinutes: 90 * 24 * 60 /* 90 days */});
  this.redirect('/?user=' + encodeURIComponent(JSON.stringify({token: token, user: user})));
}

/**
 * Google OAuth 2.0 login endpoint.
 */
function *googleLogin() {
  this.redirect(
          'https://accounts.google.com/o/oauth2/auth?client_id=' + config.oauth.google.clientId +
          '&redirect_uri=' + config.oauth.google.callbackUrl + '&response_type=code&scope=profile%20email');
}

function *googleCallback() {
  if (this.query.error) {
    this.redirect('/login');
    return;
  }

  // get an access token from google in exchange for oauth code
  var tokenResponse = yield request.post('https://accounts.google.com/o/oauth2/token', {form: {
    code: this.query.code,
    client_id: config.oauth.google.clientId,
    client_secret: config.oauth.google.clientSecret,
    redirect_uri: config.oauth.google.callbackUrl,
    grant_type: 'authorization_code'
  }});
  var token = JSON.parse(tokenResponse.body);
  if (!token.access_token) {
    this.redirect('/login');
    return;
  }

  // get user profile (including email address) from facebook and save user data in our database if necessary
  var profileResponse = yield request.get('https://www.googleapis.com/plus/v1/people/me?access_token=' + token.access_token);
  var profile = JSON.parse(profileResponse.body);
  var user = yield getUserByEmail(profile.emails[0].value);
  if (!user) {
    user = {
      email: profile.emails[0].value,
      name: profile.displayName,
      picture: (yield request.get(profile.image.url, {encoding: 'base64'})).body
    };
    var results = yield pouchdb.users.post(user);
  }
  user.id = user._id;
  delete user._id;
  // redirect the user to index page along with user profile object as query string
  user.picture = '/api/users/' + user.id + '/picture';
  var token = jwt.sign(user, config.app.secret, {expiresInMinutes: 90 * 24 * 60 /* 90 days */});
  this.redirect('/?user=' + encodeURIComponent(JSON.stringify({token: token, user: user})));
}
