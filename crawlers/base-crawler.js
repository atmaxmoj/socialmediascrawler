// Base crawler class that all platform-specific crawlers inherit from
class BaseCrawler {
  constructor(platform) {
    this.platform = platform;
    this.isRunning = false;
    this.crawledPosts = new Set();
    this.observer = null;
    this.crawlInterval = null;
    this.scrollInterval = null;
    this.lastScrollHeight = 0;
    this.noNewContentCount = 0;
    this.controlPanel = null;
    this.postCountElement = null;
    this.currentContentElement = null;
  }

  // Abstract methods that must be implemented by subclasses
  getSelectors() {
    throw new Error('getSelectors() must be implemented by subclass');
  }

  extractPostData(postElement) {
    throw new Error('extractPostData() must be implemented by subclass');
  }

  // Extract post data for display purposes (bypassing crawled check)
  extractPostDataForDisplay(postElement) {
    // Default implementation - just delegates to the main method but without duplicate checking
    return this.extractPostData(postElement);
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
    if (!postData) {
      console.warn(`[${this.platform}] No post data to save`);
      return false;
    }
    
    try {
      console.log(`[${this.platform}] Attempting to save post:`, postData);
      
      // Check if DB is available
      if (!window.postsDB) {
        console.log(`[${this.platform}] PostsDB not found, should be initialized from manifest`);
        return false;
      }
      
      // Ensure DB is initialized
      if (!window.postsDB.db) {
        console.log(`[${this.platform}] Initializing PostsDB...`);
        await window.postsDB.init();
      }
      
      console.log(`[${this.platform}] Adding post to database...`);
      const result = await window.postsDB.addPost(postData);
      console.log(`[${this.platform}] Post added successfully:`, result);
      
      // ONLY mark as crawled if successfully saved to database
      this.crawledPosts.add(postData.id);
      console.log(`[${this.platform}] Post marked as crawled in memory: ${postData.id}`);
      
      // Get updated count and update control panel
      const count = await window.postsDB.getPostCount();
      console.log(`[${this.platform}] Current post count: ${count}`);
      
      this.updatePostCount(count);
      
      // Send message to background script (with error handling for context invalidation)
      try {
        chrome.runtime.sendMessage({
          action: 'updatePostCount',
          count: count
        });
      } catch (error) {
        console.log(`[${this.platform}] Extension context invalidated, skipping background message:`, error);
        // Continue without sending message - this is not critical for functionality
      }
      
      console.log(`[${this.platform}] Post saved successfully:`, postData.text.substring(0, 100) + '...');
      return true;
    } catch (error) {
      console.error(`[${this.platform}] Error saving post:`, error);
      console.error(`[${this.platform}] Post data that failed:`, postData);
      // DO NOT mark as crawled if save failed - allow retry
      return false;
    }
  }

  createControlPanel() {
    // Remove existing panel if it exists
    if (this.controlPanel) {
      this.controlPanel.remove();
    }

    // Inject CSS file first
    this.injectCSS();

    // Create control panel container
    this.controlPanel = document.createElement('div');
    this.controlPanel.id = 'social-media-crawler-panel';
    this.controlPanel.innerHTML = `
      <div class="header">
        <div class="pulse-dot"></div>
        Social Media Crawler
      </div>
      
      <div class="status-info">
        <div class="status-line">Platform: ${this.platform.toUpperCase()}</div>
        <div class="status-line">Status: <span id="crawler-status">Stopped</span></div>
        <div class="status-line">Posts: <span id="crawler-post-count">0</span></div>
      </div>
      
      <div id="current-content-card">
        <div class="label">Currently Viewing:</div>
        <div id="current-content-text"></div>
        <div id="already-recorded-indicator" class="already-recorded">
          ✓ Already Recorded
        </div>
      </div>
      
      <div class="button-row">
        <button id="crawler-start-btn">Start</button>
        <button id="crawler-stop-btn">Stop</button>
      </div>
      
      <div class="button-row-small">
        <button id="crawler-export-json" class="small-btn">JSON</button>
        <button id="crawler-export-csv" class="small-btn">CSV</button>
        <button id="crawler-clear-data" class="small-btn">Clear</button>
      </div>
    `;

    document.body.appendChild(this.controlPanel);

    // Get references to elements
    this.postCountElement = document.getElementById('crawler-post-count');
    this.currentContentElement = document.getElementById('current-content-text');
    const statusElement = document.getElementById('crawler-status');
    const startBtn = document.getElementById('crawler-start-btn');
    const stopBtn = document.getElementById('crawler-stop-btn');
    const exportJsonBtn = document.getElementById('crawler-export-json');
    const exportCsvBtn = document.getElementById('crawler-export-csv');
    const clearBtn = document.getElementById('crawler-clear-data');

    // Add event listeners
    startBtn.addEventListener('click', () => {
      this.startCrawling();
      startBtn.style.display = 'none';
      stopBtn.style.display = 'block';
      statusElement.textContent = 'Running';
    });

    stopBtn.addEventListener('click', () => {
      this.stopCrawling();
      stopBtn.style.display = 'none';
      startBtn.style.display = 'block';
      statusElement.textContent = 'Stopped';
    });

    exportJsonBtn.addEventListener('click', () => this.exportData('json'));
    exportCsvBtn.addEventListener('click', () => this.exportData('csv'));
    clearBtn.addEventListener('click', () => this.clearData());

    // Initialize post count
    this.loadPostCount();
  }

