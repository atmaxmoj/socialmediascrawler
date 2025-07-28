// Twitter/X specific crawler
class TwitterCrawler extends BaseCrawler {
  constructor() {
    super('twitter');
  }

  getSelectors() {
    return {
      // Use multiple fallback selectors for better compatibility
      postContainer: 'article[data-testid="tweet"], div[data-testid="tweet"], [data-testid="tweet"]',
      textContent: '[data-testid="tweetText"], [lang]:not([data-testid="tweetPhoto"]):not([data-testid="videoPlayer"]):not([data-testid="gifPlayer"]) span',
      author: {
        name: '[data-testid="User-Name"] > div > div > span, [data-testid="User-Name"] span:first-child, [data-testid="User-Name"] > div span:first-child',
        handle: '[data-testid="User-Name"] > div > div:last-child span, [data-testid="User-Name"] span:last-child, [data-testid="User-Name"] a span',
        avatar: '[data-testid="Tweet-User-Avatar"] img, [data-testid="UserAvatar-Container-"] img, img[alt*="avatar"]'
      },
      timestamp: 'time, a[href*="/status/"] time, [data-testid="Time"]',
      engagement: '[role="group"], [data-testid="reply"], [data-testid="retweet"], [data-testid="like"]',
      metrics: {
        reply: '[data-testid="reply"] span[data-testid="app-text-transition-container"] span, [data-testid="reply"] span span, [aria-label*="repl"] span',
        retweet: '[data-testid="retweet"] span[data-testid="app-text-transition-container"] span, [data-testid="retweet"] span span, [aria-label*="repost"] span',
        like: '[data-testid="like"] span[data-testid="app-text-transition-container"] span, [data-testid="like"] span span, [aria-label*="like"] span',
        bookmark: '[data-testid="bookmark"], [aria-label*="bookmark"]',
        view: 'a[href*="/status/"] span[data-testid="app-text-transition-container"] span, [aria-label*="view"] span'
      },
      replies: {
        container: '[data-testid="tweet"] + div [data-testid="tweet"], article + article',
        author: '[data-testid="User-Name"] span:first-child',
        text: '[data-testid="tweetText"]',
        timestamp: 'time'
      },
      media: {
        images: '[data-testid="tweetPhoto"] img, [data-testid="card.layoutLarge.media"] img, img[src*="media"]',
        videos: '[data-testid="videoPlayer"] video, video',
        gifs: '[data-testid="gifPlayer"] video, [data-testid="gif"] video'
      },
      links: 'a[href^="https://t.co/"], a[href*="t.co"]',
      hashtags: 'a[href*="/hashtag/"], a[href*="#"]',
      mentions: 'a[href^="/"], a[href*="twitter.com/"], a[href*="x.com/"]'
    };
  }

  extractPostData(postElement) {
    try {
      if (!postElement || !postElement.querySelector) {
        console.warn('[Twitter] Invalid post element provided');
        return null;
      }
      
      const selectors = this.getSelectors();
      console.log('[Twitter] Extracting post data from element:', postElement);
      
      // Extract text content using improved method
      const text = this.extractTextContent(postElement);
      const authorName = this.extractAuthorName(postElement);
      const authorHandle = this.extractAuthorHandle(postElement);
      const timestamp = this.extractTimestamp(postElement);
      const avatar = this.extractAvatar(postElement);
      
      console.log('[Twitter] Extracted basic data:', { text: text.substring(0, 50), name: authorName, handle: authorHandle, time: timestamp });
      
      // Skip if no meaningful content
      if (!text && !authorName) {
        console.log('[Twitter] Skipping post - no text or author found');
        return null;
      }
      
      // Create unique ID
      const uniqueId = this.createPostId(text, authorHandle || authorName, timestamp);
      
      if (this.crawledPosts.has(uniqueId)) {
        console.log('[Twitter] Skipping post - already crawled');
        return null; // Already crawled
      }
      
      // Extract Twitter-specific data
      const postData = {
        id: uniqueId,
        platform: this.platform,
        author: {
          name: authorName,
          handle: authorHandle,
          avatar: avatar
        },
        text: text,
        timestamp: timestamp,
        url: window.location.href,
        crawledAt: new Date().toISOString(),
        
        // Twitter-specific fields
        tweetId: this.extractTweetId(postElement),
        isRetweet: this.isRetweet(postElement),
        isReply: this.isReply(postElement),
        
        // Engagement metrics
        metrics: this.extractTwitterMetrics(postElement),
        
        // Media content
        media: this.extractTwitterMedia(postElement),
        
        // Links and references
        links: this.extractLinks(postElement),
        hashtags: this.extractHashtags(postElement),
        mentions: this.extractMentions(postElement),
        
        // Replies (limited to first few)
        replies: this.extractTwitterReplies(postElement)
      };
      
      console.log('[Twitter] Successfully created post data:', postData);
      return postData;
    } catch (error) {
      console.error('[Twitter] Error extracting post data:', error);
      return null;
    }
  }
  
