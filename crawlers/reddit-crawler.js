// Reddit specific crawler
class RedditCrawler extends BaseCrawler {
  constructor() {
    super('reddit');
  }

  getSelectors() {
    return {
      // Reddit has different layouts (old.reddit.com vs new reddit)
      postContainer: '[data-testid="post-container"], .Post, .thing',
      textContent: '[data-testid="post-content"] p, .md p, .usertext-body p',
      title: '[data-testid="post-content"] h3, .title a, h3',
      author: {
        name: '[data-testid="comment_author_link"], .author, [data-author]',
        avatar: '.AuthorInfo__avatar img, .author-avatar img',
        profile: '[data-testid="comment_author_link"], .author'
      },
      subreddit: '[data-testid="subreddit-name"], .subreddit, [data-subreddit]',
      timestamp: '[data-testid="post-timestamp"], .live-timestamp, time',
      engagement: '[data-testid="post-vote-buttons"], .buttons, .flat-list',
      metrics: {
        upvotes: '[data-testid="vote-arrows"] button:first-child, .score, .unvoted',
        downvotes: '[data-testid="vote-arrows"] button:last-child',
        comments: '[data-testid="comment-count"], .comments, a[href*="comments"]',
        awards: '[data-testid="awards-container"], .awardings-bar'
      },
      comments: {
        container: '[data-testid="comment"], .comment, .commentarea',
        item: '[data-testid="comment"], .comment',
        author: '[data-testid="comment_author_link"], .author',
        text: '[data-testid="comment"] p, .usertext-body p',
        score: '[data-testid="comment-vote-arrows"], .score',
        timestamp: '.live-timestamp, time'
      },
      media: {
        images: '[data-testid="post-content"] img, .media-preview img, img[src*="i.redd.it"]',
        videos: '[data-testid="post-content"] video, video',
        gifs: '[data-testid="post-content"] img[src*=".gif"], img[src*="giphy"]',
        embeds: '[data-testid="post-content"] iframe, .media-element iframe'
      },
      links: '[data-testid="post-content"] a[href], .usertext-body a[href]',
      flair: '[data-testid="post-flair"], .linkflairlabel, .flair',
      spoiler: '[data-testid="spoiler"], .spoiler-text',
      nsfw: '[data-testid="nsfw-badge"], .nsfw-stamp'
    };
  }

