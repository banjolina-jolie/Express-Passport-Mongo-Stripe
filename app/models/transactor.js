'use strict';
require('sugar');

let Model = require('./model');
let stripeManager = require('../common/stripe-manager');
let projectBankAccount = require('../common/projections').bankAccount;
let projectCard = require('../common/projections').card;
let transactorTypes = require('../common/constants').transactorTypes;
let paymentMethods = require('../common/constants').transactorPaymentMethods;
let userTypes = require('../common/constants').userTypes;
let async = require('async');
let logger = require('../common/logger.js').forFile('models/transactor.js');
let util = require('util');

/**
This is used as a gateway to do stripe related activites,
it wraps the Transactor table while also providing API for charging cards,
remote payment methods details and so on.
{
  userId: '',
  type: 0|1, => based on User.type,
  logs: [$transactionDetails],
  ss: { stripeId:'acct_' || 'customerID',
         currency: 'usd',
         state: {} => Object used to capture the state of the user's
                       ability to receive or pay.
         //if listener
         keys:{  },
         legal_entity:{  }
        }
  visible: { $filteredAccount}
}


*?* the visible object is created at runtime via the stripe API

**
/*
DEBIT_CARD
*/

/*
  {
    id: 'card_16FljtBkUUc27qiSQyFmo63w',
    object: 'card',
    last4: '4242',
    brand: 'Visa',
    funding: 'credit',
    exp_month: 8,
    exp_year: 2016,
    country: 'US',
    name: 'Jane Austen',
    address_line1: null,
    address_line2: null,
    address_city: null,
    address_state: null,
    address_zip: null,
    address_country: null,
    cvc_check: null,
    address_line1_check: null,
    address_zip_check: null,
    dynamic_last4: null,
    metadata: {}
  }
*/


var members = ['userId'];

module.exports = function () {
  this.constructor.super_.call(this, 'transactors', members);
};

let Transactor = module.exports;

util.inherits(Transactor, Model);

Transactor.prototype.validate = function (entity, done) {
  done(null, {result: true});
};

Transactor.updatePush = Model.updatePush.bind(Transactor);

/**
Static helpers and entry points
**/

members.each(function (member) {
  Transactor['findBy' + Model.capitalize(member)] = Model.baseFinder.bind(Transactor, member);
});

Transactor.findById = Model.findById.bind(Transactor); // id, done);
Transactor.delete = Model.delete.bind(Transactor); // id, done);
Transactor.find = Model.find.bind(Transactor); // params, done);

Transactor.refresh = function (transactor, done) {
  async.waterfall([
    (callback) => {
      stripeManager.retrieve(transactor, callback);
    },
    (stripeDetails, callback) => {
      callback(null, Transactor.populate(transactor, stripeDetails));
    }],
    function (err, populated) {
      if (err) {
        console.log('stripe retrieve error ' + err);
      }
      done(err, populated);
    });
};

Transactor.populate = function (transactor, stripeInfo) {
  transactor.visible.paymentMethods = [];
  if (transactor.type === transactorTypes.RECEIVER) {
    if (stripeInfo.external_accounts.total_count === 0) {
      return transactor;
    }
    stripeInfo.external_accounts.data.each((pm) => {
      if (pm.object === 'bank_account') {
        transactor.visible.paymentMethods.push(projectBankAccount(pm));
      } else { // debit/credit card
       transactor.visible.paymentMethods.push(projectCard(pm));
      }
    });
    transactor.visible.verification = {
      detailsSubmitted: stripeInfo.details_submitted,
      chargesEnabled: stripeInfo.charges_enabled,
      transfersEnabled: stripeInfo.transers_enabled,
      required: stripeInfo.verification
    };
  } else {
    if (stripeInfo.sources.total_count === 0) {
      return transactor;
    }
    if (stripeInfo.sources.total_count > 1) {
      logger.error('This user has two forms of payment ' + transactor._id.toString());
    }
    transactor.visible.paymentMethods.push(projectCard(stripeInfo.sources.data.first()));
    transactor.visible.verification = {active: !stripeInfo.delinquent};
  }
  return transactor;
};