  // Extract post data for display purposes (bypassing crawled check)
  extractPostDataForDisplay(postElement) {
    try {
      if (!postElement || !postElement.querySelector) {
        console.warn('[Twitter] Invalid post element provided for display');
        return null;
      }
      
      // Extract text content using improved method
      const text = this.extractTextContent(postElement);
      const authorName = this.extractAuthorName(postElement);
      const authorHandle = this.extractAuthorHandle(postElement);
      const timestamp = this.extractTimestamp(postElement);
      
      // Skip if no meaningful content
      if (!text && !authorName) {
        console.log('[Twitter] Skipping post for display - no text or author found');
        return null;
      }
      
      // Create unique ID (but don't check if already crawled)
      const uniqueId = this.createPostId(text, authorHandle || authorName, timestamp);
      
      // Return basic data for display (minimal data needed for "Currently Viewing")
      return {
        id: uniqueId,
        platform: this.platform,
        author: {
          name: authorName,
          handle: authorHandle
        },
        text: text,
        timestamp: timestamp
      };
    } catch (error) {
      console.error('[Twitter] Error extracting post data for display:', error);
      return null;
    }
  }
  
  // Improved text extraction that handles media-rich posts
  extractTextContent(postElement) {
    try {
      console.log('[Twitter] Starting text extraction for element:', postElement);
      
      // Primary method: try tweetText selector first
      let textElement = postElement.querySelector('[data-testid="tweetText"]');
      if (textElement && textElement.textContent.trim()) {
        const primaryText = textElement.textContent.trim();
        console.log('[Twitter] Found text using primary method:', primaryText.substring(0, 50) + '...');
        return primaryText;
      }
      
      console.log('[Twitter] Primary text extraction failed, trying fallback methods...');
      
      // Fallback method 1: look for text in lang-attributed elements, excluding media containers
      const textElements = postElement.querySelectorAll('[lang] span, [lang] div');
      let combinedText = '';
      
      console.log(`[Twitter] Found ${textElements.length} lang-attributed elements`);
      
      for (const el of textElements) {
        // Skip if this element is inside media containers
        if (el.closest('[data-testid="tweetPhoto"]') || 
            el.closest('[data-testid="videoPlayer"]') || 
            el.closest('[data-testid="gifPlayer"]') ||
            el.closest('[data-testid="card.layoutLarge.media"]')) {
          continue;
        }
        
        const text = el.textContent.trim();
        if (text && text.length > 3 && !combinedText.includes(text)) {
          combinedText += (combinedText ? ' ' : '') + text;
        }
      }
      
      if (combinedText) {
        console.log('[Twitter] Found text using fallback method 1:', combinedText.substring(0, 50) + '...');
        return combinedText;
      }
      
      // Fallback method 2: try broader selectors
      console.log('[Twitter] Fallback method 1 failed, trying broader selectors...');
      const broadSelectors = [
        '[role="group"] span',
        'article span',
        '[data-testid="tweet"] span',
        'div span'
      ];
      
      for (const selector of broadSelectors) {
        const elements = postElement.querySelectorAll(selector);
        let broadText = '';
        
        for (const el of elements) {
          // Skip media and UI elements
          if (el.closest('[data-testid="tweetPhoto"]') || 
              el.closest('[data-testid="videoPlayer"]') || 
              el.closest('[data-testid="User-Name"]') ||
              el.closest('[role="button"]') ||
              el.closest('[data-testid="like"]') ||
              el.closest('[data-testid="reply"]') ||
              el.closest('[data-testid="retweet"]')) {
            continue;
          }
          
          const text = el.textContent.trim();
          if (text && text.length > 10 && !broadText.includes(text)) {
            broadText += (broadText ? ' ' : '') + text;
            if (broadText.length > 100) break; // Prevent too long text
          }
        }
        
        if (broadText && broadText.length > 20) {
          console.log(`[Twitter] Found text using broad selector ${selector}:`, broadText.substring(0, 50) + '...');
          return broadText;
        }
      }
      
      console.log('[Twitter] All text extraction methods failed');
      return '';
    } catch (error) {
      console.error('[Twitter] Error extracting text content:', error);
      return '';
    }
  }
  
