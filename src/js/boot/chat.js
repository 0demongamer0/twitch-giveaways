var match = window.location.search.match(/channel=([a-z0-9-_]+)(&|$)/i);
var channel = match ? match[1].toLowerCase() : null;
if (channel !== null)
{
	var iframe = document.querySelector('#chat');
	iframe.src = 'https://go.twitch.tv/'.concat(channel).concat('/chat');
	document.querySelector('title').textContent = 'TGA: ' + channel;

	// stupid chrome rendering bugs
	// If I won't do this the chat refuses to render and looks invisible, even
	// though it's loaded. Still doesn't work 100% of the time :/
	setTimeout(function () {
		var pos = iframe.style.position;
		iframe.style.position = 'static';
		setTimeout(function () {
			iframe.style.position = pos;
		}, 100);
	}, 600);
}
