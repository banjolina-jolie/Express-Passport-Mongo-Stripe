"use strict";

let logger = require('./logger.js').forFile('authenticate.js');
let User = require("../models/user.js");
let constants = require('./constants');

let Auth = module.exports = {};

Auth.isUserAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    let stateValidation = User.canLogIn(req.user);
    if (!stateValidation.result)
      return res.status(403).json(stateValidation);

    if (req.signedCookies.isSuper !== req.user.isSuper) {
      res.cookie('isSuper', req.user.isSuper, { maxAge: 900000/*,httpOnly: false*/});
    }
    res.cookie("currentUser", req.user.state);
    return next();
  }
  res.cookie("currentUser", constants.userStates.LOGGEDOUT);
  res.status(403).send();
};
