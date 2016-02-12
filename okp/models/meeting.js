"use strict";

require('sugar');

let async = require('async');
let util = require('util');
let meetingStates = require('../common/constants').meetingStates;
let ObjectId = require('mongodb').ObjectID;
let Seq = require('seq');
let Model = require('./model');

/**
 * Wraps the meetingss table.
 *
 * @return {object}
 *
 * So far the schema is
 *
 * {
    listener: {id: "", username: "", name : "", surname: ""},
    presenter: {id: "", username: "", name : "", surname : ""},
    startTime: Date (unix Timestamp),
    duration: Number (in seconds),
    rate: Number,
    type: Meeting.Type
    state : meetingStates.*
    logs : $entry,
    activityLogs: $entry
    }

    $entry = {message: "", timestamp: , instigator: id},

    settlingLog : [$setleEntry], //information about process of settling a charge

    $settleEntry : {message : "", date : }

 */

let members = ["listener","presenter", "state"];

module.exports = function() {
  this.constructor.super_.call(this, "meetings", members);
};

let Meeting = module.exports;
exports = Meeting;

util.inherits(Meeting, Model);

// You could do some more here
// TODO need to validate the duration of the meeting is within our accepted number of supported durations!
// Validate for timeslot for that presenter and listener, make sure they are not previously booked for something else.
Meeting.prototype.validate = function(_meeting, done){
  // if((_meeting.state === meetingStates.PENDING_ON_PRESENTER_CONFIRM && !_meeting.startTime)|| !_meeting.listener || !_meeting.presenter || !_meeting.rate || !_meeting.duration)
  //   return done(null, {result: false, message : "Listener, presenter, rate, startTime or duration are missing"});
  // if(_meeting.startTime < Date.now()/1000)
  //   return done(null, {result: false, message : "Start time is in the past"});
  done(null, {result :true});
};

Meeting.findById = Model.findById.bind(Meeting);
Meeting.find = Model.find.bind(Meeting);
Meeting.delete = Model.delete.bind(Meeting);
Meeting.create = Model.create.bind(Meeting);
Meeting.update = Model.updateAll.bind(Meeting);
Meeting.updatePush = Model.updatePush.bind(Meeting);
Meeting.findAndModify = Model.findAndModify.bind(Meeting);

Meeting.cancelAllByUser = function(user, message, done){
  let meetings;

  let cancelMeeting = function(meeting, _cb){
    let query = {_id : meeting._id};

    async.waterfall([
      (cb)=>{
        let updates = {$set : {state : meetingStates.CANCELLED}};
        Meeting.update(query, updates, cb);
      },
      (cb)=>{
        let update = {message : message,
                      timestamp : Date.now().getTime(),
                      instigator : user.email};
        let updates = {$push : {"logs" : update}};
        Meeting.update(query, updates, cb);
      }],
      function(err){
        _cb(err);
      });
  };

  async.waterfall([
    (cb) => {
      Meeting.findByUser(user, cb);
    },
    (_meetings, cb) => {
      meetings = _meetings;
      async.series(meetings, cancelMeeting, function(err){
        cb(err);
      });
    }],
    (err) => {
      done(err);
    });
};

Meeting.findByUser = function (user, done) {
  let self = this;
  if(!user)
    return done(new Error(self.name + "findByUser -> no user"));

  var dbQuery = {};
  var handle = user.type === 0 ? 'listener.email' : 'presenter.email';
  dbQuery[handle] = user.email;
  Meeting.find(dbQuery, done);
};

if (require.main === module)
{
  let _user = {};

  Meeting.cancelByUser(_user, function(err, results){
    console.log(err + JSON.stringify(results));
  });
}

Meeting.findUpcomingByUser = function (user, done) {
  let self = this;
  if(!user)
    return done(new Error(self.name + "findByUser -> no user"));

  var dbQuery = {};
  var handle = user.type === 0 ? 'listener.email' : 'presenter.email';
  dbQuery[handle] = user.email;
  
  var now = new Date().getTime() / 1000;
  dbQuery.startTime = { $gt: now };

  Meeting.find(dbQuery, done);
};

Meeting.findActiveByUser = function (user, done) {
  let self = this;
  if(!user)
    return done(new Error(self.name + "findByUser -> no user"));

  var dbQuery = {};
  // set email key
  var handle = user.type === 0 ? 'listener.email' : 'presenter.email';
  dbQuery[handle] = user.email;
  // set arhive key
  var archiveKey = user.type === 0 ? 'listener_archive' : 'presenter_archive';
  dbQuery[archiveKey] = false;
  Meeting.find(dbQuery, done);
};

Meeting.updateActivityLog = function (meetingId, logEntry, done) {
  async.waterfall([
    (cb) => {
      Meeting.findById(meetingId, cb);
    },
    (_meeting, cb) => {
      if(!_meeting)
        return done();
      _meeting.activityLog = _meeting.activityLog || {};
      _meeting.activityLog[logEntry.timestamp] = logEntry.action;
      Meeting.update(meetingId, _meeting, cb);
    }
  ],
  (err) => {
    if(err)
      return done(err);
    done();
  });
};

Meeting.convertEmailtoFullListener = function (newUser, done) {
  var mtgsBeforeSignup = 0;
  let User = require("./user");

  // Change this
  async.waterfall([
    (cb) => {
      Meeting.find({$where: "this.listener.email === '" + newUser.email + "'"}, cb);
    },
    (_meetings, cb) => {
      if(!_meetings || !_meetings.length)
        return cb();
      mtgsBeforeSignup = _meetings.length;
      async.each(_meetings, function (mtg, next) {
        var lID = newUser._id;
        if(!Object.isString(lID))
          lID = new ObjectId(lID.id).toHexString();
        mtg.listener = {
          id: lID,
          username: newUser.username,
          name: newUser.name,
          surname: newUser.surname,
          email: newUser.email
        };
        Meeting.update(mtg._id, mtg, next);
      }, cb);
    },
    (cb) => {
      newUser.mtgsBeforeSignup = mtgsBeforeSignup;
      User.update(newUser._id, newUser, cb);
    }
  ],
  (err) => {
    if(err)
      return done(err);
    done();
  });
};

Meeting.logStartSettleProcess = function(meetingId, done) {
  Meeting.updatePush(meetingId.toString(), 'settlingLog', {
    date : new Date(),
    message : 'Meeting settle process started'
  }, done);
};

Meeting.logSettleAsDone = function(meetingId, done) {
  Meeting.findAndModify({
    _id : new ObjectId(meetingId.toString())
  }, {
    $set : {
      state : meetingStates.PAYMENT_SETTLED
    },
    $push : {
      settlingLog : {
        date : new Date(),
        message : 'Meeting settled'
      }
    }
  }, done);
};

Meeting.logSettleAsFailed = function(meetingId, error, done) {
  Meeting.findAndModify({
    _id : new ObjectId(meetingId.toString())
  }, {
    $set : {
      state : meetingStates.PAYMENT_TROUBLE
    },
    $push : {
      settlingLog : {
        date : new Date(),
        message : 'Meeting settling failed with an error ' + (error.message ? error.message : error)
      }
    }
  }, done);
};
