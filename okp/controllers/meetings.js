"use strict";
require('sugar');
let _ = require('lodash');
let async = require("async");
let ObjectId = require('mongodb').ObjectID;
let projectMeeting = require('../common/projections').meeting;
let utilities = require("../common/utilities");
let meetingStates = require('../common/constants').meetingStates;
let EmailSender = require('../common/email-engine');

let Seq = require('seq');
let Meeting = require('../models/meeting');
let Transactor = require('../models/transactor');
let User = require('../models/user');
let stripeManager = require('../common/stripe-manager');
let logger = require('../common/logger.js').forFile('api.js');

function getMeeting(req, res){
  Meeting.findById(req.params.meeting_id, function(err, _meeting){
    if(err)
      return res.status(500).send();
    if(!_meeting)
      return res.status(404).send();
    return res.status(200).json(projectMeeting(_meeting));
  });
}

function fetchUserMeetings(user, res){
  Meeting.findByUser(user, function(err, _meetings){
    if(err)
      res.status(500).json({message : err});
    else
      res.status(200).json(_meetings.map(projectMeeting));
  });
}

// This method is used from both the site and the admin panel
// Search on the site -> no params -> returns all meetings that to do with that req.user
// Search on the admin panel -> {key : value.....}, exact find using key value pairs
function searchMeetings(req, res){
  // Handle the simple use case
  if(!req.query || Object.size(req.query) === 0){
    fetchUserMeetings(req.user, res);
  }
  else{
    let query = {};
    Object.each(req.query, function(key, value){
      //if multiple values are supplied then query parser will put them in array
      //it means `or` clause between values
      if(Array.isArray(value)) {
        query[key] = {
          $in : value.map((v) => {
            let potentialInt = utilities.safeParseInt(v);
            return potentialInt !== null ? potentialInt : v;
          })
        };
      } else {
        let potentialInt = utilities.safeParseInt(value);
        query[key] = potentialInt !== null ? potentialInt : value;
      }
    });

    Meeting.find(query, function (err, meetings) {
      if(err) {
        res.status(500).json({message: err});
      }
      else {
        res.status(200).json(meetings.map(projectMeeting));
      }
    });
  }
}

function createMeeting(req, res){
  Seq()
    .seq(function(){
      var pID = req.user._id;
      if(!Object.isString(pID))
        pID = new ObjectId(pID.id).toHexString();
      
      req.body.presenter = {username: req.user.username, email: req.user.email};
      req.body.presenter_archive = false;
      Meeting.create(req.body, this);
    })
    .seq(function(){
      // done
      res.status(201).json(projectMeeting(req.body));
    })
    .catch(function(err){
      res.status(500).json({message: err});
    })
    ;
}

function deleteMeeting(req, res){
  Meeting.delete(req.params.meeting_id, function(err){
    if(err){
      return res.status(500).send();
    }
    return res.status(200).send();
  });
}

function updateMeeting(req, res){
  Seq()
    .seq(function(){
      Meeting.findById(req.params.meeting_id, this);
    })
    .seq(function(_meeting){
      if(!_meeting)
        return res.status(400).json({error :"no meeting with that id"});
      let emailManager = new EmailSender();

      if (req.body.new_message_for_listener || req.body.new_message_for_presenter) {
        emailManager.sendMsgReceivedEmail(req.body);
      }

      if (req.body.startTime && _meeting.startTime !== req.body.startTime) {
        emailManager.sendMtgTimeChangedEmail(req.body);
      }

      Meeting.update(req.params.meeting_id, req.body, this);
    })
    .seq(function(_updatedMeeting){
      res.status(200).json(projectMeeting(_updatedMeeting));
      this();
    })
    .catch(function(err){
      res.status(500).json({error : err});
    })
    ;
}

function logMeetingActivity(req, res){
  Seq()
    .seq(function(){
      Meeting.findById(req.params.meeting_id, this);
    })
    .seq(function(_meeting){
      if(!_meeting)
        return res.status(400).json({error :"no meeting with that id"});
      Meeting.updateActivityLog(req.params.meeting_id, req.body, this);
    })
    .seq(function(){
      res.status(200).json({});
      this();
    })
    .catch(function(err){
      res.status(500).json({error : err});
    })
    ;
}

