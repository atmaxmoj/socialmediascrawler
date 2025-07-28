// Background service worker with state management
console.log('Social Media Crawler background script initialized');

// State management
let crawlerState = {
  isRunning: false,
  tabId: null,
  postCount: 0,
  startTime: null
};

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed successfully');
  // Initialize storage
  chrome.storage.local.set({ crawlerState: crawlerState });
});

// Restore state on startup
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get('crawlerState');
  if (result.crawlerState) {
    crawlerState = result.crawlerState;
    console.log('Restored crawler state:', crawlerState);
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request, 'from tab:', sender.tab?.id);
  
  switch (request.action) {
    case 'getCrawlerState':
      sendResponse(crawlerState);
      break;
      
    case 'startCrawling':
      crawlerState.isRunning = true;
      crawlerState.tabId = request.tabId || sender.tab?.id;
      crawlerState.startTime = Date.now();
      saveCrawlerState();
      console.log('[Background] Started crawling on tab:', crawlerState.tabId);
      sendResponse({ success: true, state: crawlerState });
      break;
      
    case 'stopCrawling':
      crawlerState.isRunning = false;
      saveCrawlerState();
      sendResponse({ success: true, state: crawlerState });
      break;
      
    case 'updatePostCount':
      crawlerState.postCount = request.count;
      saveCrawlerState();
      // Forward to popup if open
      chrome.runtime.sendMessage(request).catch(() => {});
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, message: 'Unknown action' });
  }
  
  return true; // Keep message channel open for async response
});

// Save state to storage
function saveCrawlerState() {
  chrome.storage.local.set({ crawlerState: crawlerState });
}

// Monitor tab changes and cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  if (crawlerState.tabId === tabId) {
    console.log('Crawler tab closed, stopping crawler');
    crawlerState.isRunning = false;
    crawlerState.tabId = null;
    saveCrawlerState();
  }
});

// Keep service worker alive
let keepAlive = () => {
  chrome.storage.local.get('keepAlive').then((result) => {
    chrome.storage.local.set({ keepAlive: Date.now() });
  });
};

// Call keepAlive every 20 seconds
setInterval(keepAlive, 20000);

console.log('Background script ready with state management');