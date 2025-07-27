// Background service worker for the Social Media Posts Crawler extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Social Media Posts Crawler extension installed');
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updatePostCount') {
    // Forward message to popup if it's open
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup might not be open, ignore error
    });
  }
});

// Optional: Add context menu for quick access
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'startCrawling') {
    chrome.tabs.sendMessage(tab.id, {action: 'startCrawling'});
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'startCrawling',
    title: 'Start Crawling Posts',
    contexts: ['page'],
    documentUrlPatterns: [
      'https://twitter.com/*',
      'https://x.com/*',
      'https://linkedin.com/*',
      'https://facebook.com/*',
      'https://instagram.com/*'
    ]
  });
});