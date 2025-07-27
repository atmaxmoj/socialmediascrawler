// Base crawler class that all platform-specific crawlers inherit from
class BaseCrawler {
  constructor(platform) {
    this.platform = platform;
    this.isRunning = false;
    this.crawledPosts = new Set();
    this.observer = null;
    this.crawlInterval = null;
  }

  // Abstract methods that must be implemented by subclasses
  getSelectors() {
    throw new Error('getSelectors() must be implemented by subclass');
  }

  extractPostData(postElement) {
    throw new Error('extractPostData() must be implemented by subclass');
  }

  // Common methods shared by all crawlers
  createPostId(text, author, timestamp) {
    const content = `${author}-${text.substring(0, 50)}-${timestamp}`;
    return btoa(content).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  parseNumber(text) {
    if (!text) return 0;
    
    // Remove non-numeric characters except k, m, b for thousands/millions/billions
    const cleanText = text.toLowerCase().replace(/[^0-9kmb.]/g, '');
    
    if (cleanText.includes('k')) {
      return Math.floor(parseFloat(cleanText.replace('k', '')) * 1000);
    } else if (cleanText.includes('m')) {
      return Math.floor(parseFloat(cleanText.replace('m', '')) * 1000000);
    } else if (cleanText.includes('b')) {
      return Math.floor(parseFloat(cleanText.replace('b', '')) * 1000000000);
    }
    
    return parseInt(cleanText) || 0;
  }

  async savePost(postData) {
    if (!postData) return;
    
    try {
      // Initialize DB if not already done
      if (!window.postsDB) {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('db.js');
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
      }
      
      await window.postsDB.addPost(postData);
      
      // Get updated count and notify popup
      const count = await window.postsDB.getPostCount();
      chrome.runtime.sendMessage({
        action: 'updatePostCount',
        count: count
      });
      
      console.log(`[${this.platform}] Post saved:`, postData.text.substring(0, 100) + '...');
    } catch (error) {
      console.error(`[${this.platform}] Error saving post:`, error);
    }
  }

  crawlVisiblePosts() {
    const selectors = this.getSelectors();
    const posts = document.querySelectorAll(selectors.postContainer);
    let newPostsCount = 0;
    
    posts.forEach(post => {
      const postData = this.extractPostData(post);
      if (postData) {
        this.savePost(postData);
        newPostsCount++;
      }
    });
    
    if (newPostsCount > 0) {
      console.log(`[${this.platform}] Crawled ${newPostsCount} new posts`);
    }
  }

  startCrawling() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`[${this.platform}] Starting to crawl posts...`);
    
    // Initial crawl
    this.crawlVisiblePosts();
    
    // Set up observer for new posts
    this.observer = new MutationObserver((mutations) => {
      if (!this.isRunning) return;
      
      let shouldCrawl = false;
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldCrawl = true;
        }
      });
      
      if (shouldCrawl) {
        setTimeout(() => this.crawlVisiblePosts(), 1000);
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Periodic crawl for missed posts
    this.crawlInterval = setInterval(() => {
      if (this.isRunning) {
        this.crawlVisiblePosts();
      }
    }, 5000);
  }

  stopCrawling() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log(`[${this.platform}] Stopped crawling posts`);
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.crawlInterval) {
      clearInterval(this.crawlInterval);
      this.crawlInterval = null;
    }
  }
}