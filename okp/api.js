
"use strict";
require('sugar');
let async = require('async');
let isUserAuthenticated = require('./common/ensure-auth.js').isUserAuthenticated;
let bcrypt = require('bcrypt');
let _ = require('lodash');
let express = require('express');
let logger = require('./common/logger.js').forFile('api.js');
let passport = require('passport');
let EmailSender = require('./common/email-engine');

let projectCurrentUser = require("./common/projections.js").currentUser;
let constants = require("./common/constants");

let LocalStrategy = require('passport-local').Strategy;
let User = require('./models/user');

let API = module.exports;

// User cache **BEWARE**
let userCache = {};

function populateVisibleUser(_user, res, done) {
  let user = _user;
  async.waterfall([
    function (callback) {
      res.cookie("currentUser", user.state);
      res.status(200).json(projectCurrentUser(user));
      callback();
    }],
    function (err) {
      if(err)
        return res.status(500).send({error: err});
      done();
    });
}

function login(req, res, next) {
  logger.info('login', req.body.email);
  var user;
  passport.authenticate('local', function (err, _user, info) {
    if(err) {
      res.cookie("currentUser", constants.userStates.ERRORED);
      return next(err);
    }

    if(!_user) {
      res.cookie("currentUser", constants.userStates.ERRORED);
      return res.status(401).send({ error: info.message, success: false });
    }

    user = _user;

    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }
      populateVisibleUser(user, res, function () {});
    });
  })(req, res, next);
}

function logout(req, res) {
  logger.info('logout', req.user ? req.user.name : 'unknown');
  req.session.destroy();
  req.logout();
  res.cookie("currentUser", constants.userStates.LOGGEDOUT);
  res.status(200).send({ success: true });
}

function checkAuthenticated(req, res, next) {
  if (!req.isAuthenticated() && !req.user) {
    res.cookie("currentUser", constants.userStates.LOGGEDOUT);
    res.status(200).send({});
    return;
  }

  async.waterfall([
    function (callback) {
      User.findById(req.user._id, callback);
    },
    function (_user, callback) {
      if(!_user) {
        res.cookie("currentUser", constants.userStates.LOGGEDOUT);
        return res.status(200).send({});
      }

      _user._id = req.user._id;

      // If we are super just return with that user.
      if(_user.type === constants.userTypes.SUPER)
        return res.status(200).json(projectCurrentUser(_user));

      populateVisibleUser(_user, res, callback);
    }],
    function (err) {
      if(!err)
        return next();
      res.cookie("currentUser", constants.userStates.LOGGEDOUT);
      return res.status(500).send({error: err});
    });
}

function validator(req, res) {
  var token = req.body.token;
  User.findByToken(token, function (err, user) {
    if(err)
      return res.status(500).json({message: err});

    if(!user)
      return res.status(404).json({message: "Unable to find user"});

    // Token already authenticated (not a bother but good idea to inform the frontend of the exact state)
    if(user.state === constants.userStates.ACTIVE || user.state === constants.userStates.NEEDSREVIEW)
      return res.status(204).json(projectCurrentUser(user));

    // Expired
    if(user.validation.createdAt < Date.create('7 days ago').getTime())
      return res.status(498).json({message : "this token has expired"});

    User.verifyEmail(user._id, function (err) {
      if(err) {
        return res.status(500).json({message: "Unable to verify that token"});
      }
      passport.authenticate('local', function (err, _user, info) {
        if(err) {
          res.cookie("currentUser", constants.userStates.ERRORED);
          return next(err);
        }

        if(!_user) {
          res.cookie("currentUser", constants.userStates.ERRORED);
          return res.status(401).send({ error: info.message, success: false });
        }

        user = _user;

        req.logIn(user, function (err) {
          if (err) {
            return next(err);
          }
          populateVisibleUser(user, res, function () {});
        });
      })(req, res, next);
    });
  });
}


/*
 * loadUser: load a specific user via email
 *
 * @param{string}                     email       An email address to search for.
 * @param{function (err,user)}         callback    Callback to call when done.
 * @return{undefined}
 */
function loadUser(email, done) {
  User.findByEmail(email, function (err, user) {
    if (err) return done(err);
    return done(null, user);
  });
}

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

/*
 * Passport (authentication) Methods
 */
function authenticate(email, password, done) {
  email = normalizeEmail(email);

  loadUser(email, function (err, user) {
    var message = { message: 'Incorrect email or password.'};
    if (err || !user)
      return done(err, false, message);

    bcrypt.compare(password, user.hash, function (err, matches) {
      if (err) logger.warn(err);

      if (!matches)
        return done(null, false, { message: 'Incorrect email or password.' });

      done(null, projectCurrentUser(user));
    });
  });
}

function serializeUser(user, done) {
  done(null, JSON.stringify({ _id: user._id, 'email': user.email }));
}

function deserializeUser(id, done) {
  id = JSON.parse(id);
  var email = id.email;

  if(userCache[id.email] && userCache[id.email].created > (Date.now() - 600000))
    return done(null, projectCurrentUser(userCache[id.email].user));

  User.findByEmail(email, function (err, user) {
    if (err) return done(err);

    if (!user) {
      // for now to handle db hackery
      return done(null, {invalid : true});
    }

    userCache[id.email] = { created: Date.now(), user: user };
    done(null, projectCurrentUser(user));
  });
}

function sendSupportEmail(req, res) {
  let emailManager = new EmailSender();
  emailManager.sendSupportEmail(req.body, function (err) {
    if(err) {
      logger.warn("Unable to send support email. " + err + " \n user : " + user.email);
    }
    res.send({});
  });  
}


/*
 * Public Methods
 */


API.init = function () {
  var opts = { usernameField: 'email', passwordField: 'password' };
  passport.use(new LocalStrategy(opts, authenticate));
  passport.serializeUser(serializeUser);
  passport.deserializeUser(deserializeUser);
};

/**
* For now routes follow a simple rule of anything under /api requires an auth cookie.
* Therefore the ability to login or create a user are not under /api.
**/
API.createRouter = function () {
  var router = express.Router();

  router.use(function (req, res, next) {
    /*TODO: probably allowing access for everyone isn't best idea, so allowed origins should be filtered someway
      e.g. could be created file named "config.json" where allowed origins could be white-listed*/
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    
    // For powering Backbone app
    if (req.method === "OPTIONS") {
      res.status(200).send();
    } else {
      next();
    }
  });

  router.route('/login')
    .post(login)
    .get(checkAuthenticated);

  router.all('/api/*', isUserAuthenticated);

  require('./controllers/users')(router);
  require('./controllers/transactors')(router);

  router.route('/validator')
    .post(validator);

  router.route('/api/logout')
    .get(logout);

  router.route('/contactUs')
    .post(sendSupportEmail);

  return router;
};
