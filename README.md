# PV Fault Detector - Cloudflare Pages Deployment

## 📁 Project Structure

```
webapp-deploy/
├── index.html          # Main HTML page
├── manifest.json       # PWA manifest
├── sw.js              # Service worker for offline support
├── _headers           # Cloudflare headers config
├── _redirects         # Cloudflare redirects
├── css/
│   └── style.css      # All styles
├── js/
│   ├── config.js      # Configuration (API URL)
│   └── app.js         # Main application logic
├── icons/             # PWA icons (generate these)
└── api_server.py      # Backend API (run on your GPU server)
```

## 🚀 Deployment Steps

### Step 1: Configure API URL

Edit `js/config.js` and update the `API_BASE_URL`:

```javascript
const CONFIG = {
    // Change this to your GPU server's public IP or domain
    API_BASE_URL: 'https://your-server.com:5000',
    // or
    API_BASE_URL: 'http://YOUR_GPU_SERVER_IP:5000',
};
```

### Step 2: Deploy Frontend to Cloudflare Pages

1. **Create a GitHub repository** and push the `webapp-deploy` folder contents:
   ```bash
   cd webapp-deploy
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/pv-fault-detector.git
   git push -u origin main
   ```

2. **Connect to Cloudflare Pages**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Click "Pages" → "Create a project"
   - Select "Connect to Git"
   - Choose your repository
   - Build settings:
     - **Framework preset**: None
     - **Build command**: (leave empty)
     - **Build output directory**: `/` or `.`
   - Click "Save and Deploy"

3. Your site will be live at: `https://your-project.pages.dev`

### Step 3: Run Backend API on Your GPU Server

On your GPU server, run the API:

```bash
cd /home/user/projects/vision/webapp-deploy

# Activate virtual environment
source /home/user/projects/myenv/bin/activate

# Run the API server
python api_server.py
```

For production, use a process manager:

```bash
# Using screen
screen -S pv-api
python api_server.py
# Press Ctrl+A, D to detach

# Or using nohup
nohup python api_server.py > api.log 2>&1 &
```

### Step 4: Configure HTTPS (Recommended)

For production, use HTTPS on your API server:

```bash
# Install nginx
sudo apt install nginx

# Install certbot for SSL
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-api-domain.com
```

Nginx config example (`/etc/nginx/sites-available/pv-api`):

```nginx
server {
    listen 443 ssl;
    server_name your-api-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-api-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-api-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeout for ML inference
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        
        # Allow large file uploads
        client_max_body_size 20M;
    }
}
```

## 📱 Features

- ✅ **Responsive Design** - Works on mobile and desktop
- ✅ **PWA Support** - Can be installed as an app
- ✅ **Camera Capture** - Take photos directly on mobile
- ✅ **Drag & Drop** - Easy file upload
- ✅ **Dark/Light Theme** - User preference
- ✅ **Offline Support** - Basic caching with service worker

## 🔧 Configuration Options

### `js/config.js`

| Option | Description |
|--------|-------------|
| `API_BASE_URL` | Your backend API server URL |
| `MAX_FILE_SIZE` | Maximum upload size (default: 10MB) |
| `SUPPORTED_TYPES` | Allowed image formats |

## 🌐 CORS Configuration

The backend API is configured to accept requests from any origin. For production, you may want to restrict this:

```python
# In api_server.py
CORS(app, resources={
    r"/api/*": {
        "origins": ["https://your-project.pages.dev"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})
```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/analyze` | POST | Analyze image |
| `/api/detect` | POST | Detection only |

### Request Example

```javascript
const formData = new FormData();
formData.append('image', file);

const response = await fetch('https://your-api.com/api/analyze', {
    method: 'POST',
    body: formData
});

const result = await response.json();
```

### Response Example

```json
{
    "original_image": "base64...",
    "detection_image": "base64...",
    "segmentation_image": "base64...",
    "detections": [
        {
            "class_id": 1,
            "class_name": "Defective",
            "confidence": 0.87,
            "bbox": [100, 200, 300, 400]
        }
    ],
    "inference_time": 45.2,
    "model": "YOLOv13-L (Fine-tuned)"
}
```

## 🔒 Security Considerations

1. **HTTPS** - Always use HTTPS in production
2. **Rate Limiting** - Consider adding rate limiting to prevent abuse
3. **Input Validation** - The API validates image types and sizes
4. **CORS** - Restrict origins in production

## 📈 Performance Tips

1. **Image Compression** - Compress images before upload
2. **Caching** - Static assets are cached by the service worker
3. **GPU Optimization** - Use batch inference for multiple images

## 🐛 Troubleshooting

### "API not available" error
- Check if the backend server is running
- Verify the API_BASE_URL in config.js
- Check CORS settings

### Slow inference
- Ensure GPU is being used (check with `nvidia-smi`)
- Reduce image size before sending
- Use batch processing for multiple images

### CORS errors
- Ensure the backend has CORS enabled
- Check that the origin is allowed
- Verify headers are correct

## 📞 Support

For issues or questions, check:
1. Browser console for errors
2. API server logs
3. Network tab for request/response details