function checkListener(req, res) {
  let meetingId = req.body.meetingId;
  let listenerEmail = req.body.listenerEmail;
  
  async.waterfall([
    function (cb) {
      Meeting.findById(meetingId, cb);
    },
    function (_meeting) {
      if (_meeting && _meeting.listener.email === listenerEmail) {
        res.send(projectMeeting(_meeting));
      } else {
        res.status(403).send({error: "Email does not match"});
      }
    }],
    function(err){
      if(err)
        return res.status(500).send({error: err});
    });
}

function nonAuthUpdateMtg(req, res) {
  req.body.meeting = JSON.parse(req.body.meeting);

  Seq()
    .seq(function(){
      Meeting.findById(req.params.meeting_id, this);
    })
    .seq(function(_meeting){
      if(!_meeting)
        return res.status(400).json({error :"no meeting with that id"});

      if (_meeting.listener.email !== req.body.listenerEmail) {
        return res.status(400).json({error: "invalid listener email"});
      }
      
      let emailManager = new EmailSender();
      if (req.body.meeting.new_message_for_listener || req.body.meeting.new_message_for_presenter) {
        emailManager.sendMsgReceivedEmail(req.body.meeting);
      }
      if (req.body.meeting.startTime && _meeting.startTime !== req.body.meeting.startTime) {
        emailManager.sendMtgTimeChangedEmail(req.body.meeting);
      }

      Meeting.update(req.params.meeting_id, req.body.meeting, this);
    })
    .seq(function(_updatedMeeting){
      res.status(200).json(projectMeeting(_updatedMeeting));
      this();
    })
    .catch(function(err){
      res.status(500).json({error : err});
    })
    ;
}

function settle(req, res) {
  let meetingId = req.params.meetingId;

  async.auto({
    meeting : (cb) => {
      Meeting.findById(meetingId, (error, meeting) => {
        if(error) {
          return cb(error);
        }

        if(!meeting) {
          return cb(new Error('Could not find meeting'));
        }

        if(meeting.state !== meetingStates.NEEDS_PAYMENT &&
          meeting.state !== meetingStates.PAYMENT_TROUBLE) {
          return cb(new Error('This meeting cannot be settled, the meeting state is ' + meeting.state));
        }

        cb(null, meeting);
      });
    },
    markStart : ['meeting', Meeting.logStartSettleProcess.bind(Meeting, meetingId)],
    listenerTransactor  : ['markStart', (cb, results) => {
      Transactor.findByUserId(results.meeting.listener.id, cb);
    }],
    presenterTransactor : ['markStart', (cb, results) => {
      Transactor.findByUserId(results.meeting.presenter.id, cb);
    }],
    createCharge : ['listenerTransactor', 'presenterTransactor', (cb, results) => {
      stripeManager.charge(results.listenerTransactor, results.presenterTransactor, results.meeting, cb)
    }]
  }, (error, results) => {

    if(error && results.meeting) {
      logger.error('Meeting exists but could not settle it ' + error);

      async.parallel({
        logPresenter : Transactor.markPaymentAsFailed.bind(Transactor, results.presenterTransactor._id, results.meeting._id, error),
        updatedMeeting : Meeting.logSettleAsFailed.bind(Meeting, results.meeting._id, error)
      }, (error, results) => {

        if(error) {
          logger.error('Failed to execute failure path for settlement ' + error);
        }

        res.status(500).json({
          success : false,
          meeting : results.updatedMetting
        }); //500 is sent anyway because transaction itself failed
      });
    } else if(!error) {
      logger.info('Settlement created for ' + meetingId);

      async.parallel({
        logPresenter   : Transactor.markPaymentAsSent.bind(Transactor, results.presenterTransactor._id, results.meeting._id),
        logListener    : Transactor.markPaymentAsReceived.bind(Transactor, results.listenerTransactor._id, results.meeting._id),
        updatedMetting : Meeting.logSettleAsDone.bind(Meeting, results.meeting._id)
      }, (error, results) => {
        if(error) {
          logger.error('Failed to execute success path for settlement ' + error);
          //it is success or not? payment is made but update didn't succeed
          return res.status(500).json({success : 'FileNotFound'});
        }

        res.status(200).json({
          success : true,
          meeting : results.updatedMetting
        }); //@XXX send 200 or 500 even if logging fails?
      });
    } else {
      logger.error('Failed to create a charge ' + error);
      res.status(500).json({
        success : false
      });
    }
  });
}

