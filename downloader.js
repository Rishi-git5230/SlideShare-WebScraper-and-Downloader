const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Function to send POST request, extract image links, and save the PDF
async function downloadSlidesAsPdf(url, filename, username) {
    try {
        // Define the payload with dynamic URL and other parameters
        const payload = {
            codehap_link: url,
            qu: 'high',
            curl: 'https://slidesharesdownloader.com/'
        };

        // Make the first POST request to the specified URL with the payload
        const response = await axios.post('https://slidesharesdownloader.com/result.php', payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
        });

        // Initialize a Set to store the image URLs (to avoid duplicates)
        const imageLinks = new Set();

        // Extract links using regular expression from the response data
        if (typeof response.data === 'string') {
            const regex = /https:\/\/image\.slidesharecdn\.com\/[^\s"]+/g;
            const matches = response.data.match(regex);  // Find all matching links
            if (matches) {
                // Filter the links to only include high-res images with -2048.jpg
                matches.forEach(url => {
                    if (url.includes('-2048.jpg')) {
                        imageLinks.add(url);  // Using Set to avoid duplicates automatically
                    }
                });
            }
        }

        // Convert the Set to an array of unique image URLs
        const filteredImageLinks = Array.from(imageLinks);
        //console.log('Extracted Image Links:', filteredImageLinks);

        // Check if we have valid image links to send for PDF generation
        if (filteredImageLinks.length > 0) {
            const pdfPayload = {};

            // Add each image link to the payload as a separate field
            filteredImageLinks.forEach((url, index) => {
                pdfPayload[`selectedImages[${index}]`] = url;
            });

            // Send the second POST request to generate the PDF
            const pdfResponse = await axios.post('https://slidesharesdownloader.com/pdf.php', pdfPayload, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                responseType: 'arraybuffer', // Receive the response as a binary stream (arraybuffer)
            });

            // Check if we got valid binary data for the PDF
            if (pdfResponse.data) {
                // Create the directory for the username if it doesn't exist
                const userDir = path.join(__dirname, username);
                if (!fs.existsSync(userDir)) {
                    fs.mkdirSync(userDir); // Create the directory if it doesn't exist
                }

                // Generate the full file path for the PDF
                const filePath = path.join(userDir, filename);

                // Write the binary data to the PDF file
                fs.writeFileSync(filePath, pdfResponse.data);

                console.log(`PDF downloaded successfully: ${filePath}`);
            } else {
                console.error('No PDF data returned.');
            }
        } else {
            console.log('No valid image links to send for PDF generation.');
        }

    } catch (error) {
        // Handle any errors that occur during the request
        console.error('Error during the process:', error.message);
    }
}

// Export the function so it can be used in other files
module.exports = { downloadSlidesAsPdf };
