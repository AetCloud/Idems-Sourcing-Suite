module.exports = {
	test: (url) => {
		const this_url = url.hostname.split('.').slice(-2).join('.');
		// Now checks for either domain
		return this_url === 'twitter.com' || this_url === 'x.com';
	},

	match: [
		'*://*.twitter.com/*',
		'*://*.x.com/*' // Added this line
	],

	connect: ['pbs.twimg.com'],

	title: 'Twitter',
	version: 3
};
