"use strict";

/*
 * logger.js: custom logger built on top of winston
 * *
 * Uses winston for logging, but adds a couple of things that make the logs a bit
 * more useful.
 *
 */

let os = require('os');
let util = require('util');
let winston = require('winston');

require('sugar');
let Papertrail = require('winston-papertrail').Papertrail;

let levels = {
      trace: 1,
      debug: 2,
      info: 3,
      warn: 4,
      error: 5
    };

let colors = {
      trace: 'white',
      debug: 'blue',
      info: 'green',
      warn: 'yellow',
      error: 'red'
    };

winston.addColors(colors);
var logger = new (winston.Logger)({ levels: levels });

let WEBSITE_DEBUG = process.env.WEBSITE_DEBUG || 'debug';
let WEBSITE_DEBUG_LEVEL = levels[WEBSITE_DEBUG];


function lineNumber() {
  return (new Error()).stack.split("\n")[3].match(/:([0-9]+):/)[1];
}

function functionName() {
  return (new Error()).stack.split('\n')[3].match(/at (\w+(\.<?[\w\b]+>?)*)/)[1];
}

function format() {
  return util.format.apply(null, arguments);
}


var Logger = function(filename) {
  var id = os.hostname()  + '::' + process.pid;

  this.prefix_ = id + ':' + filename + ':';
  this.logger_ = logger;
};

Logger.prototype.trace = function () {
  if (WEBSITE_DEBUG_LEVEL > levels['trace']) return;
  var string = format.apply(null, arguments);
  this.logger_.trace(this.prefix_ + lineNumber() + ':' + functionName() + ': ' + string);
};

Logger.prototype.debug = function () {
  if (WEBSITE_DEBUG_LEVEL > levels['debug']) return;
  var string = format.apply(null, arguments);
  this.logger_.debug(this.prefix_ + lineNumber() + ':' + functionName() + ': ' + string);
};

Logger.prototype.info = function() {
  if (WEBSITE_DEBUG_LEVEL > levels['info']) return;
  var string = format.apply(null, arguments);
  this.logger_.info(this.prefix_ + ':' + string);
};

Logger.prototype.log = function() {
  this.info.apply(this, arguments);
};

Logger.prototype.warn = function() {
  var string = format.apply(null, arguments);
  this.logger_.warn(this.prefix_ + lineNumber() + ': ' + string);
};

Logger.prototype.error = function() {
  var args = Array.prototype.slice.call(arguments, 0);
  var string = format.apply(null, arguments);
  var errorString = this.prefix_ + lineNumber() + ': ' +  string;

  var error = args.find(function (v) { return v instanceof Error; });
  if (!!error) {
  	// an error was passed into the arguments list, so lets sugar the
  	// displayed message with a little more than an error message.
  	errorString += "\n";
  	errorString += error.stack;
  }

  this.logger_.error(errorString);
};


exports.forFile = function(filename) {
  return new Logger(filename);
};

exports.init = function() {
  logger.add(winston.transports.Console, { level: WEBSITE_DEBUG, colorize: true, timestamp: true });
};

exports.initServer = function() {
  logger.add(winston.transports.Console, { level: WEBSITE_DEBUG, colorize: true, timestamp: true });
  logger.add(winston.transports.Papertrail, { level: 'info',  host: 'logs3.papertrailapp.com', port: 50419 });
};
