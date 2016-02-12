"use strict";

let expect = require('chai').expect;
let Model = require('../okp/models/model');
let User = require('../okp/models/user');
let fixtures = require('./fixtures/tumblers');

describe('Crashers should not happen, ', () => {
	before(done => {
 		Model.scaffold(fixtures, done);
 	});

 	after(done => {
		Model.purge(done);
 	});

 	it("should handle random stuff thrown at ObjectId creation ", (done) => {

		Model.updateAll.call(User, "random", {not: 'going to work'}, function(err, result){
			expect(err).to.exist;
		});

		Model.delete.call(User, "random", function(err, result){
			expect(err).to.exist;
		});

		Model.updateSet.call(User, "key", "value", "random", function(err, result){
			expect(err).to.exist;
		});

		Model.updatePush.call(User, "random", "key", "value", function(err, result){
			expect(err).to.exist;
		});

		Model.updatePull.call(User, "random", "key", "value", function(err, result){
			expect(err).to.exist;
			done();
		});
 	});
});