const { simple_site, append } = require('./../../utils/utils.js');
const { full_to_thumb } = require('./links.js');

const get_info = async (full_url) => simple_site({
	artist: {
		href: document.querySelector('.submission-id-avatar > a').href,
		// This is the corrected line from the GitHub issue
		textContent: document.querySelector('.submission-id-sub-container a > span').textContent
	},
	title: document.querySelector('.submission-title > h2'),
	description: () => document.querySelector('.submission-description'),
	year: new Date(document.querySelector('.popup_date').title).getFullYear().toString(),
	full_url: full_url,
	hashes: [
		[full_to_thumb(full_url), 'thumb image']
	],
	css: `
		#iss_container { 
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		#iss_container > * { white-space: nowrap; }
		.iss_hash { font-weight: 700; }
		.iss_image_link { margin-right: 0.4rem; }
	`,
	hashes_as_array: true
});

async function exec () {
	// Find the download button.
	const downloadButton = document.querySelector('a.button[href*="d.furaffinity.net/art/"]');

	// If there's no download button, it's not an image submission. Stop here.
	if (!downloadButton) {
		console.log("ISS: FurAffinity plan stopping. No image download button found.");
		return;
	}

	const full_url = downloadButton.href;
	const info = await get_info(full_url);

	const container = document.createElement('div');
	container.id = 'iss_container';
	const more_from = document
		.querySelector('#columnpage .preview-gallery')
		.previousElementSibling;
	more_from.parentNode.insertBefore(container, more_from);

	const header = document.createElement('h2');
	header.innerText = 'idem\'s sourcing suite';
	container.appendChild(header);

	append(container, info.upload);
	append(container, info.description);
	info.hashes.forEach(e => append(container, e));
}

module.exports = exec;

