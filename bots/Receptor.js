const ParentBot = require('./_Bot.js');
const util = require('util');
const log4js = require('log4js');
const express = require('express');
const Session = require('express-session');
const favicon = require('serve-favicon');
const os = require('os');
const exec = require('child_process').exec;
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const url = require('url');
const bodyParser = require('body-parser');
const multer = require('multer');
const http = require('http');
const https = require('https');
const echashcash = require('echashcash');
const ecresult = require('ecresult');
const dvalue = require('dvalue');
const textype = require('textype');

const hashcashLevel = 3;
const allowDelay = 10000 * 1000;


var pathCert = path.join(__dirname, '../config/cert.pfx'),
		pathPw = path.join(__dirname, '../config/pw.txt'),
		logger;

var checkLogin, checkHashCash, errorHandler, returnData;
checkLogin = function (req, res, next) {
	if(req.session.uid === undefined) {
		res.result.setErrorCode('10201');
		res.result.setMessage('User Not Authorized');
		returnData(req, res, next)
	}
	else {
		next();
	}
};
checkHashCash = function (req, res, next) {
	var invalidHashcash = function () {
		//-- for test
		var t, h = req.headers.hashcash, nt = new Date().getTime();
		if(h) { t = parseInt(h.split(":")[0]) || nt; }
		var c = [req.url, nt, ""].join(":");
		var hc = echashcash(c);
		var d = {
			hashcash: req.headers.hashcash,
			sample: [nt, hc].join(":")
		};
		if(new Date().getTime() - t > allowDelay) { d.information = "timeout"; }
		if(new Date().getTime() < t) { d.information = "future time"; }

		res.result.setErrorCode('10101');
		res.result.setMessage('Invalid Hashcash');
		res.result.setData(d);  //-- for test
		returnData(req, res, next);
	};

	var hashcash = req.headers.hashcash;
	if(!hashcash) { return invalidHashcash(); }
	var cashdata = hashcash.split(":");
	cashdata = cashdata.map(function (v) { return parseInt(v) || 0; });
	var content = [req.url, cashdata[0], ""].join(":");
	var now = new Date().getTime();
	var check = now - cashdata[0] < allowDelay? echashcash.check(content, cashdata[1], hashcashLevel): false;
	if(check) {
		next();
	}
	else { return invalidHashcash(); }
};
errorHandler = function (err, req, res, next) {
	logger.exception.error(err);
	if(!res.finished) {
		try {
			res.statusCode = 500;
			res.result.setMessage('oops, something wrong...');
			res.send(res.result.response());
		}
		catch(e) {}
	}
};
returnData = function(req, res, next) {
	var session, json, isFile, isURL;

	if(!res.finished) {
		json = res.result.response();
		isFile = new RegExp("^[a-zA-Z0-9\-]+/[a-zA-Z0-9\-\.]+$").test(json.message);
		isURL = textype.isURL(json.message);
		if(res.result.isDone()) {
			session = res.result.getSession();

			for(var key in session) {
				if(session[key] === null) {
					delete req.session[key];
				}
				else {
					req.session[key] = session[key];
				}
			}
		}
		else {
			res.status(404);
			res.result.setMessage("Invalid operation");
		}

		if(isFile) {
			res.header('Content-Type', json.message);
			res.end(json.data);
		}
		else if(isURL) {
			var crawler;
			var options = url.parse(json.message);
			options.method = 'GET';
			switch(options.protocol) {
				case 'http:':
					crawler = http;
					break;
				case 'https:':
				default:
					crawler = https;
					options.rejectUnauthorized = false;
			}
			crawler.request(options, function (cRes) {
				res.header('Content-Type', cRes.headers['content-type']);
				cRes.on('data', function (chunk) {
					res.write(chunk);
				});
				cRes.on('end', function () {
					res.end();
				})
			}).on('error', function (e) { res.end(); }).end();
		}
		else if(json.result >= 100) {
			res.status(json.result);
			for(var key in json.data) {
				res.header(key, json.data[key]);
			}

			res.end();
		}
		else {
			res.header("Content-Type", 'application/json');
			res.send(json);
		}
	}
	else {
		// timeout request
		json = res.result.response();
		res.result.resetResponse();
	}

	var rs = json.errorcode? [json.result, json.errorcode].join(':'): json.result;
	logger.info.info(req.method, req.url, rs, req.session.ip, json.cost);
};

var Bot = function(config) {
	this.init(config);
};

util.inherits(Bot, ParentBot);

