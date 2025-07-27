// LinkedIn specific crawler
class LinkedInCrawler extends BaseCrawler {
  constructor() {
    super('linkedin');
  }

  getSelectors() {
    return {
      postContainer: '.feed-shared-update-v2',
      textContent: '.feed-shared-text',
      author: {
        name: '.feed-shared-actor__name',
        title: '.feed-shared-actor__description',
        avatar: '.feed-shared-actor__avatar img',
        profile: '.feed-shared-actor__name a'
      },
      timestamp: '.feed-shared-actor__sub-description time',
      engagement: '.social-actions-bar',
      metrics: {
        reactions: '.social-counts-reactions__count',
        comments: '.social-counts-comments span',
        reposts: '.social-counts-shares span'
      },
      reactions: {
        container: '.reactions-menu',
        types: '.reactions-menu button'
      },
      comments: {
        container: '.comments-comments-list',
        item: '.comments-comment-item',
        author: '.comments-comment-item__commenter-name',
        text: '.comments-comment-item__main-content',
        timestamp: '.comments-comment-item__timestamp'
      },
      media: {
        images: '.feed-shared-image img',
        videos: '.feed-shared-video video',
        documents: '.feed-shared-document',
        articles: '.feed-shared-article'
      },
      links: '.feed-shared-text a[href]',
      hashtags: '.feed-shared-text a[href*="/hashtag/"]',
      mentions: '.feed-shared-text a[href*="/in/"]'
    };
  }

  extractPostData(postElement) {
    try {
      const selectors = this.getSelectors();
      
      // Basic post info
      const textElement = postElement.querySelector(selectors.textContent);
      const authorNameElement = postElement.querySelector(selectors.author.name);
      const authorTitleElement = postElement.querySelector(selectors.author.title);
      const timestampElement = postElement.querySelector(selectors.timestamp);
      const avatarElement = postElement.querySelector(selectors.author.avatar);
      const profileElement = postElement.querySelector(selectors.author.profile);
      
      const text = textElement ? textElement.textContent.trim() : '';
      const authorName = authorNameElement ? authorNameElement.textContent.trim() : '';
      const authorTitle = authorTitleElement ? authorTitleElement.textContent.trim() : '';
      const timestamp = timestampElement ? (timestampElement.getAttribute('datetime') || timestampElement.textContent.trim()) : '';
      const avatar = avatarElement ? avatarElement.src : '';
      const profileUrl = profileElement ? profileElement.href : '';
      
      // Create unique ID
      const uniqueId = this.createPostId(text, authorName, timestamp);
      
      if (this.crawledPosts.has(uniqueId)) {
        return null; // Already crawled
      }
      
      // Extract LinkedIn-specific data
      const postData = {
        id: uniqueId,
        platform: this.platform,
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
        postType: this.getLinkedInPostType(postElement),
        isSponsored: this.isSponsored(postElement),
        
        // Engagement metrics
        metrics: this.extractLinkedInMetrics(postElement),
        
        // Reaction details
        reactions: this.extractLinkedInReactions(postElement),
        
        // Media content
        media: this.extractLinkedInMedia(postElement),
        
        // Links and references
        links: this.extractLinks(postElement),
        hashtags: this.extractHashtags(postElement),
        mentions: this.extractMentions(postElement),
        
        // Comments
        comments: this.extractLinkedInComments(postElement)
      };
      
      this.crawledPosts.add(uniqueId);
      return postData;
    } catch (error) {
      console.error('[LinkedIn] Error extracting post data:', error);
      return null;
    }
  }

  getLinkedInPostType(postElement) {
    try {
      if (postElement.querySelector('.feed-shared-video')) return 'video';
      if (postElement.querySelector('.feed-shared-image')) return 'image';
      if (postElement.querySelector('.feed-shared-document')) return 'document';
      if (postElement.querySelector('.feed-shared-article')) return 'article';
      if (postElement.querySelector('.feed-shared-poll')) return 'poll';
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
}