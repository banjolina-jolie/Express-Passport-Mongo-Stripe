'use strict';

let fs = require('fs');
let config = require('./config.js');
let events = require('events');
let logger = require('./logger.js').forFile('email-engine.js');
let util = require('util');
let _ = require('lodash');

let SendGrid = require('sendgrid');

let EmailEngine = module.exports = function () {
  this.sendgrid_ = null;
  this.init();
};

util.inherits(EmailEngine, events.EventEmitter);

EmailEngine.prototype.init = function () {
  let self = this;
  self.sendgrid_ = new SendGrid(config.SENDGRID_USER, config.SENDGRID_KEY);
};

EmailEngine.prototype.sendValidationEmail = function (user, done) {
  let self = this;
  let subject = 'Thanks for signing up with AppName! Complete your registration here.';
  let message = util.format('Please go to %s/validator?token=%s to validate your email.', config.FE_URL, user.validation.token);

  let email = new self.sendgrid_.Email();

  email.addTo(user.email);
  email.setFrom('accounts@app_name.com');
  email.setSubject(subject);
  email.setText(message);
  email.addHeader('X-Sent-Using', 'SendGrid-API');
  email.addHeader('X-Transport', 'web');
  self.sendgrid_.send(email,
                      function (err, msg) {
                        if (err) {
                          logger.warn('Didn\'t get a valid response from the SendGrid servers ' + err + '\nto : ' + user.email);
                          done(err);
                        }
                        else
                          logger.info('successfully sent validation email ' + JSON.stringify(msg));
                          done();
                      });


  // email Dylan when a new user signs up
  let internalNotif = new self.sendgrid_.Email();
  internalNotif.addTo('dylan@app_name.com');
  internalNotif.setFrom('signups@app_name.com');
  internalNotif.setSubject('New User Signup');
  internalNotif.setText(user.name + ' ' + user.last_name + ' ' + user.email + ' ' + user.meta.jobTitle + ' ' + user.meta.employer);
  internalNotif.addHeader('X-Sent-Using', 'SendGrid-API');
  internalNotif.addHeader('X-Transport', 'web');
  self.sendgrid_.send(internalNotif,
                      function (err, msg) {
                        if (err) {
                          logger.warn('Didn\'t get a valid response from the SendGrid servers ' + err + '\nto : internal notif email');
                        }
                        else
                          logger.info('successfully sent internal notification email ' + JSON.stringify(msg));
                      });
};

EmailEngine.prototype.sendSupportEmail = function (body, done) {
  let self = this;
  let subject = 'Support Email';
  let message = util.format('%s %s %s', body.name, body.email, body.content);

  let email = new self.sendgrid_.Email();

  email.addTo('dylan@app_name.com');
  email.setFrom('contactUs@app_name.com');
  email.setSubject(subject);
  email.setText(message);
  email.addHeader('X-Sent-Using', 'SendGrid-API');
  email.addHeader('X-Transport', 'web');
  self.sendgrid_.send(email,
                      function (err, msg) {
                        if (err) {
                          logger.warn('Didn\'t get a valid response from the SendGrid servers ' + err + '\nto : dylan@app_name.com');
                          done(err);
                        }
                        else
                          logger.info('successfully sent support email ' + JSON.stringify(msg));
                          done();
                      });
};

function sendInviteEmail(content, address, done) {
  let self = this;
  let email = new self.sendgrid_.Email();

  email.addTo(address);
  email.setFrom('notifications@app_name.com');
  email.setFromName('AppName');
  email.setSubject(content.subject);
  email.setHtml(content.template);
  email.addHeader('X-Sent-Using', 'SendGrid-API');
  email.addHeader('X-Transport', 'web');
  self.sendgrid_.send(email,
                      function (err, msg) {
                        if (err) {
                          logger.warn('Didn\'t get a valid response from the SendGrid servers ' + err + '\nto : ' + address);
                          done(err);
                        }
                        else
                          logger.info('successfully sent invitation email ' + JSON.stringify(msg));
                          done();
                      });
}

