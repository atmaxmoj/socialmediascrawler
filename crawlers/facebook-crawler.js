// Facebook specific crawler
class FacebookCrawler extends BaseCrawler {
  constructor() {
    super('facebook');
  }

  getSelectors() {
    return {
      // Facebook posts are contained in TimelineFeedUnit pagelets
      postContainer: '[data-pagelet*="TimelineFeedUnit"], article[role="article"], [role="article"]',
      textContent: '[data-ad-rendering-role="story_message"], [data-ad-comet-preview="message"], [data-ad-preview="message"]',
      author: {
        name: 'h2 a[role="link"] span, h2 b span, [data-ad-rendering-role="profile_name"] h2 span a',
        avatar: 'svg image, img[alt*="avatar"], a[aria-label] svg image',
        profile: 'h2 a[href*="facebook.com"], [data-ad-rendering-role="profile_name"] a'
      },
      timestamp: 'a[aria-label*="年"][aria-label*="月"], a[aria-label*="日"], time, [data-testid="story-subtitle"] a',
      engagement: '[role="toolbar"], [aria-label*="赞"], [aria-label*="评论"], [aria-label*="分享"]',
      metrics: {
        likes: '[aria-label*="赞："], [aria-label*="like"], .x1kmio9f span',
        comments: '[aria-label*="评论"], [data-ad-rendering-role="comment_button"]',
        shares: '[aria-label*="分享"], [data-ad-rendering-role="share_button"]'
      },
      reactions: {
        container: '[aria-label*="查看留下心情的用户"]',
        types: 'img[src*="svg"]'
      },
      comments: {
        container: '[data-ad-rendering-role="comments_container"]',
        item: '[data-ad-rendering-role="comment"]',
        author: '[data-ad-rendering-role="comment_author"]',
        text: '[data-ad-rendering-role="comment_text"]',
        timestamp: '[data-ad-rendering-role="comment_timestamp"]'
      },
      media: {
        images: 'img[src*="scontent"], img[src*="fbcdn.net"], [data-ad-rendering-role="media"] img',
        videos: 'video, [data-ad-rendering-role="video"]',
        links: 'a[href*="facebook.com/photo"], a[href*="facebook.com/video"]'
      },
      links: 'a[href^="http"]:not([href*="facebook.com"])',
      hashtags: 'a[href*="/hashtag/"]',
      mentions: 'a[href*="facebook.com/"]:not([href*="/photo"]):not([href*="/video"])'
    };
  }

