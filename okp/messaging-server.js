"use strict";

//let config = require('./common/config.js');
let io = require('socket.io');
let fs = require('fs');
let logger = require('./common/logger').forFile('messenging-server');

var certs = {
  key: fs.readFileSync(__dirname + '/../certs/server.key'),
  cert: fs.readFileSync(__dirname + '/../certs/server.crt'),
  ca: fs.readFileSync(__dirname + '/../certs/ca.crt'),
  passphrase: 'gulp'
};

let BackChannel = function(){
	this.init();
};

BackChannel.prototype.init = function(){
	let self = this;
  self._backChannel = new io();
  self._backChannel.on('connection', self._onConnect.bind(self));
};

BackChannel.prototype._onConnect = function(socket){
	let self = this;
	logger.info("on Connection " + socket.id);
	socket.on("meetingRoomRequest", self._onMeetingRoomRequest.bind(self, socket));
	socket.on("disconnect", self._onDisconnect.bind(self, socket));
};

BackChannel.prototype._onDisconnect = function(socket, err){
	logger.info("onDisconnect " + socket.id);
	console.log(socket.id + " just disconnected with err " + err );
};

BackChannel.prototype._onMeetingRoomRequest = function(socket, meetingId){
	logger.info("! onMeetingRoomRequest " + socket.id + " meetingId : " + meetingId);
	socket.join(meetingId);
};

// Relay updates from the meetings controller
BackChannel.prototype.announceToRoom = function(meetingId, payload){
	let self = this;
	logger.info("announceToRoom " + meetingId + "payload " + JSON.stringify(payload));
	self._backChannel.sockets.to(meetingId).emit("meetingUpdate", payload);
};

var theChannel;
let operator = module.exports;

operator.connect = function(callback){
	if(!theChannel){
		theChannel = new BackChannel();
		callback(null, theChannel);
	}
	callback(null, theChannel);
};
