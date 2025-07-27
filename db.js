// IndexedDB wrapper for storing crawled posts
class PostsDB {
  constructor() {
    this.dbName = 'SocialMediaCrawler';
    this.version = 1;
    this.storeName = 'posts';
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Delete existing store if it exists
        if (db.objectStoreNames.contains(this.storeName)) {
          db.deleteObjectStore(this.storeName);
        }
        
        // Create posts store
        const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        store.createIndex('platform', 'platform', { unique: false });
        store.createIndex('author', 'author', { unique: false });
        store.createIndex('crawledAt', 'crawledAt', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
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
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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
    
    switch (format.toLowerCase()) {
      case 'json':
        return {
          data: JSON.stringify(posts, null, 2),
          filename: `social_media_posts_${new Date().toISOString().split('T')[0]}.json`,
          type: 'application/json'
        };
      
      case 'csv':
        const csvHeader = 'ID,Platform,Author,Text,Timestamp,URL,Crawled At\n';
        const csvRows = posts.map(post => {
          const text = (post.text || '').replace(/"/g, '""').replace(/\n/g, ' ');
          return `"${post.id}","${post.platform}","${post.author}","${text}","${post.timestamp}","${post.url}","${post.crawledAt}"`;
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
window.postsDB = new PostsDB();