  extractPostData(postElement) {
    try {
      const selectors = this.getSelectors();
      
      // Basic post info
      const titleElement = postElement.querySelector(selectors.title);
      const textElement = postElement.querySelector(selectors.textContent);
      const authorElement = postElement.querySelector(selectors.author.name);
      const subredditElement = postElement.querySelector(selectors.subreddit);
      const timestampElement = postElement.querySelector(selectors.timestamp);
      const avatarElement = postElement.querySelector(selectors.author.avatar);
      
      const title = titleElement ? titleElement.textContent.trim() : '';
      const text = textElement ? textElement.textContent.trim() : '';
      const author = authorElement ? authorElement.textContent.trim() : '';
      const subreddit = subredditElement ? subredditElement.textContent.trim().replace(/^r\//, '') : '';
      const timestamp = timestampElement ? (timestampElement.getAttribute('datetime') || timestampElement.textContent.trim()) : '';
      const avatar = avatarElement ? avatarElement.src : '';
      
      // Create unique ID
      const uniqueId = this.createPostId(title + text, author, timestamp);
      
      if (this.crawledPosts.has(uniqueId)) {
        return null; // Already crawled
      }
      
      // Extract Reddit-specific data
      const postData = {
        id: uniqueId,
        platform: this.platform,
        author: {
          name: author,
          avatar: avatar,
          profileUrl: author ? `https://reddit.com/u/${author}` : ''
        },
        title: title,
        text: text,
        subreddit: subreddit,
        timestamp: timestamp,
        url: window.location.href,
        crawledAt: new Date().toISOString(),
        
        // Reddit-specific fields
        postId: this.extractRedditPostId(postElement),
        postType: this.getRedditPostType(postElement),
        flair: this.extractFlair(postElement),
        isStickied: this.isStickied(postElement),
        isLocked: this.isLocked(postElement),
        isSpoiler: this.isSpoiler(postElement),
        isNSFW: this.isNSFW(postElement),
        
        // Engagement metrics
        metrics: this.extractRedditMetrics(postElement),
        
        // Awards
        awards: this.extractRedditAwards(postElement),
        
        // Media content
        media: this.extractRedditMedia(postElement),
        
        // Links
        links: this.extractLinks(postElement),
        
        // Comments
        comments: this.extractRedditComments(postElement)
      };
      
      this.crawledPosts.add(uniqueId);
      return postData;
    } catch (error) {
      console.error('[Reddit] Error extracting post data:', error);
      return null;
    }
  }

  extractRedditPostId(postElement) {
    try {
      // Look for data attributes or URL patterns
      const id = postElement.getAttribute('data-fullname') || 
                 postElement.getAttribute('id') ||
                 postElement.querySelector('[data-permalink]')?.getAttribute('data-permalink')?.match(/\/comments\/([^\/]+)/)?.[1];
      return id;
    } catch (error) {
      return null;
    }
  }

  getRedditPostType(postElement) {
    try {
      if (postElement.querySelector('[data-testid="post-content"] img, img[src*="i.redd.it"]')) return 'image';
      if (postElement.querySelector('[data-testid="post-content"] video')) return 'video';
      if (postElement.querySelector('[data-testid="post-content"] a[href*="youtube"], a[href*="youtu.be"]')) return 'video_link';
      if (postElement.querySelector('[data-testid="post-content"] a[href]:not([href*="reddit.com"])')) return 'link';
      if (postElement.querySelector('.poll-container, [data-testid="poll"]')) return 'poll';
      return 'text';
    } catch (error) {
      return 'text';
    }
  }

  extractFlair(postElement) {
    try {
      const flairElement = postElement.querySelector(this.getSelectors().flair);
      return flairElement ? flairElement.textContent.trim() : '';
    } catch (error) {
      return '';
    }
  }

  isStickied(postElement) {
    try {
      return postElement.classList.contains('stickied') || 
             postElement.querySelector('.stickied') !== null ||
             postElement.querySelector('[data-testid="post-container"]')?.getAttribute('data-stickied') === 'true';
    } catch (error) {
      return false;
    }
  }

  isLocked(postElement) {
    try {
      return postElement.querySelector('.locked, [data-testid="locked"]') !== null;
    } catch (error) {
      return false;
    }
  }

  isSpoiler(postElement) {
    try {
      return postElement.querySelector(this.getSelectors().spoiler) !== null;
    } catch (error) {
      return false;
    }
  }

  isNSFW(postElement) {
    try {
      return postElement.querySelector(this.getSelectors().nsfw) !== null ||
             postElement.classList.contains('over18');
    } catch (error) {
      return false;
    }
  }

  extractRedditMetrics(postElement) {
    const selectors = this.getSelectors().metrics;
    
    const metrics = {
      upvotes: 0,
      downvotes: 0,
      score: 0,
      comments: 0,
      awards: 0,
      upvoteRatio: 0
    };

    try {
      const scoreElement = postElement.querySelector(selectors.upvotes);
      const commentsElement = postElement.querySelector(selectors.comments);
      const awardsElement = postElement.querySelector(selectors.awards);
      
      // Reddit often shows combined score rather than separate up/down votes
      const scoreText = scoreElement?.textContent.trim() || '0';
      metrics.score = this.parseNumber(scoreText);
      metrics.upvotes = metrics.score; // Reddit usually shows net score
      
      const commentsText = commentsElement?.textContent.trim() || '0';
      metrics.comments = this.parseNumber(commentsText.replace(/[^\d]/g, ''));
      
      // Count awards if present
      if (awardsElement) {
        const awardElements = awardsElement.querySelectorAll('.award, [data-testid="award"]');
        metrics.awards = awardElements.length;
      }
    } catch (error) {
      console.error('[Reddit] Error extracting metrics:', error);
    }

    return metrics;
  }

  extractRedditAwards(postElement) {
    const awards = [];
    
    try {
      const awardsContainer = postElement.querySelector(this.getSelectors().metrics.awards);
      if (!awardsContainer) return awards;
      
      const awardElements = awardsContainer.querySelectorAll('.award, [data-testid="award"]');
      awardElements.forEach(award => {
        const name = award.getAttribute('data-name') || award.getAttribute('title') || '';
        const count = award.querySelector('.award-count')?.textContent || '1';
        
        if (name) {
          awards.push({
            name: name,
            count: parseInt(count) || 1
          });
        }
      });
    } catch (error) {
      console.error('[Reddit] Error extracting awards:', error);
    }
    
    return awards;
  }

  extractRedditMedia(postElement) {
    const selectors = this.getSelectors().media;
    const media = {
      images: [],
      videos: [],
      gifs: [],
      embeds: []
    };

    try {
      // Extract images
      const imageElements = postElement.querySelectorAll(selectors.images);
      media.images = Array.from(imageElements).map(img => ({
        url: img.src,
        alt: img.alt || '',
        preview: img.getAttribute('data-preview') || ''
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

      // Extract embeds
      const embedElements = postElement.querySelectorAll(selectors.embeds);
      media.embeds = Array.from(embedElements).map(embed => ({
        src: embed.src,
        type: embed.getAttribute('data-embed-type') || 'iframe'
      }));
    } catch (error) {
      console.error('[Reddit] Error extracting media:', error);
    }

    return media;
  }

  extractLinks(postElement) {
    const selectors = this.getSelectors();
    try {
      const linkElements = postElement.querySelectorAll(selectors.links);
      return Array.from(linkElements)
        .filter(link => !link.href.includes('reddit.com/r/') && !link.href.includes('reddit.com/u/'))
        .map(link => ({
          url: link.href,
          text: link.textContent.trim()
        }));
    } catch (error) {
      return [];
    }
  }

  extractRedditComments(postElement) {
    const comments = [];
    const selectors = this.getSelectors().comments;
    
    try {
      // Look for comments in the page (only available on post detail pages)
      const commentElements = document.querySelectorAll(selectors.item);
      
      // Limit to first 15 comments to avoid too much data
      Array.from(commentElements).slice(0, 15).forEach(commentElement => {
        const authorElement = commentElement.querySelector(selectors.author);
        const textElement = commentElement.querySelector(selectors.text);
        const scoreElement = commentElement.querySelector(selectors.score);
        const timestampElement = commentElement.querySelector(selectors.timestamp);
        
        const author = authorElement ? authorElement.textContent.trim() : '';
        const text = textElement ? textElement.textContent.trim() : '';
        const score = scoreElement ? this.parseNumber(scoreElement.textContent) : 0;
        const timestamp = timestampElement ? (timestampElement.getAttribute('datetime') || timestampElement.textContent.trim()) : '';
        
        if (author && text) {
          comments.push({
            author: author,
            text: text,
            score: score,
            timestamp: timestamp,
            extractedAt: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      console.error('[Reddit] Error extracting comments:', error);
    }
    
    return comments;
  }
}