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
        view: 'a[href*="/analytics"] span[data-testid="app-text-transition-container"] span, a[aria-label*="views"] span[data-testid="app-text-transition-container"] span, a[aria-label*="view"] span[data-testid="app-text-transition-container"] span, [data-testid="analytics"] span, [role="group"] a[href*="analytics"] span, a[href*="/analytics"] span span'
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
        console.log('[Twitter] No post element or querySelector not available');
        return null;
      }
      
      // Extract text content using improved method
      const text = this.extractTextContent(postElement);
      const authorName = this.extractAuthorName(postElement);
      const authorHandle = this.extractAuthorHandle(postElement);
      const timestamp = this.extractTimestamp(postElement);
      const avatar = this.extractAvatar(postElement);
      
      console.log(`[Twitter] Basic extraction - text: "${this.formatLogText(text, 30)}", author: "${authorName}", handle: "${authorHandle}"`);
      
      // Skip if no meaningful content
      if (!text && !authorName) {
        console.log('[Twitter] No meaningful content found, skipping post');
        return null;
      }
      
      // Try to extract tweet ID first for more reliable unique identification
      const tweetId = this.extractTweetId(postElement);
      
      // Create unique ID - prefer tweet ID if available, otherwise use content-based approach
      let uniqueId;
      if (tweetId) {
        uniqueId = `tweet_${tweetId}`;
        console.log(`[Twitter] Using tweet ID for uniqueness: ${uniqueId}`);
      } else {
        uniqueId = this.createPostId(text, authorHandle || authorName, timestamp);
        console.log(`[Twitter] Using content-based ID: ${uniqueId}`);
      }
      
      if (this.crawledPosts.has(uniqueId)) {
        console.log(`[Twitter] Post already crawled (ID: ${uniqueId}), skipping`);
        return null; // Already crawled
      }
      
      console.log(`[Twitter] Creating post data for new post (ID: ${uniqueId})`);
      
      // Extract Twitter-specific data with individual error handling
      let finalTweetId, isRetweet, isReply, metrics, media, links, hashtags, mentions, replies;
      
      try {
        finalTweetId = tweetId; // Use the already extracted tweetId
        console.log(`[Twitter] Tweet ID: ${finalTweetId}`);
      } catch (e) {
        console.warn('[Twitter] Failed to extract tweet ID:', e.message);
        finalTweetId = null;
      }
      
      try {
        isRetweet = this.isRetweet(postElement);
        isReply = this.isReply(postElement);
        console.log(`[Twitter] Tweet type - isRetweet: ${isRetweet}, isReply: ${isReply}`);
      } catch (e) {
        console.warn('[Twitter] Failed to extract tweet type:', e.message);
        isRetweet = false;
        isReply = false;
      }
      
      try {
        metrics = this.extractTwitterMetrics(postElement);
        console.log(`[Twitter] Metrics extracted - views: ${metrics.views}, likes: ${metrics.likes}`);
      } catch (e) {
        console.warn('[Twitter] Failed to extract metrics:', e.message);
        metrics = { replies: 0, retweets: 0, likes: 0, bookmarks: 0, views: 0 };
      }
      
      try {
        media = this.extractTwitterMedia(postElement);
        console.log(`[Twitter] Media extracted - images: ${media.images.length}, videos: ${media.videos.length}`);
      } catch (e) {
        console.warn('[Twitter] Failed to extract media:', e.message);
        media = { images: [], videos: [], gifs: [] };
      }
      
      try {
        links = this.extractLinks(postElement);
        hashtags = this.extractHashtags(postElement);
        mentions = this.extractMentions(postElement);
        console.log(`[Twitter] References extracted - links: ${links.length}, hashtags: ${hashtags.length}, mentions: ${mentions.length}`);
      } catch (e) {
        console.warn('[Twitter] Failed to extract references:', e.message);
        links = [];
        hashtags = [];
        mentions = [];
      }
      
      try {
        replies = this.extractTwitterReplies(postElement);
        console.log(`[Twitter] Replies extracted: ${replies.length}`);
      } catch (e) {
        console.warn('[Twitter] Failed to extract replies:', e.message);
        replies = [];
      }
      
      // Extract company name from current page
      const companyName = this.extractCompanyName();
      
      // Extract Twitter-specific data
      const postData = {
        id: uniqueId,
        platform: this.platform,
        company: companyName || 'unknown',
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
        tweetId: finalTweetId,
        isRetweet: isRetweet,
        isReply: isReply,
        
        // Engagement metrics
        metrics: metrics,
        
        // Media content
        media: media,
        
        // Links and references
        links: links,
        hashtags: hashtags,
        mentions: mentions,
        
        // Replies (limited to first few)
        replies: replies
      };
      
      console.log(`[Twitter] Post data created successfully for: "${this.formatLogText(text, 40)}"`);
      return postData;
    } catch (error) {
      console.error('[Twitter] Error extracting post data:', error);
      console.error('[Twitter] Post element that caused error:', postElement);
      return null;
    }
  }
  
  // Extract post data for display purposes (bypassing crawled check)
  extractPostDataForDisplay(postElement) {
    try {
      if (!postElement || !postElement.querySelector) {
        return null;
      }
      
      // Extract text content using improved method
      const text = this.extractTextContent(postElement);
      const authorName = this.extractAuthorName(postElement);
      const authorHandle = this.extractAuthorHandle(postElement);
      const timestamp = this.extractTimestamp(postElement);
      
      // Skip if no meaningful content
      if (!text && !authorName) {
        return null;
      }
      
      // Try to extract tweet ID first for more reliable unique identification  
      const tweetId = this.extractTweetId(postElement);
      
      // Create unique ID - prefer tweet ID if available, otherwise use content-based approach
      let uniqueId;
      if (tweetId) {
        uniqueId = `tweet_${tweetId}`;
      } else {
        uniqueId = this.createPostId(text, authorHandle || authorName, timestamp);
      }
      
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
      // Primary method: try tweetText selector first
      let textElement = postElement.querySelector('[data-testid="tweetText"]');
      if (textElement && textElement.textContent.trim()) {
        return textElement.textContent.trim();
      }
      
      // Fallback method 1: look for text in lang-attributed elements, excluding media containers
      const textElements = postElement.querySelectorAll('[lang] span, [lang] div');
      let combinedText = '';
      
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
        return combinedText;
      }
      
      // Fallback method 2: try broader selectors
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
          return broadText;
        }
      }
      
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
    try {
      // Based on the actual HTML structure, find all spans in User-Name section
      const allSpans = postElement.querySelectorAll('[data-testid="User-Name"] span');
      
      for (const span of allSpans) {
        const text = span.textContent.trim();
        if (text.startsWith('@') && text.length > 1) {
          console.log(`[Twitter] Found handle: ${text}`);
          return text;
        }
      }
      
      // Fallback: try to find link with @onfleet pattern in href
      const links = postElement.querySelectorAll('[data-testid="User-Name"] a[href^="/"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && href !== '/' && !href.includes('/status/')) {
          const handle = '@' + href.substring(1); // Remove leading /
          console.log(`[Twitter] Found handle from href: ${handle}`);
          return handle;
        }
      }
      
      // Final fallback: generate a handle based on author name if available
      const authorName = this.extractAuthorName(postElement);
      if (authorName) {
        const generatedHandle = `@${authorName.replace(/\s+/g, '').toLowerCase()}`;
        console.log(`[Twitter] Generated handle: ${generatedHandle} from author name: ${authorName}`);
        return generatedHandle;
      }
    } catch (e) {
      console.warn(`[Twitter] Error extracting handle:`, e);
    }
    
    console.warn(`[Twitter] No handle found for post, this may cause ID generation issues`);
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
          // Element found - removed debug log
          
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
      
      metrics.replies = this.parseNumber(replyElement?.textContent);
      metrics.retweets = this.parseNumber(retweetElement?.textContent);
      metrics.likes = this.parseNumber(likeElement?.textContent);
      
      // Extract view counts - try multiple approaches
      let viewElement = postElement.querySelector(selectors.view);
      if (viewElement) {
        metrics.views = this.parseNumber(viewElement.textContent);
        console.log(`[Twitter] Found views via selector: ${metrics.views}`);
      } else {
        // Fallback 1: Look for analytics link with aria-label containing "views" (most reliable)
        const analyticsLink = postElement.querySelector('a[href*="/analytics"][aria-label*="view"]');
        if (analyticsLink) {
          const ariaLabel = analyticsLink.getAttribute('aria-label');
          const viewMatch = ariaLabel.match(/(\d+(?:[.,]\d+)*)\s*views?/i);
          if (viewMatch) {
            metrics.views = this.parseNumber(viewMatch[1]);
            console.log(`[Twitter] Found views via aria-label: ${metrics.views} from "${ariaLabel}"`);
          }
        } else {
          // Fallback 2: Look for the analytics link and extract number from inner span
          const analyticsLinks = postElement.querySelectorAll('a[href*="/analytics"]');
          for (const link of analyticsLinks) {
            const numberSpan = link.querySelector('span[data-testid="app-text-transition-container"] span span');
            if (numberSpan && numberSpan.textContent.trim()) {
              const viewText = numberSpan.textContent.trim();
              if (/^\d/.test(viewText)) {
                metrics.views = this.parseNumber(viewText);
                console.log(`[Twitter] Found views via analytics link span: ${metrics.views} from "${viewText}"`);
                break;
              }
            }
            
            // Also try direct span selection
            const directSpan = link.querySelector('span span span');
            if (directSpan && directSpan.textContent.trim()) {
              const viewText = directSpan.textContent.trim();
              if (/^\d/.test(viewText)) {
                metrics.views = this.parseNumber(viewText);
                console.log(`[Twitter] Found views via direct span: ${metrics.views} from "${viewText}"`);
                break;
              }
            }
          }
          
          // Fallback 3: Look in engagement area (usually last metric after reply, retweet, like)
          if (metrics.views === 0) {
            const engagementArea = postElement.querySelector('[role="group"]');
            if (engagementArea) {
              // Find all clickable elements with numbers
              const clickableElements = engagementArea.querySelectorAll('a, button');
              for (let i = clickableElements.length - 1; i >= 0; i--) {
                const element = clickableElements[i];
                const href = element.getAttribute('href');
                const ariaLabel = element.getAttribute('aria-label');
                
                // Check if this looks like a view analytics link
                if ((href && href.includes('analytics')) || 
                    (ariaLabel && ariaLabel.toLowerCase().includes('view'))) {
                  const numberSpan = element.querySelector('span[data-testid="app-text-transition-container"] span');
                  if (numberSpan) {
                    const viewText = numberSpan.textContent.trim();
                    if (viewText && /^\d/.test(viewText)) {
                      metrics.views = this.parseNumber(viewText);
                      console.log(`[Twitter] Found views via engagement area: ${metrics.views} from "${viewText}"`);
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Bookmark button doesn't usually show count
      metrics.bookmarks = postElement.querySelector(selectors.bookmark) ? 1 : 0;
      
      // Log metrics for debugging (only if views > 0 to avoid spam)
      if (metrics.views > 0) {
        console.log(`[Twitter] Extracted metrics: replies=${metrics.replies}, retweets=${metrics.retweets}, likes=${metrics.likes}, views=${metrics.views}`);
      }
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

  // Extract company name from current page URL
  extractCompanyName() {
    try {
      // Method 1: From URL path (e.g., /Routific -> Routific)
      const pathMatch = window.location.pathname.match(/^\/([^\/]+)/);
      if (pathMatch && pathMatch[1] && pathMatch[1] !== 'home' && pathMatch[1] !== 'search' && pathMatch[1] !== 'explore' && pathMatch[1] !== 'notifications') {
        return pathMatch[1];
      }
      
      // Method 2: From page title
      const titleMatch = document.title.match(/^(.+?)\s*(?:\(.*?\))?\s*(?:\/|on|•|Twitter|X)/);
      if (titleMatch && titleMatch[1]) {
        return titleMatch[1].replace(/[^a-zA-Z0-9_]/g, '');
      }
      
      // Method 3: From profile name in DOM
      const profileName = document.querySelector('[data-testid="UserName"] span');
      if (profileName && profileName.textContent) {
        return profileName.textContent.replace(/[^a-zA-Z0-9_]/g, '');
      }
      
      return null;
    } catch (error) {
      console.warn('[Twitter] Error extracting company name:', error);
      return null;
    }
  }

  // Twitter-specific implementation for finding next post
  findNextPostToScrollTo() {
    const selectors = this.getSelectors();
    const posts = Array.from(document.querySelectorAll(selectors.postContainer));
    
    // First, find the current top post in viewport
    const currentTopPost = this.getTopPostInViewport(posts);
    
    if (!currentTopPost) {
      return posts.length > 0 ? posts[0] : null;
    }
    
    // For Twitter/X, use position-based approach due to virtual scrolling
    const currentPostTop = currentTopPost.getBoundingClientRect().top + window.scrollY;
    
    // Look for posts that are below the current post
    let nextPost = null;
    let minDistance = Infinity;
    
    posts.forEach(post => {
      const postTop = post.getBoundingClientRect().top + window.scrollY;
      
      // Only consider posts below the current post
      if (postTop > currentPostTop + 50) { // 50px buffer to avoid same post
        const distance = postTop - currentPostTop;
        if (distance < minDistance) {
          minDistance = distance;
          nextPost = post;
        }
      }
    });
    
    return nextPost;
  }
}