function createInvite(_mtg, presenter, done){
  var listenerEmail = _mtg.listener;

  Seq()
    .seq(function(){
      var pID = presenter._id;
      if(!Object.isString(pID)) {
        pID = new ObjectId(pID.id).toHexString();
      }
      // stripped down presenter
      var strippedP = {name : presenter.name,
                       surname : presenter.surname,
                       username : presenter.username,
                       email : presenter.email,
                       id : pID,
                       employer: presenter.meta.employer
                      };
      // Start building _mtg
      _mtg.presenter = strippedP;
      _mtg.presenter_archive = false;
      _mtg.listener_archive = false;

      // check if email belongs to existing user
      User.findOne({email: listenerEmail}, this);
    })
    .seq(function(_user){
      if (_user) {
        var lID = _user._id;
        if(!Object.isString(lID))
        lID = new ObjectId(lID.id).toHexString();
        // change listener to an object
        _mtg.listener = {
          id: lID,
          username: _user.username,
          name: _user.name,
          surname: _user.surname,
          email: _user.email
        };
      } else {
        _mtg.listener = { email: listenerEmail };
      }
      Meeting.create(_mtg, this);
    })
    .seq(function (result) {
      // invite projection works for both meetings and invites (basically just need to stringify the _id)
      let mtg = projectMeeting(_mtg);
      let emailManager = new EmailSender();
      // send emails
      emailManager.sendExistingListenerInviteEmail(listenerEmail, mtg, function(err){
        if(err){
          logger.warn('Unable to send meeting invite email. ' + err + ' \n user : ' + listenerEmail);
        }
      });
      // done
      if(!result.result)
        return done(null, result);
      done(null, _mtg);
    })
    .catch(function(err){
      done(err);
    })
    ;
}

function batchCreateInvites(req, res){
  if(!req.body.options)
    return res.status(422).send({message: 'no options object in request body'});
  
  let meetingsCreated = [];
  let options = req.body.options;
  // create invites objects from email list
  let invites = options.emails.map(function(email){
    var invite = _.extend({}, options);
    invite.listener = email;
    delete invite.emails;
    return invite;
  });
  
  async.each(invites, function (invite, next) {
    createInvite(invite, req.user, function(err, newlyCreated){
      if(err)
        return next(err);
      meetingsCreated.push(newlyCreated);
      next();
    });
  }, function (err) {
    if (err) {
      res.status(500).json({message: err});
    } else {
      res.status(201).json({
        meetings: meetingsCreated.map(projectMeeting),
      });
    }
  });
}

module.exports = function(router) {
  router.route('/checkListener')
    .post(checkListener);

  router.route('/api/meetings')
    .post(createMeeting);

  router.route('/api/invites')
    .post(batchCreateInvites);

  router.route('/api/meetings/search')
    .get(searchMeetings);

  router.route('/meetings/:meeting_id')
    .put(nonAuthUpdateMtg);

  router.route('/api/meetings/:meeting_id')
    .get(getMeeting)
    .put(updateMeeting)
    .delete(deleteMeeting);

  router.route('/api/meetings/logActivity/:meeting_id')
    .post(logMeetingActivity);

  router.route('/admin/api/meetings/settle/:meetingId')
    .get(settle);
};

if (require.main === module)
{
  var payload = {listener : '55303a1cb0a79c51bfeb7d3e',
                 presenter : '55534fc607791c7431942364',
                 duration : 3600,
                 startTime : 1434675831,
                 cost : 100};

  createMeeting(payload, function(err){
    if(err)
      return console.log("issues " + err);
    console.log( "all good ?");
  });
}

