// TikTok specific crawler - leverages native auto-scroll and download
class TikTokCrawler extends BaseCrawler {
  constructor() {
    super('tiktok');
    this.currentVideoUrl = '';
    this.videoChangeObserver = null;
  }

  getSelectors() {
    return {
      // TikTok single video page structure - main video container
      postContainer: 'div[data-e2e="video-player-container"], div[data-e2e="video-detail"], .video-player-container, #app > div > div > div > div:first-child',
      
      // Video elements and captions
      videoElement: 'video',
      captionContainer: '[data-e2e="video-desc"], [data-e2e="browse-video"], .video-meta-caption',
      subtitleTrack: 'track[kind="subtitles"], track[kind="captions"]',
      
      // Author information - for single video pages
      author: {
        name: '[data-e2e="video-author-uniqueid"], [data-e2e="video-author"], .author-uniqueid, .video-meta-author',
        avatar: '[data-e2e="avatar"], .avatar img, .author-avatar img',
        profile: '[data-e2e="video-author-uniqueid"] a, a[href*="/@"], .author-link'
      },
      
      // Video metadata for single video pages
      timestamp: '[data-e2e="video-create-time"], .video-meta-time, time',
      description: '[data-e2e="video-desc"], [data-e2e="video-title"], .video-meta-caption, .video-description',
      
      // Engagement metrics on single video pages
      metrics: {
        likes: '[data-e2e="browse-like-count"], [data-e2e="like-count"], [data-e2e="video-like-count"], .like-count',
        comments: '[data-e2e="browse-comment-count"], [data-e2e="comment-count"], [data-e2e="video-comment-count"], .comment-count', 
        shares: '[data-e2e="browse-share-count"], [data-e2e="share-count"], [data-e2e="video-share-count"], .share-count',
        views: '[data-e2e="video-views"], [data-e2e="browse-view-count"], .view-count',
        collects: '[data-e2e="undefined-count"], [data-e2e="collect-count"], .collect-count'
      },
      
      // Hashtags and mentions
      hashtags: 'a[href*="/tag/"], .hashtag-link',
      mentions: 'a[href*="/@"]:not([data-e2e="video-author-uniqueid"]), .mention-link',
      
      // Music and sounds
      music: '[data-e2e="video-music"], .music-info',
      
      // TikTok specific elements
      effects: '[data-e2e="video-effect"], .effect-info',
      location: '[data-e2e="video-location"], .location-info'
    };
  }

