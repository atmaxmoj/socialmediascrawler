// Facebook specific crawler
class FacebookCrawler extends BaseCrawler {
  constructor() {
    super('facebook');
  }

  getSelectors() {
    return {
      // Facebook posts - updated based on actual HTML structure
      postContainer: '[data-pagelet*="TimelineFeedUnit"], [role="article"]',
      textContent: '.native-text, div[dir="auto"], span[dir="auto"]',
      author: {
        name: '.native-text',
        avatar: 'img[src*="scontent"], img[src*="fbcdn.net"]',
        profile: 'a[href*="facebook.com"]'
      },
      timestamp: 'a[aria-label*="年"], a[aria-label*="月"], a[aria-label*="日"], time, [data-mcomponent="TextArea"]',
      engagement: '[role="button"][aria-label*="like"], [role="button"][aria-label*="comment"], [role="button"][aria-label*="share"]',
      metrics: {
        likes: '[aria-label*="like"], [aria-label*="个like"], .native-text',
        comments: '[aria-label*="comment"], [aria-label*="comments"], .native-text',
        shares: '[aria-label*="分享"], [aria-label*="share"], .native-text'
      },
      reactions: {
        container: '[aria-label*="查看留下心情的用户"], [aria-label*="个like"]',
        types: '.native-text span'
      },
      comments: {
        container: '[data-mcomponent="MContainer"]',
        item: '[data-mcomponent="MContainer"]',
        author: '.native-text',
        text: '.native-text',
        timestamp: '[data-mcomponent="TextArea"]'
      },
      media: {
        images: 'img[src*="scontent"], img[src*="fbcdn.net"]',
        videos: 'video, [data-mcomponent="MVideo"]',
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
      
      // Skip only if we have absolutely no content
      if (!text && !authorName) {
        console.log('[Facebook] No meaningful content found, skipping post');
        return null;
      }
      
      // If we have no text but have author, that's still worth saving
      if (!text && authorName) {
        console.log('[Facebook] No text content but found author, will save post');
      }
      
      // Create unique ID with additional video-specific data for better uniqueness
      const uniqueId = this.createFacebookPostId(postElement, text, authorName, timestamp);
      
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
      // Skip the expand click attempt since it requires server-side PHP requests
      // Instead, focus on extracting all available text content more comprehensively
      
      // Try multiple approaches to find text content more aggressively
      let bestText = '';
      let allFoundTexts = [];
      
      // Approach 1: Look for all possible text content containers
      const textSelectors = [
        // Primary text content areas
        '.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl',
        'div[dir="auto"]',
        'span[class*="x193iq5w"]',
        // Additional possible containers
        '[data-ad-preview="message"]',
        '.userContent',
        '.text_exposed_show',
        '.text_exposed_hide',
        'p', 'div[style*="text"]',
        // Look in parent containers that might have expanded content
        '.x1yztbdb div[dir="auto"]',
        '.x1n2onr6 span'
      ];
      
      for (const selector of textSelectors) {
        const textElements = postElement.querySelectorAll(selector);
        
        for (const element of textElements) {
          const text = element.textContent.trim();
          
          // Skip very short text or obvious UI elements
          if (text.length < 8) continue;
          if (text.match(/^[\d\s·年月日]+$/)) continue; // Skip pure dates/numbers
          if (text === 'Reels' || text === '关注' || text === '打赏！' || text === '展开') continue;
          
          // Clean up the text
          let cleanText = text
            .replace(/展开$/, '') // Remove "展开" at the end
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
          
          if (cleanText.length >= 8) {
            allFoundTexts.push(cleanText);
          }
        }
      }
      
      // Approach 2: Look for any text that might be hidden or in different elements
      const allElements = postElement.querySelectorAll('*');
      for (const element of allElements) {
        // Skip elements with many children (likely containers)
        if (element.children.length > 3) continue;
        
        const text = element.textContent.trim();
        
        // Look for substantial text content
        if (text.length > 20 && 
            !text.match(/^[\d\s·年月日]+$/) && 
            text !== 'Reels' && text !== '关注' && text !== '打赏！' && text !== '展开') {
          
          let cleanText = text
            .replace(/展开$/, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          if (cleanText.length > 20) {
            allFoundTexts.push(cleanText);
          }
        }
      }
      
      // Find the longest and most meaningful text
      if (allFoundTexts.length > 0) {
        // Sort by length and content quality
        allFoundTexts.sort((a, b) => {
          // Prefer text with punctuation (sentences)
          const aHasPunc = /[.!?]/.test(a);
          const bHasPunc = /[.!?]/.test(b);
          
          if (aHasPunc && !bHasPunc) return -1;
          if (!aHasPunc && bHasPunc) return 1;
          
          // Otherwise prefer longer text
          return b.length - a.length;
        });
        
        bestText = allFoundTexts[0];
        
        console.log(`[Facebook] Found ${allFoundTexts.length} text candidates, selected: "${bestText.substring(0, 50)}..."`);
      }
      
      // Final cleanup
      if (bestText) {
        bestText = bestText
          .replace(/Circuit\s*·\s*关注.*$/i, '') // Remove author info at the end
          .replace(/Reels\s*·\s*\d+月\d+日.*$/i, '') // Remove Reels info at the end  
          .replace(/打赏！.*$/i, '') // Remove tip info at the end
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      return bestText;
    } catch (error) {
      console.error('[Facebook] Error extracting text content:', error);
      return '';
    }
  }

  // Note: Facebook's "展开" (expand) functionality requires server-side PHP requests
  // so we cannot expand truncated content through client-side clicking.
  // Instead, we focus on extracting all available text content more comprehensively.

  extractFacebookAuthorName(postElement) {
    try {
      // Look for author name in links first (more reliable)
      const authorLinks = postElement.querySelectorAll('a[href*="facebook.com/"]');
      for (const link of authorLinks) {
        const text = link.textContent.trim();
        // Skip if it's a timestamp or UI element
        if (text.length > 2 && text.length < 50 && 
            !text.match(/^\d+月\d+日$/) && 
            text !== 'Reels' && text !== '关注' && 
            !text.includes('󰍸') && !text.includes('󰍹')) {
          return text;
        }
      }
      
      // Fallback: look for text in h3 or other header elements
      const headerElements = postElement.querySelectorAll('h3, .html-h3');
      for (const element of headerElements) {
        const text = element.textContent.trim();
        if (text.length > 2 && text.length < 50 && !text.match(/[󰍸󰍹󰐑󰍺\d年月日·]/)) {
          return text;
        }
      }
      
      // Last fallback: look for any text element that could be an author
      const textElements = postElement.querySelectorAll('span.x193iq5w, [dir="auto"]');
      for (const element of textElements) {
        const text = element.textContent.trim();
        if (text.length > 2 && text.length < 50 && 
            !text.match(/[󰍸󰍹󰐑󰍺\d年月日·]/) && 
            text !== 'Reels' && text !== '关注' && text !== '打赏！') {
          return text;
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
      // Look for timestamp patterns in the actual structure
      const timestampSelectors = [
        'span.x4k7w5x.x1h91t0o.x1h9r5lt.x1jfb8zj.xv2umb2.x1beo9mf.xaigb6o.x12ejxvf.x3igimt.xarpa2k.xedcshv.x1lytzrv.x1t2pt76.x7ja8zs.x1qrby5j',  // Date span from example
        'time',
        '[data-testid="story-subtitle"] a',
        'a[aria-label*="年"][aria-label*="月"]',
        'a[aria-label*="日"]'
      ];
      
      for (const selector of timestampSelectors) {
        const element = postElement.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          // Check if it looks like a date (e.g., "7月30日")
          if (text.match(/\d+月\d+日/) || text.match(/\d{1,2}:\d{2}/) || text.match(/\d+ hours ago|hours ago/)) {
            return text;
          }
          if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label');
          }
        }
      }
      
      // Fallback: look for any text that looks like a timestamp
      const allSpans = postElement.querySelectorAll('span');
      for (const span of allSpans) {
        const text = span.textContent.trim();
        if (text.match(/^\d+月\d+日$/) || text.match(/^\d+:\d+$/)) {
          return text;
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
      // Extract metrics from button aria-labels in mobile structure
      const buttons = postElement.querySelectorAll('[role="button"][aria-label]');
      
      for (const button of buttons) {
        const label = button.getAttribute('aria-label') || '';
        
        // Like button - look for "个like" pattern
        if (label.includes('like') || label.includes('个like')) {
          const likeMatch = label.match(/(\d+)/);
          if (likeMatch) {
            metrics.likes = parseInt(likeMatch[1]) || 0;
          }
        }
        
        // Comment button - look for "comments" pattern  
        if (label.includes('comment') || label.includes('comments')) {
          const commentMatch = label.match(/(\d+)/);
          if (commentMatch) {
            metrics.comments = parseInt(commentMatch[1]) || 0;
          }
        }
        
        // Share button
        if (label.includes('share') || label.includes('分享')) {
          const shareMatch = label.match(/(\d+)/);
          if (shareMatch) {
            metrics.shares = parseInt(shareMatch[1]) || 0;
          }
        }
      }
      
      // Also check text content for metrics
      const textElements = postElement.querySelectorAll('.native-text');
      for (const element of textElements) {
        const text = element.textContent.trim();
        
        // Look for "󰍹 1" pattern for comments
        if (text.includes('󰍹')) {
          const commentMatch = text.match(/󰍹\s*(\d+)/);
          if (commentMatch) {
            metrics.comments = parseInt(commentMatch[1]) || 0;
          }
        }
        
        // Look for pure numbers that might be like counts
        if (text.match(/^\d+$/)) {
          const num = parseInt(text);
          if (num > 0 && metrics.likes === 0) {
            metrics.likes = num;
          }
        }
      }
      
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

  // Create unique IDs for Facebook posts based primarily on text content
  createFacebookPostId(postElement, text, author, timestamp) {
    try {
      // Use text content as the primary identifier for deduplication
      let contentForId = '';
      
      // 1. Use the actual text content (cleaned) as primary identifier
      if (text && text.length > 0) {
        // Remove "展开" and other UI elements, normalize spaces
        contentForId = text
          .replace(/展开$/, '')
          .replace(/Circuit\s*·\s*关注.*$/i, '')
          .replace(/Reels\s*·\s*\d+月\d+日.*$/i, '')
          .replace(/打赏！.*$/i, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      // 2. If no meaningful text, try to find unique identifiers
      const identifiers = [];
      
      if (contentForId) {
        // Use the full cleaned text content as the main identifier
        identifiers.push(contentForId);
      } else {
        // Fallback: use other identifiers if no text
        const reelLink = postElement.querySelector('a[href*="/reel/"]');
        if (reelLink) {
          const hrefMatch = reelLink.href.match(/\/reel\/(\d+)/);
          if (hrefMatch) {
            identifiers.push(hrefMatch[1]);
          }
        }
        
        const pageletData = postElement.getAttribute('data-pagelet');
        if (pageletData) {
          identifiers.push(pageletData);
        }
        
        // Use author and timestamp as backup
        if (author) identifiers.push(author);
        if (timestamp) identifiers.push(timestamp);
      }
      
      // Create hash from the content
      const content = identifiers.join('|');
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      // Create final ID based primarily on content
      const baseHash = Math.abs(hash).toString(36);
      const finalId = `fb_${baseHash}`;
      
      console.log(`[Facebook] Generated content-based ID: ${finalId} from text: "${contentForId.substring(0, 50)}..."`);
      return finalId;
      
    } catch (error) {
      console.error('[Facebook] Error creating post ID:', error);
      // Fallback to base method
      return this.createPostId(text, author, timestamp);
    }
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
    
    // Fast auto-scroll for Facebook
    this.scrollInterval = setInterval(() => {
      if (this.isRunning) {
        this.autoScroll();
      }
    }, 500); // Scroll every 500ms for fast crawling
    
    console.log(`[${this.platform}] Started crawler with slower intervals for content loading`);
  }
}