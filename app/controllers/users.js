"use strict";

let _ = require('lodash');
let logger = require('../common/logger.js').forFile('controllers/users.js');
let projections = require("../common/projections.js");
let projectUser = projections.user;
let projectCurrentUser = projections.currentUser;
let utilities = require("../common/utilities");
let Seq = require('seq');
let async = require('async');
let User = require("../models/user.js");


function populateVisibleUser(_user, res) {
  let user = _user;
  async.waterfall([
    function (callback) {
      res.cookie("currentUser", user.first_name);
      res.status(200).json(projectCurrentUser(user));
      callback();
    }],
    function (err) {
      if (err) {
        return res.status(500).send({error: err});
      }
    });
}

function registerUser(req, res) {
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;

  if (ip.split(',').length > 1) {
    ip = ip.split(',').first();
  }

  logger.info("Register user has ip " + ip);

  Seq()
    .seq(function () {
      User.Create(req.body, ip, this);
    })
    .seq(function (result) {
      var next = this;
      if (result.result) {
        logger.info("Created new user " + result.user.first_name);
        res.cookie("currentUser", result.user.state);
        req.logIn(result.user, function (err) {
          if (err) {
            return next(err);
          }
          populateVisibleUser(result.user, res);
        });
      } else {
        logger.info("Failed to create a new user " + result.message);
        res.status(422).json(result);
      }
    })
    .catch(function (err) {
      res.status(500).json({error : err});
      logger.error("registerUser error " + err);
    });
}

// An explicit get to /users/:username should return user
// If the user is a listener then it will also return the schedule
function getUser(req, res) {
  var user;
  Seq()
    .seq(function () {
      User.findOne({username: req.params.username}, this);
    })
    .seq(function (_user) {
      if (!_user) {
        return res.status(404).send();
      }
      user = _user;
      res.status(200).json(projectUser(user));
    })
    .catch(function (err) {
      res.status(500).send({error : "get User err " + err});
    });
}

function updateUser(req, res) {
  Seq()
  	.seq(function () {
      User.findById(req.params.user_id, this);
    })
    .seq(function (_user) {
      if (!_user) {
        return res.status(500).json({error : "Can't find user " + req.params.user_id});
      }
      User.update(req.params.user_id, req.body, this);
    })
    .seq(function (_updatedUser) {
      if (_updatedUser.success) {
  		  res.status(200).json(projectCurrentUser(_updatedUser.updated));
      } else {
        res.status(422).json(_updatedUser);
      }
  	})
  	.catch(function (err) {
  		res.status(500).json({error : err});
  	});
}

function deleteUser(req, res) {
  req.session.destroy();
  req.logout();

  User.delete(req.params.user_id, function (err) {
    if (err) {
      return res.status(500).json({message : err});
    }
    return res.status(200).json({});
  });
}

// Search on the site -> {q : $NAME} -> does a regex search across first_name and last_name
// Search on the admin panel -> {key : value.....}, exact find using key value pairs
function searchUsers(req, res) {
  let query = {};
  if (req.query.q) {
    // Used by search at front end
    // Regex match across first_name and last_name
    let matcher =  "^" + req.query.q;
    query = { $or : [
      {first_name : {$regex : matcher, $options : "si"}},
      {last_name : {$regex : matcher, $options : "si"}}
    ]};
  } else {
    Object.each(req.query, function (key, value) {
      let potentialInt = utilities.safeParseInt(value);
      query[key] = potentialInt !== null ? potentialInt : value;
    });
  }

  User.find(query, function (err, users) {
    if (err) {
      res.status(500).json({message: err});
    } else {
      res.status(200).json(users.map(projectUser));
    }
  });
}

/* Simple key value pair lookup */
function getUsers (req, res) {
  var query = req.query;

  Object.each(query, function (key, value) {
    if (!isNaN(value))
      query[key] = parseInt(value);
  });

  User.find(query, function (err, users) {
    if (err) {
      res.status(500).send();
    } else {
      res.status(200).json(users.map(projectUser));
    }
  });
}

function fbFindOrCreate(req, res) {
  let profile = req.body;

  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress;

  if (ip.split(',').length > 1) {
    ip = ip.split(',').first();
  }

  User.findOne({ facebookId: profile.facebookId }, function(err, user) {
    if (err) {
      res.status(500).json({error : err});
    }

    if (user) {
      // if the user is found, return it
      res.status(200).json(projectUser(user)); // user found, return that user
    } else {
      // if there is no user found with that facebook id, create it
      var newUser = new User();
      // set all of the facebook information in our user model
      _.extend(newUser, profile);
      // save user to the database
      User.Create(newUser, ip, function(err, _user) {
        if (err) {
          res.status(500).json(err);
        } else {
          res.status(200).json(projectUser(_user)); // if successful, return the new user
        }
      });
    }
  });
}

module.exports = function (router) {
  router.route('/users')
    .post(registerUser);

  router.route('/api/users')
    .get(getUsers);

  router.route('/api/users/search')
    .get(searchUsers);

  router.route('/users/:username')
    .get(getUser);

  router.route('/fbFindOrCreate')
    .post(fbFindOrCreate)

  router.route('/api/users/:username')
    .get(getUser);

  router.route('/api/users/:user_id')
    .put(updateUser)
    .delete(deleteUser);
};
