'use strict';

/**
 * Posts controller for serving user posts.
 */

var route = require('koa-route'),
    pouchdb = require('../config/pouchdb'),
    ws = require('../config/ws'),
    _ = require('lodash')

// register koa routes
exports.init = function (app) {
  app.use(route.get('/api/posts', listPosts));
  app.use(route.post('/api/posts', createPost));
  app.use(route.post('/api/posts/:postId/comments', createComment));
};

/**
 * Lists last 15 posts with latest 15 comments in them.
 */
function *listPosts() {
  yield pouchdb.posts.createIndex({
    index: {
      fields: ['createdTime']
    }
  })
  var posts = yield pouchdb.posts.find({
    selector: {
        createdTime: {'$exists': true}
      },
      sort: [{createdTime: 'desc'}]
    });
  console.log(posts);
  this.body = _.map(posts.docs, function(doc){
    doc.id = doc._id;
    delete doc._id;
    return doc;
  });
}

/**
 * Saves a new post in the database after proper validations.
 */
function *createPost() {
  // it is best to validate post body with something like node-validator here, before saving it in the database..
  var post = this.request.body;
  post.from = this.state.user; // user info is stored in 'this.state.user' field after successful login, as suggested by Koa docs: http://koajs.com/#ctx-state
  post.createdTime = new Date();
  post.comments = [];
  var results = yield pouchdb.posts.post(post);

  this.status = 201;
  post.id = results.id;
  this.body = post;

  // now notify everyone about this new post
  ws.notify('posts.created', post);
}

/**
 * Appends a new comment to a given post.
 * @param postId - Post ID.
 */
function *createComment(postId) {
  var now = new Date();
  var comment = {
    id: now,
    from: this.state.user,
    createdTime: now,
    message: this.request.body.message,
    postId: postId
  };
  var post = yield pouchdb.posts.get(postId);
  // update post document with the new comment

  post.comments.push(comment);

  var result = yield pouchdb.posts.post(post);
  this.status = 201;
  this.body = comment;

  // now notify everyone about this new comment
  ws.notify('posts.comments.created', comment);
}
