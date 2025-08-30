const { description, upload } = require('./shared.js');
const {
	artist_commentary,
	string_to_node,
	data_to_nodes,
	common_styles,
	remove_node,
	get_value,
    set_value, // Use the correct utility function
	add_css,
    append
} = require('./../../utils/utils.js');

const OAUTH_URL = 'https://www.deviantart.com/oauth2/authorize';
const TOKEN_URL = 'https://www.deviantart.com/oauth2/token';
const API_BASE_URL = 'https://www.deviantart.com/api/v1/oauth2';
const REDIRECT_URI = 'https://aetcloud.github.io//Idems-Sourcing-Suite/callback.html';

// --- Helper function to start the authorization process ---
async function authorize() {
    const client_id = await get_value('deviantart_client_id');
    if (!client_id) {
        alert("DeviantArt Client ID is not set. Please set it in the e621 extensions settings page.");
        return;
    }
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: client_id,
        redirect_uri: REDIRECT_URI,
        scope: 'browse'
    });
    // Open the authorization page in a new tab
    window.open(`${OAUTH_URL}?${params.toString()}`);
}

// --- Helper function to get the access token ---
async function get_token(auth_code) {
    const client_id = await get_value('deviantart_client_id');
    const client_secret = await get_value('deviantart_client_secret');

    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: client_id,
        client_secret: client_secret,
        redirect_uri: REDIRECT_URI,
        code: auth_code
    });

    try {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            body: params
        });
        const data = await response.json();
        if (data.access_token) {
            await set_value('deviantart_access_token', data.access_token);
            // Clear the used auth code from local storage
            localStorage.removeItem('deviantart_auth_code');
            alert('DeviantArt authorization successful!');
            window.location.reload(); // Reload the page to use the new token
            return data.access_token;
        } else {
            throw new Error(data.error_description || 'Failed to get access token.');
        }
    } catch (error) {
        console.error("ISS (DeviantArt): Error getting access token.", error);
        alert(`DeviantArt authorization failed: ${error.message}`);
        return null;
    }
}

// --- Main execution logic ---
async function run_artwork () {
	clear_all_setup();

    // --- NEW: Check local storage for an auth code from our callback page ---
    const auth_code = localStorage.getItem('deviantart_auth_code');
    if (auth_code) {
        await get_token(auth_code);
        return; // Stop execution to allow the page to reload
    }

	const access_token = await get_value('deviantart_access_token');
    if (!access_token) {
        authorize(); // If we don't have a token, start the auth process.
        return;
    }

	const deviation_uuid = await get_deviation_uuid(window.location.href, access_token);
    if (!deviation_uuid) {
        console.error("ISS (DeviantArt): Could not retrieve deviation UUID.");
        return;
    }

	const info = await get_info(deviation_uuid, access_token);
    if (!info) {
        console.error("ISS (DeviantArt): Failed to get artwork info.");
        return;
    }

	const post_info = await document.body.arrive('[data-hook=deviation_meta]');
	post_info.style.flexDirection = 'column';
	const container = document.createElement('div');
	container.id = 'iss_container';
	post_info.appendChild(container);

	await conditional_execute('on_site_commentary_enabled', () => append(container, description(info)));
	await conditional_execute('on_site_upload_enabled', () => append(container, upload(info)));
	await conditional_execute('on_site_hasher_enabled', () => {
		const hashes = data_to_nodes(info.sources);
		hashes.forEach(e => append(container, e));
	});
}

async function conditional_execute (key, func) {
	const value = await get_value(key);
	if (value === true) func();
}

function add_style () {
	common_styles();
	add_css(`
		.iss_image_link { color: inherit !important; font-size: 1.1rem; margin-right: 0.3rem; }
		#iss_container { display: flex; flex-direction: column; margin-top: 1rem; }
		#iss_artist_commentary { width: 8rem; }
	`);
}

function clear_all_setup () {
	remove_node(document.getElementById('iss_container'));
}

async function get_deviation_uuid(url, access_token) {
    const params = new URLSearchParams({ url, access_token });
    const response = await fetch(`${API_BASE_URL}/oembed?${params.toString()}`);
    const data = await response.json();
    return data.deviationid;
}

async function get_info(deviation_uuid, access_token) {
    const params = new URLSearchParams({ access_token, "expand": "user,submission.description" });
    const API_URL = `${API_BASE_URL}/deviation/metadata/${deviation_uuid}?${params.toString()}`;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            // If the token is invalid, clear it and re-authorize
            if (response.status === 401) {
                console.log("ISS (DeviantArt): Access token is invalid or expired. Re-authorizing...");
                await set_value('deviantart_access_token', null);
                authorize();
                return null;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const deviation = data.metadata[0];
        
        return {
            sources: get_sources(deviation),
            description: get_description(deviation)
        };
    } catch (error) {
        console.error("ISS (DeviantArt): Error fetching from metadata API.", error);
        return null;
    }
}

function get_description(deviation) {
    const artist = {
        href: deviation.author.url,
        textContent: deviation.author.username
    };
    const title = { textContent: deviation.title };
    const description = string_to_node(deviation.description);

    return artist_commentary(artist, title, description);
}

function get_sources(deviation) {
    const sources = [];
    if (deviation.submission.content.src) {
        sources.push([deviation.submission.content.src, 'full image']);
    }
    if (deviation.submission.preview.src) {
        sources.push([deviation.submission.preview.src, 'preview']);
    }
    return sources;
}


module.exports = {
	init: add_style,
	exec: run_artwork,
    handle_callback: get_token // Export the callback handler
};