Transactor.addPaymentMethod = function (user, transactor, payload, done) {
  let incomingType = parseInt(payload.type);

  if (incomingType === paymentMethods.CARD) {

    let newCard = {
      object: 'card',
      name: user.name + ' ' + user.last_name,
      currency: 'usd',
      address_country: 'US', /// Hardcoded, US only for now (TODO)
      address_zip: payload.details.postal_code,
      address_line1: payload.details.line1,
      address_line2: payload.details.line2,
      address_state: payload.details.state,
      address_city: payload.details.city,
      number: payload.details.card_number,
      exp_month: parseInt(payload.details.exp_month),
      exp_year: parseInt(payload.details.exp_year),
      cvc: payload.details.cvc
    };

    // Have to assume that it is a Payer.
    stripeManager.addCardToPayer(transactor.ss.stripeId, newCard, done);
  } else if (incomingType === paymentMethods.BANK_ACCOUNT || incomingType === paymentMethods.PAYPAL) {
    // have to assume that it is a Payee
    stripeManager.addBankAccount(transactor, payload.details, function (err, _response) {
      if (err) {
        return done(err);
      }
      done(null, _response.bank_accounts.data);
    });
  }
};

/// Used exclusively in add payment details
Transactor.updatePaymentDetails = function (user, payload, done) {
  let transactor;

  async.waterfall([
    function (callback) {
      Transactor.findByUser({ userId: user._id.toString() }, callback);
    },
    function (_transactor, callback) {
      transactor = _transactor;
      if (transactor.type === transactorTypes.RECEIVER) {
        return callback();
      }
      Transactor.userlaceCustomer(user, transactor, (err, updatedTransactor) => {
        if (err) {
          return callback(err);
        }
        transactor = updatedTransactor;
        callback();
      });
    },
    function (callback) {
      Transactor.addPaymentMethod(user, transactor, payload, callback);
    },
    function (stripeUpdate, callback) {
      Transactor.refresh(transactor, callback);
    },
    function (updatedTransactor, callback) {
      let response = {validation: {success: true}, transactor: updatedTransactor};
      callback(null, response);
    }],
    function (err, result) {
      if (err) {
        logger.warn('Error adding payment Method to transactor ' + err);
        let response = {validation: {success: false, message: err.message || err}};
        return done(null, response);
      }
      logger.info('payment details updated:  ' + user.email + ' payload ' + JSON.stringify(payload));
      done(null, result);
    });
};

Transactor.userlaceCustomer = function (user, transactor, done) {
  async.waterfall([
    (cb) => {
      stripeManager.deleteCustomer(transactor, cb);
    },
    (cb) => {
      let account = Transactor.createAppropriateStripeAccount(user);
      stripeManager.createAccount(account, user.type, cb);
    },
    (_stripeResponse, cb) => {
      Model.updateSet.call(Transactor, 'ss.stripeId', _stripeResponse.id, transactor._id, cb);
    }],
    (err, _transactor) => {
      if (err) {
        return done(err);
      }
      done(null, _transactor);
    });
};

Transactor.create = function (user, ip, done) {
  let entry = Transactor.createEntry(user);
  let stripeResponse;

  if (!user)
    return done('Transactor::Create - What no user ?');

  async.waterfall([
    (callback) => {
      let account = Transactor.createAppropriateStripeAccount(user);
      stripeManager.createAccount(account, user.type, callback);
    },
    (_stripeResponse, callback) => {
      stripeResponse = _stripeResponse;
      entry.ss.stripeId = stripeResponse.id;
      let update = {
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: ip
        },
        metadata: {
          created: Date.create().format('{yyyy}-{MM}-{dd}--{HH}:{mm}')
        }
      };

      Object.merge(entry, update);
      if (entry.type !== transactorTypes.RECEIVER) {
        return callback();
      }
      // otherwise it's a managed account
      entry.ss.keys = stripeResponse.keys;

      stripeManager.updateManagedAccount(stripeResponse.id, update);
      callback();
    },
    (callback) => {
      Model.create.call(Transactor, entry, callback);
    }],
    function (err) {
      if (err) {
        return done(err);
      }
      done(null, Transactor.populate(entry, stripeResponse));
    });
};