function buildInviteEmailContent(template, mtg, listenerExists) {
  let budget = (mtg.duration / 60) * mtg.rate;
  let presenterName = mtg.presenter.name;
  let employer = mtg.presenter.employer;
  let subject;

  if (Number(mtg.rate)) {
    subject = presenterName + ' from ' + employer + ' would like to meet with you on AppName. Earn $' + budget + ' for attending the meeting!';
  } else {
    subject = presenterName + ' from ' + employer + ' would like to meet with you on AppName';
  }
  
  template = util.format(template, mtg.messages[0].text, config.FE_URL, mtg._id, mtg.listener.email);

  return {
    subject: subject,
    template: template
  };
}

EmailEngine.prototype.sendNewListenerInviteEmail = function (address, mtg, done) {
  let template = fs.readFileSync(__dirname + '/../email_templates/inviteNewListener.html', 'utf8');
  let content = buildInviteEmailContent(template, mtg);
  sendInviteEmail.call(this, content, address, done);
};

EmailEngine.prototype.sendExistingListenerInviteEmail = function (address, mtg, done) {
  let template = fs.readFileSync(__dirname + '/../email_templates/inviteExistingListener.html', 'utf8');
  let content = buildInviteEmailContent(template, mtg, true);
  sendInviteEmail.call(this, content, address, done);
};

EmailEngine.prototype.sendMsgReceivedEmail = function (mtg) {
  let sender = mtg.new_message_for_presenter ? 'listener' : 'presenter';
  let receiver = mtg.new_message_for_presenter ? 'presenter' : 'listener';
  let subjectName = mtg[sender].name || mtg[sender].email;

  let template = fs.readFileSync(__dirname + '/../email_templates/messageReceived.html', 'utf8');
  template = util.format(template, _.last(mtg.messages).text, config.FE_URL, mtg.id);
  let self = this;
  let email = new self.sendgrid_.Email();

  email.addTo(mtg[receiver].email);
  email.setFrom('notifications@app_name.com');
  email.setFromName('AppName');
  email.setSubject('New message from ' + subjectName);
  email.setHtml(template);
  email.addHeader('X-Sent-Using', 'SendGrid-API');
  email.addHeader('X-Transport', 'web');
  self.sendgrid_.send(email,
                      function (err, msg) {
                        if (err) {
                          logger.warn('Didn\'t get a valid response from the SendGrid servers ' + err + '\nto : ' + receiver.address);
                        }
                        else
                          logger.info('successfully sent invitation email ' + JSON.stringify(msg));
                      });
};

EmailEngine.prototype.sendMtgTimeChangedEmail = function (mtg) {
  let sender = Number(mtg.state) === 0 ? 'presenter' : 'listener';
  let receiver = Number(mtg.state) === 0 ? 'listener' : 'presenter';
  let subjectName = mtg[sender].name || mtg[sender].email;


  let template = fs.readFileSync(__dirname + '/../email_templates/meetingTimeChanged.html', 'utf8');
  template = util.format(template, config.FE_URL, mtg.id);
  let self = this;
  let email = new self.sendgrid_.Email();
  email.addTo(mtg[receiver].email);
  email.setFrom('notifications@app_name.com');
  email.setFromName('AppName');
  email.setSubject(subjectName + ' is requesting a new start time');
  email.setHtml(template);
  email.addHeader('X-Sent-Using', 'SendGrid-API');
  email.addHeader('X-Transport', 'web');
  self.sendgrid_.send(email,
                      function (err, msg) {
                        if (err) {
                          logger.warn('Didn\'t get a valid response from the SendGrid servers ' + err + '\nto : ' + receiver.address);
                        }
                        else
                          logger.info('successfully sent meeting time changed email ' + JSON.stringify(msg));
                      });
};
