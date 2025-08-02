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
  } else if (hostname.includes('tiktok.com')) {
    return 'tiktok';
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
      return new FacebookCrawler();
    case 'tiktok':
      return new TikTokCrawler();
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

console.log('Current URL:', window.location.href);
console.log('Detected platform:', platform);

if (platform !== 'unknown') {
  crawler = createCrawler(platform);
  if (crawler) {
    console.log(`[${platform}] Social Media Crawler loaded successfully`);
    
    // Create control panel after DOM is ready
    setTimeout(() => {
      crawler.createControlPanel();
      console.log(`[${platform}] Control panel created`);
    }, 2000);
    
    // Debug logging removed to reduce console noise
  } else {
    console.log(`[${platform}] Crawler not available for this platform`);
  }
} else {
  console.log('Unknown platform, crawler not initialized');
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Received message:', request);
  
  if (request.action === 'startCrawling') {
    if (!crawler) {
      console.log('[Content] No crawler available for this platform');
      sendResponse({status: 'error', message: 'Crawler not available for this platform'});
      return true;
    }
    
    console.log('[Content] Starting crawler...');
    crawler.startCrawling();
    sendResponse({status: 'started'});
    return true;
    
  } else if (request.action === 'stopCrawling') {
    if (!crawler) {
      console.log('[Content] No crawler to stop');
      sendResponse({status: 'error', message: 'No crawler running'});
      return true;
    }
    
    console.log('[Content] Stopping crawler...');
    crawler.stopCrawling();
    sendResponse({status: 'stopped'});
    return true;
    
  } else if (request.action === 'getCrawlerStatus') {
    // Return the actual crawler state from content script
    const actualState = {
      isRunning: crawler ? crawler.isRunning : false,
      platform: platform,
      crawlerExists: !!crawler
    };
    console.log('[Content] Returning actual crawler status:', actualState);
    sendResponse(actualState);
    return true;
  }
  
  console.log('[Content] Unknown action:', request.action);
  sendResponse({status: 'error', message: 'Unknown action'});
  return true;
});