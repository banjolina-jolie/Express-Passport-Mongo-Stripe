"use strict";

let async = require('async');
let bcrypt = require('bcrypt');
let crypto = require('crypto');
let logger = require('../common/logger.js').forFile('models/user.js');
let util = require('util');

let constants = require('../common/constants');
let EmailSender = require('../common/email-engine');
let Model = require('./model');
let Seq = require('seq');
let Storage = require('../common/storage');
let Transactor = require('./transactor');
/**
 * Wraps the users table.
 *
 * @return {object}
 *
 * So far the schema is
 *
 * {name: "",
    username: ""
    email: "" (*unique),
    hash: password hashed,
    state: constants.userStates.*
    last_name: ""
    type: constants.userTypes.*,
    metadata: {professions: [{ name: "Physician",
                                 speciality: {name: "", subSpecialities: []}]
                education: [{university: ""
                              qualification: ""}]
                employment: {title: ""
                              employer: ""}
                telephone: {region: 'us'|?,
                            areaCode: [0-9]*,
                            number: [0-9]*}
                address: ""
                bio: ""
                picture: "",
                price: {rate: X,
                         currency: $CurrencyCode},
                ratings: [ {rater: email,
                            createdAt: date,
                            rating: user.Rating}]

              }
    validation: {createdAt: ts
                  token: "" }
    }
 **/

let members = ["email","username"];

module.exports = function () {
  this.name = "User";
  this.constructor.super_.call(this, "users", members);
};

let User = module.exports;

util.inherits(User, Model);

// TODO needs testing
User.prototype.ratings = function () {
  let self = this;
  let figures = self.ratings.map(function (rating) {
    return rating.rating;
  });
  return figures.average();
};

User.prototype.validate = function (_user, done) {
  let self = this;

  Seq()
    .seq(function () {
      if (!_user.email || !_user.name || !_user.password) {
        let result  = {
          result: false,
          message: "New users need at least a name, email, password and a type"
        };
        return done(null, result);
      }
      this();
    })
    .seq(function () {
      let query  = {$or: [{email: _user.email}, {username: _user.username}]};
      self.collection_.findOne(query, this);
    })
    .seq(function (previous) {
      if (previous) {
        let result  = {result: false,
                       message: "We already have a user with this same email or username"};
        return done(null, result);
      }
      done(null, {result: true});
    })
    .catch(function (err) {
      done(err);
    })
    ;
};

User.prototype.addRatings = function (rating, done) {
  let self = this;
  // TODO validate rating range (with regards enum)
  // Can the same 'rater' give ratings twice to the same person.
  // I would think not, Validations needed here.

  rating["createdAt"] = Date.now();

  let query = {
    email: self.email
  };

  // TODO - what is this ?
  let updates = {
    $push: { 'metadata.ratings': {}}
  };

  self.collection_.update(query, updates, done);

};

/**
Static helpers and entry points
**/

members.each(function (member) {
  User["findBy" + Model.capitalize(member)] = Model.baseFinder.bind(User, member);
});

User.findById = Model.findById.bind(User); // id, done);
User.find = Model.find.bind(User); // params, done);
User.findOne = Model.findOne.bind(User); // params, done);

User.findByToken = Model.findByAttribute.bind(User, "validation.token"); // $token, done);
User.verifyEmail = Model.updateSet.bind(User, 'state', constants.userStates.NEEDSREVIEW); // _id, done);
User.changeState = Model.updateSet.bind(User, 'state'); //state, done);

User.addSlideshow = function (userId, slideshow, done) {
  Model.updatePush.call(User, userId, "slideshows", slideshow, done);
};

User.removeSlideshow = function (userId, slideshowId, done) {
  Model.updatePull.call(User, userId, "slideshows", {id: slideshowId}, done);
};

User.delete = function (userId, done) {
  let user;
  async.waterfall([
    function (callback) {
      User.findById(userId, callback);
    },
    function (_user, callback) {
      user = _user;
      if (_user.type !== constants.userTypes.LISTENER) {
        return callback();
      }
      Schedule.deleteByUser(userId, callback);
    },
    function (callback) {
      Transactor.deleteByUser(userId, callback);
    },
    function (callback) {
      // TODO:
      //Meeting.cancelAllByUser(user, "User was deleted", callback);
      callback();
    },
    function (callback) {
      Model.delete.call(User, userId, callback);
    }],
    function (err) {
      done(err);
    });
};

