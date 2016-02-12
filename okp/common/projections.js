'use strict';

require('sugar');
let ObjectId = require('mongodb').ObjectID;

let projections = module.exports;

projections.currentUser = function (user) {
  let newUser = Object.clone(user, true);
  newUser = Object.reject(newUser, ['hash', 'password', 'reEnterPassword']);
  newUser.meta = Object.reject(newUser.meta, ['dob']);

  if(!Object.isString(newUser._id)){
    let temp = ObjectId(newUser._id.id);
    newUser._id = temp.toHexString();
  }

  if (newUser.schedule) {
    delete newUser.schedule._id;
  }

  newUser.isSuper = user.type === 2; // SUPER

  return newUser;
};

projections.user = function (user) {
  let newUser = Object.clone(user, true);
  newUser = Object.reject(newUser, ['hash', 'password', 'reEnterPassword']);
  newUser.meta = Object.reject(newUser.meta, ['dob', 'telephone']);
  newUser.meta.address = Object.reject(newUser.meta.address, ['line1', 'line2', 'postal_code']);

  if(!Object.isString(newUser._id)){
    let temp = ObjectId(newUser._id.id);
    newUser._id = temp.toHexString();
  }

  newUser.isSuper = user.type === 2; // SUPER

  return newUser;
};

projections.meeting = function(meeting) {
  var newMeeting = Object.clone(meeting, true);
  if(!Object.isString(newMeeting._id)){
    var temp = ObjectId(newMeeting._id.id);
    newMeeting._id = temp.toHexString();
  }
  delete newMeeting.activityLog;

  return newMeeting;
};

projections.meetingTimes = function(meeting) {
  var newMeeting = {};
  newMeeting.startTime = meeting.startTime;
  newMeeting.duration = meeting.duration;
  return newMeeting;
};

projections.deal = function(deal) {
  var newDeal = Object.clone(deal, true);
  if(!Object.isString(newDeal._id)){
    var temp = ObjectId(newDeal._id.id);
    newDeal._id = temp.toHexString();
  }
  if (typeof newDeal.presenter === 'object') {
    var presenter = {};
    presenter.id = newDeal.presenter._id;
    presenter.name = newDeal.presenter.name;
    presenter.surname = newDeal.presenter.surname;
    presenter.username = newDeal.presenter.username;
    presenter.jobTitle = newDeal.presenter.meta.jobTitle;
    presenter.employer = newDeal.presenter.meta.employer;
    presenter.city = newDeal.presenter.meta.address.city;
    presenter.state = newDeal.presenter.meta.address.state;
    newDeal.presenter = presenter;
  }
  return newDeal;
};

projections.transactor = function(details) {
  var filtered = Object.clone(details, true);

  if(filtered.type === 0) // LISTENER
    filtered.visible.publishableKey = filtered.ss.keys.publishable;

  filtered = Object.reject(filtered, ['ss', '_id']);

  return filtered;
};

projections.card = function(_card){
  let result = {type : 0}; // card

  result.last4 = _card.last4;
  result.brand = _card.brand;
  result.exp_month = _card.exp_month;
  result.exp_year = _card.exp_year;
  //result.pmId = _card.id;
  /*
  result.cvc_check = _card.cvc_check;
  result.address_line1_check = _card.address_line1_check;
  result.address_zip_check = _card.address_zip_check;
  */
  return result;
};

projections.bankAccount = function(_bankAccount){
  let result = {type : 1}; //bank account
  result.last4 = _bankAccount.last4;
  result.bankName = _bankAccount.bank_name;
  result.status = _bankAccount.status;
  //result.pmId = _bankAccount.id;
  return result;
};

projections.charge = function(charge) {
  return {
    type : 'charge',
    amount : charge.amount,
    refundedAmount : charge.amount_refunded,
    created : new Date(charge.created * 1000),
    currency : charge.currency,
    description : charge.description,
    refunded : charge.refunded
  };
};

projections.transfer = function(transfer) {
  return {
    type : 'transfer',
    amount : transfer.amount,
    amountReversed : transfer.amount_reversed,
    currency : transfer.currency,
    arrivalDate : new Date(transfer.date * 1000),
    created : new Date(transfer.created * 1000),
    status : transfer.status,
    description : transfer.description
  };
};

projections.schedule = function (schedule) {
  var newSchedule = schedule || {};
  return newSchedule;
};
