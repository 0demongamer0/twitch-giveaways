var emitter = require('emitter');
var query = require('query');
var slice = require('sliced');
var chatContainer = query('.chat-room .chat-lines');
var User = require('../model/user');
var textify = require('./textify');

if (!chatContainer) return false;

var chat = module.exports = {};

emitter(chat);

// chat messages observer
var chatObserver = new MutationObserver(function processMutations(mutations) {
	var addedNodes, i, l, node, line, name, html, text;
	for (var m = 0, ml = mutations.length; m < ml; m++) {
		addedNodes = mutations[m].addedNodes;
		for (i = 0, l = addedNodes.length; i < l; i++) {
			node = addedNodes[i];
			line = node.querySelector && node.querySelector('.chat-line');
			if (!line && node.matches && node.matches('.chat-line'))
				line = node;  // BTTV fix;
			if (!line) continue;
			name = query('.from', line);
			name = name && name.textContent.trim();
			if (!name) continue;
			if (query('.deleted', line)) continue;
			html = query('.message', line).innerHTML.trim();
			text = textify(html);
			chat.emit('message', {
				user: {
					name: name,
					badges: slice(query.all('.badge', line)).map(getBadge).filter(truthy),
				},
				html: html,
				text: text,
				time: new Date()
			});
		}
	}
});

function getBadge(el) {
	var name = el.getAttribute('original-title').toLowerCase();
	if (~User.badges.indexOf(name)) {
		return name;
	}
}

function truthy(group) {
	return group;
}

// start observing mutations on chat messages
chatObserver.observe(chatContainer, { childList: true });