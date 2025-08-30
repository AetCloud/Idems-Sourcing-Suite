const { description, upload } = require('./shared.js');
const {
	artist_commentary,
	string_to_node,
	data_to_nodes,
	common_styles,
	remove_node,
	get_value,
    set_value,
	add_css,
    append
} = require('./../../utils/utils.js');

const OAUTH_URL = 'https://www.deviantart.com/oauth2/authorize';
const TOKEN_URL = 'https://www.deviantart.com/oauth2/token';
const API_BASE_URL = 'https://www.deviantart.com/api/v1/oauth2';
const REDIRECT_URI = 'https://aetcloud.github.io/Idems-Sourcing-Suite/callback.html';

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
    window.location.href = `${OAUTH_URL}?${params.toString()}`;
}

async function get_token(auth_code) {
    const client_id = await get_value('deviantart_client_id');
    const client_secret = await get_value('deviantart_client_secret');
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id,
        client_secret,
        redirect_uri: REDIRECT_URI,
        code: auth_code
    });
    try {
        const response = await fetch(TOKEN_URL, { method: 'POST', body: params });
        const data = await response.json();
        if (data.access_token) {
            await set_value('deviantart_access_token', data.access_token);
            localStorage.removeItem('deviantart_auth_code');
            alert('DeviantArt authorization successful!');
            window.location.reload();
        } else {
            throw new Error(data.error_description || 'Failed to get access token.');
        }
    } catch (error) {
        console.error("ISS (DeviantArt): Error getting access token.", error);
        alert(`DeviantArt authorization failed: ${error.message}`);
    }
}

async function run_artwork () {
	clear_all_setup();
    const auth_code = localStorage.getItem('deviantart_auth_code');
    if (auth_code) {
        await get_token(auth_code);
        return;
    }
	const access_token = await get_value('deviantart_access_token');
    if (!access_token) {
        authorize();
        return;
    }

    const deviation_uuid = await get_deviation_uuid_from_page();
    if (!deviation_uuid) {
        console.error("ISS (DeviantArt): Could not find deviation UUID on the page.");
        return;
    }

	const info = await get_info(deviation_uuid, access_token);
    if (!info) {
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

async function get_deviation_uuid_from_page() {
    // Find the embedded JSON data script tag
    const scriptTag = await document.body.arrive('script[type="application/ld+json"]');
    if (!scriptTag) return null;
    
    try {
        const jsonData = JSON.parse(scriptTag.textContent);
        const url = jsonData.mainEntity['@id'] || jsonData.mainEntity.url;
        // The UUID is the last part of the URL path
        const uuid = url.split('-').pop();
        return uuid;
    } catch (e) {
        console.error("ISS (DeviantArt): Failed to parse embedded JSON-LD data.", e);
        return null;
    }
}

async function get_info(deviation_uuid, access_token) {
    // The official API uses a different endpoint for metadata
    const params = new URLSearchParams({ access_token });
    const API_URL = `${API_BASE_URL}/deviation/${deviation_uuid}?${params.toString()}`;

    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            if (response.status === 401) { // Unauthorized
                console.log("ISS (DeviantArt): Access token is invalid or expired. Re-authorizing...");
                await set_value('deviantart_access_token', null);
                authorize();
                return null;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            sources: get_sources(data),
            description: get_description(data)
        };
    } catch (error) {
        console.error("ISS (DeviantArt): Error fetching from metadata API.", error);
        return null;
    }
}

function get_description(data) {
    const artist = {
        href: data.author.url,
        textContent: data.author.username
    };
    const title = { textContent: data.title };
    // The description is in a separate API call in the new system, so we get it from the page
    const description_node = document.querySelector('[data-hook=description]');
    return artist_commentary(artist, title, description_node);
}

function get_sources(data) {
    const sources = [];
    if (data.content.src) {
        sources.push([data.content.src, 'full image']);
    }
    // The official API response structure is different
    if (data.thumbs && data.thumbs.length > 0) {
        // Find the largest thumbnail as a preview
        const largest_thumb = data.thumbs.reduce((prev, current) => (prev.width > current.width) ? prev : current);
        sources.push([largest_thumb.src, 'preview']);
    }
    return sources;
}

module.exports = {
	init: add_style,
	exec: run_artwork,
    handle_callback: get_token
};