  async extractPostData(postElement) {
    try {
      const selectors = this.getSelectors();
      
      // Extract basic video information
      const videoElement = postElement.querySelector(selectors.videoElement);
      const authorName = this.extractTikTokAuthor(postElement);
      const description = this.extractTikTokDescription(postElement);
      const timestamp = this.extractTikTokTimestamp(postElement);
      
      console.log(`[TikTok] Extracting video - author: "${authorName}", desc: "${this.formatLogText(description, 30)}"`);
      
      // Get current video URL to track changes
      const currentVideoUrl = window.location.href;
      
      // Extract captions/transcript if available
      let transcript = '';
      try {
        transcript = await this.extractTikTokCaptions(postElement, videoElement);
        console.log(`[TikTok] Extracted transcript: "${this.formatLogText(transcript, 50)}"`);
      } catch (error) {
        console.warn('[TikTok] Failed to extract captions:', error.message);
      }
      
      // Create unique ID based on video URL
      const uniqueId = this.createTikTokPostId(postElement, description, transcript, authorName);
      
      // Check both in-memory cache and database for duplicates
      if (this.crawledPosts.has(uniqueId)) {
        console.log(`[TikTok] Video already crawled in memory (ID: ${uniqueId}), skipping`);
        
        // Return the existing post data instead of null to allow UI updates
        const existingPostData = {
          id: uniqueId,
          text: description,
          author: { name: authorName },
          alreadyCrawled: true
        };
        return existingPostData;
      }
      
      // Also check database in case post was crawled in a previous session
      if (window.postsDB && window.postsDB.db) {
        try {
          const existingPost = await window.postsDB.getPost(uniqueId);
          if (existingPost) {
            console.log(`[TikTok] Video already exists in database (ID: ${uniqueId}), adding to memory cache and skipping`);
            
            // Add to memory cache so we don't need to check database again
            this.crawledPosts.add(uniqueId);
            
            // Return the existing post data instead of null to allow UI updates
            const existingPostData = {
              id: uniqueId,
              text: description,
              author: { name: authorName },
              alreadyCrawled: true
            };
            return existingPostData;
          }
        } catch (error) {
          console.warn(`[TikTok] Error checking database for existing post: ${error.message}`);
          // Continue with normal flow if database check fails
        }
      }
      
      console.log(`[TikTok] New video detected (ID: ${uniqueId}), triggering download...`);
      
      // Trigger TikTok's native download if this is a new video
      this.triggerNativeDownload();
      
      // Extract additional data
      const avatar = this.extractTikTokAvatar(postElement);
      const profileUrl = this.extractTikTokProfileUrl(postElement);
      const metrics = this.extractTikTokMetrics(postElement);
      const music = this.extractTikTokMusic(postElement);
      const hashtags = this.extractHashtags(postElement);
      const mentions = this.extractMentions(postElement);
      const effects = this.extractTikTokEffects(postElement);
      const location = this.extractTikTokLocation(postElement);
      
      // Get video URL and metadata
      const videoUrl = videoElement ? videoElement.src || videoElement.currentSrc : '';
      const videoDuration = videoElement ? videoElement.duration : 0;
      
      // For TikTok UGC content, company should always be 'NA'
      // Create post data
      const postData = {
        id: uniqueId,
        platform: this.platform,
        company: 'NA',
        author: {
          name: authorName,
          avatar: avatar,
          profileUrl: profileUrl
        },
        text: description,
        transcript: transcript,
        timestamp: timestamp,
        url: currentVideoUrl,
        crawledAt: new Date().toISOString(),
        downloaded: true, // Mark that we triggered download
        
        // TikTok-specific fields
        videoUrl: videoUrl,
        videoDuration: videoDuration,
        music: music,
        effects: effects,
        location: location,
        
        // Engagement metrics
        metrics: metrics,
        
        // Social elements
        hashtags: hashtags,
        mentions: mentions
      };
      
      console.log(`[TikTok] Video data created and download triggered for: "${this.formatLogText(description, 40)}"`);
      return postData;
      
    } catch (error) {
      console.error('[TikTok] Error extracting video data:', error);
      return null;
    }
  }
  
  // Extract TikTok captions/subtitles - this is the core feature
  async extractTikTokCaptions(postElement, videoElement) {
    // If no video element passed in, try to find one
    if (!videoElement) {
      console.log('[TikTok] No video element provided, searching for video in postElement...');
      videoElement = postElement.querySelector('video');
      
      if (!videoElement) {
        console.log('[TikTok] No video found in postElement, searching entire document...');
        videoElement = document.querySelector('video');
      }
      
      if (!videoElement) {
        console.warn('[TikTok] No video element found anywhere on page, skipping caption extraction');
        return '';
      } else {
        console.log('[TikTok] Found video element, proceeding with caption extraction');
      }
    }
    
    let transcript = '';
    
    // Method 1: Try to extract from subtitle tracks (WebVTT)
    const tracks = videoElement.querySelectorAll('track[kind="subtitles"], track[kind="captions"]');
    for (const track of tracks) {
      try {
        const vttText = await this.fetchVTTContent(track.src);
        if (vttText) {
          transcript = this.parseVTTToText(vttText);
          console.log('[TikTok] Extracted captions from VTT track');
          break;
        }
      } catch (error) {
        console.warn('[TikTok] Failed to fetch VTT content:', error.message);
      }
    }
    
    // Method 2: Try to extract from DOM elements (displayed captions)
    if (!transcript) {
      transcript = this.extractDisplayedCaptions(postElement, videoElement);
    }
    
    // Method 3: Look for TikTok's auto-generated caption data
    if (!transcript) {
      transcript = this.extractTikTokCaptionData(postElement);
    }
    
    return transcript;
  }
  
  // Fetch VTT (WebVTT) subtitle content
  async fetchVTTContent(vttUrl) {
    if (!vttUrl || vttUrl.startsWith('data:')) return null;
    
    try {
      const response = await fetch(vttUrl);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.warn('[TikTok] Failed to fetch VTT:', error.message);
    }
    return null;
  }
  
