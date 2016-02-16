"use strict";

let logger = require('../common/logger.js').forFile('controllers/users.js');
let constants = require('../common/constants');
let ObjectId = require('mongodb').ObjectID;
let projections = require("../common/projections.js");
let utilities = require("../common/utilities");
let projectUser = projections.user;
let projectCurrentUser = projections.currentUser;
let Seq = require('seq');
let User = require("../models/user.js");

function registerUser(req, res) {
  let ip = req.headers['x-forwarded-for'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.connection.socket.remoteAddress;

  if (ip.split(',').length > 1) {
    ip = ip.split(',').first();
  }

  logger.info("Register user has ip " + ip);

  Seq()
    .seq(function () {
      User.Create(req.body, ip, this);
    })
    .seq(function (result) {
      if (result.result) {
        logger.info("Created new user " + result.user.first_name);
        res.cookie("currentUser", result.user.state);
        res.status(201).json(projectUser(result.user));
        this();
      } else{
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
      if (!_user)
        return res.status(404).send();
      user = _user;
      res.status(200).json(projectUser(user));
    })
    .catch(function (err) {
      res.status(500).send({error : "get User err " + err});
    })
    ;
}

function updateUser(req, res) {
  Seq()
  	.seq(function () {
      User.findById(req.params.user_id, this);
    })
    .seq(function (_user) {
      if (!_user)
        return res.status(500).json({error : "Can't find user " + req.params.user_id});
      User.update(req.params.user_id, req.body, this);
    })
    .seq(function (_updatedUser) {
      if (_updatedUser.success)
  		  res.status(200).json(projectCurrentUser(_updatedUser.updated));
      else
        res.status(422).json(_updatedUser);
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

// This method is used from both the front page and the admin panel
// Search on the site -> {q : $NAME} -> does a regex search across name, last_name and username
// Search on the admin panel -> {key : value.....}, exact find using key value pairs
function searchUsers(req, res) {
  let query = {};
  if (req.query.q) {
    // Used by search at front end
    // Regex match across name, last_name and username for now
    let matcher =  "^" + req.query.q;
    query = { $or : [{name : {$regex : matcher, $options : "si"}},
                     {last_name : {$regex : matcher, $options : "si"}},
                     {username : {$regex : matcher, $options : "si"}}]};
    // for type 1 users, only return type 0 users.  And vis-versa.
    // type 2 users (super users) will see search results for types 0 AND 1.
    if (req.user.type === 0 || req.user.type === 1) {
      var searchUserType = req.user.type === 1 ? 0 : 1;
      query = { $and : [{ type: searchUserType}, query ]};
    }
  }
  else if (req.query.listener) {
    req.query.listener = req.query.listener.map(function (id) {
      return new ObjectId.createFromHexString(id);
    });
    query = { _id: { $in: req.query.listener }};
  }
  else if (req.query.presenter) {
    req.query.presenter = req.query.presenter.map(function (id) {
      return new ObjectId.createFromHexString(id);
    });
    query = { _id: { $in: req.query.presenter }};
  }
  else{
    Object.each(req.query, function (key, value) {
      let potentialInt = utilities.safeParseInt(value);
      query[key] = potentialInt !== null ? potentialInt : value;
    });
  }

  User.find(query, function (err, users) {
    if (err) {
      res.status(500).json({message: err});
    }
    else {
      res.status(200).json(users.map(projectUser));
    }
  });
}

/* Simple key value pair lookup (for listener's search)*/
function getUsers (req, res) {
  var query = req.query;

  Object.each(query, function (key, value) {
    if (!isNaN(value))
      query[key] = parseInt(value);
  });

  User.find(query, function (err, users) {
    if (err) {
      res.status(500).send();
    }
    else {
      res.status(200).json(users.map(projectUser));
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

  router.route('/api/users/:username')
    .get(getUser);

  router.route('/api/users/:user_id')
    .put(updateUser)
    .delete(deleteUser);
};

