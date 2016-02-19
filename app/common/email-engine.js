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
  self.sendgrid_.send(email, function (err, msg) {
    if (err) {
      logger.warn('Didn\'t get a valid response from the SendGrid servers ' + err + '\nto : ' + user.email);
      done(err);
    } else {
      logger.info('successfully sent validation email ' + JSON.stringify(msg));
      done();
    }
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
  self.sendgrid_.send(email, function (err, msg) {
    if (err) {
      logger.warn('Didn\'t get a valid response from the SendGrid servers ' + err + '\nto : dylan@app_name.com');
      done(err);
    } else {
      logger.info('successfully sent support email ' + JSON.stringify(msg));
      done();
    }
  });
};
