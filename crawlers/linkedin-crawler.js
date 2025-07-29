// LinkedIn specific crawler
class LinkedInCrawler extends BaseCrawler {
  constructor() {
    super('linkedin');
  }

  getSelectors() {
    return {
      postContainer: '.feed-shared-update-v2, .occludable-update',
      textContent: '.update-components-text, .feed-shared-text, .feed-shared-inline-show-more-text',
      author: {
        name: '.update-components-actor__title span span span, .update-components-actor__title',
        title: '.update-components-actor__description, .feed-shared-actor__description', 
        avatar: '.update-components-actor__avatar img, .feed-shared-actor__avatar img, .update-components-actor__avatar-image',
        profile: '.update-components-actor__meta-link, .feed-shared-actor__name a'
      },
      timestamp: '.update-components-actor__sub-description, .feed-shared-actor__sub-description time, .feed-shared-actor__sub-description',
      engagement: '.feed-shared-social-action-bar, .social-actions-bar',
      metrics: {
        reactions: '.social-details-social-counts__reactions-count, .social-counts-reactions__count',
        comments: '.social-counts-comments span',
        reposts: '.social-details-social-counts__item--truncate-text span, .social-counts-shares span'
      },
      reactions: {
        container: '.reactions-menu',
        types: '.reactions-menu button'
      },
      comments: {
        container: '.comments-comments-list, .feed-shared-update-v2__comments-container',
        item: '.comments-comment-item',
        author: '.comments-comment-item__commenter-name',
        text: '.comments-comment-item__main-content',
        timestamp: '.comments-comment-item__timestamp'
      },
      media: {
        images: '.update-components-image img, .feed-shared-image img, .update-components-image__image',
        videos: '.feed-shared-video video',
        documents: '.feed-shared-document',
        articles: '.feed-shared-article'
      },
      links: '.update-components-text a[href], .feed-shared-text a[href]',
      hashtags: '.update-components-text a[href*="/hashtag/"], .feed-shared-text a[href*="/hashtag/"]',
      mentions: '.update-components-text a[href*="/in/"], .feed-shared-text a[href*="/in/"]'
    };
  }