  extractAuthorName(postElement) {
    const selectors = [
      '[data-testid="User-Name"] > div > div > span',
      '[data-testid="User-Name"] span:first-child',
      '[data-testid="User-Name"] > div span:first-child',
      '[data-testid="User-Name"] span'
    ];
    
    for (const selector of selectors) {
      try {
        const el = postElement.querySelector(selector);
        if (el && el.textContent.trim()) {
          return el.textContent.trim();
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }
  
  extractAuthorHandle(postElement) {
    const selectors = [
      '[data-testid="User-Name"] > div > div:last-child span',
      '[data-testid="User-Name"] span:last-child',
      '[data-testid="User-Name"] a span',
      '[data-testid="User-Name"] a'
    ];
    
    for (const selector of selectors) {
      try {
        const el = postElement.querySelector(selector);
        if (el && el.textContent.trim()) {
          const text = el.textContent.trim();
          // Ensure we get the handle (starts with @)
          if (text.startsWith('@')) {
            return text;
          }
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }
  
  extractTimestamp(postElement) {
    const selectors = [
      'time',
      'a[href*="/status/"] time',
      '[data-testid="Time"]'
    ];
    
    for (const selector of selectors) {
      try {
        const el = postElement.querySelector(selector);
        if (el) {
          // Try datetime attribute first
          if (el.getAttribute && el.getAttribute('datetime')) {
            return el.getAttribute('datetime');
          }
          // Fall back to text content
          if (el.textContent && el.textContent.trim()) {
            return el.textContent.trim();
          }
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }
  
  extractAvatar(postElement) {
    const selectors = [
      '[data-testid="Tweet-User-Avatar"] img',
      '[data-testid="UserAvatar-Container-"] img',
      'img[alt*="avatar"]',
      '[data-testid="User-Name"] img'
    ];
    
    for (const selector of selectors) {
      try {
        const el = postElement.querySelector(selector);
        if (el && el.src) {
          return el.src;
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }
  
  // Helper method to try multiple selectors
  trySelectors(element, selectors, attribute = 'textContent') {
    if (!element || !selectors || !Array.isArray(selectors)) {
      console.warn(`[Twitter] Invalid parameters for trySelectors:`, { element, selectors, attribute });
      return null;
    }
    
    for (const selector of selectors) {
      try {
        if (!selector || typeof selector !== 'string') continue;
        
        const trimmedSelector = selector.trim();
        if (!trimmedSelector) continue;
        
        const el = element.querySelector(trimmedSelector);
        if (el) {
          console.log(`[Twitter] Found element with selector: ${trimmedSelector}`);
          
          try {
            if (attribute === 'textContent') {
              return el.textContent ? el.textContent.trim() : '';
            } else if (attribute === 'src') {
              return el.src || '';
            } else {
              return el;
            }
          } catch (attrError) {
            console.warn(`[Twitter] Error accessing ${attribute} on element:`, attrError);
            continue;
          }
        }
      } catch (e) {
        console.warn(`[Twitter] Selector failed: ${selector}`, e.message);
      }
    }
    console.log(`[Twitter] No element found for selectors: ${selectors.join(', ')}`);
    return null;
  }

  extractTweetId(postElement) {
    try {
      const timeElement = postElement.querySelector('time');
      const link = timeElement?.closest('a')?.href;
      if (link) {
        const match = link.match(/\/status\/(\d+)/);
        return match ? match[1] : null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  isRetweet(postElement) {
    return postElement.querySelector('[data-testid="socialContext"]')?.textContent.includes('retweeted') || false;
  }

  isReply(postElement) {
    return postElement.querySelector('[data-testid="reply-to-link"]') !== null;
  }

  extractTwitterMetrics(postElement) {
    const selectors = this.getSelectors().metrics;
    
    const metrics = {
      replies: 0,
      retweets: 0,
      likes: 0,
      bookmarks: 0,
      views: 0
    };

    try {
      const replyElement = postElement.querySelector(selectors.reply);
      const retweetElement = postElement.querySelector(selectors.retweet);
      const likeElement = postElement.querySelector(selectors.like);
      const viewElement = postElement.querySelector(selectors.view);
      
      metrics.replies = this.parseNumber(replyElement?.textContent);
      metrics.retweets = this.parseNumber(retweetElement?.textContent);
      metrics.likes = this.parseNumber(likeElement?.textContent);
      metrics.views = this.parseNumber(viewElement?.textContent);
      
      // Bookmark button doesn't usually show count
      metrics.bookmarks = postElement.querySelector(selectors.bookmark) ? 1 : 0;
    } catch (error) {
      console.error('[Twitter] Error extracting metrics:', error);
    }

    return metrics;
  }

  extractTwitterMedia(postElement) {
    const selectors = this.getSelectors().media;
    const media = {
      images: [],
      videos: [],
      gifs: []
    };

    try {
      // Extract images
      const imageElements = postElement.querySelectorAll(selectors.images);
      media.images = Array.from(imageElements).map(img => ({
        url: img.src,
        alt: img.alt || ''
      }));

      // Extract videos
      const videoElements = postElement.querySelectorAll(selectors.videos);
      media.videos = Array.from(videoElements).map(video => ({
        url: video.src,
        poster: video.poster || ''
      }));

      // Extract GIFs
      const gifElements = postElement.querySelectorAll(selectors.gifs);
      media.gifs = Array.from(gifElements).map(gif => ({
        url: gif.src
      }));
    } catch (error) {
      console.error('[Twitter] Error extracting media:', error);
    }

    return media;
  }

  extractLinks(postElement) {
    const selectors = this.getSelectors();
    try {
      const linkElements = postElement.querySelectorAll(selectors.links);
      return Array.from(linkElements).map(link => ({
        url: link.href,
        text: link.textContent.trim()
      }));
    } catch (error) {
      return [];
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
      return Array.from(mentionElements)
        .filter(mention => mention.href.startsWith(window.location.origin + '/'))
        .map(mention => ({
          handle: mention.textContent.trim(),
          url: mention.href
        }));
    } catch (error) {
      return [];
    }
  }

  extractTwitterReplies(postElement) {
    const replies = [];
    const selectors = this.getSelectors().replies;
    
    try {
      // Look for replies in the thread below the main tweet
      const replyElements = document.querySelectorAll(selectors.container);
      
      // Limit to first 5 replies to avoid too much data
      Array.from(replyElements).slice(0, 5).forEach(replyElement => {
        const authorElement = replyElement.querySelector(selectors.author);
        const textElement = replyElement.querySelector(selectors.text);
        const timestampElement = replyElement.querySelector(selectors.timestamp);
        
        const author = authorElement ? authorElement.textContent.trim() : '';
        const text = textElement ? textElement.textContent.trim() : '';
        const timestamp = timestampElement ? (typeof timestampElement === 'string' ? timestampElement : (timestampElement.getAttribute ? (timestampElement.getAttribute('datetime') || timestampElement.textContent.trim()) : timestampElement.toString())) : '';
        
        if (author && text) {
          replies.push({
            author: author,
            text: text,
            timestamp: timestamp,
            extractedAt: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      console.error('[Twitter] Error extracting replies:', error);
    }
    
    return replies;
  }
}