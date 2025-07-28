document.addEventListener('DOMContentLoaded', async function() {
  const startBtn = document.getElementById('startCrawler');
  const statusDiv = document.getElementById('status');
  
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
      statusDiv.innerHTML = '<div class="icon">⚠️</div>Navigate to a supported social media platform<br>(Twitter/X, LinkedIn, Reddit, Facebook, Instagram)';
      statusDiv.className = 'status error';
      startBtn.disabled = true;
      return;
    }
    
    // Show which platform is detected
    let detectedPlatform = 'Unknown';
    if (currentUrl.includes('twitter.com') || currentUrl.includes('x.com')) detectedPlatform = 'Twitter/X';
    else if (currentUrl.includes('linkedin.com')) detectedPlatform = 'LinkedIn';
    else if (currentUrl.includes('reddit.com')) detectedPlatform = 'Reddit';
    else if (currentUrl.includes('facebook.com')) detectedPlatform = 'Facebook';
    else if (currentUrl.includes('instagram.com')) detectedPlatform = 'Instagram';
    
    statusDiv.innerHTML = `<div class="icon">✅</div>Ready to crawl ${detectedPlatform} posts`;
    statusDiv.className = 'status ready';
  });
  
  startBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
      const tabId = tabs[0].id;
      
      try {
        statusDiv.innerHTML = '<div class="icon">⚙️</div>Initializing crawler...';
        statusDiv.className = 'status info';
        startBtn.disabled = true;
        
        // First, check if scripts are already injected by testing for existing global variables
        const checkResult = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            return {
              hasPostsDB: typeof window.postsDB !== 'undefined',
              hasBaseCrawler: typeof BaseCrawler !== 'undefined',
              hasTwitterCrawler: typeof TwitterCrawler !== 'undefined',
              hasCrawler: typeof crawler !== 'undefined'
            };
          }
        });
        
        const alreadyInjected = checkResult[0].result;
        console.log('Scripts already injected:', alreadyInjected);
        
        if (alreadyInjected.hasCrawler) {
          // Scripts already loaded, just refresh the page to clean up and re-inject
          statusDiv.innerHTML = '<div class="icon">🔄</div>Refreshing page to reinitialize...';
          await chrome.tabs.reload(tabId);
          
          // Wait for page to reload
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Inject content scripts in proper order with delays between each step
        statusDiv.innerHTML = '<div class="icon">1️⃣</div>Loading database...';
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['db.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        statusDiv.innerHTML = '<div class="icon">2️⃣</div>Loading base crawler...';
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['crawlers/base-crawler.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        statusDiv.innerHTML = '<div class="icon">3️⃣</div>Loading platform crawlers...';
        // Inject each platform crawler separately to ensure proper loading
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['crawlers/twitter-crawler.js']
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['crawlers/linkedin-crawler.js']
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['crawlers/reddit-crawler.js']
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        
        statusDiv.innerHTML = '<div class="icon">4️⃣</div>Loading content script...';
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        // Wait for all scripts to initialize
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        statusDiv.innerHTML = '<div class="icon">🎛️</div>Crawler activated!<br>Check the floating panel on the webpage';
        statusDiv.className = 'status info';
        
        // Show success message for 3 seconds, then close popup
        setTimeout(() => {
          window.close();
        }, 3000);
        
      } catch (error) {
        console.error('Error starting crawler:', error);
        statusDiv.innerHTML = '<div class="icon">❌</div>Failed to start crawler<br>Please refresh the page and try again';
        statusDiv.className = 'status error';
        startBtn.disabled = false;
      }
    });
  });
});