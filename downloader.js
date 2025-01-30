const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Define the first payload with the specified parameters
const payload = {
    codehap_link: 'https://www.slideshare.net/slideshow/storytelling-for-the-web-integrate-storytelling-in-your-design-process/269527754',
    qu: 'high',
    curl: 'https://slidesharesdownloader.com/'
};

// Function to send the POST request and extract the image links
async function sendPostRequest() {
    try {
        // Make the first POST request to the specified URL with the payload
        const response = await axios.post('https://slidesharesdownloader.com/result.php', payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
        });

        // Initialize an empty array to store the image URLs
        const imageLinks = new Set(); // Using Set to avoid duplicates automatically

        // Extract links using regular expression from response data (assuming it's a string)
        if (typeof response.data === 'string') {
            const regex = /https:\/\/image\.slidesharecdn\.com\/[^\s"]+/g;
            const matches = response.data.match(regex);  // Find all matching links
            if (matches) {
                // Filter the links to only include high-res images with -2048.jpg
                matches.forEach(url => {
                    if (url.includes('-2048.jpg')) {  // Ensure only high-res images are included
                        imageLinks.add(url); // Using Set will automatically remove duplicates
                    }
                });
            }
        }

        // Convert the Set back to an array (Set will automatically remove duplicates)
        const filteredImageLinks = Array.from(imageLinks);

        console.log('Extracted Image Links:', filteredImageLinks);

        // Send a second POST request to pdf.php with the extracted image links
        if (filteredImageLinks.length > 0) {
            const pdfPayload = {};

            // Add each image link as a separate field to the payload (not as an array)
            filteredImageLinks.forEach((url, index) => {
                pdfPayload[`selectedImages[${index}]`] = url;
            });

            const pdfResponse = await axios.post('https://slidesharesdownloader.com/pdf.php', pdfPayload, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                responseType: 'arraybuffer', // Receive the response as a binary stream (arraybuffer)
            });

            // Check if we got binary data for the PDF
            if (pdfResponse.data) {
                // Generate a file name for the PDF
                const fileName = 'slideshare_downloaded.pdf'; // You can customize this if needed
                const filePath = path.join(__dirname, fileName);

                // Write the binary data to a PDF file
                fs.writeFileSync(filePath, pdfResponse.data);

                console.log(`PDF downloaded successfully: ${filePath}`);
            } else {
                console.error('No PDF data returned.');
            }
        } else {
            console.log('No images to send for PDF generation.');
        }

    } catch (error) {
        // Handle any errors that occur during the request
        console.error('Error during POST request:', error.message);
    }
}

// Call the function to send the POST request and handle the entire flow
sendPostRequest();
