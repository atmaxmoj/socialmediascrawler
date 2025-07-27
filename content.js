// Platform detection and crawler factory
function detectPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    return 'twitter';
  } else if (hostname.includes('linkedin.com')) {
    return 'linkedin';
  } else if (hostname.includes('reddit.com')) {
    return 'reddit';
  } else if (hostname.includes('facebook.com')) {
    return 'facebook';
  } else if (hostname.includes('instagram.com')) {
    return 'instagram';
  }
  return 'unknown';
}

function createCrawler(platform) {
  switch (platform) {
    case 'twitter':
      return new TwitterCrawler();
    case 'linkedin':
      return new LinkedInCrawler();
    case 'reddit':
      return new RedditCrawler();
    case 'facebook':
      // TODO: Implement FacebookCrawler
      console.warn('Facebook crawler not yet implemented');
      return null;
    case 'instagram':
      // TODO: Implement InstagramCrawler
      console.warn('Instagram crawler not yet implemented');
      return null;
    default:
      console.warn('Unsupported platform:', platform);
      return null;
  }
}

// Initialize crawler based on current platform
const platform = detectPlatform();
let crawler = null;

if (platform !== 'unknown') {
  crawler = createCrawler(platform);
  if (crawler) {
    console.log(`[${platform}] Social Media Crawler loaded`);
  } else {
    console.log(`[${platform}] Crawler not available for this platform`);
  }
} else {
  console.log('Unknown platform, crawler not initialized');
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!crawler) {
    sendResponse({status: 'error', message: 'Crawler not available for this platform'});
    return;
  }

  if (request.action === 'startCrawling') {
    crawler.startCrawling();
    sendResponse({status: 'started'});
  } else if (request.action === 'stopCrawling') {
    crawler.stopCrawling();
    sendResponse({status: 'stopped'});
  }
});