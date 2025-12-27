/**
 * PV Fault Detector - Main Application
 */

class PVFaultDetector {
    constructor() {
        this.selectedFile = null;
        this.isVideo = false;
        this.videoResults = null;
        this.currentFrameIndex = 0;
        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.loadTheme();
        this.checkAPIHealth();
    }

    bindElements() {
        // Navigation
        this.navBtns = document.querySelectorAll('.nav-btn');
        this.sections = document.querySelectorAll('.section');
        
        // Upload
        this.uploadArea = document.getElementById('upload-area');
        this.fileInput = document.getElementById('file-input');
        this.cameraBtn = document.getElementById('camera-btn');
        
        // Preview
        this.previewSection = document.getElementById('preview-section');
        this.previewTitle = document.getElementById('preview-title');
        this.previewImage = document.getElementById('preview-image');
        this.previewVideo = document.getElementById('preview-video');
        this.videoOptions = document.getElementById('video-options');
        this.frameInterval = document.getElementById('frame-interval');
        this.clearBtn = document.getElementById('clear-btn');
        this.analyzeBtn = document.getElementById('analyze-btn');
        
        // Results
        this.resultsSection = document.getElementById('results-section');
        this.originalResult = document.getElementById('original-result');
        this.detectionResult = document.getElementById('detection-result');
        this.segmentationResult = document.getElementById('segmentation-result');
        this.detectionsContainer = document.getElementById('detections-container');
        this.statsGrid = document.getElementById('stats-grid');
        this.downloadBtn = document.getElementById('download-btn');
        this.newAnalysisBtn = document.getElementById('new-analysis-btn');
        
        // Loading & Theme
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingText = document.getElementById('loading-text');
        this.loadingSubtext = document.getElementById('loading-subtext');
        this.progressContainer = document.getElementById('progress-container');
        this.progressFill = document.getElementById('progress-fill');
        this.themeToggle = document.getElementById('theme-toggle');
        this.toastContainer = document.getElementById('toast-container');
    }

