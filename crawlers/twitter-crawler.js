// Twitter/X specific crawler
class TwitterCrawler extends BaseCrawler {
  constructor() {
    super('twitter');
  }

  getSelectors() {
    return {
      postContainer: '[data-testid="tweet"]:not([data-testid="tweet"] [data-testid="tweet"])', // Avoid nested tweets
      textContent: '[data-testid="tweetText"]',
      author: {
        name: '[data-testid="User-Name"] span' +
            '' +
            ':first-child',
        handle: '[data-testid="User-Name"] span:last-child',
        avatar: '[data-testid="Tweet-User-Avatar"] img'
      },
      timestamp: 'time',
      engagement: '[role="group"]',
      metrics: {
        reply: '[data-testid="reply"] span[data-testid="app-text-transition-container"] span',
        retweet: '[data-testid="retweet"] span[data-testid="app-text-transition-container"] span',
        like: '[data-testid="like"] span[data-testid="app-text-transition-container"] span',
        bookmark: '[data-testid="bookmark"]',
        view: 'a[href*="/status/"] span[data-testid="app-text-transition-container"] span'
      },
      replies: {
        container: '[data-testid="tweet"] + div [data-testid="tweet"]',
        author: '[data-testid="User-Name"] span:first-child',
        text: '[data-testid="tweetText"]',
        timestamp: 'time'
      },
      media: {
        images: '[data-testid="tweetPhoto"] img',
        videos: '[data-testid="videoPlayer"] video',
        gifs: '[data-testid="gifPlayer"] video'
      },
      links: 'a[href^="https://t.co/"]',
      hashtags: 'a[href*="/hashtag/"]',
      mentions: 'a[href^="/"]'
    };
  }

  extractPostData(postElement) {
    try {
      const selectors = this.getSelectors();
      
      // Basic post info
      const textElement = postElement.querySelector(selectors.textContent);
      const authorNameElement = postElement.querySelector(selectors.author.name);
      const authorHandleElement = postElement.querySelector(selectors.author.handle);
      const timestampElement = postElement.querySelector(selectors.timestamp);
      const avatarElement = postElement.querySelector(selectors.author.avatar);
      
      const text = textElement ? textElement.textContent.trim() : '';
      const authorName = authorNameElement ? authorNameElement.textContent.trim() : '';
      const authorHandle = authorHandleElement ? authorHandleElement.textContent.trim() : '';
      const timestamp = timestampElement ? (timestampElement.getAttribute('datetime') || timestampElement.textContent.trim()) : '';
      const avatar = avatarElement ? avatarElement.src : '';
      
      // Create unique ID
      const uniqueId = this.createPostId(text, authorHandle, timestamp);
      
      if (this.crawledPosts.has(uniqueId)) {
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
      
      this.crawledPosts.add(uniqueId);
      return postData;
    } catch (error) {
      console.error('[Twitter] Error extracting post data:', error);
      return null;
    }
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
        const timestamp = timestampElement ? (timestampElement.getAttribute('datetime') || timestampElement.textContent.trim()) : '';
        
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