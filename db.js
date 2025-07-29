// IndexedDB wrapper for storing crawled posts
class PostsDB {
  constructor() {
    this.dbName = 'SocialMediaCrawler';
    this.version = 3; // Increment version to add company index
    this.storeName = 'posts';
    this.db = null;
    console.log('[PostsDB] Constructor called');
  }

  async init() {
    console.log(`[PostsDB] Initializing database ${this.dbName} version ${this.version}`);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        console.error('[PostsDB] Database open error:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[PostsDB] Database opened successfully');
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        console.log('[PostsDB] Database upgrade needed');
        const db = event.target.result;
        
        // Delete existing store if it exists
        if (db.objectStoreNames.contains(this.storeName)) {
          console.log('[PostsDB] Deleting existing store');
          db.deleteObjectStore(this.storeName);
        }
        
        // Create posts store
        console.log('[PostsDB] Creating new posts store');
        const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        store.createIndex('platform', 'platform', { unique: false });
        store.createIndex('company', 'company', { unique: false });
        store.createIndex('author', 'author', { unique: false });
        store.createIndex('crawledAt', 'crawledAt', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('[PostsDB] Store created with indexes');
      };
    });
  }

  async addPost(post) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(post);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        // If post already exists, update it
        if (request.error.name === 'ConstraintError') {
          this.updatePost(post).then(resolve).catch(reject);
        } else {
          reject(request.error);
        }
      };
    });
  }

  async updatePost(post) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(post);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPost(id) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPosts() {
    if (!this.db) await this.init();
    
    console.log('[PostsDB] Getting all posts...');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        console.log('[PostsDB] getAllPosts result:', request.result.length, 'posts');
        resolve(request.result);
      };
      request.onerror = () => {
        console.error('[PostsDB] Error getting all posts:', request.error);
        reject(request.error);
      };
    });
  }

  async getPostsByPlatform(platform) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('platform');
      const request = index.getAll(platform);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPostsByCompany(company) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('company');
      const request = index.getAll(company);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPostsByPlatformAndCompany(platform, company) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Filter posts by both platform and company
        const filteredPosts = request.result.filter(post => 
          post.platform === platform && post.company === company
        );
        resolve(filteredPosts);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAvailableCompanies() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Extract unique companies
        const companies = [...new Set(request.result.map(post => post.company).filter(Boolean))];
        resolve(companies.sort());
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAvailablePlatforms() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Extract unique platforms
        const platforms = [...new Set(request.result.map(post => post.platform).filter(Boolean))];
        resolve(platforms.sort());
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getPostCount() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePost(id) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllPosts() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async exportData(format = 'json') {
    const posts = await this.getAllPosts();
    console.log(`[PostsDB] Exporting ${posts.length} posts in ${format} format`);
    
    if (!posts || posts.length === 0) {
      console.log('[PostsDB] No posts to export');
      return null;
    }
    
    // Generate intelligent filename based on current page and posts
    const dateStr = new Date().toISOString().split('T')[0];
    let filename = `social_media_posts_${dateStr}`;
    
    // Try to extract company/profile name from current page
    const companyName = this.extractCompanyName();
    if (companyName) {
      filename = `${dateStr}_${companyName}`;
    }
    
    // Add platform info if posts are from single platform
    const platforms = [...new Set(posts.map(post => post.platform))];
    if (platforms.length === 1) {
      const platform = platforms[0];
      if (companyName) {
        filename = `${dateStr}_${companyName}_${platform}`;
      } else {
        filename = `${dateStr}_${platform}_posts`;
      }
    }
    
    // Add post count
    filename += `_${posts.length}posts`;
    
    switch (format.toLowerCase()) {
      case 'json':
        return {
          data: JSON.stringify(posts, null, 2),
          filename: `${filename}.json`,
          type: 'application/json'
        };
      
      case 'csv':
        const csvHeader = 'ID,Platform,Author Name,Author Handle,Text,Timestamp,URL,Crawled At,Likes,Retweets,Replies,Views\n';
        const csvRows = posts.map(post => {
          const text = (post.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
          const authorName = (post.author?.name || '').replace(/"/g, '""');
          const authorHandle = (post.author?.handle || '').replace(/"/g, '""');
          const likes = post.metrics?.likes || 0;
          const retweets = post.metrics?.retweets || 0;
          const replies = post.metrics?.replies || 0;
          const views = post.metrics?.views || 0;
          return `"${post.id}","${post.platform}","${authorName}","${authorHandle}","${text}","${post.timestamp}","${post.url}","${post.crawledAt}","${likes}","${retweets}","${replies}","${views}"`;
        }).join('\n');
        
        return {
          data: csvHeader + csvRows,
          filename: `${filename}.csv`,
          type: 'text/csv'
        };
      
      default:
        throw new Error('Unsupported export format');
    }
  }

  // Extract company/profile name from current page
  extractCompanyName() {
    try {
      // For Twitter/X - try different methods to get profile name
      if (window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com')) {
        // Method 1: From URL path (e.g., /Routific -> Routific)
        const pathMatch = window.location.pathname.match(/^\/([^\/]+)/);
        if (pathMatch && pathMatch[1] && pathMatch[1] !== 'home' && pathMatch[1] !== 'search') {
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
      }
      
      // For LinkedIn
      if (window.location.hostname.includes('linkedin.com')) {
        // From URL or page title
        const titleMatch = document.title.match(/^(.+?)\s*[\|\-]/);
        if (titleMatch && titleMatch[1]) {
          return titleMatch[1].replace(/[^a-zA-Z0-9_]/g, '');
        }
      }
      
      return null;
    } catch (error) {
      console.warn('[PostsDB] Error extracting company name:', error);
      return null;
    }
  }
}

// Create global instance
if (!window.postsDB) {
  window.postsDB = new PostsDB();
}