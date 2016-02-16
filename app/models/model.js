"use strict";
require('sugar');

let events = require('events');
let util = require('util');
let logger = require('../common/logger.js').forFile('core/models/model.js');
let database = require('../common/database.js');

let async = require('async');
let Seq = require('seq');
let ObjectId = require('mongodb').ObjectID;

let Model = module.exports = function (collection) {
  this.db_ = undefined;
  this.collection_ = undefined;
  this.name = collection.singularize().capitalize();
  this.init(collection);
};

util.inherits(Model, events.EventEmitter);

Model.prototype.init = function (collection) {
  let self = this;
  database.connectAndEnsureCollection(collection, function (err, db, coll) {
    if (err) {
      self.emit("error", err);
      return console.log('Unable to connect to database %s', err);
    }
    self.db_ = db;
    self.collection_ = coll;

    if (self.members_) {
      self.createGetters();
    }

    self.emit("ready");
  });
};

Model.prototype.createGetters = function () {
  var self = this;

  function addMethod(key, fn) {
    self[key] = fn;
  }

  self.members_.each(function (member) {
    addMethod("findBy" + Model.capitalize(member), self.baseFind.bind(self, member));
  });
};

Model.prototype.baseFind = function (attr, value, done) {
  var self = this;

  Seq()
    .seq(function () {
      var query = {};
      query[attr] = value;
      self.collection_.findOne(query, this);
    })
    .seq(function (_entity) {
      done(null, _entity);
    })
    .catch(function (err) {
      done(self.name + "" + err.toString());
    });
};

/*
var result  = {result : false,
               message : ""};
*/
Model.prototype.validate = function (entity, done) {
  console.log("No validation method implemented");
  done (null, {result: true});
};

/*\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
//////////////////Static/////////////////
\\\\\\\\\\\\\\\\\\Helpers\\\\\\\\\\\\\\\\
////////////////////////////////////////*/

Model.baseFinder = function (attr, value, done) {
  let child = this;
  let self;


  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      var query = {};
      query[attr] = value;
      self.collection_.find(query).toArray(this);
    })
    .seq(function (_entity) {
      done(null, _entity.first());
    })
    .seq(function (err) {
      done(self.name + "" + err.toString());
    });
};

Model.capitalize = function (input) {
  return input.charAt(0).toUpperCase() + input.slice(1);
};


Model.findById = function (searchId, done) {
  let child = this;
  let self;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      if (Object.isString(searchId)) {
        searchId = new ObjectId.createFromHexString(searchId);
      }
      var query = {
        _id : searchId
      };
      self.collection_.findOne(query, this);
    })
    .seq(function (_entity) {
      done(null, _entity);
    })
    .catch(function (err) {
      done(self.name + "" + err.toString());
    });
};

Model.create = function (entry, done) {
  let child = this;
  let self;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      console.log("validate this " + JSON.stringify(entry));
      self.validate(entry, this);
    })
    .seq(function (validation) {
      if (!validation.result) {
        return done(null, validation);
      }
      self.collection_.insert(entry, this);
    })
    .seq(function (result) {
      done(null, {result : true});
    })
    .catch(function (err) {
      done(self.name + "" + err.toString());
    });
};

Model.find = function (params, done) {
  let child = this;
  let self;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      self.collection_.find(params).limit(100).toArray(done);
    })
    .catch(function (err) {
      done(self.name + "" + err.toString());
    });
};

Model.findOne = function (params, done) {
  let child = this;
  let self;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      self.collection_.findOne(params, done);
    })
    .catch(function (err) {
      done(self.name + "" + err.toString());
    });
};

Model.updateAll = function (id, payload, done) {
  let child = this;
  let self;
  let query;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
         return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      var result = Model.translateObjectId(id);
      if (!result.success)
        return done(new Error("Could not translate id into ObjectId, check arguments supplied"));
      query = {
        _id : result.id
      };
      var updates = {
        $set: Object.reject(payload, ["_id", "id", "isSuper"])
      };
      self.collection_.update(query, updates, this);
    })
    .seq(function () {
      self.collection_.findOne(query, this);
    })
    .seq(function (updated) {
      if (!updated)
        return this(new Error("updated should NOT be null " + JSON.stringify(query)));
      done(null, updated);
    })
    .catch(function (err) {
      done(err);
    });
};


