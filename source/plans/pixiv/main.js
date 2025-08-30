const header = require('./header.js');
const {
	commentary_from_text,
	node_to_dtext,
	commentary_button,
	data_to_span,
	common_styles,
	upload_button,
	get_value,
	add_css,
    remove_node,
    append
} = require('./../../utils/utils.js');

let isRunning = false; // Add a lock to prevent the function from running multiple times

// This function will run when the script detects an artwork page.
async function run_artwork_logic() {
    if (isRunning) {
        console.log("ISS (Pixiv): Artwork logic is already running.");
        return;
    }
    isRunning = true;
    console.log("ISS (Pixiv): Starting artwork logic...");
    clear_all_setup();

    try {
        // Wait for the container that holds both the figure and figcaption
        const artworkContainer = await document.body.arrive('main .sc-f473edfb-1');
        if (!artworkContainer) {
            isRunning = false; // Release lock
            return;
        }

        // Now, find the figcaption and artist element
        const [figcaption, artist_element] = await Promise.all([
            artworkContainer.arrive('figcaption'),
            document.body.arrive('aside a[data-gtm-value][href*="/users/"]')
        ]);

        if (!figcaption || !artist_element) {
            isRunning = false; // Release lock
            return;
        }
        
        // Find the main content container within the figcaption
        const contentContainer = figcaption.querySelector('div[class*="sc-d4cbc2e2"]');
        if (!contentContainer) {
            isRunning = false; // Release lock
            return;
        }

        // Use more robust selectors
        const description_element = contentContainer.querySelector('[id^="expandable-paragraph"]');
        
        if (!description_element) {
            isRunning = false; // Release lock
            return;
        }
        
        const date_element = figcaption.querySelector('time[datetime]');
        const ui_anchor = figcaption.querySelector('footer');

        if (!date_element || !ui_anchor) {
            isRunning = false; // Release lock
            return;
        }
        
        const year = new Date(date_element.dateTime).getFullYear().toString();
        
        // Use document.title for the commentary title as a fallback
        const title_text = document.title.split('/')[1].trim() || "Untitled";
        const description_dtext = node_to_dtext(description_element);
        const commentary = commentary_from_text(artist_element.textContent, artist_element.href, title_text, description_dtext);
        
        const sources = get_sources();

        if (sources.length === 0) {
            isRunning = false; // Release lock
            return;
        }

        const info = await get_value_object(commentary, artist_element.href, [year], sources);

        const button_container = document.createElement('div');
        button_container.id = 'iss_button_container';
        
        append(button_container, info.upload);
        append(button_container, info.description);
        append(button_container, info.hashes);

        ui_anchor.parentElement.insertBefore(button_container, ui_anchor);
        console.log("ISS (Pixiv): Artwork logic finished successfully.");

    } catch (error) {
        console.error("ISS (Pixiv): An unexpected error occurred in run_artwork_logic.", error);
    } finally {
        isRunning = false; // Release lock
    }
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
    // Correctly target the link that wraps the image, as it contains the direct URL to the original file
    const image_links = Array.from(document.querySelectorAll('main [role="presentation"] a[href*="i.pximg.net/img-original"]'));
    
    return image_links.map((link, i) => {
        return [link.href, `Image ${i+1}`];
    });
}


// Checks if the current URL is an artwork page.
function find_site() {
    const artworks = /^\/en\/artworks\/\d+/;
    if (artworks.test(window.location.pathname)) {
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