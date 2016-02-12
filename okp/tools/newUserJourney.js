"use strict";
let async = require("async");
let config = require('../common/config');
let path = require('path');
let request = require('request');

request = request.defaults({jar: true});

let newUser = {"name": "conor",
						   "email":"conor@forwind.net",
						   "password": "ppp",
						   "type" : 0,
						   "username" : "ronoc",
						   "surname" : "curran",
						   "meta" : {dob : {day: 13, month: 5, year: 1975}}};

let projectedUser;

(()=> {
	async.waterfall([
		(cb) => {
			//let target = config.API_SERVER + ':';
			//console.log("api server " + target);
			request.post({url: 'http://' + path.join(config.API_SERVER, 'users'),
									  headers: {"Content-Type": "application/json" },
									  body: JSON.stringify(newUser)},
									  cb);
		},
		(response, body, cb) => {
			console.log(JSON.stringify(response));
			projectedUser = JSON.parse(response.body);
			if(response.statusCode !== 201)
				return cb("new user not created");
	   	let loginWith = Object.reject(newUser, 'name', 'currentType');
			request.post({url: 'http://' + path.join(config.API_SERVER, 'login'),
									  headers: {"Content-Type": "application/json" },
									  body: JSON.stringify(loginWith)},
									  cb);

		},
		(res, body, cb) => {
			if(res.statusCode !== 200)
				return cb("unable to login in");
			console.log("all created, all good.");
		}],
		(err) => {
	    console.log('error: '+ err);
		});
})();