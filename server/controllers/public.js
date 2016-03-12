'use strict';

/**
 * Publicly accessible API endpoints. This is useful for special cases like user profile images, etc.
 */

var route = require('koa-route'),
    config = require('../config/config'),
    pouchdb = require('../config/pouchdb');

// register koa routes
exports.init = function (app) {
  app.use(route.get('/api/users/:id/picture', getPicture));
};

/**
 * Serves user profile picture in jpeg format.
 * @param id - User ID.
 */
function *getPicture(id) {
  var user = yield pouchdb.users.get(id);
  if (user) {
    var img = new Buffer(user.picture, 'base64');
    this.set('Content-Type', 'image/jpeg');
    if (config.app.cacheTime) {
      this.set('Cache-Control', 'max-age=' + (config.app.cacheTime / 1000));
    }
    this.body = img;
  }
}
