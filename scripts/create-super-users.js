"use strict";

require('sugar');

let argv = require('minimist')(process.argv.slice(2));
let util = require('util');
let async = require('async');
let User = require('../okp/models/user');
let randomstring = require('randomstring');

function validate() {
	if(!Object.has(argv, 'name')){
		console.warn("The two essential args were not provided : Usage $name --name " + JSON.stringify(argv));
		return false;
	}
	return true;
}

(function main(){

	if(!validate())
		return process.exit(1);

  let obfuscate = randomstring.generate({length: 3}).toLowerCase();
	let input = {type : 2, //super
							 created : Date.create().format('{yyyy}-{MM}-{dd}--{HH}:{mm}'),
						   email : util.format("%s-%s@ok.pitch",argv.name.toLowerCase(), obfuscate),
						   name: argv.name.toLowerCase(),
						   username: util.format("%s-%s", argv.name.toLowerCase(), obfuscate)};

	let password;
	let user;

	async.waterfall([
		(cb)=>{
      user = new User();
      user.on("error", cb);
      user.on("ready", cb);
		},
		(cb)=> {
			password = randomstring.generate({
			  length: 12
			}).toLowerCase();
      User.hashPassword(password, cb);
    },
    (_hash, cb) => {
      input.hash = _hash;
      user.collection_.insert(input, cb);
			console.log("create with this new super " + JSON.stringify(input));
		}],
		(err, result) => {
			if(err)
				return console.error("Creation failure " + err);
			console.log(util.format("Created super user %s, email %s, password %s, username %s, result %s",
			 						input.name,
			 						input.email,
			 						password,
			 						input.username,
			 						JSON.stringify(result)));
		});
})();
