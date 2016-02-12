"use strict";

require('sugar');

let argv = require('minimist')(process.argv.slice(2));
let async = require('async');
let User = require('../okp/models/user');
let Connection = require('../okp/models/connection');

function validate() {
	if(!Object.has(argv, 'listener') || !Object.has(argv, 'presenter')){
		console.warn("The two essential args were not provided : Usage -> --listner $username --presenter $username" + JSON.stringify(argv));
		return false;
	}
	return true;
}

(function main(){

	if(!validate())
		return process.exit(1);

	async.waterfall([
		(cb)=>{
			User.find({$or : [{username : argv.listener}, {username : argv.presenter}]}, cb);
		},
		(results, cb)=> {
			if(results.length !== 2){
				console.warn("user find results " + JSON.stringify(results));
				process.exit(1);
			}

			let fullL = results.find((result) => {return result.username === argv.listener;});
			let fullP = results.find((result) => {return result.username === argv.presenter;});

			let conn = {listener : fullL._id.toString(),
									presenter : fullP._id.toString(),
								  active : true,
								  starred: true};
			console.log("create this new connection " + JSON.stringify(conn));
			Connection.create(conn, cb);
		}],
		(err, result) => {
			console.log("finished, error ? " + err + " or has been created -> " + result.result);
		});
})();
