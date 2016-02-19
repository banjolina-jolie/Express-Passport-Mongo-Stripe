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
  PAYPAL :  3
};

/**
req.body needs to be
 {updates :  {type : paymentMethods.?
              details : {*?*}}
  }

*?* (one of the following payment methods)

Cards
{card: <number>, exp_month: <number>, exp_year: <number>, cvc: <number>, brand : <string>}
Paypal
{email: <string>}

**/

function get(req, res) {
  Transactor.findByUser({ userId : req.params.user_id }, function (err, _transactor) {
    if (err || !_transactor) {
      return res.status(500).send();
    }
    return res.status(200).json(projectTransactor(_transactor));
  });
}


// For adding payment methods
function update(req, res) {
  async.waterfall([
    (cb) => {
      User.findById(req.params.user_id, cb);
    },
    (_user, cb) => {
      if (!_user) {
        return cb(new Error("unable to find user with that id"));
      }
      if (req.body.updates) {
        return Transactor.updatePaymentDetails(_user, req.body.updates, cb);
      }
      return cb(new Error("No details to update Stripe with"));
    }],
    (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }
      if (!result.validation.success) {
        return res.status(422).json({message : result.validation.message});
      }
      return res.status(200).json(projectTransactor(result.transactor));
    });
}

module.exports = function (router) {
  router.route('/api/transactors/:user_id')
    .get(get)
    .put(update);
};
