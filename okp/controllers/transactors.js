"use strict";
let async = require('async');
let logger = require('../common/logger.js').forFile('controllers/transactors.js');
let projectTransactor = require("../common/projections").transactor;
let userTypes = require("../common/constants").userTypes;
let paymentMethods = require("../common/constants").transactorPaymentMethods;
let Transactor = require('../models/transactor');
let User = require('../models/user');

/*
paymentMethods = {
  CARD : 0,
  BANK_ACCOUNT : 2,
  PAYPAL :  3
};

/**
req.body needs to be
 {updates :  {type : paymentMethods.?
              details : {*?*}}
  }

*?* (one of the following payment methods)

Bank accounts (doctors)
{account: <number>,  routing: <number>}
Cards
{card: <number>, exp_month: <number>, exp_year: <number>, cvc: <number>, brand : <string>}
Paypal
{email: <string>}

**/

function get(req, res){
  var params = {userId : req.params.user_id,
                type : req.user.type};


  Transactor.findByUserAndType(params, function(err, _transactor){
    if(err || !_transactor)
      return res.status(500).send();
    return res.status(200).json(projectTransactor(_transactor));
  });
}

function getTransactorForAdmin(req, res) {
  Transactor.findByUserAndType({
    userId : req.params.user_id,
    type : parseInt(req.params.type, 10)
  }, function(error, transactor) {
    if(error) {
      logger.error('Failed to fetch transactor for admin ' + error);
      return res.status(500).send();
    }

    res.status(200).json(projectTransactor(transactor));
  });
}

function getTransactions(req, res) {
  Transactor.getTransactionsByUser(req.params.user_id, (error, transactions) => {
    if(error) {
      logger.error('getTransactions failed with an error ' + error);
      return res.status(500).send();
    }

    res.status(200).json(transactions);
  });
}

// For adding payment methods
function update(req, res){
  console.log("update in controller " + JSON.stringify(req.body) + ' ' + req.params.user_id);
  let incomingType = parseInt(req.body.updates.type);

  if(req.user.type === userTypes.LISTENER && (incomingType === paymentMethods.CARD))
    return res.status(422).json({message : "Unable to add cards to a Listener's (managed) account through the back end -> use Stripe.js"});

  async.waterfall([
    (cb) => {
      User.findById(req.params.user_id, cb);
    },
    (_user, cb) => {
      if(!_user)
        return cb(new Error("unable to find user with that id"));
      if(req.body.updates)
        return Transactor.updatePaymentDetails(_user, req.body.updates, cb);
      return cb(new Error("No details to update Stripe with"));
    }],
    (err, result) => {
      if(err){
        console.log("err " + err);
        return res.status(500).json(err.message);
      }
      if(!result.validation.success){
        return res.status(422).json({message : result.validation.message});
      }
      console.log("response from transactor.update " + JSON.stringify(result));
      return res.status(200).json(projectTransactor(result.transactor));
    });
}

module.exports = function(router){
  router.route('/api/transactors/:user_id')
    .get(get)
    .put(update);

  router.route('/admin/api/transactors/:user_id/transactions')
    .get(getTransactions);

  router.route('/admin/api/transactors/:user_id/:type')
    .get(getTransactorForAdmin);
};
