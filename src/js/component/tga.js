var m = require('mithril');
var icon = require('../component/icon');
var Tooltips = require('tooltips');
var throttle = require('throttle');
var withKey = require('../lib/withkey');
var Components = require('../lib/components');
var Messages = require('../component/messages');
var Section = require('../lib/section');
var setters = require('../lib/setters');
var twitch = require('../lib/twitch');
var chat = require('../lib/chat');
var channel = require('../lib/channel');
var evt = require('event');
var extend = require('extend');

var app = module.exports = {};
app.controller = Controller;
app.view = view;
app.config = require('tga/data/config.json');
app.options = require('tga/data/options.json');

/**
 * Initiate an app on a container, and return the controller instance.
 *
 * @param  {Element} container
 * @return {Controller}
 */
app.init = function (container) {
	var instance = new Controller(container);
	m.module(container, {
		controller: function () {
			return instance;
		},
		view: view
	});
	return instance;
};

// models
var User = require('../model/user');
var Users = require('../model/users');
var Message = require('../model/message');
var Winners = require('../model/winners');

function Controller(container, config) {
	var self = this;
	window.app = this;
	this.twitch = twitch;
	this.channel = channel;
	this.chat = chat;
	this.container = container;
	this.setter = setters(this);

	// session data
	this.config = extend(true, app.config, config);
	var savedOptions = localStorage[this.config.storageName]
		? JSON.parse(localStorage[this.config.storageName])
		: {};
	this.options = extend(true, {}, app.options, savedOptions);
	this.version = require('tga/data/changelog.json')[0].version;
	this.isNewVersion = this.options.lastReadChangelog !== this.version;
	this.users = new Users();
	this.selectedUsers = new Users();
	this.winners = new Winners(channel.name, {onsync: m.redraw});
	this.rolling = {
		types: ['all', 'active', 'keyword'],
		keyword: null,
		forbiddenWords: []
	};
	this.winner = null;
	this.messages = new Messages();

	// load past winners
	this.winners.connect();

	// save config on change
	this.setter.on('options', function (options) {
		localStorage[self.config.storageName] = JSON.stringify(options);
	});

	// selected users abstraction
	this.updateSelectedUsers = function () {
		self.selectedUsers.reset();
		for (var i = 0, user; user = self.users[i], i < self.users.length; i++) {
			if (selectedFilter(user)) {
				self.selectedUsers.insert(user);
			}
		}
	};

	this.requestUpdateSelectedUsers = throttle(function () {
		self.updateSelectedUsers();
		setTimeout(m.redraw);
	}, 150);

	// create and periodically update updateActiveCutoffTime so we don't have
	// to recreate this object tens of thousands of times on each selected
	// users filter event
	this.activeCutoffTime;
	function updateActiveCutoffTime() {
		self.activeCutoffTime = new Date(Date.now() - self.options.activeTimeout);
	}
	updateActiveCutoffTime();
	setInterval(updateActiveCutoffTime, 1000);

	// set activeTimeout user cleaning interval
	setInterval(function () {
		if (self.options.type === 'active') {
			self.requestUpdateSelectedUsers();
		}
	}, 1000 * 10);

	function selectedFilter(user) {
		var rol = self.rolling;
		var opt = self.options;
		if (!opt.groups[user.group]) return false;
		if (opt.subscriberLuck > self.config.maxSubscriberLuck && !user.subscriber) return false;
		if (opt.minBits && opt.minBits > user.bits) return false;
		if (opt.subscribedTime && (!user.subscriber || opt.subscribedTime > user.subscribedTime)) return false;
		if (self.searchFilter) {
			if (self.searchFilter.value === 'truthy') {
				if (!user[self.searchFilter.prop]) return false;
			} else if (self.searchFilter.value === 'falsy') {
				if (user[self.searchFilter.prop]) return false;
			} else {
				if (self.searchFilter.value !== user[self.searchFilter.prop]) return false;
			}
		}
		if (self.searchQuery && !~user.name.indexOf(self.searchQuery) && !~user.displayName.indexOf(self.searchQuery)) return false;
		if (opt.type === 'all') return true;
		if (opt.type === 'active' && self.activeCutoffTime > user.lastMessage) return false;
		if (opt.type === 'keyword' && rol.keyword && rol.keyword !== user.keyword) return false;
		return true;
	}

	chat.on('message', function (message) {
		var id = twitch.toID(message.user.name);
		var user;
		if (self.users.exists(id)) {
			user = self.users.get(id);
			var prevGroup = user.group;
			user.extend(message.user);
			// if user's group has changed, we need to resort users
			if (prevGroup !== user.group) {
				self.users.sort();
				self.updateSelectedUsers();
			}
		} else {
			user = new User(message.user);
			// check if the user shouldn't be ignored
			if (~Users.ignoredGroups.indexOf(user.group)) return;
			if (~self.options.ignoreList.indexOf(user.id)) return;
			self.users.insert(user);
		}
		user.lastMessage = new Date();
		if (self.winner === user) user.messages.push(new Message(message));
		if (self.rolling.forbiddenWords.length > 0) {
			var lowercaseMessage = String(message.text).replace(' ', '').toLowerCase();
			var forbiddenCount = self.rolling.forbiddenWords.reduce(function (acc, word) {
				return lowercaseMessage.indexOf(word) > -1 ? acc + 1 : acc;
			}, 0);
			if (forbiddenCount > 0) {
				user.eligible = false;
				self.requestUpdateSelectedUsers();
			}
		}
		if (self.rolling.keyword) {
			var keywordIndex = self.options.caseSensitive
				? message.text.indexOf(self.rolling.keyword)
				: message.text.toLowerCase().indexOf(self.rolling.keyword.toLowerCase());
			if (keywordIndex === 0) {
				if (self.options.keywordAntispam && user.keyword === self.rolling.keyword) {
					user.keywordEntries++;
					if (user.keywordEntries > self.options.keywordAntispamLimit) user.eligible = false;
				} else {
					user.keyword = self.rolling.keyword;
					user.keywordEntries = 1;
				}
				self.requestUpdateSelectedUsers();
			}
		}
		if (self.winner && self.winner === user && !self.winner.respondedAt)
			self.winner.respondedAt = new Date();
		m.redraw();
	});

	this.users.on('insert', function (user) {
		if (selectedFilter(user)) self.selectedUsers.insert(user);
	});
	this.users.on('remove', self.selectedUsers.remove.bind(self.selectedUsers));

	this.setter.on('options.groups', this.updateSelectedUsers);
	this.setter.on('options.type', this.updateSelectedUsers);
	this.setter.on('options.activeTimeout', function () {
		updateActiveCutoffTime();
		self.requestUpdateSelectedUsers();
	});
	this.setter.on('rolling.keyword', self.requestUpdateSelectedUsers);
	this.setter.on('options.minBits', self.requestUpdateSelectedUsers);
	this.setter.on('options.subscribedTime', self.requestUpdateSelectedUsers);

	// search
	this.search = '';
	this.searchFilter = null;
	this.searchQuery = '';
	this.setter.on('search', function () {
		self.search = String(self.search).trim().toLowerCase();
		self.searchFilter = self.config.searchFilters[self.search[0]];
		self.searchQuery = self.searchFilter ? self.search.substr(1).trim() : self.search;
	});
	this.setter.on('search', self.requestUpdateSelectedUsers);

	// forbidden words
	this.setter.on('options.forbiddenWords', serializeForbiddenWords);
	serializeForbiddenWords();
	function serializeForbiddenWords() {
		var list = String(self.options.forbiddenWords)
			.split(',')
			.map(function (word) {
				return word.trim().toLowerCase();
			})
			.filter(function (word) {
				return word;
			});
		self.setter('rolling.forbiddenWords')(list);
	}

	this.randrange = function (min, max) {
		var range = max - min;
		if (range <= 0) {
			throw new Exception('max must be larger than min');
		}
		var requestBytes = Math.ceil(Math.log2(range) / 8);
		if (!requestBytes) { // No randomness required
			return min;
		}
		var maxNum = Math.pow(256, requestBytes);
		var ar = new Uint8Array(requestBytes);

		while (true) {
			window.crypto.getRandomValues(ar);

			var val = 0;
			for (var i = 0;i < requestBytes;i++) {
				val = (val << 8) + ar[i];
			}

			if (val < maxNum - maxNum % range) {
				return min + (val % range);
			}
		}
	};

	this.reannounce = function() {
		chat.post(String(self.options.announceTemplate).replace(/{name}/g, /^[a-z0-9-_]+$/i.test(self.winner.displayName) ? self.winner.displayName : self.winner.name ));
	};

	// Rolling function
	this.roll = function () {
		// Blur active element to work around this chrome rendering bug:
		// When section changes while some of the range inputs is focused,
		// Chrome will not clear the old index.js section from raster,
		// although it is no longer in DOM. This was causing loading indicator
		// to be overlayed on the old section while spinning.
		if (document.activeElement && document.activeElement.blur) {
			document.activeElement.blur();
		}

		self.messages.clear();

		// Create rolling pool
		var pool = [];
		var subLuck = self.options.subscriberLuck;
		for (var i = 0, j, user; user = self.selectedUsers[i], i < self.selectedUsers.length; i++) {
			if (!user.eligible) continue;
			if (user.subscriber && subLuck > 1) {
				// Duplicate subscirbers in the rolling pool to simulate luck
				for (j = 0; j < subLuck; j++) pool.push(user);
			}
			else pool.push(user);
		}

		if (!pool.length) {
			self.messages.danger('There is none to roll from.');
			return;
		}

		// Clean current winner data
		if (self.winner) {
			delete self.winner.rolledAt;
			delete self.winner.respondedAt;
			delete self.winner.messages;
		}

		// Pick random winner from pool
		// Using window.crypto.getRandomValues instead of Math.random
		// See "this.randrange"
		// Though V8 has a better Math.Random Algo its not designed for secure number generation and when items of value are on the line
		// I would feel better using something other than math.random()
		// Want to be able to pull random numbers from random.org using XMLHttpRequest.
		// https://www.random.org/integers/?num=1&min=0&col=1&base=10&format=plain&rnd=new&max=200
		var winner = (self.options.useMathRandom) ? pool[Math.random() * pool.length | 0] : pool[self.randrange(0, pool.length)] ;
		winner.messages = [];
		winner.rolledAt = new Date();

		// Uncheck winner
		if (self.options.uncheckWinners) {
			winner.eligible = false;
		}

		// Announce winner in chat
		if (self.options.announceWinner) {
			chat.post(String(self.options.announceTemplate).replace(/{name}/g, /^[a-z0-9-_]+$/i.test(winner.displayName) ? winner.displayName : winner.name ));
		}

		// Set winner and open their profile
		self.setter('winner')(winner);
		self.section.activate('profile', winner);

		// Add winner to the recent winners database
		channel.channel()
			.then(null, function (err) {
				console.error(err);
				return false;
			}).then(function (stream) {
				self.winners.add({
					name: winner.name,
					displayName: winner.displayName || winner.name,
					title: stream ? stream.status : 'couldn\'t retrieve stream title'
				});
			});
	};

	// components
	this.components = new Components(this)
		.use(require('../component/userlist'), this.selectedUsers);

	// primary section
	this.section = new Section(this)
		.use(require('../section/index'))
		.use(require('../section/winners'))
		.use(require('../section/config'))
		.use(require('../section/changelog'))
		.use(require('../section/about'))

		.use(require('../section/profile'))
		.use(require('../section/bitcoin'));

	// clear messages when changing sections
	this.section.on('active', this.messages.clear.bind(this.messages));

	// this.toSection = this.section.activator.bind(this.section);
	this.toSection = function (name, data) {
		return withKey(1, self.section.activator(name, data));
	};

	// active section class - returns 'active' when passed section name is active
	this.classWhenActive = function (name, normalClass, activeClass) {
		if (!activeClass) {
			activeClass = normalClass;
			normalClass = '';
		}
		return normalClass + ' ' + (self.section.isActive(name) ? activeClass || 'active' : '');
	};

	// tooltips
	this.tooltips = false;
	this.setter.on('options.displayTooltips', makeTooltips);
	makeTooltips(this.options.displayTooltips);

	function makeTooltips(display) {
		if (display && !self.tooltips) self.tooltips = new Tooltips(container, self.config.tooltips);
		else if (!display && self.tooltips) {
			self.tooltips.destroy();
			self.tooltips = false;
		}
	}

	// also clean users when ignore list has changed
	this.setter.on('options.ignoreList', throttle(this.cleanUsers, 1000));
}

