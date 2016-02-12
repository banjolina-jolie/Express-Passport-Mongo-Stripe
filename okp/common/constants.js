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
	LISTENER : 0,
	PRESENTER : 1,
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
MEETING
**/
Constants.meetingStates = {
  PENDING_ON_LISTENER_CONFIRM : 0,     // waiting on listener
  PENDING_ON_PRESENTER_CONFIRM : 1,    // waiting on presenter but of course.
  PLANNED : 2,
  ONGOING : 3,
  ENDED_NO_FEEDBACK : 4,               // meeting has ended but listener hasn't yet given feedback
  LISTENER_ACCEPTS_PAYMENT : 5,
  LISTENER_REJECTS_PAYMENTS : 6,
  PAYMENT_SETTLED : 7,
  PAYMENT_TROUBLE : 8,
  CANCELLED : 9
};

Constants.meetingType = {
  PITCH : 0
};

/**
TRANSACTOR
**/
Constants.transactorTypes = {
  RECEIVER : 0, // => User.Listener => Stripe managed account
  CUSTOMER : 1 // => User.Presenter => Stripe customer
};

Constants.transactorPaymentMethods = {
  CARD : 0,
  BANK_ACCOUNT : 1,
  PAYPAL :  2
};

Constants.transactorStates = {
  NEEDS_DETAILS : 0, // => aft
  SATISFIED : 1,
  ORPHANED : 2
};

Constants.fees = {
  ourCut : 0.1 // amount amount we take from total amount
};