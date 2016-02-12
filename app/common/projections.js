'use strict';

require('sugar');
let ObjectId = require('mongodb').ObjectID;

let projections = module.exports;

projections.currentUser = function (user) {
  let newUser = Object.clone(user, true);

  if (!Object.isString(newUser._id)) {
    let temp = ObjectId(newUser._id.id);
    newUser._id = temp.toHexString();
  }

  return newUser;
};

projections.user = function (user) {
  let newUser = Object.clone(user, true);
  newUser = Object.reject(newUser, ['hash', 'password', 'reEnterPassword']);

  if (!Object.isString(newUser._id)) {
    let temp = ObjectId(newUser._id.id);
    newUser._id = temp.toHexString();
  }

  return newUser;
};


projections.transactor = function (details) {
  var filtered = Object.clone(details, true);

  if (filtered.type === 0) // LISTENER
    filtered.visible.publishableKey = filtered.ss.keys.publishable;

  filtered = Object.reject(filtered, ['ss', '_id']);

  return filtered;
};

projections.card = function (_card) {
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

projections.bankAccount = function (_bankAccount) {
  let result = {type : 1}; //bank account
  result.last4 = _bankAccount.last4;
  result.bankName = _bankAccount.bank_name;
  result.status = _bankAccount.status;
  //result.pmId = _bankAccount.id;
  return result;
};

projections.charge = function (charge) {
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

projections.transfer = function (transfer) {
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
