"use strict";

let logger = require('../common/logger.js').forFile('common/utilities.js'); 

let Utilities = module.exports = {};

Utilities.safeParseInt = function (string) {
  let ret = null;
  try {
    ret = parseInt(string);
  } catch(e) {
    logger.warn('Unable to parseInt %s: %s', string, e);
  }
  return isNaN(ret) ? null : ret;
};