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
    // For Twitter, try to use more of the text content for uniqueness
    const textPortion = text ? text.substring(0, 100) : ''; // Increased from 50 to 100 chars
    const content = `${author}-${textPortion}-${timestamp}`;
    
    // Create a more robust hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to base36 for shorter string and add timestamp suffix for extra uniqueness
    const baseHash = Math.abs(hash).toString(36);
    const timestampSuffix = timestamp ? timestamp.replace(/[^0-9]/g, '').slice(-6) : Date.now().toString().slice(-6);
    
    return `${baseHash}_${timestampSuffix}`.substring(0, 20);
  }

  // Helper method to format console output with fixed width
  formatLogText(text, maxWidth = 80) {
    if (!text) return '';
    const cleanText = text.replace(/\s+/g, ' ').trim();
    return cleanText.length > maxWidth ? cleanText.substring(0, maxWidth - 3) + '...' : cleanText;
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
      
      console.log(`[${this.platform}] Post saved: ${this.formatLogText(postData.text, 60)}`);
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
        <div class="status-line">
          Platform: ${this.platform.toUpperCase()}
          <span class="platform-info-icon" data-tooltip="Supported platforms: X/Twitter, LinkedIn, Facebook">ⓘ</span>
        </div>
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
      
      <div class="filter-section">
        <div class="filter-row">
          <select id="crawler-platform-filter" class="filter-select">
            <option value="all">All Platforms</option>
          </select>
          <select id="crawler-company-filter" class="filter-select">
            <option value="all">All Companies</option>
          </select>
        </div>
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

    // Initialize tooltip functionality
    this.initializeTooltips();
    
    // Initialize filters and post count
    this.initializeFilters();
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
        width: 320px;
        max-width: 320px;
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

      .filter-section {
        margin-bottom: 12px;
      }

      .filter-row {
        display: flex;
        gap: 8px;
      }

      .filter-select {
        flex: 1;
        background: rgba(0, 0, 0, 0.3) !important;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        padding: 6px 8px;
        color: white !important;
        font-size: 11px;
        cursor: pointer;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        /* Force white text color */
        -webkit-text-fill-color: white !important;
        text-shadow: none !important;
      }

      .filter-select option {
        background: #333333;
        color: white;
      }
      
      .filter-select option:checked {
        background: #667eea;
        color: white;
      }

      .filter-select:focus {
        outline: none;
        border-color: rgba(255, 255, 255, 0.4);
        background: rgba(0, 0, 0, 0.4) !important;
        color: white !important;
        -webkit-text-fill-color: white !important;
      }
      
      /* Additional Chrome/Safari fixes */
      select.filter-select {
        background-color: rgba(0, 0, 0, 0.3) !important;
        color: white !important;
      }
      
      select.filter-select::-webkit-scrollbar {
        width: 8px;
      }
      
      select.filter-select::-webkit-scrollbar-track {
        background: #333;
      }
      
      select.filter-select::-webkit-scrollbar-thumb {
        background: #666;
        border-radius: 4px;
      }
      
      .platform-info-icon {
        margin-left: 6px;
        opacity: 0.6;
        font-size: 11px;
        cursor: help;
        transition: opacity 0.2s;
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        text-align: center;
        line-height: 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .platform-info-icon:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
      }
      
      /* Custom tooltip - positioned relative to control panel */
      .custom-tooltip {
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 400;
        white-space: nowrap;
        z-index: 10001;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        /* Ensure tooltip stays within control panel bounds */
        max-width: 280px;
        word-wrap: break-word;
        white-space: normal;
      }
      
      .custom-tooltip.show {
        opacity: 1;
      }
      
      .custom-tooltip::before {
        content: '';
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid rgba(0, 0, 0, 0.9);
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
    if (this.currentContentElement && text) {
      // Calculate appropriate text length based on control panel width (320px)
      // With 11px font size and padding, approximately 40-45 characters fit well
      const maxChars = this.calculateMaxCharsForWidth();
      const displayText = this.formatLogText(text, maxChars);
      this.currentContentElement.textContent = displayText;
      
      // Show the current content card
      const card = document.getElementById('current-content-card');
      if (card) {
        card.style.display = 'block';
      }
    }
  }

  // Calculate maximum characters that fit in the current content text area
  calculateMaxCharsForWidth() {
    // Control panel width is 320px, with 16px padding on each side = 288px inner width
    // Current content card has 10px padding on each side = 268px text area width  
    // With 11px font size, roughly 6-7 pixels per character
    // 268px / 6.5px ≈ 41 characters, but allow for 2-line display with -webkit-line-clamp: 2
    // So we can accommodate roughly 80-85 characters total, but keep it readable at ~45 per effective line
    return 45;
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
    }
  }

  hideAlreadyRecordedIndicator() {
    const indicator = document.getElementById('already-recorded-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  async exportData(format) {
    try {
      console.log(`[${this.platform}] Exporting data in ${format} format...`);
      
      if (!window.postsDB) {
        alert('Database not available');
        return;
      }

      // Get filter values
      const platformFilter = document.getElementById('crawler-platform-filter')?.value || 'all';
      const companyFilter = document.getElementById('crawler-company-filter')?.value || 'all';
      
      console.log(`[${this.platform}] Exporting with filters - platform: ${platformFilter}, company: ${companyFilter}`);

      const exportData = await window.postsDB.exportFilteredData(format, platformFilter, companyFilter);
      if (!exportData) {
        alert('No data to export with current filters');
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

  // Initialize filter dropdowns with available platforms and companies
  async initializeFilters() {
    try {
      if (!window.postsDB) {
        console.log(`[${this.platform}] PostsDB not available for filters`);
        return;
      }

      if (!window.postsDB.db) {
        await window.postsDB.init();
      }

      // Get available platforms and companies
      const platforms = await window.postsDB.getAvailablePlatforms();
      const companies = await window.postsDB.getAvailableCompanies();

      console.log(`[${this.platform}] Found platforms: ${platforms.join(', ')}, companies: ${companies.join(', ')}`);

      // Update platform dropdown
      const platformSelect = document.getElementById('crawler-platform-filter');
      if (platformSelect) {
        // Clear existing options except "All Platforms"
        while (platformSelect.children.length > 1) {
          platformSelect.removeChild(platformSelect.lastChild);
        }
        
        // Add platform options
        platforms.forEach(platform => {
          const option = document.createElement('option');
          option.value = platform;
          option.textContent = platform.charAt(0).toUpperCase() + platform.slice(1);
          platformSelect.appendChild(option);
        });
        
        // Set current platform as selected
        platformSelect.value = this.platform;
      }

      // Update company dropdown
      const companySelect = document.getElementById('crawler-company-filter');
      if (companySelect) {
        // Clear existing options except "All Companies"
        while (companySelect.children.length > 1) {
          companySelect.removeChild(companySelect.lastChild);
        }
        
        // Add company options
        companies.forEach(company => {
          const option = document.createElement('option');
          option.value = company;
          option.textContent = company;
          companySelect.appendChild(option);
        });
      }

      // Add event listeners for filter changes
      platformSelect?.addEventListener('change', () => this.updateFilteredCount());
      companySelect?.addEventListener('change', () => this.updateFilteredCount());

      // Initial count update
      this.updateFilteredCount();

    } catch (error) {
      console.error(`[${this.platform}] Error initializing filters:`, error);
    }
  }

  // Update post count based on current filters
  async updateFilteredCount() {
    try {
      if (!window.postsDB) return;

      const platformFilter = document.getElementById('crawler-platform-filter')?.value || 'all';
      const companyFilter = document.getElementById('crawler-company-filter')?.value || 'all';

      let count;
      if (platformFilter === 'all' && companyFilter === 'all') {
        count = await window.postsDB.getPostCount();
      } else if (platformFilter !== 'all' && companyFilter !== 'all') {
        const posts = await window.postsDB.getPostsByPlatformAndCompany(platformFilter, companyFilter);
        count = posts.length;
      } else if (platformFilter !== 'all') {
        const posts = await window.postsDB.getPostsByPlatform(platformFilter);
        count = posts.length;
      } else if (companyFilter !== 'all') {
        const posts = await window.postsDB.getPostsByCompany(companyFilter);
        count = posts.length;
      }

      this.updatePostCount(count);
      console.log(`[${this.platform}] Filtered count updated: ${count} posts (platform: ${platformFilter}, company: ${companyFilter})`);

    } catch (error) {
      console.error(`[${this.platform}] Error updating filtered count:`, error);
    }
  }

  // Initialize custom tooltip functionality
  initializeTooltips() {
    // Find all elements with data-tooltip attribute
    const tooltipElements = this.controlPanel.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
      let tooltip = null;
      
      const showTooltip = (e) => {
        // Remove existing tooltip
        if (tooltip) {
          tooltip.remove();
        }
        
        // Create new tooltip
        tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.textContent = element.getAttribute('data-tooltip');
        
        // Append tooltip to control panel instead of document.body
        this.controlPanel.appendChild(tooltip);
        
        // Position tooltip relative to the control panel
        const panelRect = this.controlPanel.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Calculate position relative to control panel
        const relativeLeft = elementRect.left - panelRect.left;
        const relativeTop = elementRect.top - panelRect.top;
        
        // Position tooltip above the element, centered horizontally
        tooltip.style.left = (relativeLeft + element.offsetWidth / 2 - tooltipRect.width / 2) + 'px';
        tooltip.style.top = (relativeTop - tooltipRect.height - 10) + 'px';
        
        // Show tooltip with animation
        setTimeout(() => tooltip.classList.add('show'), 10);
      };
      
      const hideTooltip = () => {
        if (tooltip) {
          tooltip.classList.remove('show');
          setTimeout(() => {
            if (tooltip) {
              tooltip.remove();
              tooltip = null;
            }
          }, 200);
        }
      };
      
      element.addEventListener('mouseenter', showTooltip);
      element.addEventListener('mouseleave', hideTooltip);
    });
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
      console.log(`[${this.platform}] No top post found in viewport`);
      return false;
    }
    
    // Rate limiting: check if we've processed the same post too many times
    const postPosition = topPost.getBoundingClientRect().top + window.scrollY;
    const postKey = `${postPosition.toFixed(0)}px`;
    
    if (!this.lastProcessedPosts) {
      this.lastProcessedPosts = new Map();
    }
    
    const currentTime = Date.now();
    const lastProcessed = this.lastProcessedPosts.get(postKey);
    
    if (lastProcessed) {
      const timeDiff = currentTime - lastProcessed.timestamp;
      lastProcessed.count = (lastProcessed.count || 0) + 1;
      
      // If we've processed the same post more than 3 times in the last 15 seconds, skip it silently
      if (lastProcessed.count > 3 && timeDiff < 15000) {
        // Silent skip - only log occasionally to reduce console spam
        if (lastProcessed.count === 4 || lastProcessed.count % 10 === 0) {
          console.log(`[${this.platform}] Rate limiting: skipping post at ${postKey} (processed ${lastProcessed.count} times in ${(timeDiff/1000).toFixed(1)}s)`);
        }
        return false;
      }
      
      // Reset count if enough time has passed
      if (timeDiff > 30000) {
        lastProcessed.count = 1;
        lastProcessed.timestamp = currentTime;
      }
    } else {
      this.lastProcessedPosts.set(postKey, { timestamp: currentTime, count: 1 });
    }
    
    // Clean up old entries (keep only last 10)
    if (this.lastProcessedPosts.size > 10) {
      const entries = Array.from(this.lastProcessedPosts.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      this.lastProcessedPosts.clear();
      entries.slice(0, 10).forEach(([key, value]) => {
        this.lastProcessedPosts.set(key, value);
      });
    }
    
    // Always update "Currently Viewing" to show what's at the top
    const displayData = this.extractPostDataForDisplay(topPost);
    if (displayData && displayData.text) {
      this.updateCurrentContent(displayData.text);
    }
    
    // Try to extract and save the post if not already crawled
    const postData = this.extractPostData(topPost);
    if (postData) {
      if (postData.text && !this.crawledPosts.has(postData.id)) {
        console.log(`[${this.platform}] Recording new post: ${this.formatLogText(postData.text, 50)}`);
        this.hideAlreadyRecordedIndicator(); // Hide indicator for new posts
        this.savePost(postData);
        return true; // Successfully processed new post
      } else if (this.crawledPosts.has(postData.id)) {
        console.log(`[${this.platform}] Post already recorded, should scroll to next post`);
        this.showAlreadyRecordedIndicator(); // Show indicator for already recorded posts
        return false; // Already processed, should move to next
      }
    } else {
      console.log(`[${this.platform}] Could not extract post data from current top post`);
    }
    
    return false;
  }
  
  // Get the post that's currently at the top of the viewport
  getTopPostInViewport(posts) {
    const viewportTop = window.scrollY;
    const viewportHeight = window.innerHeight;
    
    let topPost = null;
    let bestScore = -1;
    
    Array.from(posts).forEach((post, index) => {
      const rect = post.getBoundingClientRect();
      const postTop = rect.top + window.scrollY;
      const postBottom = postTop + rect.height;
      
      // Check if post is visible in viewport
      if (postBottom > viewportTop && postTop < viewportTop + viewportHeight) {
        // Calculate how much of the post is visible in the viewport
        const visibleTop = Math.max(postTop, viewportTop);
        const visibleBottom = Math.min(postBottom, viewportTop + viewportHeight);
        const visibleHeight = visibleBottom - visibleTop;
        const totalHeight = postBottom - postTop;
        const visibilityRatio = visibleHeight / totalHeight;
        
        // Only consider posts that are at least 30% visible
        if (visibilityRatio >= 0.3) {
          // Calculate distance from viewport top
          const distanceFromViewportTop = Math.abs(rect.top);
          
          // Create a scoring system that prioritizes:
          // 1. Posts that are more visible (higher visibility ratio)
          // 2. Posts that are closer to the top of viewport (lower distance)
          // 3. Posts that have their top part visible (not cut off at top)
          
          let score = visibilityRatio * 100; // Base score from visibility
          
          // Bonus for posts closer to viewport top
          score -= distanceFromViewportTop / 10;
          
          // Bonus for posts that start within viewport (not cut off at top)
          if (rect.top >= -50) { // Allow small negative values for partially cut posts
            score += 20;
          }
          
          // Additional bonus for "readable" posts (posts where we can see the header/author)
          if (rect.top >= -100 && visibilityRatio >= 0.5) {
            score += 10;
          }
          
          if (score > bestScore) {
            bestScore = score;
            topPost = post;
          }
        }
      }
    });
    
    if (topPost) {
      const winningRect = topPost.getBoundingClientRect();
      console.log(`[${this.platform}] Selected top post: top=${winningRect.top.toFixed(0)}px, height=${winningRect.height.toFixed(0)}px, score=${bestScore.toFixed(1)}`);
    } else {
      console.log(`[${this.platform}] No suitable top post found`);
    }
    
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
    
    // Step 1: Process the current top post (show currently viewing + record if new)
    const processedNewPost = this.processTopPost();
    
    // Step 2: If current post was already processed or couldn't be processed, scroll down
    if (!processedNewPost) {
      // For Twitter/X, scroll by the height of current post to move to next post
      if (this.platform === 'twitter') {
        const selectors = this.getSelectors();
        const posts = document.querySelectorAll(selectors.postContainer);
        const currentTopPost = this.getTopPostInViewport(posts);
        
        if (currentTopPost) {
          const currentScrollY = window.scrollY;
          const postRect = currentTopPost.getBoundingClientRect();
          const postHeight = postRect.height;
          
          // Safety check: ensure we always scroll down with a reasonable amount
          let scrollAmount = Math.max(postHeight, 100); // At least 100px, but prefer post height
          
          // Additional safety: cap maximum scroll to prevent huge jumps
          scrollAmount = Math.min(scrollAmount, 800); // Max 800px per scroll
          
          // Final safety check: ensure we're actually scrolling down
          const targetScrollY = currentScrollY + scrollAmount;
          if (targetScrollY <= currentScrollY) {
            console.warn(`[${this.platform}] Invalid scroll target detected, using fallback`);
            scrollAmount = 200; // Safe fallback
          }
          
          window.scrollTo({
            top: currentScrollY + scrollAmount,
            behavior: 'smooth'
          });
          
          console.log(`[${this.platform}] Current post couldn't be processed, scrolling down by ${scrollAmount}px (post height: ${postHeight}px, current: ${currentScrollY}px, target: ${currentScrollY + scrollAmount}px)`);
        } else {
          // Fallback if no current post found
          const currentScrollY = window.scrollY;
          const fallbackAmount = 200;
          
          window.scrollTo({
            top: currentScrollY + fallbackAmount,
            behavior: 'smooth'
          });
          
          console.log(`[${this.platform}] No current post found, using fallback scroll of ${fallbackAmount}px`);
        }
        
        // After scroll completes, process the newly positioned top post
        setTimeout(() => {
          this.processTopPost();
        }, 1000);
        
      } else if (this.platform === 'tiktok') {
        // For TikTok, we don't control scrolling - rely on native TikTok autoscroll
        console.log('[TikTok] Relying on native TikTok autoscroll, not controlling scroll programmatically');
        return; // Don't scroll programmatically for TikTok
      } else {
        // For other platforms, use the original logic with findNextPostToScrollTo
        const nextPost = this.findNextPostToScrollTo();
        
        if (nextPost) {
          // Scroll to bring the next post to the top of the viewport
          const postRect = nextPost.getBoundingClientRect();
          const postTop = postRect.top + window.scrollY;
          const targetScrollY = postTop - 50; // Leave some margin at the top
          
          // Add safeguard to prevent infinite scrolling to same position
          if (Math.abs(targetScrollY - window.scrollY) < 10) {
            window.scrollTo({
              top: window.scrollY + 200,
              behavior: 'smooth'
            });
          } else {
            window.scrollTo({
              top: targetScrollY,
              behavior: 'smooth'
            });
          }
          
          // After scroll completes, process the newly positioned top post
          setTimeout(() => {
            this.processTopPost();
          }, 1500); // Wait for smooth scroll to complete
          
        } else {
          // No next post found, scroll down to load more content
          const currentScrollY = window.scrollY;
          const viewportHeight = window.innerHeight;
          const scrollAmount = viewportHeight * 0.8;
          const documentHeight = document.documentElement.scrollHeight;
          const targetScroll = Math.min(currentScrollY + scrollAmount, documentHeight - viewportHeight);
          
          window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          });
          
          // Check if new content loaded after scroll
          setTimeout(() => {
            const newDocumentHeight = document.documentElement.scrollHeight;
            
            if (newDocumentHeight === this.lastScrollHeight) {
              this.noNewContentCount++;            
              // If we've been stuck for too long, try a different approach
              if (this.noNewContentCount >= 5) {
                console.warn(`[${this.platform}] Crawler appears stuck, attempting recovery...`);
                this.noNewContentCount = 0;
                // Try scrolling to the very bottom to trigger more content loading
                window.scrollTo({
                  top: document.documentElement.scrollHeight,
                  behavior: 'smooth'
                });
              }
            } else {
              this.noNewContentCount = 0;
            }
            
            this.lastScrollHeight = newDocumentHeight;
          }, 2000);
        }
      }
    }
  }

  // Abstract method - each platform should implement its own logic
  findNextPostToScrollTo() {
    throw new Error('findNextPostToScrollTo() must be implemented by subclass');
  }

  async startCrawling() {
    if (this.isRunning) {
      console.warn(`[${this.platform}] startCrawling called but already running`);
      return;
    }
    
    // Clear any existing intervals/observers first to prevent duplicates
    this.stopCrawling();
    
    this.isRunning = true;
    console.log(`[${this.platform}] Starting to crawl posts...`);
    
    // Load existing post IDs from database to avoid duplicates
    await this.loadExistingPostIds();
    
    // Initial setup
    this.lastScrollHeight = document.body.scrollHeight;
    
    // Initial crawl
    this.crawlVisiblePosts();
    
    // 改用精准的触发机制：只监听真正的新内容加载，而不是React重渲染
    this.lastContentHeight = document.documentElement.scrollHeight;
    this.observer = new MutationObserver((mutations) => {
      if (!this.isRunning) return;
      
      // 只有当页面内容高度发生变化时才认为有新内容
      const currentHeight = document.documentElement.scrollHeight;
      if (currentHeight > this.lastContentHeight) {
        this.lastContentHeight = currentHeight;
        // 新内容加载后，延迟一次性处理
        setTimeout(() => {
          this.crawlVisiblePosts();
        }, 1000);
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // 改用基于滚动位置变化的精准触发
    let lastScrollY = window.scrollY;
    this.scrollListener = () => {
      if (!this.isRunning) return;
      
      const currentScrollY = window.scrollY;
      // 只有当滚动位置显著变化时才处理（避免小幅滚动的噪音）
      if (Math.abs(currentScrollY - lastScrollY) > 100) {
        lastScrollY = currentScrollY;
        // 滚动停止后处理一次
        clearTimeout(this.scrollTimeout);
        this.scrollTimeout = setTimeout(() => {
          this.crawlVisiblePosts();
        }, 500);
      }
    };
    window.addEventListener('scroll', this.scrollListener, { passive: true });
    
    // 保留自动滚动，调快频率
    this.scrollInterval = setInterval(() => {
      if (this.isRunning) {
        this.autoScroll();
      }
    }, 1000); // 每2.5秒自动滚动
    
    console.log(`[${this.platform}] Started crawler with intervals: scroll=${!!this.scrollInterval}, periodic=${!!this.crawlInterval}, observer=${!!this.observer}`);
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
    
    // 清理滚动监听器
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }
    
    // 清理滚动超时
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
  }
}