'use strict';

/**
 * MongoDB configuration using generators (with the help of co-mongo package).
 * You can require this config file in your controllers and start using named collections directly.
 * See /controllers directory for sample usage.
 */

var pouchdb = require('pouchdb'),
    config = require('./config');
  pouchdb.plugin(require('pouchdb-find'));
  pouchdb.debug.enable('pouchdb:find')

  module.exports = pouchdb;
  /**
   * Opens a new connection to the mongo database, closing the existing one if exists.
   */
  pouchdb.users = new pouchdb(config.couchdb.url + '/users');
  pouchdb.posts = new pouchdb(config.couchdb.url + '/posts');

  // extending and exposing top co-mongo namespace like this is not optimal but it saves the user from one extra require();
