module.exports = {
	test: (url) => {
        // Test for deviantart.com OR either of the callback pages
		const this_url = url.hostname.split('.').slice(-2).join('.');
		return this_url === 'deviantart.com' || url.hostname === 'aetcloud.github.io' || url.hostname === 'n4.ppstar.art';
	},

	match: [
        '*://*.deviantart.com/*',
        'https://aetcloud.github.io/Idems-Sourcing-Suite/callback.html*',
        'https://n4.ppstar.art/Idems-Sourcing-Suite/callback.html*'
    ],

	connect: [
        'wixmp.com',
        'www.deviantart.com'
    ],

	title: 'DeviantArt',
	version: 10 // Incremented version
};