# PV Fault Detector - Web Application

AI-powered solar panel fault detection using a 3-stage vision pipeline.

## 🔬 Pipeline Architecture

| Stage | Model | Purpose |
|-------|-------|---------|
| **Stage 1** | YOLOv13-L | Fast detection - Defective or Non-Defective |
| **Stage 2** | RT-DETR | Classification - Dust, Bird Drop, Snow, Shade |
| **Stage 3** | SAM3 | Precise segmentation masks |

## 🔍 Detectable Faults

- ✅ Non Defective
- ⚠️ Defective (Physical damage)
- 🌫️ Dust
- 🐦 Bird Droppings
- ❄️ Snow
- 🌑 Shade

## 📁 Frontend Files (Deploy to Cloudflare)

```
├── index.html          # Main HTML page
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── _headers           # Cloudflare headers
├── _redirects         # Cloudflare redirects
├── css/
│   └── style.css      # Styles
├── js/
│   ├── config.js      # ⚠️ Configure API URL here
│   └── app.js         # Application logic
└── icons/             # PWA icons
```

## 🚀 Deployment Guide

### Step 1: Configure API URL

Before deploying, edit `js/config.js`:

```javascript
const CONFIG = {
    API_BASE_URL: 'https://YOUR_GPU_SERVER_IP:5000',
    // ...
};
```

Replace `YOUR_GPU_SERVER_IP` with your actual GPU server address.

### Step 2: Deploy to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Pages** → **Create a project** → **Connect to Git**
3. Select this repository: `Tolgayalcn/PV_fault_detection_webdeploy`
4. Configure build settings:
   - **Framework preset**: None
   - **Build command**: *(leave empty)*
   - **Build output directory**: `/`
5. Click **Save and Deploy**

Your site will be live at: `https://pv-fault-detection-webdeploy.pages.dev`

### Step 3: Run Backend API (On Your GPU Server)

The backend API (`api_server.py`) runs on your GPU server - it is **NOT** included in this repository for security.

```bash
# On your GPU server
cd /path/to/vision/webapp-deploy
source /path/to/myenv/bin/activate
python api_server.py
```

For production, use a process manager:

```bash
# Using screen
screen -S pv-api
python api_server.py
# Ctrl+A, D to detach

# Or using systemd (create a service file)
```

## 📱 Features

- **Image & Video Analysis** - Upload photos or videos of solar panels
- **Mobile Responsive** - Works on phones, tablets, and desktops
- **PWA Support** - Install as an app on your device
- **Dark/Light Mode** - Toggle between themes
- **Real-time Results** - Instant detection with severity scores
- **Action Recommendations** - Clean, Inspect, or Urgent Repair

## 🔒 Security Notes

- ✅ No sensitive data in frontend code
- ✅ API server runs separately on your GPU server
- ✅ No hardcoded credentials or API keys

## 📄 License

MIT License