  injectCSS() {
    // Check if CSS is already injected
    if (document.getElementById('social-media-crawler-css')) {
      return;
    }

    const cssText = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      #social-media-crawler-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        color: white;
        min-width: 280px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      #social-media-crawler-panel .header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        font-weight: 600;
        font-size: 16px;
      }

      #social-media-crawler-panel .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        animation: pulse 2s infinite;
      }

      #social-media-crawler-panel .status-info {
        margin-bottom: 12px;
      }

      #social-media-crawler-panel .status-line {
        font-size: 12px;
        opacity: 0.8;
        margin-bottom: 4px;
      }

      #current-content-card {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 12px;
        border-left: 3px solid #10b981;
        display: none;
      }

      #current-content-card .label {
        font-size: 11px;
        opacity: 0.7;
        margin-bottom: 4px;
      }

      #current-content-text {
        font-size: 11px;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      #social-media-crawler-panel .button-row {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      #social-media-crawler-panel .button-row-small {
        display: flex;
        gap: 8px;
      }

      #social-media-crawler-panel button {
        flex: 1;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        color: white;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      #social-media-crawler-panel button:hover {
        transform: translateY(-1px);
      }

      #crawler-start-btn {
        background: #10b981;
      }

      #crawler-start-btn:hover {
        background: #059669;
      }

      #crawler-stop-btn {
        background: #ef4444;
        display: none;
      }

      #crawler-stop-btn:hover {
        background: #dc2626;
      }

      #social-media-crawler-panel .small-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 6px 8px;
        font-size: 11px;
      }

      #social-media-crawler-panel .small-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .already-recorded {
        display: none;
        font-size: 10px;
        color: #10b981;
        background: rgba(16, 185, 129, 0.2);
        padding: 4px 8px;
        border-radius: 4px;
        margin-top: 6px;
        text-align: center;
        font-weight: 500;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
    `;

    const style = document.createElement('style');
    style.id = 'social-media-crawler-css';
    style.textContent = cssText;
    document.head.appendChild(style);
  }

  async loadPostCount() {
    try {
      if (window.postsDB) {
        if (!window.postsDB.db) {
          await window.postsDB.init();
        }
        const count = await window.postsDB.getPostCount();
        this.updatePostCount(count);
      }
    } catch (error) {
      console.error(`[${this.platform}] Error loading post count:`, error);
    }
  }

  async loadExistingPostIds() {
    try {
      console.log(`[${this.platform}] Loading existing post IDs from database...`);
      
      if (!window.postsDB) {
        console.log(`[${this.platform}] PostsDB not available, starting with empty crawled posts set`);
        return;
      }
      
      if (!window.postsDB.db) {
        await window.postsDB.init();
      }
      
      // Get all existing posts for this platform
      const existingPosts = await window.postsDB.getPostsByPlatform(this.platform);
      console.log(`[${this.platform}] Found ${existingPosts.length} existing posts in database`);
      
      // Clear current set and repopulate with existing IDs
      this.crawledPosts.clear();
      existingPosts.forEach(post => {
        this.crawledPosts.add(post.id);
      });
      
      console.log(`[${this.platform}] Loaded ${this.crawledPosts.size} post IDs into memory to avoid duplicates`);
    } catch (error) {
      console.error(`[${this.platform}] Error loading existing post IDs:`, error);
      console.log(`[${this.platform}] Continuing with empty crawled posts set`);
    }
  }

  updatePostCount(count) {
    if (this.postCountElement) {
      this.postCountElement.textContent = count;
    }
  }

  updateCurrentContent(text) {
    console.log(`[${this.platform}] updateCurrentContent called with text:`, text ? text.substring(0, 100) : 'null/empty');
    
    if (this.currentContentElement && text) {
      // Limit to 50 characters and add ellipsis
      const displayText = text.length > 50 ? text.substring(0, 50) + '...' : text;
      this.currentContentElement.textContent = displayText;
      console.log(`[${this.platform}] Updated current content element with:`, displayText);
      
      // Show the current content card
      const card = document.getElementById('current-content-card');
      if (card) {
        card.style.display = 'block';
        console.log(`[${this.platform}] Showed current content card`);
      } else {
        console.error(`[${this.platform}] Could not find current content card element`);
      }
    } else {
      console.warn(`[${this.platform}] updateCurrentContent failed - element:`, !!this.currentContentElement, 'text:', !!text);
    }
  }

  hideCurrentContent() {
    const card = document.getElementById('current-content-card');
    if (card) {
      card.style.display = 'none';
    }
  }

  showAlreadyRecordedIndicator() {
    const indicator = document.getElementById('already-recorded-indicator');
    if (indicator) {
      indicator.style.display = 'block';
      console.log(`[${this.platform}] Showed "Already Recorded" indicator`);
    }
  }

  hideAlreadyRecordedIndicator() {
    const indicator = document.getElementById('already-recorded-indicator');
    if (indicator) {
      indicator.style.display = 'none';
      console.log(`[${this.platform}] Hid "Already Recorded" indicator`);
    }
  }

  async exportData(format) {
    try {
      console.log(`[${this.platform}] Exporting data in ${format} format...`);
      
      if (!window.postsDB) {
        alert('Database not available');
        return;
      }

      const count = await window.postsDB.getPostCount();
      if (count === 0) {
        alert('No data to export');
        return;
      }

      const exportData = await window.postsDB.exportData(format);
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
      console.log(`[${this.platform}] Export completed successfully`);
    } catch (error) {
      console.error(`[${this.platform}] Export error:`, error);
      alert('Export failed: ' + error.message);
    }
  }

  async clearData() {
    if (!confirm('Are you sure you want to clear all crawled data?')) {
      return;
    }

    try {
      console.log(`[${this.platform}] Clearing all posts...`);
      
      if (!window.postsDB) {
        alert('Database not available');
        return;
      }

      await window.postsDB.clearAllPosts();
      const newCount = await window.postsDB.getPostCount();
      this.updatePostCount(newCount);
      
      // Also clear the in-memory crawled posts set
      this.crawledPosts.clear();
      console.log(`[${this.platform}] Cleared ${this.crawledPosts.size} posts from memory`);
      
      // Send message to background script (with error handling for context invalidation)
      try {
        chrome.runtime.sendMessage({action: 'updatePostCount', count: newCount});
      } catch (error) {
        console.log(`[${this.platform}] Extension context invalidated, skipping background message:`, error);
      }
      
      console.log(`[${this.platform}] Posts cleared successfully`);
    } catch (error) {
      console.error(`[${this.platform}] Clear error:`, error);
      alert('Failed to clear data');
    }
  }

  // Process the post currently at the top of viewport
  processTopPost() {
    const selectors = this.getSelectors();
    const posts = document.querySelectorAll(selectors.postContainer);
    
    // Find the post that's currently at the top of the viewport
    const topPost = this.getTopPostInViewport(posts);
    
    if (!topPost) {
      console.log(`[${this.platform}] No post found at top of viewport`);
      return false;
    }
    
    console.log(`[${this.platform}] Processing top post in viewport`);
    
    // Always update "Currently Viewing" to show what's at the top
    const displayData = this.extractPostDataForDisplay(topPost);
    if (displayData && displayData.text) {
      this.updateCurrentContent(displayData.text);
      console.log(`[${this.platform}] Updated "Currently Viewing" to: ${displayData.text.substring(0, 50)}...`);
    }
    
    // Try to extract and save the post if not already crawled
    const postData = this.extractPostData(topPost);
    if (postData && postData.text && !this.crawledPosts.has(postData.id)) {
      console.log(`[${this.platform}] Recording new top post: ${postData.text.substring(0, 50)}...`);
      this.hideAlreadyRecordedIndicator(); // Hide indicator for new posts
      this.savePost(postData);
      return true; // Successfully processed new post
    } else if (postData && this.crawledPosts.has(postData.id)) {
      console.log(`[${this.platform}] Top post already recorded, showing indicator`);
      this.showAlreadyRecordedIndicator(); // Show indicator for already recorded posts
      return false; // Already processed, should move to next
    }
    
    return false;
  }
  
  // Get the post that's currently at the top of the viewport
  getTopPostInViewport(posts) {
    const viewportTop = window.scrollY;
    const viewportHeight = window.innerHeight;
    const topThreshold = viewportTop + 100; // Consider posts within 100px of top as "at top"
    
    let topPost = null;
    let highestVisibilityRatio = 0;
    
    Array.from(posts).forEach(post => {
      const rect = post.getBoundingClientRect();
      const postTop = rect.top + window.scrollY;
      const postBottom = postTop + rect.height;
      
      // Check if post is visible in viewport
      if (postBottom > viewportTop && postTop < viewportTop + viewportHeight) {
        // Calculate how much of the post is visible at the top portion of viewport
        const visibleTop = Math.max(postTop, viewportTop);
        const visibleBottom = Math.min(postBottom, topThreshold);
        
        if (visibleBottom > visibleTop) {
          const visibleHeight = visibleBottom - visibleTop;
          const totalHeight = postBottom - postTop;
          const visibilityRatio = visibleHeight / totalHeight;
          
          // Prefer posts that are more visible at the top and closer to viewport top
          const distanceFromTop = Math.abs(postTop - viewportTop);
          const score = visibilityRatio - (distanceFromTop / 1000); // Slight penalty for distance
          
          if (score > highestVisibilityRatio) {
            highestVisibilityRatio = score;
            topPost = post;
          }
        }
      }
    });
    
    return topPost;
  }
  
  crawlVisiblePosts() {
    // This method is now simplified to just process the current top post
    return this.processTopPost() ? 1 : 0;
  }

  // Helper method to get posts currently visible in viewport
  getPostsInViewport(posts) {
    const viewportTop = window.scrollY;
    const viewportBottom = viewportTop + window.innerHeight;
    const visiblePosts = [];
    
    Array.from(posts).forEach(post => {
      const rect = post.getBoundingClientRect();
      const postTop = rect.top + window.scrollY;
      const postBottom = postTop + rect.height;
      
      // Check if post is at least partially visible in viewport
      if (postBottom > viewportTop && postTop < viewportBottom) {
        // Calculate how much of the post is visible
        const visibleHeight = Math.min(postBottom, viewportBottom) - Math.max(postTop, viewportTop);
        const visibilityRatio = visibleHeight / rect.height;
        
        // Only include posts that are at least 30% visible
        if (visibilityRatio >= 0.3) {
          visiblePosts.push({
            element: post,
            visibilityRatio: visibilityRatio,
            topPosition: postTop
          });
        }
      }
    });
    
    // Sort by top position (topmost first) and return just the elements
    return visiblePosts
      .sort((a, b) => a.topPosition - b.topPosition)
      .map(item => item.element);
  }

  autoScroll() {
    if (!this.isRunning) return;
    
    console.log(`[${this.platform}] Auto-scroll cycle starting...`);
    
    // Step 1: Process the current top post (show currently viewing + record if new)
    const processedNewPost = this.processTopPost();
    
    // Step 2: If current post was already processed, find and scroll to next post
    if (!processedNewPost) {
      console.log(`[${this.platform}] Current top post already processed, finding next post...`);
      
      const nextPost = this.findNextPostToScrollTo();
      
      if (nextPost) {
        // Scroll to bring the next post to the top of the viewport
        const postRect = nextPost.getBoundingClientRect();
        const postTop = postRect.top + window.scrollY;
        const targetScrollY = postTop - 50; // Leave some margin at the top
        
        console.log(`[${this.platform}] Scrolling to bring next post to top: ${window.scrollY} -> ${targetScrollY}`);
        
        window.scrollTo({
          top: targetScrollY,
          behavior: 'smooth'
        });
        
        // After scroll completes, process the newly positioned top post
        setTimeout(() => {
          console.log(`[${this.platform}] Scroll completed, processing newly positioned top post...`);
          this.processTopPost();
        }, 1500); // Wait for smooth scroll to complete
        
      } else {
        // No next post found, scroll down to load more content
        console.log(`[${this.platform}] No next post found, loading more content...`);
        
        const currentScrollY = window.scrollY;
        const viewportHeight = window.innerHeight;
        const scrollAmount = viewportHeight * 0.8;
        const documentHeight = document.documentElement.scrollHeight;
        const targetScroll = Math.min(currentScrollY + scrollAmount, documentHeight - viewportHeight);
        
        window.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
        
        console.log(`[${this.platform}] Loading more content: ${currentScrollY} -> ${targetScroll}`);
        
        // Check if new content loaded after scroll
        setTimeout(() => {
          const newDocumentHeight = document.documentElement.scrollHeight;
          
          if (newDocumentHeight === this.lastScrollHeight) {
            this.noNewContentCount++;
            console.log(`[${this.platform}] No new content loaded (${this.noNewContentCount}/5)`);
          } else {
            this.noNewContentCount = 0;
            console.log(`[${this.platform}] New content loaded! Height: ${this.lastScrollHeight} -> ${newDocumentHeight}`);
          }
          
          this.lastScrollHeight = newDocumentHeight;
        }, 2000);
      }
    } else {
      console.log(`[${this.platform}] Successfully processed new post, continuing with current position`);
    }
  }

  // Find the next post that should be scrolled into view (strict sequential order)
  findNextPostToScrollTo() {
    const selectors = this.getSelectors();
    const posts = Array.from(document.querySelectorAll(selectors.postContainer));
    
    console.log(`[${this.platform}] findNextPostToScrollTo: Found ${posts.length} total posts`);
    
    // First, find the current top post in viewport
    const currentTopPost = this.getTopPostInViewport(posts);
    
    if (!currentTopPost) {
      console.log(`[${this.platform}] No current top post found, returning first post`);
      return posts.length > 0 ? posts[0] : null;
    }
    
    // Log current post info for debugging
    const currentPostData = this.extractPostDataForDisplay(currentTopPost);
    if (currentPostData) {
      console.log(`[${this.platform}] Current top post: "${currentPostData.text ? currentPostData.text.substring(0, 50) : 'no text'}..."`);
    }
    
    // Find the index of current top post in the DOM order
    const currentIndex = posts.indexOf(currentTopPost);
    
    if (currentIndex === -1) {
      console.log(`[${this.platform}] Current top post not found in posts array`);
      return null;
    }
    
    // Return the very next post in DOM order (strict sequential)
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < posts.length) {
      const nextPost = posts[nextIndex];
      
      // Log next post info for debugging
      const nextPostData = this.extractPostDataForDisplay(nextPost);
      if (nextPostData) {
        console.log(`[${this.platform}] Next post to scroll to: "${nextPostData.text ? nextPostData.text.substring(0, 50) : 'no text'}..."`);
      }
      
      console.log(`[${this.platform}] Found next post in sequence (${currentIndex} -> ${nextIndex})`);
      return nextPost;
    } else {
      console.log(`[${this.platform}] Already at last post (${currentIndex}/${posts.length}), no next post`);
      return null;
    }
  }

  async startCrawling() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`[${this.platform}] Starting to crawl posts...`);
    
    // Load existing post IDs from database to avoid duplicates
    await this.loadExistingPostIds();
    
    // Initial setup
    this.lastScrollHeight = document.body.scrollHeight;
    
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
    
    // Start auto-scrolling to load more content  
    this.scrollInterval = setInterval(() => {
      if (this.isRunning) {
        // Adjust scroll frequency based on content loading
        const baseInterval = this.noNewContentCount >= 3 ? 8000 : 3000;
        this.autoScroll();
      }
    }, 3000); // Scroll every 3 seconds initially
    
    // Periodic crawl for missed posts
    this.crawlInterval = setInterval(() => {
      if (this.isRunning) {
        this.crawlVisiblePosts();
      }
    }, 10000); // Check every 10 seconds
  }

  stopCrawling() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log(`[${this.platform}] Stopped crawling posts`);
    
    // Hide current content card when stopping
    this.hideCurrentContent();
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.crawlInterval) {
      clearInterval(this.crawlInterval);
      this.crawlInterval = null;
    }
    
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
  }
}