    bindEvents() {
        // Navigation
        this.navBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchSection(btn.dataset.section));
        });

        // Upload area
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', () => this.uploadArea.classList.remove('dragover'));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Camera
        this.cameraBtn.addEventListener('click', () => this.openCamera());

        // Preview actions
        this.clearBtn.addEventListener('click', () => this.clearPreview());
        this.analyzeBtn.addEventListener('click', () => this.analyzeImage());

        // Results actions
        this.downloadBtn.addEventListener('click', () => this.downloadResults());
        this.newAnalysisBtn.addEventListener('click', () => this.startNewAnalysis());

        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // ===== Navigation =====
    switchSection(sectionId) {
        this.navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
        
        this.sections.forEach(section => {
            section.classList.toggle('active', section.id === `${sectionId}-section`);
        });
    }

    // ===== Theme =====
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = this.themeToggle.querySelector('.theme-icon');
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }

    // ===== File Handling =====
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    processFile(file) {
        // Check if video
        const isVideo = CONFIG.SUPPORTED_VIDEO_TYPES.includes(file.type);
        this.isVideo = isVideo;
        
        // Validate file type
        if (!CONFIG.SUPPORTED_TYPES.includes(file.type) && !isVideo) {
            this.showToast('Please select a valid image or video file', 'error');
            return;
        }

        // Validate file size
        const maxSize = isVideo ? CONFIG.MAX_VIDEO_SIZE : CONFIG.MAX_FILE_SIZE;
        if (file.size > maxSize) {
            const sizeMB = Math.round(maxSize / 1024 / 1024);
            this.showToast(`File size must be less than ${sizeMB}MB`, 'error');
            return;
        }

        this.selectedFile = file;
        this.showPreview(file);
    }

    showPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (this.isVideo) {
                this.previewImage.hidden = true;
                this.previewVideo.hidden = false;
                this.previewVideo.src = e.target.result;
                this.videoOptions.classList.remove('hidden');
                this.previewTitle.textContent = 'Selected Video';
                this.analyzeBtn.querySelector('.btn-text').textContent = 'Analyze Video';
            } else {
                this.previewImage.hidden = false;
                this.previewVideo.hidden = true;
                this.previewImage.src = e.target.result;
                this.videoOptions.classList.add('hidden');
                this.previewTitle.textContent = 'Selected Image';
                this.analyzeBtn.querySelector('.btn-text').textContent = 'Analyze Panel';
            }
            this.previewSection.classList.remove('hidden');
            this.resultsSection.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    clearPreview() {
        this.selectedFile = null;
        this.isVideo = false;
        this.videoResults = null;
        this.currentFrameIndex = 0;
        this.previewImage.src = '';
        this.previewImage.hidden = false;
        this.previewVideo.src = '';
        this.previewVideo.hidden = true;
        this.videoOptions.classList.add('hidden');
        this.previewSection.classList.add('hidden');
        this.fileInput.value = '';
    }

    // ===== Camera =====
    openCamera() {
        // Create a file input with camera capture
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Use back camera on mobile
        
        input.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.processFile(e.target.files[0]);
            }
        };
        
        input.click();
    }

    // ===== API =====
    async checkAPIHealth() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.HEALTH}`, {
                method: 'GET',
                mode: 'cors'
            });
            
            if (response.ok) {
                console.log('✅ API is healthy');
            }
        } catch (error) {
            console.warn('⚠️ API health check failed:', error.message);
            this.showToast('Backend server not available. Please ensure the API is running.', 'warning');
        }
    }

    async analyzeImage() {
        if (!this.selectedFile) {
            this.showToast('Please select an image or video first', 'error');
            return;
        }

        // Route to video or image analysis
        if (this.isVideo) {
            await this.analyzeVideo();
        } else {
            await this.analyzeImageFile();
        }
    }

    async analyzeImageFile() {
        this.showLoading(true, 'Analyzing image...');

        try {
            const formData = new FormData();
            formData.append('image', this.selectedFile);

            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.ANALYZE}`, {
                method: 'POST',
                body: formData,
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            this.displayResults(result);
            this.showToast('Analysis complete!', 'success');

        } catch (error) {
            console.error('Analysis failed:', error);
            this.showToast(`Analysis failed: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async analyzeVideo() {
        this.showLoading(true, 'Processing video...');
        this.progressContainer.classList.remove('hidden');
        this.progressFill.style.width = '0%';

        try {
            const formData = new FormData();
            formData.append('video', this.selectedFile);
            formData.append('frame_interval', this.frameInterval.value);

            // Use XMLHttpRequest for progress tracking
            const result = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.ANALYZE_VIDEO}`);
                
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = (e.loaded / e.total) * 30; // Upload is 30% of total
                        this.progressFill.style.width = `${pct}%`;
                        this.loadingSubtext.textContent = 'Uploading video...';
                    }
                };

                xhr.onload = () => {
                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`Server error: ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(formData);
                
                // Simulate processing progress after upload
                let progress = 30;
                const progressInterval = setInterval(() => {
                    if (progress < 90) {
                        progress += 2;
                        this.progressFill.style.width = `${progress}%`;
                        this.loadingSubtext.textContent = 'Analyzing frames...';
                    } else {
                        clearInterval(progressInterval);
                    }
                }, 500);

                xhr.onload = () => {
                    clearInterval(progressInterval);
                    this.progressFill.style.width = '100%';
                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`Server error: ${xhr.status}`));
                    }
                };
            });

            this.videoResults = result;
            this.currentFrameIndex = 0;
            this.displayVideoResults(result);
            this.showToast(`Analyzed ${result.total_frames} frames!`, 'success');

        } catch (error) {
            console.error('Video analysis failed:', error);
            this.showToast(`Video analysis failed: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
            this.progressContainer.classList.add('hidden');
        }
    }

    // ===== Results Display =====
    displayResults(result) {
        // Show results section
        this.resultsSection.classList.remove('hidden');

        // Hide video navigation if present
        const frameNav = document.getElementById('frame-navigation');
        if (frameNav) frameNav.classList.add('hidden');

        // Display images
        if (result.original_image) {
            this.originalResult.src = `data:image/jpeg;base64,${result.original_image}`;
        }
        
        if (result.detection_image) {
            this.detectionResult.src = `data:image/jpeg;base64,${result.detection_image}`;
        }
        
        if (result.segmentation_image) {
            this.segmentationResult.src = `data:image/jpeg;base64,${result.segmentation_image}`;
        }

        // Display detections
        this.displayDetections(result.detections || []);

        // Display statistics
        this.displayStats(result);

        // Scroll to results
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    displayVideoResults(result) {
        // Show results section
        this.resultsSection.classList.remove('hidden');

        // Create or show frame navigation
        let frameNav = document.getElementById('frame-navigation');
        if (!frameNav) {
            frameNav = document.createElement('div');
            frameNav.id = 'frame-navigation';
            frameNav.className = 'frame-navigation';
            frameNav.innerHTML = `
                <button class="frame-nav-btn" id="prev-frame">◀ Previous</button>
                <span class="frame-counter" id="frame-counter">Frame 1 / ${result.total_frames}</span>
                <button class="frame-nav-btn" id="next-frame">Next ▶</button>
            `;
            this.resultsSection.querySelector('.results-header').appendChild(frameNav);
            
            // Bind navigation events
            document.getElementById('prev-frame').addEventListener('click', () => this.showPrevFrame());
            document.getElementById('next-frame').addEventListener('click', () => this.showNextFrame());
        } else {
            frameNav.classList.remove('hidden');
            document.getElementById('frame-counter').textContent = `Frame 1 / ${result.total_frames}`;
        }

        // Show first frame
        this.showFrameResult(0);

        // Display video statistics
        this.displayVideoStats(result);

        // Scroll to results
        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    showFrameResult(index) {
        if (!this.videoResults || !this.videoResults.frames) return;
        
        const frames = this.videoResults.frames;
        if (index < 0 || index >= frames.length) return;
        
        this.currentFrameIndex = index;
        const frame = frames[index];
        
        // Update images
        if (frame.original_image) {
            this.originalResult.src = `data:image/jpeg;base64,${frame.original_image}`;
        }
        if (frame.detection_image) {
            this.detectionResult.src = `data:image/jpeg;base64,${frame.detection_image}`;
        }
        if (frame.segmentation_image) {
            this.segmentationResult.src = `data:image/jpeg;base64,${frame.segmentation_image}`;
        }
        
        // Update frame counter
        const counter = document.getElementById('frame-counter');
        if (counter) {
            counter.textContent = `Frame ${index + 1} / ${frames.length} (${frame.timestamp || '0.00'}s)`;
        }
        
        // Update detections for this frame
        this.displayDetections(frame.detections || []);
    }

    showPrevFrame() {
        if (this.currentFrameIndex > 0) {
            this.showFrameResult(this.currentFrameIndex - 1);
        }
    }

    showNextFrame() {
        if (this.videoResults && this.currentFrameIndex < this.videoResults.frames.length - 1) {
            this.showFrameResult(this.currentFrameIndex + 1);
        }
    }

    displayVideoStats(result) {
        // Count all detections across frames
        const allDetections = result.frames.flatMap(f => f.detections || []);
        const classCounts = {};
        allDetections.forEach(det => {
            const cls = det.class_name || 'Unknown';
            classCounts[cls] = (classCounts[cls] || 0) + 1;
        });

        const stats = [
            { value: result.total_frames, label: 'Frames Analyzed' },
            { value: allDetections.length, label: 'Total Detections' },
            { value: `${(result.total_time || 0).toFixed(1)}s`, label: 'Processing Time' },
            { value: result.video_duration ? `${result.video_duration.toFixed(1)}s` : 'N/A', label: 'Video Duration' }
        ];

        // Add class counts
        Object.entries(classCounts).forEach(([cls, count]) => {
            stats.push({ value: count, label: cls });
        });

        this.statsGrid.innerHTML = stats.map(stat => `
            <div class="stat-card">
                <div class="stat-value">${stat.value}</div>
                <div class="stat-label">${stat.label}</div>
            </div>
        `).join('');
    }

    displayDetections(detections) {
        this.detectionsContainer.innerHTML = '';

        if (detections.length === 0) {
            this.detectionsContainer.innerHTML = '<p style="color: var(--text-muted);">No panels detected</p>';
            return;
        }

        detections.forEach(det => {
            const tag = document.createElement('div');
            // Use fault_type if available (full pipeline), otherwise class_name
            const faultType = det.fault_type || det.class_name || 'Unknown';
            const className = det.class_name || faultType;
            const confidence = ((det.confidence || 0) * 100).toFixed(1);
            const severity = det.severity_score ? det.severity_score.toFixed(0) : null;
            const action = det.action_required ? det.action_required.replace(/_/g, ' ') : null;
            
            // Determine CSS class
            const cssClass = faultType.toLowerCase().replace(/\s+/g, '-');
            
            tag.className = `detection-tag ${cssClass}`;
            
            let html = `
                <span>${CONFIG.CLASS_ICONS[faultType] || CONFIG.CLASS_ICONS[className] || '🔍'}</span>
                <span class="detection-name">${faultType}</span>
                <span class="detection-confidence">${confidence}%</span>
            `;
            
            // Add severity if available
            if (severity !== null) {
                html += `<span class="detection-severity">Sev: ${severity}</span>`;
            }
            
            tag.innerHTML = html;
            
            // Add action as tooltip
            if (action) {
                tag.title = `Action: ${action}`;
            }
            
            this.detectionsContainer.appendChild(tag);
        });
    }

    displayStats(result) {
        const stats = [
            { value: result.detections?.length || 0, label: 'Detections' },
            { value: `${(result.inference_time || 0).toFixed(0)}ms`, label: 'Inference Time' },
            { value: result.stages_used?.join(' → ') || result.model || 'Pipeline', label: 'Stages Used' }
        ];

        // Add fault type summary if available
        if (result.detections && result.detections.length > 0) {
            const faultCounts = {};
            result.detections.forEach(det => {
                const ft = det.fault_type || det.class_name;
                faultCounts[ft] = (faultCounts[ft] || 0) + 1;
            });
            
            Object.entries(faultCounts).forEach(([fault, count]) => {
                if (fault !== 'NON_DEFECTIVE') {
                    stats.push({ value: count, label: fault.replace(/_/g, ' ') });
                }
            });
        }

        this.statsGrid.innerHTML = stats.map(stat => `
            <div class="stat-card">
                <div class="stat-value">${stat.value}</div>
                <div class="stat-label">${stat.label}</div>
            </div>
        `).join('');
    }

    // ===== Download =====
    downloadResults() {
        const link = document.createElement('a');
        link.download = `pv-fault-detection-${Date.now()}.png`;
        link.href = this.detectionResult.src;
        link.click();
        this.showToast('Image downloaded!', 'success');
    }

    startNewAnalysis() {
        this.clearPreview();
        this.resultsSection.classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ===== Loading =====
    showLoading(show, text = 'Analyzing...') {
        this.loadingOverlay.classList.toggle('hidden', !show);
        if (this.loadingText) this.loadingText.textContent = text;
        if (this.loadingSubtext) this.loadingSubtext.textContent = '';
    }

    // ===== Toast Notifications =====
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${this.getToastIcon(type)}</span>
            <span>${message}</span>
        `;
        
        this.toastContainer.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
}

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PVFaultDetector();
});

// ===== Service Worker Registration (PWA) =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}
