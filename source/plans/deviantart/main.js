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
    // --- START: CORRECTED LOGIC ---
    const here = new URL(window.location.href);

    // FIRST, check if this is the OAuth callback URL.
    if (here.hostname === '127.0.0.1' && here.pathname === '/deviantart-callback') {
        const auth_code = here.searchParams.get('code');
        if (auth_code) {
            eclipse.handle_callback(auth_code);
        } else {
            alert('DeviantArt OAuth callback received, but no authorization code was found.');
        }
        return; // Stop further execution.
    }
    // --- END: CORRECTED LOGIC ---

    // If it's not the callback, proceed with normal page logic.
	const is_old = document.getElementById('oh-menu-eclipse-toggle');
    let version;

	if (is_old) {
		version = old;
	} else {
		version = eclipse;
	}

	version.init();
	find_site(version); // Pass the correct version to find_site
	window.addEventListener('locationchange', () => find_site(version));
}

module.exports = {
	...header,
	exec: exec
};