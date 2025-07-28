// IndexedDB wrapper for storing crawled posts
class PostsDB {
  constructor() {
    this.dbName = 'SocialMediaCrawler';
    this.version = 2; // Increment version to force database refresh
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
    
    switch (format.toLowerCase()) {
      case 'json':
        return {
          data: JSON.stringify(posts, null, 2),
          filename: `social_media_posts_${new Date().toISOString().split('T')[0]}.json`,
          type: 'application/json'
        };
      
      case 'csv':
        const csvHeader = 'ID,Platform,Author Name,Author Handle,Text,Timestamp,URL,Crawled At,Likes,Retweets,Replies\n';
        const csvRows = posts.map(post => {
          const text = (post.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
          const authorName = (post.author?.name || '').replace(/"/g, '""');
          const authorHandle = (post.author?.handle || '').replace(/"/g, '""');
          const likes = post.metrics?.likes || 0;
          const retweets = post.metrics?.retweets || 0;
          const replies = post.metrics?.replies || 0;
          return `"${post.id}","${post.platform}","${authorName}","${authorHandle}","${text}","${post.timestamp}","${post.url}","${post.crawledAt}","${likes}","${retweets}","${replies}"`;
        }).join('\n');
        
        return {
          data: csvHeader + csvRows,
          filename: `social_media_posts_${new Date().toISOString().split('T')[0]}.csv`,
          type: 'text/csv'
        };
      
      default:
        throw new Error('Unsupported export format');
    }
  }
}

// Create global instance
if (!window.postsDB) {
  window.postsDB = new PostsDB();
}