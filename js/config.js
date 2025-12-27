/**
 * PV Fault Detector - Configuration
 * Update API_BASE_URL with your backend server address
 */

const CONFIG = {
    // Backend API URL - Change this to your server's address
    // ⚠️ IMPORTANT: Update this before deploying!
    // For local testing: 'http://localhost:5000'
    // For production: 'https://your-gpu-server.com:5000'
    API_BASE_URL: 'https://YOUR_API_SERVER_URL',
    
    // API Endpoints
    ENDPOINTS: {
        ANALYZE: '/api/analyze',
        ANALYZE_VIDEO: '/api/analyze-video',
        HEALTH: '/api/health',
        DETECT: '/api/detect',
        SEGMENT: '/api/segment'
    },
    
    // Max file size in bytes (10MB for images, 50MB for videos)
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    MAX_VIDEO_SIZE: 50 * 1024 * 1024,
    
    // Supported file types
    SUPPORTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    SUPPORTED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    
    // Detection class colors
    CLASS_COLORS: {
        'Non Defective': '#06d6a0',
        'Defective': '#ef476f',
        'Dust': '#ffd60a',
        'Bird Drop': '#a855f7',
        'Snow': '#4cc9f0',
        'Shade': '#6b7280'
    },
    
    // Detection class icons
    CLASS_ICONS: {
        'Non Defective': '✅',
        'NON_DEFECTIVE': '✅',
        'Defective': '⚠️',
        'DEFECTIVE': '⚠️',
        'Dust': '🌫️',
        'DUST': '🌫️',
        'Bird Drop': '🐦',
        'BIRD_DROP': '🐦',
        'Snow': '❄️',
        'SNOW': '❄️',
        'Shade': '🌑',
        'SHADE': '🌑'
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.ENDPOINTS);
Object.freeze(CONFIG.CLASS_COLORS);
Object.freeze(CONFIG.CLASS_ICONS);
