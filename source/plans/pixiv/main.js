const header = require('./header.js');
const {
	artist_commentary,
	commentary_button,
	data_to_span,
	common_styles,
	upload_button,
	get_value,
	add_css,
    remove_node,
    append
} = require('./../../utils/utils.js');

// This function will run when the script detects an artwork page.
async function run_artwork_logic() {
    clear_all_setup();

    // Wait for both the main content AND the sidebar artist link. This prevents race conditions on refresh.
    const [figcaption, artist_element] = await Promise.all([
        document.body.arrive('main figure figcaption'),
        document.body.arrive('aside a[data-gtm-value][href*="/users/"]')
    ]);

    if (!figcaption || !artist_element) {
        console.log("ISS (Pixiv): Timed out waiting for essential elements. Stopping.");
        return;
    }
    
    // Now that we know the core components are loaded, we can safely find the rest.
    const title_element = figcaption.querySelector('h1');
    const description_element = figcaption.querySelector('.sc-d4cbc2e2-0'); // The div containing the caption
    const date_element = figcaption.querySelector('time[datetime]');
    const ui_anchor = figcaption.querySelector('footer');

    if (!title_element || !date_element || !ui_anchor) {
        console.log("ISS (Pixiv): Missing elements within the figcaption. Stopping.");
        return;
    }
    
    const year = new Date(date_element.dateTime).getFullYear().toString();
    const commentary = artist_commentary(artist_element, title_element, description_element);
    const sources = get_sources();

    if (sources.length === 0) {
        console.log("ISS (Pixiv): No image sources found. Stopping.");
        return;
    }

    const info = await get_value_object(commentary, artist_element.href, [year], sources);

    const button_container = document.createElement('div');
    button_container.id = 'iss_button_container';
    
    append(button_container, info.upload);
    append(button_container, info.description);
    append(button_container, info.hashes);

    ui_anchor.parentElement.insertBefore(button_container, ui_anchor);
}

// Helper to build the object for the UI elements
async function get_value_object(commentary, artist_url, tags = [], sources) {
    const on_site_commentary = await get_value('on_site_commentary_enabled');
    const on_site_upload = await get_value('on_site_upload_enabled');
    const on_site_hasher = await get_value('on_site_hasher_enabled');

    return {
        description: on_site_commentary ? commentary_button(commentary) : null,
        upload: on_site_upload ? upload_button(sources[0][0], [window.location.href, sources[0][0], artist_url], commentary, tags) : null,
        hashes: on_site_hasher ? data_to_span(sources) : null
    };
}

// Finds all image sources.
function get_sources() {
    const images = Array.from(document.querySelectorAll('main [role="presentation"] img'));
    
    return images.map((img, i) => {
        // Reconstruct the original image URL from the thumbnail/master URL
        let hires_url = img.src.replace('i.pximg.net/c/250x250_80_a2/img-master/', 'i.pximg.net/img-original/');
        hires_url = hires_url.replace(/_master\d+\./, '.').replace(/_square\d+\./,'.');
        return [hires_url, `Image ${i+1}`];
    });
}

// Checks if the current URL is an artwork page.
function find_site() {
    const artworks = /^\/en\/artworks\/\d+/;
    if (artworks.test(window.location.pathname)) {
        console.log('ISS: Pixiv artwork URL detected');
        run_artwork_logic();
    } else {
        clear_all_setup();
    }
}

// Removes old UI elements.
function clear_all_setup() {
    remove_node(document.getElementById('iss_button_container'));
    remove_node(document.getElementById('iss_hashes'));
}

// Main Execution
function exec() {
    common_styles();
    add_css(`
        #iss_button_container { margin: 16px 0; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #efefef; padding-top: 16px; }
        #iss_upload_link, #iss_artist_commentary { color: #333 !important; border: 1px solid #ddd; padding: 8px; border-radius: 8px; text-align: center; cursor: pointer; background: white; }
        #iss_upload_link:hover, #iss_artist_commentary:hover { background-color: #f7f7f7; }
        #iss_hashes { display: flex; flex-direction: column; gap: 5px; }
        .iss_image_link { color: #888 !important; }
    `);
    
    // Use a MutationObserver to detect navigation changes.
    let lastUrl = ''; 
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            // A brief delay helps ensure the old page content is gone before we run on the new one
            setTimeout(find_site, 500);
        }
    }).observe(document.body, { subtree: true, childList: true });

    // Initial run for the first page load
    find_site();
}

module.exports = {
    ...header,
    exec: exec
};

