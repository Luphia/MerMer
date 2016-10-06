const ParentBot = require('./_Bot.js');
const util = require('util');
const io = require('socket.io');
const ecresult = require('ecresult');

var logger;

var Bot = function (config) {
	if (!config) config = {};
	this.init(config);
};

util.inherits(Bot, ParentBot);

Bot.prototype.init = function (config) {
	Bot.super_.prototype.init.call(this, config);
	logger = config.logger;
};

Bot.prototype.start = function () {
	var self = this;
	var sio = new io();
	var user = [];
	this.sio = sio;
	this.user = user;
	this.getBot('Receptor').getServer().map(function (v) {
		if(v) { sio.attach(v); }
	});

	sio.on('connection', function (socket) {
		user.push(socket);
		socket.user = {};
		socket.on('authorization', function (token) {
			self.getBot('User').checkToken(token, function (e, d) {
				var result = new ecresult();
				if(!!d) {
					socket.user = d;
					result.setResult(1);
					result.setMessage('login successfully');
					result.setData(d);
				}
				else {
					result.setMessage('Invalid Token');
				}
				socket.emit('authorization', result.toJSON());
			});
		});
	});
};

// require: options.uid, event, data
Bot.prototype.notice = function (options, cb) {
	var socket = this.user.find(function (v) { return v.user.uid == options.uid; });
	if(socket) {
		socket.emit(options.event, options.data);
		cb(null, true);
	}
	else {
		var e = new Error('user not found');
		e.code = '39102';
		cb(e);
	}
};

module.exports = Bot;