  extractPostData(postElement) {
    try {
      const selectors = this.getSelectors();
      
      // Basic post info
      const text = this.extractFacebookText(postElement);
      const authorName = this.extractFacebookAuthorName(postElement);
      const timestamp = this.extractFacebookTimestamp(postElement);
      const avatar = this.extractFacebookAvatar(postElement);
      const profileUrl = this.extractFacebookProfileUrl(postElement);
      
      console.log(`[Facebook] Basic extraction - text: "${this.formatLogText(text, 30)}", author: "${authorName}"`);
      
      // Skip if no meaningful content
      if (!text && !authorName) {
        console.log('[Facebook] No meaningful content found, skipping post');
        return null;
      }
      
      // Create unique ID
      const uniqueId = this.createPostId(text, authorName, timestamp);
      
      if (this.crawledPosts.has(uniqueId)) {
        console.log(`[Facebook] Post already crawled (ID: ${uniqueId}), skipping`);
        return null;
      }
      
      console.log(`[Facebook] Creating post data for new post (ID: ${uniqueId})`);
      
      // Extract company name from current page
      const companyName = this.extractCompanyName();
      console.log(`[Facebook] Company name extracted: ${companyName}`);
      
      // Extract Facebook-specific data with individual error handling
      let postType, isSponsored, metrics, reactions, media, links, hashtags, mentions, comments;
      
      try {
        postType = this.getFacebookPostType(postElement);
        isSponsored = this.isSponsored(postElement);
        console.log(`[Facebook] Post type: ${postType}, sponsored: ${isSponsored}`);
      } catch (e) {
        console.warn('[Facebook] Failed to extract post type:', e.message);
        postType = 'text';
        isSponsored = false;
      }
      
      try {
        metrics = this.extractFacebookMetrics(postElement);
        console.log(`[Facebook] Metrics extracted - likes: ${metrics.likes}, comments: ${metrics.comments}`);
      } catch (e) {
        console.warn('[Facebook] Failed to extract metrics:', e.message);
        metrics = { likes: 0, comments: 0, shares: 0 };
      }
      
      try {
        reactions = this.extractFacebookReactions(postElement);
        media = this.extractFacebookMedia(postElement);
        links = this.extractLinks(postElement);
        hashtags = this.extractHashtags(postElement);
        mentions = this.extractMentions(postElement);
        comments = this.extractFacebookComments(postElement);
        console.log(`[Facebook] Additional data extracted - media: ${media.images.length} images, links: ${links.length}`);
      } catch (e) {
        console.warn('[Facebook] Failed to extract additional data:', e.message);
        reactions = { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
        media = { images: [], videos: [], links: [] };
        links = [];
        hashtags = [];
        mentions = [];
        comments = [];
      }
      
      // Create post data
      const postData = {
        id: uniqueId,
        platform: this.platform,
        company: companyName || 'unknown',
        author: {
          name: authorName,
          avatar: avatar,
          profileUrl: profileUrl
        },
        text: text,
        timestamp: timestamp,
        url: window.location.href,
        crawledAt: new Date().toISOString(),
        
        // Facebook-specific fields
        postType: postType,
        isSponsored: isSponsored,
        
        // Engagement metrics
        metrics: metrics,
        
        // Reaction details
        reactions: reactions,
        
        // Media content
        media: media,
        
        // Links and references
        links: links,
        hashtags: hashtags,
        mentions: mentions,
        
        // Comments
        comments: comments
      };
      
      console.log(`[Facebook] Post data created successfully for: "${this.formatLogText(text, 40)}"`);
      return postData;
    } catch (error) {
      console.error('[Facebook] Error extracting post data:', error);
      return null;
    }
  }

  // Extract text content from Facebook posts
  extractFacebookText(postElement) {
    try {
      // Primary method: look for story message selectors
      const textSelectors = [
        '[data-ad-rendering-role="story_message"]',
        '[data-ad-comet-preview="message"]',
        '[data-ad-preview="message"]',
        '[data-ad-rendering-role="message"]'
      ];
      
      for (const selector of textSelectors) {
        const textElement = postElement.querySelector(selector);
        if (textElement && textElement.textContent.trim()) {
          let text = textElement.textContent.trim();
          // Clean up common Facebook text artifacts
          text = text.replace(/\s+/g, ' ');
          text = text.replace(/展开$/, ''); // Remove "expand" button text
          if (text.length > 10) {
            return text;
          }
        }
      }
      
      // Fallback method: look for text in specific div structures
      const fallbackSelectors = [
        'div[dir="auto"]',
        'span[dir="auto"]',
        'div[style*="text-align: start"]'
      ];
      
      for (const selector of fallbackSelectors) {
        const elements = postElement.querySelectorAll(selector);
        for (const element of elements) {
          // Skip if this element is likely metadata (very short or contains only symbols)
          const text = element.textContent.trim();
          if (text.length > 20 && 
              !text.includes('·') && 
              !text.includes('年') && 
              !text.match(/^\d+$/)) {
            return text.replace(/\s+/g, ' ').replace(/展开$/, '');
          }
        }
      }
      
      return '';
    } catch (error) {
      console.error('[Facebook] Error extracting text content:', error);
      return '';
    }
  }

  extractFacebookAuthorName(postElement) {
    try {
      // Try multiple selectors for author name
      const selectors = [
        'h2 a[role="link"] b span',
        'h2 b span',
        '[data-ad-rendering-role="profile_name"] h2 b span',
        '[data-ad-rendering-role="profile_name"] span',
        'h2 span a b span'
      ];
      
      for (const selector of selectors) {
        const element = postElement.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      
      return '';
    } catch (error) {
      console.error('[Facebook] Error extracting author name:', error);
      return '';
    }
  }

  extractFacebookTimestamp(postElement) {
    try {
      // Facebook timestamps are often in links with specific aria-labels
      const timestampSelectors = [
        'a[aria-label*="年"][aria-label*="月"]',
        'a[aria-label*="日"]',
        'time',
        '[data-testid="story-subtitle"] a'
      ];
      
      for (const selector of timestampSelectors) {
        const element = postElement.querySelector(selector);
        if (element) {
          if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label');
          }
          if (element.textContent.trim()) {
            return element.textContent.trim();
          }
        }
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  extractFacebookAvatar(postElement) {
    try {
      // Facebook avatars are often in SVG format or img tags
      const avatarSelectors = [
        'svg image',
        'img[alt*="avatar"]',
        'a[aria-label] svg image',
        'img[src*="profile"]'
      ];
      
      for (const selector of avatarSelectors) {
        const element = postElement.querySelector(selector);
        if (element) {
          if (element.getAttribute && element.getAttribute('xlink:href')) {
            return element.getAttribute('xlink:href');
          }
          if (element.src) {
            return element.src;
          }
        }
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  extractFacebookProfileUrl(postElement) {
    try {
      const element = postElement.querySelector('h2 a[href*="facebook.com"], [data-ad-rendering-role="profile_name"] a');
      return element ? element.href : '';
    } catch (error) {
      return '';
    }
  }

  getFacebookPostType(postElement) {
    try {
      if (postElement.querySelector('video, [data-ad-rendering-role="video"]')) return 'video';
      if (postElement.querySelector('img[src*="scontent"], img[src*="fbcdn.net"]')) return 'image';
      if (postElement.querySelector('a[href*="facebook.com/photo"]')) return 'photo';
      if (postElement.querySelector('a[href*="facebook.com/video"]')) return 'video';
      return 'text';
    } catch (error) {
      return 'text';
    }
  }

  isSponsored(postElement) {
    try {
      // Facebook sponsored posts usually have specific indicators
      return postElement.textContent.includes('赞助') || 
             postElement.textContent.includes('Sponsored') ||
             postElement.querySelector('[data-ad-rendering-role="sponsored"]') !== null;
    } catch (error) {
      return false;
    }
  }

  extractFacebookMetrics(postElement) {
    const metrics = {
      likes: 0,
      comments: 0,
      shares: 0
    };

    try {
      // Extract likes - Facebook shows like counts in specific areas
      const likeElements = postElement.querySelectorAll('[aria-label*="赞："], .x1kmio9f span');
      for (const element of likeElements) {
        const text = element.textContent || element.getAttribute('aria-label') || '';
        const likeMatch = text.match(/赞：\s*(\d+)|(\d+)\s*人/);
        if (likeMatch) {
          metrics.likes = parseInt(likeMatch[1] || likeMatch[2]) || 0;
          break;
        }
      }
      
      // Extract comments and shares from button areas
      const buttons = postElement.querySelectorAll('[aria-label*="评论"], [aria-label*="分享"]');
      buttons.forEach(button => {
        const label = button.getAttribute('aria-label') || '';
        if (label.includes('评论')) {
          const commentMatch = label.match(/(\d+)/);
          if (commentMatch) {
            metrics.comments = parseInt(commentMatch[1]) || 0;
          }
        }
        if (label.includes('分享')) {
          const shareMatch = label.match(/(\d+)/);
          if (shareMatch) {
            metrics.shares = parseInt(shareMatch[1]) || 0;
          }
        }
      });
      
    } catch (error) {
      console.error('[Facebook] Error extracting metrics:', error);
    }

    return metrics;
  }

  extractFacebookReactions(postElement) {
    const reactions = {
      like: 0,
      love: 0,
      care: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0
    };

    try {
      // Facebook reactions are complex and often require interaction to see details
      const reactionContainer = postElement.querySelector('[aria-label*="查看留下心情的用户"]');
      if (reactionContainer) {
        // This would require more complex interaction to extract detailed reaction counts
        const totalReactions = postElement.querySelector('.x1kmio9f span');
        if (totalReactions) {
          const total = this.parseNumber(totalReactions.textContent);
          reactions.like = total; // Assign all to 'like' as fallback
        }
      }
    } catch (error) {
      console.error('[Facebook] Error extracting reactions:', error);
    }

    return reactions;
  }

  extractFacebookMedia(postElement) {
    const selectors = this.getSelectors().media;
    const media = {
      images: [],
      videos: [],
      links: []
    };

    try {
      // Extract images
      const imageElements = postElement.querySelectorAll(selectors.images);
      media.images = Array.from(imageElements).map(img => ({
        url: img.src,
        alt: img.alt || ''
      })).filter(img => img.url && !img.url.includes('data:'));

      // Extract videos
      const videoElements = postElement.querySelectorAll(selectors.videos);
      media.videos = Array.from(videoElements).map(video => ({
        url: video.src || '',
        poster: video.poster || ''
      })).filter(video => video.url);

      // Extract media links
      const linkElements = postElement.querySelectorAll(selectors.links);
      media.links = Array.from(linkElements).map(link => ({
        url: link.href,
        text: link.textContent.trim()
      }));
    } catch (error) {
      console.error('[Facebook] Error extracting media:', error);
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
      })).filter(link => link.url && link.url.startsWith('http'));
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
      return Array.from(mentionElements).map(mention => ({
        name: mention.textContent.trim(),
        url: mention.href
      })).filter(mention => mention.url && mention.url.includes('facebook.com'));
    } catch (error) {
      return [];
    }
  }

  extractFacebookComments(postElement) {
    const comments = [];
    const selectors = this.getSelectors().comments;
    
    try {
      // Facebook comments are complex and often loaded dynamically
      const commentElements = postElement.querySelectorAll(selectors.item);
      
      Array.from(commentElements).slice(0, 5).forEach(commentElement => {
        const authorElement = commentElement.querySelector(selectors.author);
        const textElement = commentElement.querySelector(selectors.text);
        const timestampElement = commentElement.querySelector(selectors.timestamp);
        
        const author = authorElement ? authorElement.textContent.trim() : '';
        const text = textElement ? textElement.textContent.trim() : '';
        const timestamp = timestampElement ? timestampElement.textContent.trim() : '';
        
        if (author && text) {
          comments.push({
            author: author,
            text: text,
            timestamp: timestamp,
            extractedAt: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      console.error('[Facebook] Error extracting comments:', error);
    }
    
    return comments;
  }

  // Extract company name from current page URL or post context
  extractCompanyName() {
    try {
      // Method 1: From URL path (e.g., /routific -> routific)
      const pathMatch = window.location.pathname.match(/\/([^\/]+)/);
      if (pathMatch && pathMatch[1] && 
          pathMatch[1] !== 'home' && 
          pathMatch[1] !== 'feed' && 
          pathMatch[1] !== 'watch') {
        return pathMatch[1];
      }
      
      // Method 2: From page title
      const titleMatch = document.title.match(/^(.+?)\s*[|\-|•]/);
      if (titleMatch && titleMatch[1]) {
        const cleanTitle = titleMatch[1]
          .replace(/\s*\(\d+.*?\)/, '') // Remove follower counts
          .replace(/\s*Facebook.*$/i, '') // Remove Facebook suffix
          .trim();
        if (cleanTitle.length > 0) {
          return cleanTitle.replace(/[^a-zA-Z0-9_]/g, '');
        }
      }
      
      // Method 3: From company name in post author
      const companyName = document.querySelector('h2 b span')?.textContent?.trim();
      if (companyName) {
        return companyName.replace(/[^a-zA-Z0-9_]/g, '');
      }
      
      return null;
    } catch (error) {
      console.warn('[Facebook] Error extracting company name:', error);
      return null;
    }
  }

  // Facebook-specific implementation for finding next post
  findNextPostToScrollTo() {
    const selectors = this.getSelectors();
    const posts = Array.from(document.querySelectorAll(selectors.postContainer));
    
    console.log(`[Facebook] Found ${posts.length} posts in DOM`);
    
    // Find the current top post in viewport
    const currentTopPost = this.getTopPostInViewport(posts);
    
    if (!currentTopPost) {
      console.log(`[Facebook] No current top post found, returning first post`);
      return posts.length > 0 ? posts[0] : null;
    }
    
    // Use position-based approach for Facebook
    const currentPostTop = currentTopPost.getBoundingClientRect().top + window.scrollY;
    console.log(`[Facebook] Current post position: ${currentPostTop}px`);
    
    // Look for posts that are below the current post by at least 100px
    let nextPost = null;
    let minDistance = Infinity;
    
    posts.forEach((post, index) => {
      const postTop = post.getBoundingClientRect().top + window.scrollY;
      
      // Only consider posts below the current post with sufficient distance
      if (postTop > currentPostTop + 100) { 
        const distance = postTop - currentPostTop;
        if (distance < minDistance) {
          minDistance = distance;
          nextPost = post;
          console.log(`[Facebook] Found potential next post at index ${index}, position ${postTop}px, distance ${distance}px`);
        }
      }
    });
    
    if (nextPost) {
      console.log(`[Facebook] Selected next post at distance ${minDistance}px`);
      return nextPost;
    }
    
    console.log(`[Facebook] No next post found, will trigger content loading`);
    return null;
  }
  
  // Override autoScroll for Facebook to handle slow loading
  autoScroll() {
    if (!this.isRunning) return;
    
    // Step 1: Process the current top post
    const processedNewPost = this.processTopPost();
    
    // Step 2: If current post was already processed, scroll down
    if (!processedNewPost) {
      // Facebook needs special handling due to lazy loading
      const selectors = this.getSelectors();
      const posts = document.querySelectorAll(selectors.postContainer);
      const currentTopPost = this.getTopPostInViewport(posts);
      
      if (currentTopPost) {
        const currentScrollY = window.scrollY;
        const postRect = currentTopPost.getBoundingClientRect();
        const postHeight = postRect.height;
        
        // For Facebook, scroll more slowly to allow content to load
        let scrollAmount = Math.min(postHeight * 0.7, 400); // Scroll 70% of post height or max 400px
        
        window.scrollTo({
          top: currentScrollY + scrollAmount,
          behavior: 'smooth'
        });
        
        console.log(`[Facebook] Scrolling down by ${scrollAmount}px to allow content loading`);
        
        // Wait longer for Facebook content to load
        setTimeout(() => {
          // Check if new content has loaded
          const newPosts = document.querySelectorAll(selectors.postContainer);
          if (newPosts.length > posts.length) {
            console.log(`[Facebook] New posts loaded: ${newPosts.length - posts.length} new posts`);
          }
          
          // Process the newly positioned top post
          this.processTopPost();
        }, 2000); // Wait 2 seconds for content to load
        
      } else {
        // Fallback scroll
        window.scrollTo({
          top: window.scrollY + 300,
          behavior: 'smooth'
        });
      }
    } else {
      // If we just processed a new post, wait a bit before scrolling
      console.log(`[Facebook] Processed new post, waiting before next scroll`);
    }
  }
  
  // Override startCrawling to use slower intervals for Facebook
  async startCrawling() {
    if (this.isRunning) {
      console.warn(`[${this.platform}] startCrawling called but already running`);
      return;
    }
    
    // Clear any existing intervals/observers first
    this.stopCrawling();
    
    this.isRunning = true;
    console.log(`[${this.platform}] Starting to crawl posts...`);
    
    // Load existing post IDs from database to avoid duplicates
    await this.loadExistingPostIds();
    
    // Initial setup
    this.lastScrollHeight = document.body.scrollHeight;
    
    // Initial crawl
    this.crawlVisiblePosts();
    
    // Set up mutation observer for new content
    this.lastContentHeight = document.documentElement.scrollHeight;
    this.observer = new MutationObserver((mutations) => {
      if (!this.isRunning) return;
      
      const currentHeight = document.documentElement.scrollHeight;
      if (currentHeight > this.lastContentHeight) {
        this.lastContentHeight = currentHeight;
        setTimeout(() => {
          this.crawlVisiblePosts();
        }, 1500); // Wait longer for Facebook content
      }
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Slower auto-scroll for Facebook to allow content loading
    this.scrollInterval = setInterval(() => {
      if (this.isRunning) {
        this.autoScroll();
      }
    }, 3000); // Scroll every 3 seconds instead of 1 second
    
    console.log(`[${this.platform}] Started crawler with slower intervals for content loading`);
  }
}