const { remove_node, simple_site, append } = require('./../../utils/utils.js');
const header = require('./header.js');

// This function will run when a tweet is detected on the page.
async function run_tweet_logic() {
    // --- Determine Context: Are we in the main view or the photo viewer? ---
    const photo_dialog = document.querySelector('div[role="dialog"]');
    let tweet_article;

    if (photo_dialog) {
        // In photo view, the relevant tweet is inside the sidebar of the dialog
        tweet_article = await photo_dialog.arrive('article[data-testid="tweet"]');
    } else {
        // In main view, it's in the primary content column
        const primaryColumn = await document.body.arrive('[data-testid="primaryColumn"]');
        tweet_article = await primaryColumn.arrive('article[data-testid="tweet"]');
    }

    if (!tweet_article) {
        console.log('ISS (Twitter): Could not find the main tweet article. Stopping.');
        return;
    }

    // --- 1. Find the necessary elements within the correct context ---
    const user_info_element = tweet_article.querySelector('[data-testid="User-Name"]');
    if (!user_info_element) {
        console.log('ISS (Twitter): Could not find User-Name element. Stopping.');
        return;
    }
    
    const artist_element = {
        href: user_info_element.querySelector('a[role="link"]').href,
        textContent: user_info_element.querySelector('span > span').textContent
    };

    const description_element = tweet_article.querySelector('[data-testid="tweetText"]');
    const time_element = tweet_article.querySelector('time');
    
    // The image will always be in the dialog if it's open
    const image_element = photo_dialog 
        ? photo_dialog.querySelector('img[src*="pbs.twimg.com"]')
        : tweet_article.querySelector('[data-testid="tweetPhoto"] img');

    if (!image_element) {
        console.log('ISS (Twitter): No image found. Stopping.');
        return;
    }

    // --- 2. Extract and format the data ---
    const year = new Date(time_element.dateTime).getFullYear().toString();
    const sources = produce_sources(image_element.src);
    const info = await simple_site({
        artist: artist_element,
        title: null,
        description: description_element,
        year: year,
        full_url: sources[0][0],
        full_url_name: 'orig',
        hashes: sources.slice(1),
        css: `
            #iss_hashes {
                position: fixed; top: 0px; left: 0px; z-index: 3000; display: flex;
                width: 100%; background-color: #000c; padding: 4px;
                flex-wrap: wrap; gap: 10px; justify-content: center; color: white;
            }
            .iss_hash_span { margin: auto; }
            .iss_image_link { margin-right: 0.5rem; color: #71767b !important; }

            /* Styles for sidebar integration */
            #iss_button_container {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 12px;
                border-top: 1px solid rgb(47, 51, 54);
                padding-top: 12px;
            }
            #iss_upload_link, #iss_artist_commentary {
                color: #71767b; text-decoration: none; font-size: 14px;
                padding: 8px; border-radius: 16px; text-align: center;
                border: 1px solid rgb(83, 100, 113);
                background-color: transparent;
                cursor: pointer;
            }
             #iss_upload_link:hover, #iss_artist_commentary:hover {
                background-color: rgba(239, 243, 244, 0.1);
            }
        `,
        hashes_as_array: false
    });

    // --- 3. Add the UI elements to the page ---
    clear_all_setup();

    const ui_anchor = tweet_article.querySelector('[data-testid="tweetText"]');

    if (ui_anchor) {
        const button_container = document.createElement('div');
        button_container.id = 'iss_button_container';
        
        append(button_container, info.upload);
        append(button_container, info.description);
        
        ui_anchor.parentElement.insertBefore(button_container, ui_anchor.nextSibling);
    } else {
        console.log('ISS (Twitter): Could not find the tweet text to attach buttons.');
    }

    // Only show hashes when the photo viewer is open.
    if (photo_dialog) {
        append(document.body, info.hashes);
    }
}

// Generates different quality versions of the image URL.
function produce_sources(starting_url) {
    const base_url = new URL(starting_url);
    const format = base_url.searchParams.get('format') || 'jpg';
    
    const clean_url_base = `${base_url.origin}${base_url.pathname}.${format}`;
    return [
        [`${clean_url_base}?name=orig`, 'orig'],
        [`${clean_url_base}?name=4096x4096`, '4096'],
        [`${clean_url_base}?name=large`, 'large']
    ];
}

// Checks the URL to decide if the script should run.
function find_site() {
    const tweet_regex = /^\/[A-z0-9_]+\/status\/\d+/;
    const here = new URL(window.location.href);

    if (tweet_regex.test(here.pathname)) {
        console.log('ISS: Twitter status URL detected');
        // A short delay helps ensure the tweet content is fully loaded.
        setTimeout(run_tweet_logic, 500);
    }
}

// Removes old UI elements to prevent duplication.
function clear_all_setup() {
    remove_node(document.getElementById('iss_hashes'));
    const old_container = document.querySelector('#iss_button_container');
    if (old_container) remove_node(old_container);
}

// Main Execution
function exec() {
    // Initial run when the page loads.
    find_site();
    // Re-run whenever the URL changes (for single-page app navigation).
    window.addEventListener('locationchange', find_site);

    // Set up a listener that watches the entire page for changes.
    // This is how we'll know when the photo viewer opens or closes.
    const observer = new MutationObserver(() => find_site());
    observer.observe(document.body, { childList: true, subtree: true });
}

module.exports = {
    ...header,
    exec: exec
};

