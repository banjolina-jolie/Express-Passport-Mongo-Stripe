"use strict";

let async = require('async');
let util = require('util');


let Seq = require('seq');
let Model = require('./model.js');

/**
 * Wraps the schedule table.
 *
 * @return {object}
 *
 * So far the schema is
 *
 * {
    user : {id:, type: },
    availability : {
      1200am: {
        monday: true,
        tues: false,
        ...
      },
      1230am: {
        ...
      }
     }
    }
 */


module.exports = function() {
  this.constructor.super_.call(this, "schedules", []);
};

let Schedule = exports = module.exports;

util.inherits(Schedule, Model);

Schedule.findById = Model.findById.bind(Schedule);
Schedule.find = Model.find.bind(Schedule);

var week = {
	monday : false,
	tuesday : false,
	wednesday : false,
	thursday : false,
	friday : false,
	saturday : false,
	sunday : false
};

var weekWithAvailableWkdays = {
  monday : true,
  tuesday : true,
  wednesday : true,
  thursday : true,
  friday : true,
  saturday : false,
  sunday : false
};

// TODO more than likely you could use the base finder cleverly here
Schedule.findByUser = function(user, done){
  var self;
  Seq()
    .seq(function(){
      self = new Schedule();
      self.on("error", function(err){
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function(){
      var userId = user._id.toString();
      var query = {$where: "this.user.id === '" + userId + "'"};
      self.collection_.findOne(query, done);
    })
    .catch(function(err){
      done(err);
    })
    ;
};


Schedule.updateByUser = function(user, done){
  var self;
  Seq()
    .seq(function(){
      self = new Schedule();
      self.on("error", function(err){
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function(){
      var userId = user._id.toString();
      var query = {$where: "this.user.id === '" + userId + "'"};
      self.collection_.update(query, {$set : {availability : user.schedule}}, this);
    })
    .seq(function(){
      done();
    })
    .catch(function(err){
      done(err);
    })
    ;
};

// Static helpers
Schedule.createBlank = function(user, done){
  var self;
  Seq()
    .seq(function(){
      self = new Schedule();
      self.on("error", function(err){
        return done(err);
      });
      self.on("ready", this);
    })
    .seq(function(){
      var timeline = {};
      var counter = 12;

      for(var i = 0; i < 25; i++){
        var hour = counter++ % 13;
        var splits = i > 12 ? 'pm' : 'am';

        if(hour !== 12)
          hour += 1;

      	timeline[hour+'00' + splits] = (i > 9 && i < 19 && i !== 12) ? weekWithAvailableWkdays : week;
      	timeline[hour+'30' + splits] = (i > 9 && i < 19 && i !== 12) ? weekWithAvailableWkdays : week;
      }
      var schedule = {user : {id : user._id.toString(),
                              type : user.type},
      								availability : timeline};
     	self.collection_.insert(schedule, this);
    })
    .seq(function(){
      done();
    })
    .catch(function(err){
      done(err);
    })
    ;
};

Schedule.deleteByUser = function(userId, done){
  async.waterfall([
    function(callback){
      Schedule.findByUser(userId, callback);
    },
    function(_schedule, callback){
      Model.delete.call(Schedule, _schedule._id, callback);
    }],
    function(err){
      done(err);
    });
};

