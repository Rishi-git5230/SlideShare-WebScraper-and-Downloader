const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs');
const path = require('path'); // Required for handling file paths
const { downloadSlidesAsPdf } = require('./downloader'); // Import the function

// Create an interface to read input from the console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// The base URL to filter links is fixed
const baseUrl = "https://www.slideshare.net/";

// Ask the user for the URL to scrape
rl.question('Enter the URL to scrape: ', async (url) => {
  // Extract username from the URL
  const username = extractUsername(url);
  if (!username) {
    console.log('Invalid URL format. Could not extract username.');
    rl.close();
    return;
  }

  // Create a folder with the username if it doesn't exist
  const folderPath = path.join(__dirname, username);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
    console.log(`Folder created: ${folderPath}`);
  } else {
    console.log(`Folder already exists: ${folderPath}`);
  }

  const browser = await puppeteer.launch({ headless: true }); // Use headless: false to see browser action
  const page = await browser.newPage();

  try {
    // Navigate to the provided URL
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for the content to load initially
    console.log("Waiting for the content to load...");
    await page.waitForSelector('div.slideshow-list-container', { timeout: 60000 });

    let allLinks = new Set(); // Use a Set to ensure unique links
    let hasNextPage = true;

    // Loop through the pages until there is no "Next" button or it is disabled
    while (hasNextPage) {
      console.log("Extracting links from the current page...");

      // Simulate scrolling to load all content
      await autoScroll(page);

      // Wait for the links to load
      await page.waitForSelector('a[href^="https://www.slideshare.net/"]', { timeout: 5000 });

      // Extract all links from the page inside the target div
      const links = await page.evaluate((baseUrl) => {
        const linkArray = [];
        // Select anchor tags that start with the base URL
        const anchorTags = document.querySelectorAll('div.slideshow-list-container a[href^="https://www.slideshare.net/"]');
        anchorTags.forEach(anchor => {
          const href = anchor.href;
          if (href && href.startsWith(baseUrl)) {
            linkArray.push(href);
          }
        });
        return linkArray;
      }, baseUrl);

      // Add links to the Set (automatically handles duplicates)
      links.forEach(link => allLinks.add(link));

      console.log(`Total links found so far: ${allLinks.size}`);

      // Check if the "Next" button exists and the href is not "#"
      const nextPageLink = await page.$('li.next_page a'); // The "Next" button

      if (nextPageLink) {
        // Extract the href of the "Next" button
        const nextPageHref = await page.evaluate((nextPageLink) => {
          return nextPageLink.getAttribute('href');
        }, nextPageLink);

        // Check if the "Next" button href is "#"
        if (nextPageHref === "#") {
          console.log("Reached the last page.");
          hasNextPage = false; // Stop if it's the last page
        } else {
          console.log("Moving to the next page...");

          // Construct the full URL for the next page
          const nextPageUrl = new URL(nextPageHref, url).href; // Combine the base URL with the relative link

          // Navigate to the next page
          await page.goto(nextPageUrl, { waitUntil: 'domcontentloaded' });
        }
      } else {
        // No "Next" button found, stop the loop
        console.log("No 'Next' button found. Exiting...");
        hasNextPage = false;
      }
    }

    // Show the number of files to be downloaded
    const totalLinks = allLinks.size;
    console.log(`Total ${totalLinks} files to download for user: ${username}`);

    // Process each link in allLinks set
    let downloadedCount = 0;
    for (const link of allLinks) {
      const fileName = extractFileNameFromLink(link);
      if (fileName) {
        // Call the downloadSlidesAsPdf function for each link
        await downloadSlidesAsPdf(link, `${fileName}.pdf`, username); // Add .pdf extension to the file name
        downloadedCount++;
        console.log(`Downloaded ${downloadedCount} of ${totalLinks} files.`);
      } else {
        console.log(`Could not extract file name from link: ${link}`);
      }
    }

    console.log("All downloads completed!");

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the browser
    await browser.close();
    rl.close(); // Close the readline interface
  }
});

// Function to simulate scrolling to load content
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      let totalHeight = 0;
      let distance = 100;
      let timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

// Function to extract username from the URL
function extractUsername(url) {
  const regex = /https:\/\/www\.slideshare\.net\/([^\/]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Function to extract file name from the link
function extractFileNameFromLink(link) {
  // Updated regex to handle the general format of slideshare.net URLs
  const regex = /slideshare\.net\/[^/]+\/([^/]+)/;
  const match = link.match(regex);
  return match ? match[1] : null;
}
