const ParentBot = require('./_Bot.js');
const util = require('util');
const url = require('url');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const FacebookTokenStrategy = require('passport-facebook-token');
const TwitterStrategy = require('passport-twitter').Strategy;
const TwitterTokenStrategy = require('passport-twitter-token');
const GoogleStrategy = require('passport-google').Strategy;
const GoogleTokenStrategy = require('passport-google-token');

var Bot = function (config) {
	if (!config) config = {};
	this.init(config);
};

util.inherits(Bot, ParentBot);

Bot.prototype.init = function (config) {
	var self = this;
	Bot.super_.prototype.init.call(this, config);
	var facebookProcess = function (accessToken, refreshToken, profile, done) {
		if(!profile) { done(null, false); return; }
		var user = {
			type: 'facebook',
			accessToken: accessToken,
			refreshToken: refreshToken,
			condition: {
				'facebook.id': profile.id
			},
			profile: {
				username: profile.displayName,
				email: profile.emails[0].value,
				emails: profile.emails.map(function (v) { return v.value; }),
				photo: profile.photos[0].value,
				photos: profile.photos.map(function (v) { return v.value; }),
				allowmail: false,
				facebook: {
					id: profile.id,
					username: profile.displayName,
					emails: profile.emails,
					photos: profile.photos,
				}
			}
		};
		self.getUserID(user, done);
	};
	var twitterProcess = function (identifier, done) {
		console.log(identifier);
	};

	passport.use(new FacebookStrategy({
			clientID: config.facebook.id,
			clientSecret: config.facebook.secret,
			callbackURL: url.resolve(config.url, "/auth/facebook/callback"),
			profileFields: ['id', 'displayName', 'photos', 'email']
		},
		facebookProcess
	));
	passport.use(new FacebookTokenStrategy({
			clientID: config.facebook.id,
			clientSecret: config.facebook.secret,
			profileFields: ['id', 'displayName', 'photos', 'email']
		},
		facebookProcess
	));
	passport.serializeUser(function(user, done) {
		done(null, user);
	});

	passport.deserializeUser(function(user, done) {
		done(null, user);
	});

	passport.use(new TwitterStrategy({
			consumerKey: config.twitter.id,
			consumerSecret: config.twitter.secret
			callbackURL: url.resolve(config.url)
		},
		twitterProcess
	));

};

Bot.prototype.start = function () {

};

Bot.prototype.initialize = function (req, res, next) {
	passport.initialize()(req, res, next);
};
Bot.prototype.facebook_authenticate = function (req, res, next) {
	passport.authenticate('facebook', { scope: ['public_profile', 'email'] })(req, res, next);
};
Bot.prototype.facebook_callback = function (req, res, next) {
	var self = this;
	passport.authenticate('facebook', function (err, user, info) {
		if(err || !user) {
			// auth failed
			var e = new Error('view:facebook_callback');
			e.code = '68101';
			res.result.setError(e);
			next();
		}
		else {
			self.getToken(user, function (e, d) {
				if(e) {
					res.result.setError(e);
					res.result.setMessage('view:facebook_callback');
				}
				else if(!d) {
					var e = new Error('view:facebook_callback');
					e.code = '68101';
					res.result.setError(e);
				}
				else {
					res.result.setResult(1);
					res.result.setMessage('view:facebook_callback');
					res.result.setData(d);
					res.result.setSession({uid: d.uid});
				}
				next();
			});
		}
	})(req, res, next);
};
Bot.prototype.facebook_token = function (req, res, next) {
	var self = this;
	req.query.access_token = req.query.access_token || req.params.access_token;
	passport.authenticate('facebook-token', function (err, user, info) {
		if(err) {
			err.code = '68101';
			res.result.setError(err);
			next();
		}
		else if(!user) {
			// auth failed
			var e = new Error('Facebook authorization failed');
			e.code = '68101';
			res.result.setErrorCode(e.code);
			res.result.setMessage(e.message);
			next();
		}
		else {
			self.getToken(user, function (e, d) {
				if(e) {
					res.result.setErrorCode(e.code);
					res.result.setMessage(e.message);
				}
				else if(!d) {
					var e = new Error('Facebook authorization failed');
					e.code = '68101';
					res.result.setErrorCode(e.code);
					res.result.setMessage(e.message);
				}
				else {
					res.result.setResult(1);
					res.result.setMessage('Login with Facebook');
					res.result.setData(d);
					res.result.setSession({uid: d.uid});
				}
				next();
			});
		}
	})(req, res, next);
};
Bot.prototype.getUserID = function (user, cb) {
	var bot = this.getBot('User');
	bot.getUserBy3rdParty(user, cb);
};
Bot.prototype.getToken = function (user, cb) {
	var bot = this.getBot('User');
	bot.createToken(user, cb);
};

module.exports = Bot;