function view(ctrl) {
	return [
		m('.viewers', [
			m('.bar', [
				m('.search', [
					m('input[type=text]', {
						oninput: m.withAttr('value', ctrl.setter('search')),
						onkeydown: withKey(27, ctrl.setter('search').to('')),
						placeholder: 'search...',
						required: true,
						value: ctrl.search
					}),
					ctrl.search
						? m('.cancel', {onclick: ctrl.setter('search').to(''), 'data-tip': 'Cancel search <kbd>ESC</kbd>'}, icon('close', '-small'))
						: null
				]),
				m('h3.count', ctrl.selectedUsers.length)
			]),
			ctrl.components.render('userlist'),
		]),
		m('.primary', [
			m('.bar', {key: 'bar'}, [
				m('div', {
					class: ctrl.classWhenActive('index', 'button index', 'active'),
					onmousedown: ctrl.toSection('index'),
					'data-tip': 'Giveaway'
				}, [icon('gift')]),
				ctrl.winner
					? m('div', {
						class: ctrl.classWhenActive('profile', 'button profile', 'active'),
						onmousedown: ctrl.toSection('profile', ctrl.winner),
						'data-tip': 'Last winner'
					}, [icon('trophy'), m('span.label', ctrl.winner.name)])
					: null
				,
				m('.spacer'),
				m('div', {
					class: ctrl.classWhenActive('winners', 'button winners', 'active'),
					onmousedown: ctrl.toSection('winners'),
					'data-tip': 'Past winners'
				}, [icon('trophy-list')]),
				m('div', {
					class: ctrl.classWhenActive('config', 'button config', 'active'),
					onmousedown: ctrl.toSection('config'),
					'data-tip': 'Settings'
				}, [icon('cogwheel')]),
				m('div', {
					class: ctrl.classWhenActive('changelog', 'button index', 'active'),
					onmousedown: ctrl.toSection('changelog'),
					'data-tip': 'Changelog'
				}, [
					icon('list'),
					ctrl.isNewVersion && !ctrl.section.isActive('changelog') ? m('.new') : null
				]),
				m('div', {
					class: ctrl.classWhenActive('about', 'button index', 'active'),
					onmousedown: ctrl.toSection('about'),
					'data-tip': 'About + FAQ'
				}, [icon('help')])
			]),
			ctrl.messages.render(),
			m('section.section.' + ctrl.section.active, {key: ctrl.section.key}, ctrl.section.render()),
		])
	];
}