  // Parse WebVTT format to plain text
  parseVTTToText(vttContent) {
    try {
      const lines = vttContent.split('\n');
      const textLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip WebVTT headers, timestamps, and empty lines
        if (line === 'WEBVTT' || line === '' || line.includes('-->')) {
          continue;
        }
        
        // Skip cue identifiers (usually just numbers)
        if (/^\d+$/.test(line)) {
          continue;
        }
        
        // This is likely caption text
        if (line.length > 0) {
          textLines.push(line);
        }
      }
      
      return textLines.join(' ').trim();
    } catch (error) {
      console.error('[TikTok] Error parsing VTT:', error);
      return '';
    }
  }
  
  // Extract captions that are currently displayed in the DOM
  extractDisplayedCaptions(postElement, videoElement) {
    const captionSelectors = [
      '.tt-video-meta-caption',
      '[data-e2e="video-desc"]',
      '.video-meta-caption',
      '.tiktok-caption',
      'div[style*="position: absolute"] span', // Overlay captions
    ];
    
    for (const selector of captionSelectors) {
      const captionElement = postElement.querySelector(selector);
      if (captionElement) {
        const text = captionElement.textContent.trim();
        if (text.length > 10) { // Only meaningful captions
          console.log('[TikTok] Extracted captions from DOM');
          return text;
        }
      }
    }
    
    return '';
  }
  
  // Extract TikTok's auto-generated caption data from data attributes or script tags
  extractTikTokCaptionData(postElement) {
    // Look for TikTok's data attributes that might contain caption info
    const dataAttrs = ['data-captions', 'data-subtitles', 'data-transcript'];
    
    for (const attr of dataAttrs) {
      const element = postElement.querySelector(`[${attr}]`);
      if (element) {
        const data = element.getAttribute(attr);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            return this.extractTextFromCaptionData(parsed);
          } catch (e) {
            return data; // Return as-is if not JSON
          }
        }
      }
    }
    
    // Look in script tags for caption data
    const scripts = postElement.querySelectorAll('script[type="application/json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const captionText = this.findCaptionInData(data);
        if (captionText) {
          console.log('[TikTok] Extracted captions from script data');
          return captionText;
        }
      } catch (e) {
        continue;
      }
    }
    
    return '';
  }
  
  // Recursively search for caption-like data in TikTok's JSON
  findCaptionInData(obj, path = '') {
    if (typeof obj === 'string' && obj.length > 20) {
      // Look for caption-like strings
      if (path.includes('caption') || path.includes('subtitle') || path.includes('transcript')) {
        return obj;
      }
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = path ? `${path}.${key}` : key;
        const result = this.findCaptionInData(value, newPath);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  // Extract text from structured caption data
  extractTextFromCaptionData(captionData) {
    if (typeof captionData === 'string') {
      return captionData;
    }
    
    if (Array.isArray(captionData)) {
      return captionData.map(item => 
        typeof item === 'string' ? item : (item.text || item.content || '')
      ).filter(text => text.length > 0).join(' ');
    }
    
    if (typeof captionData === 'object') {
      return captionData.text || captionData.content || captionData.transcript || '';
    }
    
    return '';
  }

  extractTikTokAuthor(postElement) {
    try {
      // Use the same logic that was used for company extraction
      // Method 1: From URL (e.g., /@username)
      const usernameMatch = window.location.pathname.match(/\/@([^\/]+)/);
      if (usernameMatch && usernameMatch[1]) {
        console.log(`[TikTok] Found author from URL: ${usernameMatch[1]}`);
        return usernameMatch[1];
      }
      
      // Method 2: From page title
      const titleMatch = document.title.match(/^([^|]+)/);
      if (titleMatch && titleMatch[1]) {
        const authorFromTitle = titleMatch[1].trim().replace(/[^a-zA-Z0-9_]/g, '');
        console.log(`[TikTok] Found author from title: ${authorFromTitle}`);
        return authorFromTitle;
      }
      
      console.warn('[TikTok] Could not extract author name from any source');
      return '';
    } catch (error) {
      console.error('[TikTok] Error extracting author:', error);
      return '';
    }
  }

  extractTikTokDescription(postElement) {
    try {
      // Get the current video ID from URL to focus on current video only
      const videoIdMatch = window.location.pathname.match(/\/video\/(\d+)/);
      const currentVideoId = videoIdMatch ? videoIdMatch[1] : null;
      
      // Wait a bit for content to load when URL changes
      const currentUrl = window.location.href;
      if (this.lastProcessedUrl !== currentUrl) {
        this.lastProcessedUrl = currentUrl;
        console.log(`[TikTok] Processing new video: ${currentVideoId} for description extraction`);
      }
      
      // Strategy 1: Look for video-specific description elements that match current video URL
      // Try to find elements that are likely to contain the CURRENT video's description
      const videoSpecificDescSelectors = [
        `[data-video-id="${currentVideoId}"] [data-e2e*="desc"]`,
        `[href*="${currentVideoId}"] + * [data-e2e*="desc"]`,
        '[data-e2e="video-detail-desc"]',
        '[data-e2e="browse-video-desc"]'
      ];
      
      for (const selector of videoSpecificDescSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent.trim();
          if (text && text.length > 10 && text.length < 500) {
            console.log(`[TikTok] Found video-specific description: "${text.substring(0, 50)}..."`);
            return text;
          }
        }
      }
      
      // Strategy 2: Look in the main content area for description containers
      const mainContent = document.querySelector('main, [role="main"], #app > div');
      if (mainContent) {
        const descContainers = mainContent.querySelectorAll('div[data-e2e*="desc"], aside, .video-info');
        
        for (const container of descContainers) {
          // Check if this container is visible and reasonably sized
          const rect = container.getBoundingClientRect();
          if (rect.width > 200 && rect.height > 30) {
            // Look for description spans within this container
            const spans = container.querySelectorAll('span:not(:empty)');
            const descriptionParts = [];
            
            for (const span of spans) {
              const text = span.textContent.trim();
              if (text && text !== 'more' && text.length > 3 && text.length < 200) {
                descriptionParts.push(text);
                
                // Stop after getting reasonable amount of text
                if (descriptionParts.join(' ').length > 150) {
                  break;
                }
              }
            }
            
            // Look for hashtags in the same container
            const hashtagLinks = container.querySelectorAll('a[href*="/tag/"]');
            for (const link of hashtagLinks) {
              const hashtagText = link.textContent.trim();
              if (hashtagText.startsWith('#') && hashtagText.length < 50) {
                descriptionParts.push(hashtagText);
                
                // Limit hashtags
                if (descriptionParts.filter(p => p.startsWith('#')).length >= 10) {
                  break;
                }
              }
            }
            
            if (descriptionParts.length > 0) {
              const cleanDescription = descriptionParts.join(' ').trim();
              if (cleanDescription.length > 10) {
                console.log(`[TikTok] Extracted description: "${cleanDescription.substring(0, 50)}..."`);
                return cleanDescription;
              }
            }
          }
        }
      }
      
      // Strategy 3: Fallback to generic description search
      const fallbackSelectors = [
        '[data-e2e*="desc"] span',
        '[data-e2e*="caption"] span', 
        '.video-meta-caption',
        '[aria-label*="caption"]'
      ];
      
      for (const selector of fallbackSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent.trim();
          if (text && text.length > 10 && text.length < 300) {
            console.log(`[TikTok] Found fallback description: "${text.substring(0, 50)}..."`);
            return text;
          }
        }
      }
      
      console.log(`[TikTok] No description found for video ${currentVideoId}`);
      return '';
    } catch (error) {
      console.error('[TikTok] Error extracting description:', error);
      return '';
    }
  }
  
  // Find the description container for the currently playing video
  findCurrentVideoDescriptionContainer() {
    try {
      // Method 1: Look for a container that's likely for the current video
      const containers = document.querySelectorAll('div[data-e2e*="detail"], div[data-e2e*="desc"], aside, .video-info');
      
      // Try to find the one that's most likely the current video
      for (const container of containers) {
        // Check if this container is visible and has reasonable size
        const rect = container.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 50) {
          console.log(`[TikTok] Found potential description container:`, container.getAttribute('data-e2e') || container.className);
          return container;
        }
      }
      
      // Method 2: Look for video description in the right panel (desktop) or below video (mobile)
      const rightPanel = document.querySelector('div[data-e2e="video-detail-desc"], div[data-e2e="browse-video-desc"]');
      if (rightPanel) {
        console.log(`[TikTok] Found right panel description container`);
        return rightPanel;
      }
      
      // Method 3: Find any container with description-related attributes that's reasonably sized
      const anyDescContainer = document.querySelector('div[data-e2e*="desc"]:not([style*="display: none"])');
      if (anyDescContainer) {
        console.log(`[TikTok] Found generic description container`);
        return anyDescContainer;
      }
      
      return null;
    } catch (error) {
      console.warn('[TikTok] Error finding description container:', error);
      return null;
    }
  }

  extractTikTokTimestamp(postElement) {
    const selectors = this.getSelectors();
    try {
      const timeElement = postElement.querySelector(selectors.timestamp);
      return timeElement ? timeElement.textContent.trim() : '';
    } catch (error) {
      return '';
    }
  }

  extractTikTokAvatar(postElement) {
    const selectors = this.getSelectors();
    try {
      const avatarElement = postElement.querySelector(selectors.author.avatar);
      return avatarElement ? avatarElement.src : '';
    } catch (error) {
      return '';
    }
  }

  extractTikTokProfileUrl(postElement) {
    const selectors = this.getSelectors();
    try {
      const profileElement = postElement.querySelector(selectors.author.profile);
      return profileElement ? profileElement.href : '';
    } catch (error) {
      return '';
    }
  }

  extractTikTokMetrics(postElement) {
    const selectors = this.getSelectors();
    const metrics = {
      likes: 0,
      comments: 0,
      shares: 'NA', // TikTok doesn't have retweets/shares concept
      views: 'NA',
      collects: 0
    };

    try {
      // Extract likes
      let likesElement = postElement.querySelector(selectors.metrics.likes);
      if (!likesElement) {
        // Fallback: search entire document
        likesElement = document.querySelector(selectors.metrics.likes);
      }
      if (likesElement) {
        metrics.likes = this.parseNumber(likesElement.textContent);
        console.log(`[TikTok] Found likes: ${metrics.likes}`);
      }

      // Extract comments - improved with more specific targeting
      let commentsElement = null;
      let commentsCount = 0;
      
      // Try multiple strategies to find the comments count
      const commentSelectors = [
        'strong[data-e2e="browse-comment-count"]', // Most specific based on user's HTML
        '[data-e2e="browse-comment-count"]',
        '[data-e2e="comment-count"]',
        '[data-e2e="video-comment-count"]',
        '.comment-count'
      ];
      
      console.log(`[TikTok] Searching for comments with ${commentSelectors.length} selectors...`);
      
      // Try each selector in order of specificity
      for (const selector of commentSelectors) {
        // First try in postElement
        commentsElement = postElement.querySelector(selector);
        if (commentsElement) {
          console.log(`[TikTok] Found comments element in postElement with selector: ${selector}`);
          break;
        }
        
        // Then try entire document
        commentsElement = document.querySelector(selector);
        if (commentsElement) {
          console.log(`[TikTok] Found comments element in document with selector: ${selector}`);
          break;
        }
      }
      
      if (commentsElement) {
        const rawText = commentsElement.textContent.trim();
        commentsCount = this.parseNumber(rawText);
        console.log(`[TikTok] Successfully extracted comments: ${commentsCount} from text: "${rawText}"`);
        console.log(`[TikTok] Comments element: ${commentsElement.tagName}[${commentsElement.getAttribute('data-e2e')}]`);
      } else {
        console.log(`[TikTok] No comments element found with any selector`);
        // Enhanced debug: look for any elements containing numbers near comment icons
        const debugElements = document.querySelectorAll('*[data-e2e*="comment"], button:has(svg) strong, button strong');
        console.log(`[TikTok] Debug: Found ${debugElements.length} potential comment elements:`);
        Array.from(debugElements).slice(0, 5).forEach(el => {
          const text = el.textContent.trim();
          if (text.match(/^\d+$/)) { // If it's just a number
            console.log(`  - ${el.tagName}[${el.getAttribute('data-e2e') || el.className}]: "${text}"`);
          }
        });
      }
      
      metrics.comments = commentsCount;

      // Extract collects (save/bookmark count)
      let collectsElement = postElement.querySelector(selectors.metrics.collects);
      if (!collectsElement) {
        // Fallback: search entire document
        collectsElement = document.querySelector(selectors.metrics.collects);
      }
      if (collectsElement) {
        metrics.collects = this.parseNumber(collectsElement.textContent);
        console.log(`[TikTok] Found collects: ${metrics.collects}`);
      }

      // TikTok doesn't have shares/retweets concept, keeping as 'NA'
      console.log(`[TikTok] Shares not supported on TikTok, keeping as 'NA'`);

      // TikTok doesn't show view counts on individual videos, always keep as 'NA'
      console.log(`[TikTok] Views not supported on TikTok, keeping as 'NA'`);
    } catch (error) {
      console.error('[TikTok] Error extracting metrics:', error);
    }

    return metrics;
  }

  extractTikTokMusic(postElement) {
    const selectors = this.getSelectors();
    try {
      const musicElement = postElement.querySelector(selectors.music);
      return musicElement ? {
        name: musicElement.textContent.trim(),
        url: musicElement.href || ''
      } : null;
    } catch (error) {
      return null;
    }
  }

  extractTikTokEffects(postElement) {
    const selectors = this.getSelectors();
    try {
      const effectElements = postElement.querySelectorAll(selectors.effects);
      return Array.from(effectElements).map(el => el.textContent.trim());
    } catch (error) {
      return [];
    }
  }

  extractTikTokLocation(postElement) {
    const selectors = this.getSelectors();
    try {
      const locationElement = postElement.querySelector(selectors.location);
      return locationElement ? locationElement.textContent.trim() : '';
    } catch (error) {
      return '';
    }
  }

  extractHashtags(postElement) {
    const selectors = this.getSelectors();
    try {
      const hashtagElements = postElement.querySelectorAll(selectors.hashtags);
      return Array.from(hashtagElements).map(hashtag => hashtag.textContent.trim());
    } catch (error) {
      return [];
    }
  }

  extractMentions(postElement) {
    const selectors = this.getSelectors();
    try {
      const mentionElements = postElement.querySelectorAll(selectors.mentions);
      return Array.from(mentionElements).map(mention => ({
        name: mention.textContent.trim(),
        url: mention.href
      }));
    } catch (error) {
      return [];
    }
  }

  // Create unique IDs for TikTok videos
  createTikTokPostId(postElement, description, transcript, author) {
    try {
      // Primary strategy: use video ID from URL as it's most reliable
      const videoIdFromUrl = window.location.pathname.match(/\/video\/(\d+)/);
      
      if (videoIdFromUrl && videoIdFromUrl[1]) {
        const finalId = `tiktok_${videoIdFromUrl[1]}`;
        
        // Only log when creating ID for new videos (not already crawled)
        if (!this.crawledPosts.has(finalId)) {
          console.log(`[TikTok] Generated new video ID: ${finalId} from URL`);
        }
        
        return finalId;
      }
      
      // Fallback: use content-based ID
      let contentForId = '';
      
      if (transcript && transcript.length > 10) {
        contentForId = transcript.trim();
      } else if (description && description.length > 0) {
        contentForId = description.trim();
      } else {
        // Last resort: use URL + timestamp
        contentForId = window.location.href + '|' + Date.now();
      }
      
      // Add author for uniqueness
      if (author) {
        contentForId += '|' + author;
      }
      
      // Create hash
      let hash = 0;
      for (let i = 0; i < contentForId.length; i++) {
        const char = contentForId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      const finalId = `tiktok_${Math.abs(hash).toString(36)}`;
      console.log(`[TikTok] Generated content-based ID: ${finalId}`);
      
      return finalId;
    } catch (error) {
      console.error('[TikTok] Error creating post ID:', error);
      return `tiktok_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }
  }

  // Extract company/creator name from TikTok page
  extractCompanyName() {
    try {
      // Method 1: From URL (e.g., /@username)
      const usernameMatch = window.location.pathname.match(/\/@([^\/]+)/);
      if (usernameMatch && usernameMatch[1]) {
        return usernameMatch[1];
      }
      
      // Method 2: From page title
      const titleMatch = document.title.match(/^([^|]+)/);
      if (titleMatch && titleMatch[1]) {
        return titleMatch[1].trim().replace(/[^a-zA-Z0-9_]/g, '');
      }
      
      return null;
    } catch (error) {
      console.warn('[TikTok] Error extracting company name:', error);
      return null;
    }
  }

  // TikTok-specific implementation for single video pages
  autoScroll() {
    if (!this.isRunning) return;
    
    // Check if URL has changed (video switched)
    const currentUrl = window.location.href;
    if (this.currentVideoUrl && this.currentVideoUrl !== currentUrl) {
      console.log('[TikTok] Video URL changed, new video detected:', currentUrl);
      console.log('[TikTok] Previous URL:', this.currentVideoUrl);
      this.currentVideoUrl = currentUrl;
      
      // Extract the new video ID to check if we should clear the session cache
      const newVideoId = window.location.pathname.match(/\/video\/(\d+)/);
      if (newVideoId && newVideoId[1]) {
        const newPostId = `tiktok_${newVideoId[1]}`;
        console.log(`[TikTok] New video ID: ${newPostId}`);
        
        // For TikTok, we don't clear the entire crawledPosts set because users might
        // navigate back to previous videos. Instead we just log the current state.
        console.log(`[TikTok] Current session has ${this.crawledPosts.size} crawled posts`);
      }
      
      // Clear any cached content when video switches
      this.updateCurrentContent('Loading new video...');
      
      // Add longer delay for video switching to allow new content to load
      setTimeout(() => {
        this.processTikTokVideo();
      }, 3000); // Increased delay for video switching
    } else if (!this.currentVideoUrl) {
      // First time processing
      console.log('[TikTok] First time processing video on single video page');
      this.currentVideoUrl = currentUrl;
      
      // Add delay to allow video element to load if page just loaded
      setTimeout(() => {
        this.processTikTokVideo();
      }, 1500); // Slightly increased initial delay
    } else {
      // Same video - don't process repeatedly to avoid infinite loops
      console.log('[TikTok] Same video, skipping processing to avoid infinite loop');
      return;
    }
  }

  // Process the current TikTok video (different from feed-based processTopPost)
  async processTikTokVideo() {
    try {
      // Wait for video element to be available
      await this.waitForVideoElement();
      
      // For TikTok, we find the main video container instead of looking for "top post"
      const videoContainer = this.findTikTokVideoContainer();
      
      if (!videoContainer) {
        console.log('[TikTok] No video container found on page');
        this.updateCurrentContent('No video found');
        return false;
      }
      
      console.log('[TikTok] Found video container, extracting data...');
      
      // Wait a bit more for dynamic content to load after video switch
      // Always wait for content to load when processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Extract display data for UI - this should be fresh for new videos
      const displayData = this.extractPostDataForDisplay(videoContainer);
      if (displayData && displayData.text) {
        console.log(`[TikTok] Updating current content: "${this.formatLogText(displayData.text, 40)}"`);
        this.updateCurrentContent(displayData.text);
      } else {
        console.log('[TikTok] No display data extracted, using default');
        this.updateCurrentContent('TikTok video detected');
      }
      
      // Try to extract and save the video data
      const postData = await this.extractPostData(videoContainer);
      if (postData) {
        if (postData.alreadyCrawled) {
          // Video was already crawled, but we got data for UI update
          console.log(`[TikTok] Video already recorded (ID: ${postData.id}), showing indicator`);
          this.showAlreadyRecordedIndicator();
          return false;
        } else if (!this.crawledPosts.has(postData.id)) {
          console.log(`[TikTok] Recording new video: ${this.formatLogText(postData.text || postData.url, 50)}`);
          this.hideAlreadyRecordedIndicator();
          await this.savePost(postData);
          return true;
        } else {
          console.log(`[TikTok] Video already recorded (ID: ${postData.id})`);
          this.showAlreadyRecordedIndicator();
          return false;
        }
      } else {
        console.log('[TikTok] Could not extract video data');
        this.updateCurrentContent('Failed to extract video data');
        return false;
      }
    } catch (error) {
      console.error('[TikTok] Error processing video:', error);
      this.updateCurrentContent('Error processing video');
      return false;
    }
  }
  
  // Wait for video element to be available on the page
  async waitForVideoElement(maxWaitTime = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        console.log('[TikTok] Video element found after waiting');
        return videoElement;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.warn('[TikTok] Video element not found after waiting', maxWaitTime, 'ms');
    return null;
  }
  
  // Find the main TikTok video container on single video pages
  findTikTokVideoContainer() {
    const selectors = this.getSelectors();
    
    // Try different selectors for TikTok video container
    let container = document.querySelector(selectors.postContainer);
    
    if (!container) {
      // Fallback: look for any div containing a video element
      const videoElement = document.querySelector('video');
      if (videoElement) {
        // Find the parent container that likely contains all video info
        container = videoElement.closest('div[data-e2e], div[class*="video"], div[class*="player"], main, article');
        if (!container) {
          // Last resort: use the video element's parent
          container = videoElement.parentElement;
        }
      }
    }
    
    if (!container) {
      // Ultimate fallback: use document body but this is not ideal
      console.warn('[TikTok] Using document body as container fallback');
      container = document.body;
    }
    
    console.log(`[TikTok] Using container:`, container?.tagName, container?.className);
    return container;
  }

  // TikTok doesn't need this method since we rely on native scrolling
  findNextPostToScrollTo() {
    // This method is not used for TikTok since we rely on native autoscroll
    console.log('[TikTok] findNextPostToScrollTo() not needed - using native TikTok autoscroll');
    return null;
  }

  // Trigger TikTok's native download functionality via right-click
  triggerNativeDownload() {
    try {
      // Find the video element
      const videoElement = document.querySelector('video');
      if (!videoElement) {
        console.log('[TikTok] No video element found for right-click download');
        return false;
      }

      console.log('[TikTok] Found video element, simulating right-click for download menu');
      
      // Create and dispatch a contextmenu (right-click) event
      const rightClickEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 2, // Right mouse button
        clientX: videoElement.offsetLeft + videoElement.offsetWidth / 2,
        clientY: videoElement.offsetTop + videoElement.offsetHeight / 2
      });
      
      videoElement.dispatchEvent(rightClickEvent);
      
      // After right-click, look for download option in the context menu
      setTimeout(() => {
        // Use the correct selector from the HTML you provided
        const downloadOption = document.querySelector('[data-e2e="right-click-menu-popover_download-video"]');
        
        if (downloadOption) {
          console.log('[TikTok] Found download option in right-click menu, clicking');
          downloadOption.click();
        } else {
          console.log('[TikTok] No download option found in right-click menu');
          // Try to find any menu items for debugging
          const menuItems = document.querySelectorAll('div[role="menuitem"], [role="menu"] > *, .context-menu *');
          if (menuItems.length > 0) {
            console.log('[TikTok] Available menu items:', Array.from(menuItems).map(item => item.textContent.trim()));
          }
        }
        
        // Always click somewhere else to dismiss the context menu and resume video
        setTimeout(() => {
          console.log('[TikTok] Clicking elsewhere to dismiss context menu and resume video');
          
          // Find a safe area to click (away from video controls)
          const bodyRect = document.body.getBoundingClientRect();
          const clickX = bodyRect.width * 0.1; // Click on left side of screen
          const clickY = bodyRect.height * 0.1; // Click near top
          
          const dismissClickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clickX,
            clientY: clickY
          });
          
          document.body.dispatchEvent(dismissClickEvent);
          
          // Also try to resume video playback if it's paused
          const video = document.querySelector('video');
          if (video && video.paused) {
            console.log('[TikTok] Video was paused, attempting to resume playback');
            video.play().catch(e => console.log('[TikTok] Could not auto-resume video:', e.message));
          }
        }, 300);
        
      }, 500);
      
      return true;
    } catch (error) {
      console.warn('[TikTok] Error triggering right-click download:', error);
      return false;
    }
  }

  // Extract post data for display purposes (simpler version for UI)
  extractPostDataForDisplay(postElement) {
    try {
      const description = this.extractTikTokDescription(postElement);
      const author = this.extractTikTokAuthor(postElement);
      
      return {
        text: description || `@${author}的视频`,
        author: author
      };
    } catch (error) {
      console.error('[TikTok] Error extracting display data:', error);
      return { text: 'TikTok视频', author: '' };
    }
  }
}

// TikTok Caption Extractor utility class
class TikTokCaptionExtractor {
  constructor() {
    this.observers = new Map();
  }
  
  // Monitor video for caption changes
  observeCaptions(videoElement, callback) {
    if (!videoElement.textTracks || videoElement.textTracks.length === 0) {
      return null;
    }
    
    const textTrack = videoElement.textTracks[0];
    
    const handleCueChange = () => {
      const activeCues = textTrack.activeCues;
      if (activeCues && activeCues.length > 0) {
        const currentText = Array.from(activeCues)
          .map(cue => cue.text)
          .join(' ');
        callback(currentText);
      }
    };
    
    textTrack.addEventListener('cuechange', handleCueChange);
    
    // Store observer for cleanup
    this.observers.set(videoElement, {
      textTrack,
      handler: handleCueChange
    });
    
    return handleCueChange;
  }
  
  // Stop observing captions
  stopObserving(videoElement) {
    const observer = this.observers.get(videoElement);
    if (observer) {
      observer.textTrack.removeEventListener('cuechange', observer.handler);
      this.observers.delete(videoElement);
    }
  }
  
  // Clean up all observers
  cleanup() {
    for (const [videoElement, observer] of this.observers) {
      this.stopObserving(videoElement);
    }
  }
}