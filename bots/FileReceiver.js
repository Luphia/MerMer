const path = require('path');
const fs = require('fs');

const Parent = require(path.join(__dirname, '_Bot.js'));

var Bot = class extends Parent {
	constructor() {
		super();
		this.name = path.parse(__filename).base.replace(/.js$/, '');
	}
	init(config) {
		this.config = {};
		for(var k in config) {
			if(!/^_/.test(k)) { this.config[k] = config[k]; }
		}
		this.db = config._db;
		this.logger = config._logger;
		this.i18n = config._i18n;

		return Promise.resolve(this);
	}
	start() {
		super.getBot('Receptor').then(receptor => {
			// method: get, post, put, delete, all
			receptor.register(
				{method: 'all', authorization: false, hashcash: false},
				'/file/',
				(options) => { return Promise.resolve(options); }
			);
		});
		return Promise.resolve(true);
	}
	ready() {
		return Promise.resolve(true);
	}
};

module.exports = Bot;