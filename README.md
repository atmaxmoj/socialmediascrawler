# Social Media Posts Crawler

A Chrome extension that automatically crawls and extracts posts from social media platforms including Twitter/X, LinkedIn, Facebook, Instagram, and Reddit.

## ✨ Features

- **Multi-Platform Support**: Crawl posts from Twitter/X, LinkedIn, Facebook, Instagram, and Reddit
- **Smart Post Extraction**: Automatically extracts post content, author information, timestamps, engagement metrics, and media
- **Intelligent Scrolling**: Uses post-height-based scrolling to efficiently navigate through feeds
- **Duplicate Detection**: Prevents re-crawling of already saved posts
- **Real-time Control Panel**: Floating control panel with live status updates and post counting
- **Data Export**: Export collected data in JSON or CSV formats
- **Filtering & Search**: Filter posts by platform and company before export
- **Persistent Storage**: Uses IndexedDB for reliable local data storage
- **Rate Limiting**: Built-in protection against excessive API calls and duplicate processing

## 🚀 Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd crawlers
   ```

2. **Install in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked" and select the project folder
   - The extension icon should appear in your toolbar

## 📖 How to Use

### 1. Basic Setup

1. **Navigate to Target Page**: Go to any supported social media platform (Twitter/X, LinkedIn, Facebook, Instagram, or Reddit)

2. **Activate Extension**: Click the extension icon in your Chrome toolbar

3. **Start Crawler**: Click "Start Crawler" in the popup to activate the floating control panel

### 2. Using the Control Panel

The floating control panel appears in the top-right corner of the webpage and includes:

- **Platform Detection**: Automatically detects the current social media platform
- **Status Indicator**: Shows current crawling status (Stopped/Running)
- **Post Counter**: Real-time count of crawled posts
- **Currently Viewing**: Shows the post currently being processed
- **Start/Stop Controls**: Toggle crawling on/off
- **Export Options**: Download data in JSON or CSV format
- **Data Management**: Clear all stored data

### 3. Crawling Process

**Automatic Mode:**
- The crawler automatically scrolls through the feed
- Posts are processed one by one based on their height
- Each post is analyzed for content, author, metrics, and media
- Duplicate posts are automatically skipped (shows "Already Recorded" indicator)
- New posts are saved to local database

**What Gets Extracted:**
- **Post Content**: Full text content and titles
- **Author Information**: Name, handle, avatar, profile URL
- **Engagement Metrics**: Likes, shares, comments, views (platform-dependent)
- **Timestamps**: Post creation time
- **Media Content**: Images, videos, GIFs, embedded content
- **Platform Metadata**: Post type, tags, categories
- **Company Information**: Extracted from profile or URL

### 4. Data Export

1. **Apply Filters** (optional):
   - Select specific platform from dropdown
   - Filter by company name
   - Choose "All" for no filtering

2. **Export Format**:
   - **JSON**: Complete data with nested objects and arrays
   - **CSV**: Flattened data suitable for spreadsheet analysis

3. **Download**: Files are automatically named with date and post count

## 🎯 Supported Platforms

| Platform | Status | Features |
|----------|--------|----------|
| **Twitter/X** | ✅ Full Support | Posts, replies, retweets, metrics, media |
| **LinkedIn** | ✅ Full Support | Posts, articles, company updates, engagement |
| **Facebook** | ✅ Full Support | Posts, comments, reactions, media |
| **Instagram** | ✅ Full Support | Posts, stories, captions, hashtags |
| **Reddit** | ✅ Full Support | Posts, comments, subreddits, awards |

## 🔧 Technical Details

### Architecture

- **Base Crawler**: Abstract class with common crawling logic
- **Platform Crawlers**: Specialized extractors for each social media platform
- **IndexedDB Storage**: Client-side database for persistent data storage
- **Smart Scrolling**: Post-height-based navigation system
- **Rate Limiting**: Prevents duplicate processing and API overload

### Data Schema

```javascript
{
  id: "unique_post_identifier",
  platform: "twitter|linkedin|facebook|instagram|reddit",
  company: "extracted_company_name",
  author: {
    name: "Author Name",
    handle: "@username",
    avatar: "avatar_url",
    profileUrl: "profile_url"
  },
  text: "post_content",
  title: "post_title", // if applicable
  timestamp: "ISO_datetime",
  url: "post_url",
  crawledAt: "ISO_datetime",
  metrics: {
    likes: 0,
    shares: 0,
    comments: 0,
    views: 0 // platform dependent
  },
  media: {
    images: [...],
    videos: [...],
    gifs: [...],
    embeds: [...]
  },
  // Platform-specific fields...
}
```

### Performance Features

- **Intelligent Viewport Detection**: Only processes visible posts
- **Memory Management**: Automatic cleanup of processed post references
- **Scroll Optimization**: Precise scroll amounts based on actual post heights
- **Background Processing**: Non-blocking data extraction and storage

## ⚙️ Configuration

### Rate Limiting

The crawler includes built-in rate limiting:
- Maximum 3 processing attempts per post within 15 seconds
- Automatic retry logic for failed extractions
- Memory cleanup for optimal performance

### Scroll Behavior

- **Auto-scroll Interval**: 1 second (configurable)
- **Viewport Detection**: 30% visibility threshold
- **Scroll Amount**: Calculated based on current post height
- **Recovery Mode**: Automatic detection and recovery from stuck states

## 🐛 Troubleshooting

### Common Issues

**Extension Not Working**:
- Ensure you're on a supported platform
- Check that the extension is enabled in Chrome
- Refresh the page and try again

**No Posts Being Detected**:
- Platform may have updated their HTML structure
- Check browser console for error messages
- Try scrolling manually to load content

**Control Panel Not Visible**:
- Panel appears in top-right corner
- Check if it's behind other page elements
- Try clicking the extension icon again

**Data Export Issues**:
- Ensure you have crawled posts before exporting
- Check filter settings (try "All" options)
- Verify browser allows file downloads

### Browser Console

Enable Chrome DevTools (F12) to see detailed logging:
- `[Platform] Post saved: ...` - Successful post extraction
- `[Platform] Rate limiting: ...` - Duplicate processing prevention
- `[Platform] Error: ...` - Extraction or storage errors

## 🔐 Privacy & Security

- **Local Storage Only**: All data is stored locally in your browser
- **No External Servers**: No data is transmitted to external services
- **HTTPS Only**: Extension only works on secure connections
- **Minimal Permissions**: Only requests necessary browser permissions

## 🤝 Contributing

This extension follows a modular architecture making it easy to add new platforms:

1. Create new platform crawler extending `BaseCrawler`
2. Implement required methods: `getSelectors()`, `extractPostData()`
3. Add platform detection in `content.js`
4. Update manifest permissions for new domains

## 📄 License

This project is provided as-is for educational and research purposes.

## 🆘 Support

For issues, questions, or feature requests, please check:
1. Browser console for error messages
2. Extension permissions and settings
3. Platform compatibility

---

**Note**: This extension is designed for educational and research purposes. Please respect platform terms of service and rate limits when crawling data.