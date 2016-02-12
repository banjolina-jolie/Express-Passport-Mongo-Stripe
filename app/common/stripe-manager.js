"use strict";

let async = require('async');
let config = require('./config');

let stripe = require("stripe")(config.STRIPE_SECRETKEY);
let userTypes = require('./constants').userTypes;
let projections = require('./projections');
let fees = require('./constants').fees;

stripe.setApiVersion('2015-06-15');

/**
 *  Static for now. In time it may need a more forced singleton pattern.
 */
let StripeManager = module.exports = {};

StripeManager.createAccount = function (_account, userType, done) {

  console.log("createAccount " + JSON.stringify(_account));
  async.waterfall([
    function (callback) {
      if (userType === 0) { // LISTENER
        stripe.accounts.create(_account, callback);
      }
      else if (userType === 1) { // PRESENTER
        stripe.customers.create(_account, callback);
      }
    },
    function (_newStriper, callback) {
      callback(null, _newStriper);
    }],
    function (err, _newStriper) {
      if (err)
        return StripeManager.errorAnalysis(err, done);
      done(null, _newStriper);
    });
};

StripeManager.addCardToPresenter = function (stripeId, cardInfo, done) {
  stripe.customers.createSource(stripeId, {source : cardInfo}, function (err, _response) {
    if (err)
      return StripeManager.errorAnalysis(err, done);
    done(null, _response);
  });
};


StripeManager.addBankAccount = function (transactor, bankInfo, done) {
  let input = {"object" : "bank_account",
               "country": "US",
               "currency" : "usd",
               "legal_entity" : transactor.ss.legal_entity};
  
  let payload = {
    legal_entity: {},
    external_account : Object.merge(input, bankInfo)
  };

  // move DOB and address to top-level user attributes
  if (bankInfo.dob) {
    payload.legal_entity.dob = bankInfo.dob;
    delete bankInfo.dob;
  }
  if (bankInfo.address) {
    payload.legal_entity.address = bankInfo.address;
    delete bankInfo.address;
  }

  StripeManager.addPMToAccount(transactor.ss.stripeId, payload, done);
};

StripeManager.addPMToAccount = function (stripeId, payload, done) {
  async.waterfall([
    function (callback) {
      stripe.accounts.update(stripeId, payload, callback);
    },
    function (_response, callback) {
      callback(null, _response);
    }],
    function (err, response) {
      if (err)
        return StripeManager.errorAnalysis(err, done);
      done(null, response);
    });
};

StripeManager.updateManagedAccount = function (stripeId, update) {
  stripe.accounts.update(stripeId, update);
};

StripeManager.retrieve = function (transactor, done) {
  async.waterfall([
    function (callback) {
      if (transactor.type === 0) // LISTENER
        stripe.accounts.retrieve(transactor.ss.stripeId, callback);
      else
        stripe.customers.retrieve(transactor.ss.stripeId, callback);
    },
    function (_response, callback) {
      callback(null, _response);
    }],
    function (err, response) {
      if (err)
        return StripeManager.errorAnalysis(err, done);
      done(null, response);
    });
};

StripeManager.deleteCustomer = function (transactor, done) {
  stripe.customers.del(transactor.ss.stripeId, (err, confirmation) => {
    if (err)
      return done(err);
    if (!confirmation.deleted)
      return done(new Error("Unable to delete customer " + JSON.stringify(confirmation)));
    done();
  });
};

StripeManager.retrieveTransactions = function (transactor, done) {
  if (!transactor)  {
    return done(null, []);
  }

  if (transactor.type === userTypes.LISTENER) { //receieves money, that means that we transfer money to him
    StripeManager._getTransfers(transactor.ss.stripeId, [], done);
  } else if (transactor.type === userTypes.PRESENTER) { //pays
    StripeManager._getCharges(transactor.ss.stripeId, [], done);
  } else { //super
    return done(null, []);
  }
};

//both _getCharges and _getTransfers are calling themselves as stripe
//results are paginated

StripeManager._getCharges = function (stripeId, buffer, done) {
  stripe.charges.list({
    limit : 100,
    customer : stripeId,
    starting_after : (buffer[buffer.length - 1] || {}).id
  }, (error, result) => {
    if (error) {
      return StripeManager.errorAnalysis(error, done);
    }

    if (result.has_more) {
      return StripeManager._getCharges(stripeId, buffer.concat(result.data), done);
    }

    done(null, buffer.concat(result.data).map(projections.charge));
  });
};

StripeManager._getTransfers = function (stripeId, buffer, done) {
  stripe.transfers.list({
    limit : 100,
    //@XXX destination isnt in api docs but it works, recipient
    //requires recipient id, that can't be extracted from
    //other information
    destination : stripeId,
    starting_after : (buffer[buffer.length - 1] || {}).id
  }, (error, result) => {
    if (error) {
      return StripeManager.errorAnalysis(error, done);
    }

    if (result.has_more) {
      return StripeManager._getTransfers(stripeId, buffer.concat(result.data), done);
    }

    done(null, buffer.concat(result.data).map(projections.transfer));
  });
};

StripeManager.errorAnalysis = function (err, done) {
  console.log(err);
  switch (err.type) {
    case 'StripeCardError':
      // A declined card error
      done(err.message); // => e.g. "Your card's expiration year is invalid."
      break;
    case 'StripeInvalidRequestError':
      done("Invalid parameters were supplied to Stripe's API");
      break;
    case 'StripeAPIError':
      done("An error occurred internally with Stripe's API");
      break;
    case 'StripeConnectionError':
      done("Some kind of error occurred during the HTTPS communication");
      break;
    case 'StripeAuthenticationError':
      done("You probably used an incorrect API key");
      break;
    default:
      done(err);
  }
};

StripeManager.getAccounts = function (done) {
  async.waterfall([
    function (callback) {
      stripe.accounts.list({limit : 30}, callback);
    },
    function (accounts, callback) {
      console.log("accounts count " + accounts.data.length);
      callback();
    }],
    function (err) {
      done(err);
    });
};

StripeManager.charge = function (listenerTransactor, presenterTransactor, meeting, done) {
  let amount = Math.floor((meeting.duration / 60) * meeting.rate * 100),
    meetingDate = new Date(meeting.startTime * 1000);

  stripe.charges.create({
    amount          : amount,
    currency        : 'usd',
    application_fee : Math.floor(amount * fees.ourCut),
    destination     : listenerTransactor.ss.stripeId,
    customer        : presenterTransactor.ss.stripeId,
    description     : 'Payment for meeting on ' +
      meetingDate.getUTCDate() + '.' + meetingDate.getUTCMonth() + '.' + meetingDate.getUTCFullYear(),
    metadata        : {
      meetingId : meeting._id.toString()
    }
  }, (error) => {
    if (error) {
      return StripeManager.errorAnalysis(error, done);
    }

    done();
  });
};
