"use strict";

let config = require('./common/config');
let http = require('http');
let https = require('https');
let loggerEntry = require('./common/logger');
let logger = require('./common/logger').forFile('OKP API Server');
let fs = require('fs');
let session = require('express-session');
let MongoStore = require('connect-mongo')(session);
let setupApp = require('./app');

loggerEntry.initServer();
logger.info("Fire up the big guns on port " + process.env.PORT);

var certs = {
  key: fs.readFileSync(__dirname + '/../certs/server.key'),
  cert: fs.readFileSync(__dirname + '/../certs/server.crt'),
  ca: fs.readFileSync(__dirname + '/../certs/ca.crt'),
  passphrase: 'gulp'
};

function errorHandler(err, req, res, next) {
  logger.warn("error handler " + err);
  if (req.xhr) {
    res.status(500).send({ error: 'Hold your horses !' + err});
  } else {
    next(err);
  }
}

function configureApp(app) {
  logger.info("Setting API server port to " + config.API_PORT);
  app.set('port', config.API_PORT);
  app.use(errorHandler);
  //app.set('proxyport', 80);
}

function setupExceptionHandlers() {
  var term_events = ['exit', 'SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL',
                     'SIGABRT', 'SIGFPE', 'SIGSEGV', 'SIGPIPE', 'SIGTERM',
                     'SIGUSR1', 'SIGUSR2', 'SIGBUS', 'SIGIO'];

  function gracefullExit() {
    process.exit(1);
  }
  for (var i in term_events) {
    process.on(term_events[i], gracefullExit);
  }

  process.on('uncaughtException', function(err) {
    logger.warn(console.trace() + " error : " + err);
    throw err;
  });
}

(function main() {
  let app;
  let proxy;
  let store = new MongoStore({ url: config.MONGODB_URL, autoReconnect: true });
  let theSession = session({ secret: config.SESSION_SECRET,
                             store: store,
                             cookie: { maxAge: 86400000 },
                             saveUninitialized: true,
                             resave: true
                           });

  app = setupApp(theSession);
  configureApp(app);
  setupExceptionHandlers();

  //var server =  https.createServer(certs, app);

  var server =  http.createServer(app);
  server.listen(app.get('port'));
})();