  extractPostData(postElement) {
    try {
      const selectors = this.getSelectors();
      
      // Basic post info
      const text = this.extractLinkedInText(postElement);
      const authorName = this.extractLinkedInAuthorName(postElement);
      const authorTitle = this.extractLinkedInAuthorTitle(postElement);
      const timestamp = this.extractLinkedInTimestamp(postElement);
      const avatar = this.extractLinkedInAvatar(postElement);
      const profileUrl = this.extractLinkedInProfileUrl(postElement);
      
      console.log(`[LinkedIn] Basic extraction - text: "${this.formatLogText(text, 30)}", author: "${authorName}"`);
      
      // Skip if no meaningful content
      if (!text && !authorName) {
        console.log('[LinkedIn] No meaningful content found, skipping post');
        return null;
      }
      
      // Create unique ID
      const uniqueId = this.createPostId(text, authorName, timestamp);
      
      if (this.crawledPosts.has(uniqueId)) {
        console.log(`[LinkedIn] Post already crawled (ID: ${uniqueId}), skipping`);
        return null; // Already crawled
      }
      
      console.log(`[LinkedIn] Creating post data for new post (ID: ${uniqueId})`);
      
      // Extract company name from current page
      const companyName = this.extractCompanyName();
      console.log(`[LinkedIn] Company name extracted: ${companyName}`);
      
      // Extract LinkedIn-specific data with individual error handling
      let postType, isSponsored, metrics, reactions, media, links, hashtags, mentions, comments;
      
      try {
        postType = this.getLinkedInPostType(postElement);
        isSponsored = this.isSponsored(postElement);
        console.log(`[LinkedIn] Post type: ${postType}, sponsored: ${isSponsored}`);
      } catch (e) {
        console.warn('[LinkedIn] Failed to extract post type:', e.message);
        postType = 'text';
        isSponsored = false;
      }
      
      try {
        metrics = this.extractLinkedInMetrics(postElement);
        console.log(`[LinkedIn] Metrics extracted - reactions: ${metrics.reactions}, comments: ${metrics.comments}`);
      } catch (e) {
        console.warn('[LinkedIn] Failed to extract metrics:', e.message);
        metrics = { reactions: 0, comments: 0, reposts: 0, shares: 0 };
      }
      
      try {
        reactions = this.extractLinkedInReactions(postElement);
        media = this.extractLinkedInMedia(postElement);
        links = this.extractLinks(postElement);
        hashtags = this.extractHashtags(postElement);
        mentions = this.extractMentions(postElement);
        comments = this.extractLinkedInComments(postElement);
        console.log(`[LinkedIn] Additional data extracted - media: ${media.images.length} images, links: ${links.length}`);
      } catch (e) {
        console.warn('[LinkedIn] Failed to extract additional data:', e.message);
        reactions = { like: 0, celebrate: 0, support: 0, love: 0, insightful: 0, funny: 0 };
        media = { images: [], videos: [], documents: [], articles: [] };
        links = [];
        hashtags = [];
        mentions = [];
        comments = [];
      }
      
      // Extract LinkedIn-specific data
      const postData = {
        id: uniqueId,
        platform: this.platform,
        company: companyName || 'unknown',
        author: {
          name: authorName,
          title: authorTitle,
          avatar: avatar,
          profileUrl: profileUrl
        },
        text: text,
        timestamp: timestamp,
        url: window.location.href,
        crawledAt: new Date().toISOString(),
        
        // LinkedIn-specific fields
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
      
      console.log(`[LinkedIn] Post data created successfully for: "${this.formatLogText(text, 40)}"`);
      return postData;
    } catch (error) {
      console.error('[LinkedIn] Error extracting post data:', error);
      return null;
    }
  }

  // Improved text extraction for LinkedIn posts
  extractLinkedInText(postElement) {
    try {
      // Primary method: try update-components-text selector first
      const textElement = postElement.querySelector('.update-components-text');
      if (textElement) {
        // Get all text content but clean up whitespace and special characters
        let text = textElement.textContent.trim();
        // Replace multiple whitespaces with single space
        text = text.replace(/\s+/g, ' ');
        // Clean up common LinkedIn text artifacts
        text = text.replace(/\u00A0/g, ' '); // Non-breaking spaces
        if (text.length > 0) {
          return text;
        }
      }
      
      // Fallback method: try other selectors
      const fallbackSelectors = [
        '.feed-shared-text',
        '.feed-shared-inline-show-more-text',
        '.update-components-update-v2__commentary'
      ];
      
      for (const selector of fallbackSelectors) {
        const element = postElement.querySelector(selector);
        if (element && element.textContent.trim()) {
          let text = element.textContent.trim().replace(/\s+/g, ' ');
          if (text.length > 10) {
            return text;
          }
        }
      }
      
      return '';
    } catch (error) {
      console.error('[LinkedIn] Error extracting text content:', error);
      return '';
    }
  }

  extractLinkedInAuthorName(postElement) {
    try {
      // Try multiple selectors for author name
      const selectors = [
        '.update-components-actor__title span span span',
        '.update-components-actor__title span',
        '.update-components-actor__title',
        '.feed-shared-actor__name'
      ];
      
      for (const selector of selectors) {
        const element = postElement.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      
      return '';
    } catch (error) {
      console.error('[LinkedIn] Error extracting author name:', error);
      return '';
    }
  }

  extractLinkedInAuthorTitle(postElement) {
    try {
      const element = postElement.querySelector('.update-components-actor__description, .feed-shared-actor__description');
      return element ? element.textContent.trim() : '';
    } catch (error) {
      return '';
    }
  }

  extractLinkedInTimestamp(postElement) {
    try {
      const element = postElement.querySelector('.update-components-actor__sub-description, .feed-shared-actor__sub-description time, .feed-shared-actor__sub-description');
      if (element) {
        // Try datetime attribute first
        if (element.getAttribute && element.getAttribute('datetime')) {
          return element.getAttribute('datetime');
        }
        // Fall back to text content and extract time info
        const text = element.textContent.trim();
        // Look for time patterns like "2mo •", "1d •", etc.
        const timeMatch = text.match(/(\d+[a-z]+)\s*•/);
        if (timeMatch) {
          return timeMatch[1];
        }
        return text;
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  extractLinkedInAvatar(postElement) {
    try {
      const selectors = [
        '.update-components-actor__avatar-image',
        '.update-components-actor__avatar img',
        '.feed-shared-actor__avatar img'
      ];
      
      for (const selector of selectors) {
        const element = postElement.querySelector(selector);
        if (element && element.src) {
          return element.src;
        }
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  extractLinkedInProfileUrl(postElement) {
    try {
      const element = postElement.querySelector('.update-components-actor__meta-link, .feed-shared-actor__name a');
      return element ? element.href : '';
    } catch (error) {
      return '';
    }
  }

  getLinkedInPostType(postElement) {
    try {
      if (postElement.querySelector('.feed-shared-video, .update-components-video')) return 'video';
      if (postElement.querySelector('.feed-shared-image, .update-components-image')) return 'image';
      if (postElement.querySelector('.feed-shared-document, .update-components-document')) return 'document';
      if (postElement.querySelector('.feed-shared-article, .update-components-article')) return 'article';
      if (postElement.querySelector('.feed-shared-poll, .update-components-poll')) return 'poll';
      return 'text';
    } catch (error) {
      return 'text';
    }
  }

  isSponsored(postElement) {
    try {
      return postElement.querySelector('.feed-shared-actor__sub-description')?.textContent.includes('Promoted') || false;
    } catch (error) {
      return false;
    }
  }

  extractLinkedInMetrics(postElement) {
    const selectors = this.getSelectors().metrics;
    
    const metrics = {
      reactions: 0,
      comments: 0,
      reposts: 0,
      shares: 0
    };

    try {
      const reactionsElement = postElement.querySelector(selectors.reactions);
      const commentsElement = postElement.querySelector(selectors.comments);
      const repostsElement = postElement.querySelector(selectors.reposts);
      
      metrics.reactions = this.parseNumber(reactionsElement?.textContent);
      metrics.comments = this.parseNumber(commentsElement?.textContent);
      metrics.reposts = this.parseNumber(repostsElement?.textContent);
      metrics.shares = metrics.reposts; // LinkedIn combines these
    } catch (error) {
      console.error('[LinkedIn] Error extracting metrics:', error);
    }

    return metrics;
  }

  extractLinkedInReactions(postElement) {
    const reactions = {
      like: 0,
      celebrate: 0,
      support: 0,
      love: 0,
      insightful: 0,
      funny: 0
    };

    try {
      // LinkedIn reaction details are often hidden in dropdowns
      const reactionElements = postElement.querySelectorAll('.reactions-menu button');
      reactionElements.forEach(button => {
        const reactionType = button.getAttribute('aria-label') || '';
        const count = this.parseNumber(button.textContent);
        
        if (reactionType.includes('Like')) reactions.like = count;
        else if (reactionType.includes('Celebrate')) reactions.celebrate = count;
        else if (reactionType.includes('Support')) reactions.support = count;
        else if (reactionType.includes('Love')) reactions.love = count;
        else if (reactionType.includes('Insightful')) reactions.insightful = count;
        else if (reactionType.includes('Funny')) reactions.funny = count;
      });
    } catch (error) {
      console.error('[LinkedIn] Error extracting reactions:', error);
    }

    return reactions;
  }

  extractLinkedInMedia(postElement) {
    const selectors = this.getSelectors().media;
    const media = {
      images: [],
      videos: [],
      documents: [],
      articles: []
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

      // Extract documents
      const documentElements = postElement.querySelectorAll(selectors.documents);
      media.documents = Array.from(documentElements).map(doc => ({
        title: doc.querySelector('.feed-shared-document__title')?.textContent.trim() || '',
        subtitle: doc.querySelector('.feed-shared-document__subtitle')?.textContent.trim() || ''
      }));

      // Extract shared articles
      const articleElements = postElement.querySelectorAll(selectors.articles);
      media.articles = Array.from(articleElements).map(article => ({
        title: article.querySelector('.feed-shared-article__title')?.textContent.trim() || '',
        description: article.querySelector('.feed-shared-article__description')?.textContent.trim() || '',
        source: article.querySelector('.feed-shared-article__subtitle')?.textContent.trim() || '',
        url: article.querySelector('a')?.href || ''
      }));
    } catch (error) {
      console.error('[LinkedIn] Error extracting media:', error);
    }

    return media;
  }

  extractLinks(postElement) {
    const selectors = this.getSelectors();
    try {
      const linkElements = postElement.querySelectorAll(selectors.links);
      return Array.from(linkElements)
        .filter(link => !link.href.includes('/hashtag/') && !link.href.includes('/in/'))
        .map(link => ({
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
      return Array.from(mentionElements).map(mention => ({
        name: mention.textContent.trim(),
        url: mention.href
      }));
    } catch (error) {
      return [];
    }
  }

  extractLinkedInComments(postElement) {
    const comments = [];
    const selectors = this.getSelectors().comments;
    
    try {
      // Look for comments in the comments section
      const commentElements = postElement.querySelectorAll(selectors.item);
      
      // Limit to first 10 comments to avoid too much data
      Array.from(commentElements).slice(0, 10).forEach(commentElement => {
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
      console.error('[LinkedIn] Error extracting comments:', error);
    }
    
    return comments;
  }

  // Extract company name from current page URL or post context
  extractCompanyName() {
    try {
      // Method 1: From URL path (e.g., /company/routific -> routific)
      const companyMatch = window.location.pathname.match(/\/company\/([^\/]+)/);
      if (companyMatch && companyMatch[1]) {
        return companyMatch[1];
      }
      
      // Method 2: From individual profile URL (e.g., /in/john-doe -> john-doe)  
      const profileMatch = window.location.pathname.match(/\/in\/([^\/]+)/);
      if (profileMatch && profileMatch[1]) {
        return profileMatch[1];
      }
      
      // Method 3: From posts URL with company context (e.g., /company/optimo-route/posts)
      const postsMatch = window.location.pathname.match(/\/company\/([^\/]+)\/posts/);
      if (postsMatch && postsMatch[1]) {
        return postsMatch[1];
      }
      
      // Method 4: From page title
      const titleMatch = document.title.match(/^(.+?)\s*[\|\-]/);
      if (titleMatch && titleMatch[1]) {
        // Clean up common LinkedIn title suffixes
        const cleanTitle = titleMatch[1]
          .replace(/\s+\(\d+.*?\)/, '') // Remove follower counts like "(4,757 followers)"
          .replace(/\s*posts.*$/i, '') // Remove "posts" suffix
          .trim();
        if (cleanTitle.length > 0) {
          return cleanTitle.replace(/[^a-zA-Z0-9_]/g, '');
        }
      }
      
      // Method 5: From company name in DOM (main page header)
      const companyName = document.querySelector('h1')?.textContent?.trim();
      if (companyName) {
        return companyName.replace(/[^a-zA-Z0-9_]/g, '');
      }
      
      // Method 6: From active company posts page (look for company name in navigation)
      const navCompany = document.querySelector('.org-top-card-primary-content__title')?.textContent?.trim();
      if (navCompany) {
        return navCompany.replace(/[^a-zA-Z0-9_]/g, '');
      }
      
      return null;
    } catch (error) {
      console.warn('[LinkedIn] Error extracting company name:', error);
      return null;
    }
  }

  // LinkedIn-specific implementation for finding next post
  findNextPostToScrollTo() {
    const selectors = this.getSelectors();
    const posts = Array.from(document.querySelectorAll(selectors.postContainer));
    
    console.log(`[LinkedIn] Found ${posts.length} posts in DOM`);
    
    // First, find the current top post in viewport
    const currentTopPost = this.getTopPostInViewport(posts);
    
    if (!currentTopPost) {
      console.log(`[LinkedIn] No current top post found, returning first post`);
      return posts.length > 0 ? posts[0] : null;
    }
    
    // For LinkedIn, use position-based approach to avoid getting stuck
    const currentPostTop = currentTopPost.getBoundingClientRect().top + window.scrollY;
    console.log(`[LinkedIn] Current post position: ${currentPostTop}px`);
    
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
          console.log(`[LinkedIn] Found potential next post at index ${index}, position ${postTop}px, distance ${distance}px`);
        }
      }
    });
    
    if (nextPost) {
      console.log(`[LinkedIn] Selected next post at distance ${minDistance}px`);
      return nextPost;
    }
    
    console.log(`[LinkedIn] No next post found, will trigger content loading`);
    return null;
  }
}