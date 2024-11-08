const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// type = AUDIO, VIDEO or BITMAP
async function fetchSingleMedia(titles, type, timestamp) {
	try {
		const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
			params: {
				action: 'query',
				generator: 'images',
				prop: 'imageinfo',
				gimlimit: 500,
				redirects: 1,
				titles: titles,
				// iiprop: 'url',
				format: 'json',
				iiprop: timestamp ? 'url|mediatype|extmetadata' : 'url|mediatype'
			}
		});
		const pages = response.data.query?.pages;
		if (!pages) return null;

		const medias = []
		for (const page of Object.values(pages)) {
			for (const image of page.imageinfo) {
				if (image.mediatype === type) {
					medias.push(image);
				}
			}
		}

		if(!timestamp) { // Gets a random image
			return medias[Math.floor(Math.random() * medias.length)].url;
		} else {
			let closestImage = null;
			let minDifference = Infinity;

			medias.forEach((image) => {
				const dateStr = image.extmetadata.DateTimeOriginal?.value;
				if (dateStr) {
					const imageDate = new Date(dateStr);
					const difference = Math.abs(timestamp - imageDate);
					if (difference < minDifference) {
						minDifference = difference;
						closestImage = image;
					}
				}
			});

			return closestImage.url;
		}
	} catch (error) {
		console.error('Error fetching single image:', error);
		return null;
	}
}

// Helper function to search Wikimedia for a random title
async function fetchRandomTitle() {
	try {
		const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
			params: {
				action: 'query',
				list: 'random',
				rnnamespace: 0,
				rnlimit: 1,
				format: 'json'
			}
		});
		return response.data.query.random[0].title;
	} catch (error) {
		console.error('Error fetching random title:', error);
		return null;
	}
}

app.get('/media/:type/raw', async (req, res) => {
	let {titles, timestamp} = req.query;
	let {type} = req.params;

	try {
		if (!titles) {
			titles = await fetchRandomTitle();
		}

		if (type === "image")
			type = "BITMAP";

		if (type === "audio")
			type = "AUDIO";

		if (type === "video")
			type = "VIDEO";

		const imageUrl = await fetchSingleMedia(titles, type, timestamp ? new Date(timestamp) : null);
		if (!imageUrl) return res.status(404).json({error: 'Media not found'});

		const imageResponse = await axios.get(imageUrl, {responseType: 'arraybuffer'});
		const contentType = imageResponse.headers['content-type'];

		// Set content type based on the image format and send image data as a binary response
		res.setHeader('Content-Type', contentType);
		res.send(imageResponse.data);
	} catch (error) {
		console.error('Error in /image/raw route:', error);
		res.status(500).json({error: 'An error occurred while processing your request'});
	}
});

// Start the server
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
