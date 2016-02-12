"use strict";
/*
 * Mongo backend
 * databases.js: the database table
 *
 * Wraps the database connection to share connections.
 *
 */

let config = require('./config.js');
let mongodb = require('mongodb');
let logger = require('./logger.js').forFile('common/database');
var Seq = require('seq');

let DATABASE;
let MAX_RETRIES = 5;
let RETRIES = 0;
let CONNECTING = false;
let WAITING = null;

let Database = module.exports;

//
// Public Methods
//
/**
 * Connect to the database.
 *
 * @param {function(err, database)} callback  The callback to consume the database.
 * @return {undefined}
 */
Database.connect = function(callback) {

  callback = callback ? callback : function() {};

  if (!DATABASE && CONNECTING) {
    return WAITING.push([Database.connect, Object.values(arguments)]);
  }

  if (DATABASE) {
    callback(null, DATABASE);
  }
  else {

    CONNECTING = true;
    WAITING = [];

    var dbTarget = config.MONGODB_URL;
    logger.info('Connecting to database at ' + dbTarget);
    mongodb.MongoClient.connect(dbTarget,
                                {},
                                function(err, db) {
      if (err && RETRIES < MAX_RETRIES) {
        RETRIES += 1;
        logger.warn('Unable to connect to database: %s. Retrying %s out of %s times',
                    err, RETRIES, MAX_RETRIES);
        setTimeout(Database.connect.bind(null, callback), 1000 * 10 * RETRIES); // Decaying
        return;
      }
      DATABASE = db;
      callback(err, DATABASE);
      db.on('error', function(err) {
        throw err;
      });

      if (WAITING.length) {
        WAITING.forEach(function(call) {
          call[0].apply(null, call[1]);
        });
      }
    });
  }
};


/**
 * Connect to database and ensure collection exists
 *
 * @param {string}  collectionName   The name of the collection.
 * @param {function(err, database, collection)}   callback  The callback to consume the database and collection
 * @return {undefined}
 */
 Database.connectAndEnsureCollection = function(collectionName, callback) {
  callback = callback ? callback : function() {};

  Seq()
    .seq('Get database', function() {
      Database.connect(this);
    })
    .seq('Ensure collection', function(db) {
      var that = this;
      db.createCollection(collectionName, function(err) {
        that(err, db);
      });
    })
    .seq('done', function(db) {
      callback(null, db, db.collection(collectionName));
    })
    .catch(function(err) {
      callback(err);
    })
    ;
 };
