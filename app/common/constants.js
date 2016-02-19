"use strict";

let Constants = module.exports = {};

/**
USER
**/
Constants.userStates = {
	ACTIVE : 0,
  NEEDS_EMAIL_VERIFICATION : 1,
  AWAITS_EMAIL_VERIFICATION : 2,
  NEEDSREVIEW: 3,
	SUSPENDED : 4,
  ERRORED : 5,
  LOGGEDOUT : 6,
  DELETED : 7
};

Constants.userTypes = {
	PAYEE : 0,
	PAYER : 1,
  SUPER : 2
};

Constants.userRating = {
  UNRATED : 0,
  ONESTAR : 1,
  TWOSTAR : 2,
  THREESTAR : 3,
  FOURSTAR : 4,
  FIVESTAR : 5
};


/**
TRANSACTOR
**/
Constants.transactorTypes = {
  RECEIVER : 0, // => Payee => Stripe managed account
  CUSTOMER : 1 // => Payer => Stripe customer
};

Constants.transactorPaymentMethods = {
  CARD : 0,
  BANK_ACCOUNT : 1,
  PAYPAL :  2
};

Constants.transactorStates = {
  NEEDS_DETAILS : 0,
  SATISFIED : 1,
  ORPHANED : 2
};

Constants.fees = {
  ourCut : 0.1 // amount amount we take from total amount
};