// Backend API (PUT -> users/:user_id)
User.update = function (id, update, done) {
  Seq()
    .seq(function () {
      if (!!update.meta.picture) {
        User.saveProfileImage(id, update.meta.picture, this);
      }
      else
        this();
    })
    .seq(function () {
      update.meta = Object.reject(update.meta, "picture");
      if (!update.schedule) {
        return this();
      }
      update._id = id;
      Schedule.updateByUser(update, this);
    })
    .seq(function () {
      if (!update.newPassword)
        return this();
      User.changePassword(id, update, function (err, result) {
        if (err)
          return this(err);
        if (!result.success) {
          console.log("no joy updating password");
          return done(null, result);
        }
        this();
      }.bind(this));
    })
    .seq(function () {
      let rejects = [
        "id",
        "completions",
        "showCompletions",
        "password",
        "reEnterPassword",
        "newPassword",
        "oldPassword"
      ];
      let payload = Object.reject(update, rejects);
      Model.updateAll.call(User, id, payload, this);
    })
    .seq(function (updated) {
      updated._id = id;
      updated.schedule = update.schedule;
      updated.meetings = update.meetings;
      done(null, {success: true, updated: updated});
    })
    .catch(function (err) {
      done(err);
    });
};

User.saveProfileImage = function (userId, image, done) {
  let storage;
  Seq()
    .seq(function () {
      let that = this;
      storage = new Storage("appBucket");
      storage.on("error", function (err) {
        that(err);
      });
      storage.on("ready", function () {
        that();
      });
    })
    .seq(function () {
      storage.put(userId + '/profile_pic', image, done);
    })
    .catch(function (err) {
      done(err);
    });
};

User.changePassword = function (id, update, done) {
  async.waterfall([
    function (callback) {
      User.findById(id, callback);
    },
    function (_user, callback) {
      bcrypt.compare(update.oldPassword, _user.hash, callback);
    },
    function (matches, callback) {
      if (!matches) {
        return done(null, {success: false,  message: 'Old passwords do not match' });
      }
      User.hashPassword(update.newPassword, callback);
    },
    function (hashedNew, callback) {
      Model.updateSet.call(User, "hash", hashedNew, id, callback);
    }],
    function (err) {
      if (err) {
        done(err);
      }
      done(null, {success: true});
    });
};

User.Create = function (_user, ip, done) {
  let self;
  let user = {};

  if (!_user.email) {
    return done(null, {
      result: false,
      message: 'New users need at least an email'
    });
  }

  _user.email = _user.email.toLowerCase();

  Seq()
    .seq(function () {
      self = new User();
      self.on("error", function (err) {
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      self.validate(_user, this);
    })
    .seq(function (validation) {
      if (!validation.result) {
        return done(null, validation);
      }
      _user.created = Date.now();
      User.hashPassword(_user.password, this);
    })
    .seq(function (_hash) {
      user = Object.reject(_user, ['password', 'completions', 'showCompletions', 'reEnterPassword']);
      user.hash = _hash;
      user.tos_acceptance = {
        date: Math.floor(Date.now() / 1000),
        ip: ip
      };

      let shasum = crypto.createHash('sha1');
      shasum.update(user.email+Date.now());

      user.validation = {createdAt: Date.now(),
                         token: shasum.digest('hex')};

      user.state = constants.userTypes.NEEDS_EMAIL_VERIFICATION;
      
      // Insert into Mongo
      self.collection_.insert(user, this);
    })
    .seq(function () {
      let emailManager = new EmailSender();
      let that = this;
      emailManager.sendValidationEmail(user, function (err) {
        if (err) {
          logger.warn("Unable to send validation emails " + err + " \n user: " + user.email);
          return that();
        }
        var query = { email: user.email };
        var update = {
          $set: {
            state: constants.userStates.AWAITS_EMAIL_VERIFICATION
          }
        };
        self.collection_.update(query, update, function (err) {
          that(err);
        });
      });
    })
    .seq(function () {
      self.collection_.findOne({email: user.email}, this);
    })
    .seq(function (_user) {
      user =_user;
      Transactor.create(user, ip, this);
    })
    .seq(function (_transactor) {
      Schedule.createBlank(user, this);
    })
    .seq(function () {
      logger.info(util.format("created user %s, request ip %s", JSON.stringify(_user), ip));
      done(null, {result:true, user: user});
    })
    .catch(function (err) {
      done(err);
    });
};

User.canLogIn = function (user, forAdmin) {
  if (user.state === constants.userStates.DELETED) {
    return {result: false, message: "User has been deleted"};
  } else if (user.state === constants.userStates.SUSPENDED) {
    return {result: false, message: "User has been suspended"};
  }
  return {result: true};
};

User.hashPassword = function (password, callback) {
  bcrypt.genSalt(10, function (err, salt) {
    if (err) {
      return callback(err);
    }
    bcrypt.hash(password, salt, callback);
  });
};

