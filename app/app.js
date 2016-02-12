'use strict';
require('sugar');

let api = require('./api.js');
let config = require('./common/config');
let express = require('express');
let bodyParser = require('body-parser');
let cookieParser = require('cookie-parser');
let passport = require('passport');
let methodOverride = require('method-override');

let logger = require('./common/logger').forFile('app.js');

module.exports = function setupApp(theSession) {
  var app = express();

  api.init();

  app.use(bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
  }));

  app.use(bodyParser.json({limit: '20mb'}));
  app.use(methodOverride());
  app.use(cookieParser(config.SESSION_SECRET));
  app.use(theSession);
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(function(err, req, res, next) {
    if (err) {
      logger.error(err.stack ? err.stack : new Error('error').stack);
    }

    next(err);
  });

  var router = api.createRouter();
  app.use('/', router);

  return app;
};
