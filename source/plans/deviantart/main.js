const old = require('./old.js');
const eclipse = require('./eclipse.js');
const header = require('./header.js');

let last_url = { href: null };

async function find_site (version) {
    const here = new URL(window.location.href);

	if (here.href === last_url.href) {
		return;
	} else if (last_url !== null && here.pathname === last_url.pathname) {
		return;
	} else {
		last_url = here;
	}

	const artwork_regex = /^\/[A-z0-9_-]+\/art\/.*$/;
	if (artwork_regex.test(here.pathname)) {
		version.exec();
	}
}

async function exec () {
    const here = new URL(window.location.href);

    // Check if this is one of the OAuth callback URLs.
    if ((here.hostname === 'aetcloud.github.io' || here.hostname === 'n4.ppstar.art') && here.pathname.includes('/Idems-Sourcing-Suite/callback.html')) {
        const auth_code = here.searchParams.get('code');
        if (auth_code) {
            eclipse.handle_callback(auth_code);
        } else {
            alert('DeviantArt OAuth callback received, but no authorization code was found.');
        }
        return; // Stop further execution.
    }

    // If it's not the callback, proceed with normal page logic.
	const is_old = document.getElementById('oh-menu-eclipse-toggle');
    let version;

	if (is_old) {
		version = old;
	} else {
		version = eclipse;
	}

	version.init();
	find_site(version);
	window.addEventListener('locationchange', () => find_site(version));
}

module.exports = {
	...header,
	exec: exec
};