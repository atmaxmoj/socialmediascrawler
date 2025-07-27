document.addEventListener('DOMContentLoaded', async function() {
  const startBtn = document.getElementById('startCrawl');
  const stopBtn = document.getElementById('stopCrawl');
  const exportJsonBtn = document.getElementById('exportJson');
  const exportCsvBtn = document.getElementById('exportCsv');
  const clearBtn = document.getElementById('clearData');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  const postCountSpan = document.getElementById('postCount');
  const crawlStatusSpan = document.getElementById('crawlStatus');

  // Initialize IndexedDB
  await window.postsDB.init();

  // Check if we're on a supported platform
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    const supportedPlatforms = [
      'twitter.com', 'x.com', 
      'linkedin.com', 
      'reddit.com', 'old.reddit.com',
      'facebook.com', 
      'instagram.com'
    ];
    const isSupported = supportedPlatforms.some(platform => currentUrl.includes(platform));
    
    if (!isSupported) {
      statusDiv.textContent = 'Navigate to a supported social media platform (Twitter/X, LinkedIn, Reddit, Facebook, Instagram)';
      statusDiv.className = 'status error';
      startBtn.disabled = true;
    } else {
      // Show which platform is detected
      let detectedPlatform = 'Unknown';
      if (currentUrl.includes('twitter.com') || currentUrl.includes('x.com')) detectedPlatform = 'Twitter/X';
      else if (currentUrl.includes('linkedin.com')) detectedPlatform = 'LinkedIn';
      else if (currentUrl.includes('reddit.com')) detectedPlatform = 'Reddit';
      else if (currentUrl.includes('facebook.com')) detectedPlatform = 'Facebook';
      else if (currentUrl.includes('instagram.com')) detectedPlatform = 'Instagram';
      
      statusDiv.textContent = `Ready to crawl ${detectedPlatform} posts`;
    }
  });

  // Load saved data count from IndexedDB
  try {
    const count = await window.postsDB.getPostCount();
    postCountSpan.textContent = count;
    if (count > 0) {
      resultsDiv.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading post count:', error);
  }

  startBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'startCrawling'});
      
      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      statusDiv.textContent = 'Crawling in progress...';
      statusDiv.className = 'status crawling';
      crawlStatusSpan.textContent = 'Running';
      resultsDiv.classList.remove('hidden');
    });
  });

  stopBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'stopCrawling'});
      
      stopBtn.classList.add('hidden');
      startBtn.classList.remove('hidden');
      statusDiv.textContent = 'Crawling stopped';
      statusDiv.className = 'status ready';
      crawlStatusSpan.textContent = 'Stopped';
    });
  });

  // Export JSON functionality
  exportJsonBtn.addEventListener('click', async function() {
    try {
      const exportData = await window.postsDB.exportData('json');
      if (!exportData) {
        alert('No data to export');
        return;
      }
      
      const blob = new Blob([exportData.data], {type: exportData.type});
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = exportData.filename;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed');
    }
  });

  // Export CSV functionality
  exportCsvBtn.addEventListener('click', async function() {
    try {
      const exportData = await window.postsDB.exportData('csv');
      if (!exportData) {
        alert('No data to export');
        return;
      }
      
      const blob = new Blob([exportData.data], {type: exportData.type});
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = exportData.filename;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed');
    }
  });

  clearBtn.addEventListener('click', async function() {
    if (confirm('Are you sure you want to clear all crawled data?')) {
      try {
        await window.postsDB.clearAllPosts();
        postCountSpan.textContent = '0';
        resultsDiv.classList.add('hidden');
      } catch (error) {
        console.error('Clear error:', error);
        alert('Failed to clear data');
      }
    }
  });

  // Listen for updates from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updatePostCount') {
      postCountSpan.textContent = request.count;
      resultsDiv.classList.remove('hidden');
    }
  });
});