Bot.prototype.init = function(config) {
	var self = this;
	Bot.super_.prototype.init.call(this, config);
	this.serverPort = [5566, 80];
	this.httpsPort = [7788, 443];
	this.nodes = [];
	this.monitorData = {};
	this.monitorData.traffic = {in: 0, out: 0};
	logger = config.logger;

	var folders = config.path || {};
	var upload = folders.upload || "./uploads/";
	var shards = folders.shards || "./shards/";
	this.shardPath = shards;
	var logs = folders.logs || "./logs/";
	var passportBot = this.getBot("Passport");
	var jobQueue = this.getBot("JobQueue");

	this.router = express.Router();
	this.app = express();
	this.http = require('http').createServer(this.app);
	this.http.on('error', function(err) {
		if(err.syscall == 'listen') {
			var nextPort = self.serverPort.pop() || self.listening + 1;
			self.startServer(nextPort);
		}
		else {
			throw err;
		}
	});
	this.http.on('listening', function() {
		config.listening = self.listening;
		logger.info.info('HTTP:', self.listening);
	});

	// if has pxf -> create https service
	if(fs.existsSync(pathCert)) {
		this.pfx = fs.readFileSync(pathCert);
		this.pfxpw = fs.readFileSync(pathPw);

		this.https = require('https').createServer({
			pfx: this.pfx,
			passphrase: this.pfxpw
		}, this.app);
		this.https.on('error', function(err) {
			if(err.syscall == 'listen') {
				var nextPort = self.httpsPort.pop() || self.listeningHttps + 1;
				self.startServer(null, nextPort);
			}
			else {
				throw err;
			}
		});

		this.https.on('listening', function() {
			config.listeningHttps = self.listeningHttps;
			logger.info.info('HTTPS:', self.listeningHttps);
		});
	}

	this.session = Session({
		secret: this.randomID(),
		resave: true,
		saveUninitialized: true
	});

	this.app.set('port', this.serverPort.pop());
	this.app.set('portHttps', this.httpsPort.pop());
	this.app.use(this.session);
	this.app.use('/auth/*', passportBot.initialize);
	this.app.use(express.static(path.join(__dirname, '../public')));
	this.app.use(bodyParser.urlencoded({ extended: false }));
	this.app.use(bodyParser.json({}));
	this.app.use(function(req, res, next) { self.filter(req, res, next); });
	this.app.use(jobQueue.middleware());
	this.app.use(this.router);
	this.app.use(returnData);
	this.ctrl = [];

	// passport
	this.router.get('/auth/facebook', function (req, res, next) { passportBot.facebook_authenticate(req, res, next); });
	this.router.get('/auth/facebook/callback', function (req, res, next) { passportBot.facebook_callback(req, res, next); });
	this.router.get('/auth/facebook/token/:access_token', checkHashCash, function (req, res, next) { passportBot.facebook_token(req, res, next); });

	// HOME
	this.router.get('/', function (req, res, next) {
		res.result.setResult(1);
		res.result.setMessage('Application Information');
		res.result.setData(self.config.package);
		next();
	});

	// get system infomation
	this.router.get('/version/', function (req, res, next) {
		res.result.setResult(1);
		res.result.setMessage('Application Information');
		res.result.setData(self.config.package);
		next();
	});

	// get command Result
	this.router.get('/command/:id', checkHashCash, function (req, res, next) {
		var commandID = req.params.id;
		var options = {attr: {command: commandID}};
		var rs = jobQueue.findJob(options);
		if(rs) {
			res.result = rs;
			rs.resetResponse();
		}
		else {
			res.result.setErrorCode('00002');
			res.result.setMessage('command not found:', commandID);
		}
		next();
	});

	// notice user
	this.router.post('/notice/:uid/:event', function (req, res, next) {
		var options = {uid: req.params.uid, event: req.params.event, data: req.body}
		self.getBot('Notifier').notice(options, function (e, d) {
			if(e) {
				res.result.setErrorCode(e.code);
				res.result.setMessage(e.message);
			}
			else {
				res.result.setResult(1);
				res.result.setMessage('notice user:', options.uid);
				res.result.setData(options);
			}
			next();
		});
	});
};

Bot.prototype.start = function(cb) {
	Bot.super_.prototype.start.apply(this);
	var self = this;
	var httpPort = this.app.get('port');
	var httpsPort = this.app.get('portHttps');
	this.router.use(errorHandler);
	this.startServer(httpPort, httpsPort, cb);
};

Bot.prototype.startServer = function(port, httpsPort, cb) {
	if(port > 0) {
		this.listening = port;
		this.http.listen(port, function() {
			if(typeof(cb) == 'function') { cb(); }
		});
	}

	if(httpsPort > 0 && this.pfx) {
		this.listeningHttps = httpsPort;
		this.https.listen(httpsPort, function() {});
	}
}

Bot.prototype.stop = function() {
	Bot.super_.prototype.stop.apply(this);
	this.http.close();

	if(this.pfx) {
		this.https.close();
	}
};

Bot.prototype.filter = function (req, res, next) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '0.0.0.0';
	var port = req.connection.remotePort;
	parseIP = ip.match(/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/);
	ip = !!parseIP? parseIP[0]: ip;
	if(!req.session.ip) { req.session.ip = ip; }
	if(!req.session.port) { req.session.port = port; }
	var powerby = this.config.powerby;

	var processLanguage = function (acceptLanguage) {
		var regex = /((([a-zA-Z]+(-[a-zA-Z]+)?)|\*)(;q=[0-1](\.[0-9]+)?)?)*/g;
		var l = acceptLanguage.toLowerCase().replace(/_+/g, '-');
		var la = l.match(regex);
		la = la.filter(function (v) {return v;}).map(function (v) {
			var bits = v.split(';');
			var quality = bits[1]? parseFloat(bits[1].split("=")[1]): 1.0;
			return {locale: bits[0], quality: quality};
		}).sort(function (a, b) { return b.quality > a.quality; });
		return la;
	};
	req.language = processLanguage(req.headers['accept-language'] || 'en-US');

	res.result = new ecresult();
	res.header('X-Powered-By', powerby);
	res.header('Client-IP', ip);
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
	res.header("Access-Control-Allow-Headers", "Hashcash, Authorization, Content-Type");

	var bot = this.getBot('User');
	var auth = req.headers.authorization;
	var token = !!auth? auth.split(" ")[1]: '';
	bot.checkToken(token, function (e, d) {
		if(!!d) {
			req.session.uid = d.uid;
			req.token = token;
		}
		next();
	});
};
Bot.prototype.tokenParser = function (req, res, next) {
	var auth = req.headers.authorization;
	var token = !!auth? auth.split(" ")[1]: '';
	bot.checkToken(token, function (e, d) {
		if(!!d) {
			req.session.uid = d.uid;
		}
		next();
	});
};
Bot.prototype.getServer = function () {
	return [this.http, this.https];
};

module.exports = Bot;