Transactor.createEntry = function (user) {
  return {
    userId: user._id.toString(),
    type: user.type,
    logs: [],
    ss: {
      currency: 'usd',
      state: {}
    },
    visible: {}
  };
};

Transactor.createAppropriateStripeAccount = function (_user) {
  if (_user.type === transactorTypes.CUSTOMER) {
    return {
      description: 'AppName user ' + _user.first_name + ' ' + _user.last_name,
      email: _user.email,
      metadata: {
        userId: _user._id.toString(),
        created: Date.create().format('{yyyy}-{MM}-{dd}--{HH}:{mm}')
      }
    };
  }
  // => transactorTypes.receiver || user.listener
  return {
    managed: true,
    country: 'US',
    email: _user.email,
    legal_entity: {
      first_name: _user.name,
      last_name: _user.last_name,
      dob: _user.dob,
      address: _user.address,
      type: 'individual'
    }
  };
};

Transactor.findByUser = function (params, done) {
  async.waterfall([
    function (callback) {
      Transactor.find(params, callback);
    },
    (transactors, callback) => {
      if (transactors.length !== 1)
        return done(new Error('we should only have one Transactor per user ' + JSON.stringify(transactors)));
      Transactor.refresh(transactors.first(), callback);
    }],
    (err, transactor) => {
      done(err, transactor);
    });
};

Transactor.deleteByUser = function (userid, done) {
  let transactor;
  async.waterfall([
    function (callback) {
      Transactor.find({userId: userid}, callback);
    },
    function (transactors, callback) {
      if (transactors.length !== 1)
        return done(new Error('we should only have one Transactor per user ' + JSON.stringify(transactors)));
      transactor = transactors.first();
      if (transactor.type === transactorTypes.RECEIVER) {
        logger.warn('unable to delete the managed account yet, transactorId ' + transactor._id.toString());
        callback();
      } else {
        stripeManager.deleteCustomer(transactor, callback);
      }
    },
    function (callback) {
      Model.updatePush.call(Transactor,
                            transactor._id,
                            'logs',
                            {timestamp: Date.now(),
                             message: 'transactor orphaned due to user account deletion'},
                            callback);
    },
    function (response, callback) {
      Model.updateSet.call(Transactor,
                          'state',
                          Transactor.States.ORPHANED,
                          transactor._id,
                          callback);
    }],
    function (err, response) {
      if (err) {
        console.log('Error deleting transactor ' + err);
        return done(err);
      }
      done();
    });
};


/**
 * Retrieves array of transactions performed for user acount
 *
 * For listeners that is an array with transfers and for presenters
 * it is array with charges
 *
 * @param  {String}   userId
 * @param  {Function} done
 */
Transactor.getTransactionsByUser = function (userId, done) {
  async.waterfall([
    (cb) => {
      Transactor.find({
        userId: userId
      }, (error, result) => {
        if (error) {
          return cb(error);
        }

        cb(null, result[0]);
      });
    },
    stripeManager.retrieveTransactions.bind(stripeManager)
  ], done);
};

Transactor.markPaymentAsFailed = function (userId, eventId, error, done) {
  Transactor.updatePush(userId.toString(), 'logs', {
    timestamp: Date.now(),
    message: 'Failed to charge presenter for ' + eventId + ' because of ' + (error.message ? error.message: error)
  }, done);
};

Transactor.markPaymentAsSent = function (userId, eventId, done) {
  Transactor.updatePush(userId.toString(), 'logs', {
    timestamp: Date.now(),
    message: 'Presenter charged for ' + eventId
  }, done);
};

Transactor.markPaymentAsReceived = function (userId, eventId, done) {
  Transactor.updatePush(userId.toString(), 'logs', {
    timestamp: Date.now(),
    message: 'Listener received money for ' + eventId
  }, done);
};
