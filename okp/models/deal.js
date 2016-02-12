"use strict";

require('sugar');

let util = require('util');
let Model = require('./model');

/**
 * Wraps the deals table.
 *
 * @return {object}
 *
 * So far the schema is
 *
 *  {
		title: "",
		description: "",
		checkSize: <Int>,
		closingDate: {month: "", day: "", year: ""},
		slideshowUrl: "",
		presenter: "",
		investorsOnboard: <Array,
		interestedListeners: <Array> // only returned to presenter
	}

 */

let members = ["presenter"];

module.exports = function() {
  this.constructor.super_.call(this, "deals", members);
};

let Deal = module.exports;
exports = Deal;

util.inherits(Deal, Model);


Deal.findById = Model.findById.bind(Deal);
Deal.find = Model.find.bind(Deal);
Deal.create = Model.create.bind(Deal);
Deal.update = Model.updateAll.bind(Deal);


Deal.findByPresenter = function (user, done) {
  let self = this;
  if(!user)
    return done(new Error(self.name + "findByPresenter -> no presenter"));

  var dbQuery = {presenter: user._id.toString()};
  Deal.find(dbQuery, done);
};