Model.delete = function (id, done) {
  let child = this;
  let self;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      var result = Model.translateObjectId(id);
      if (!result.success)
        return done(new Error("Could not translate id into ObjectId, check arguments supplied"));
      let query = {
        _id : result.id
      };

      self.collection_.remove(query, this);
    })
    .seq(function () {
      done();
    })
    .catch(function (err) {
      done(err);
    });
};

Model.findByAttribute = function (attr, value, done) {
  let child = this;
  let self;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      var query = {};
      query[attr] = value;
      self.collection_.findOne(query, this);
    })
    .seq(function (_entity) {
      done(null, _entity);
    })
    .catch(function (err) {
      done(self.name + "" + err.toString());
    });
};

Model.updateSet = function (key, value, id, done) {
  let child = this;
  let self;

  var result = Model.translateObjectId(id);
  if (!result.success)
    return done(new Error("Could not translate id into ObjectId, check arguments supplied"));

  let query = {_id : result.id};

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
         return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      let updateInternals = {};
      updateInternals[key] = value;
      let updates = {
        $set: updateInternals
      };
      self.collection_.update(query, updates, this);
    })
    .seq(function () {
      self.collection_.findOne(query, this);
    })
    .seq(function (result) {
      done(null, result);
    })
    .catch(function (err) {
      done(self.name + "" + err.toString());
    });
};

Model.updatePush = function (id, key, value, done) {
  let child = this;
  let self;
  let query;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
         return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      var updateInternals = {};
      updateInternals[key] = value;
      let updates = {
        $push: updateInternals
      };

      var result = Model.translateObjectId(id);
      if (!result.success)
        return done(new Error("Could not translate id into ObjectId, check arguments supplied"));

      query = {
        _id : result.id
      };

      self.collection_.update(query, updates, this);
    })
    .seq(function () {
      self.collection_.findOne(query, done);
    })
    .catch(function (err) {
      done(self.name + "" + err.toString());
    });
};

Model.updatePull = function (id, key, valueQuery, done) {
  let child = this;
  let self;
  let query;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
         return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      var updateInternals = {};
      updateInternals[key] = valueQuery;
      let updates = {
        $pull: updateInternals
      };

      var result = Model.translateObjectId(id);
      if (!result.success)
        return done(new Error("Could not translate id into ObjectId, check arguments supplied"));

      query = {
        _id : result.id
      };

      self.collection_.update(query, updates, { multi: true }, this);
    })
    .seq(function () {
      self.collection_.findOne(query, done);
    })
    .catch(function (err) {
      done(self.name + "" + err.toString());
    });
};

Model.findAndModify = function (query, update, done) {
  let child = this;
  let self;

  Seq()
    .seq(function () {
      self = new child();
      self.on("error", function (err) {
         return done(err);
      });
      self.on("ready", this);
    })
    .seq(function () {
      self.collection_.findAndModify(query,
                                     [['_id','asc']],
                                     update,
                                     {},
                                     this);
    })
    .seq(function () {
      self.collection_.findOne(query, done);
    })
    .catch(function (err) {
      done(err);
    });
};

Model.translateObjectId = function (id) {
  try{
    let objectId = new ObjectId.createFromHexString(id.toString());
    return {success : true, id: objectId };
  }
  catch(err) {
    return {success : false};
  }
};

/* Testing paraphernalia */
Model.removeTable = function (table, done) {
  let instance = new Model(table);
  instance.on('ready', () => {
    instance.db_.dropCollection(table, (err) =>{
      done(err);
    });
  });
};

Model.purge = function (done) {
  let tables = ['users', 'schedules', 'meetings', 'transactors'];
  async.each(tables, Model.removeTable, (err) => {
    if (err)
      return done(err);
    done();
  });
};

Model.populate = function (fixtures, done) {
  Object.each(fixtures, (table, tableFixtures) => {
    let instance = new Model(table);
    instance.on('ready', () => {
      instance.collection_.insert(tableFixtures, (err) => {});
    });
    instance.on('error', (err) => {
      done(err);
    });
  });
  done();
};

Model.scaffold = function (fixtures, done) {
  async.waterfall([
    (cb) => {
      Model.purge(cb);
    },
    (cb) => {
      Model.populate(fixtures, cb);
    }],
    (err) => {
      done(err);
    });
};
