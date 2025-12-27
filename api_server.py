"""
PV Fault Detector - Backend API Server
=====================================
Full 3-Stage Pipeline:
    Stage 1: YOLOv13-L (Fast Detection) - Defective or Not
    Stage 2: RT-DETR (Classification) - Dust, Bird Drop, Snow, Shade, etc.
    Stage 3: SAM3 (Segmentation) - Precise fault masking

Usage:
    python api_server.py

Environment Variables:
    - PORT: Server port (default: 5000)
    - HOST: Server host (default: 0.0.0.0)
    - ENABLE_SAM3: Enable SAM3 segmentation (default: true)
"""

import os
import sys
import base64
import io
import time
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np
import cv2

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "src"))

app = Flask(__name__)

# Enable CORS for all origins (required for Cloudflare Pages frontend)
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Global pipeline storage
pipeline = None


def load_pipeline():
    """Load the full PV Fault Pipeline."""
    global pipeline
    
    print("=" * 60)
    print("🔆 PV FAULT DETECTION - Full Pipeline API Server")
    print("=" * 60)
    print()
    print("Pipeline Architecture:")
    print("  Stage 1: YOLOv13-L → Detect panels, check if Defective")
    print("  Stage 2: RT-DETR   → Classify fault type (Dust, Bird Drop, etc.)")
    print("  Stage 3: SAM3      → Precise segmentation masks")
    print()
    
    enable_sam3 = os.environ.get('ENABLE_SAM3', 'true').lower() == 'true'
    
    try:
        from pipeline.pv_fault_pipeline import PVFaultPipeline
        
        pipeline = PVFaultPipeline(
            yolo_model_path=str(PROJECT_ROOT / "weights/yolov13l_pv_fault.pt"),
            rtdetr_model_path=str(PROJECT_ROOT / "weights/rtdetr_best.pt"),
            enable_sam3=enable_sam3
        )
        
        # Force load models now (not lazy)
        print("🔄 Loading YOLOv13-L model...")
        _ = pipeline.yolo_model
        print("✅ YOLOv13-L loaded")
        
        print("🔄 Loading RT-DETR model...")
        _ = pipeline.rtdetr_model
        print("✅ RT-DETR loaded")
        
        if enable_sam3:
            print("🔄 SAM3 will load on first use...")
        else:
            print("ℹ️  SAM3 disabled for speed")
        
        print()
        print("=" * 60)
        print("✅ Pipeline loaded successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Failed to load pipeline: {e}")
        import traceback
        traceback.print_exc()
        pipeline = None


def image_to_base64(image):
    """Convert PIL Image or numpy array to base64 string."""
    if isinstance(image, np.ndarray):
        # Convert BGR to RGB if needed
        if len(image.shape) == 3 and image.shape[2] == 3:
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image = Image.fromarray(image)
    
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=90)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def annotate_image(image, detections):
    """Draw detections on image with full pipeline info."""
    annotated = image.copy()
    
    colors = {
        'NON_DEFECTIVE': (0, 255, 0),    # Green
        'DEFECTIVE': (0, 0, 255),         # Red  
        'DUST': (0, 165, 255),            # Orange
        'BIRD_DROP': (128, 0, 128),       # Purple
        'SNOW': (255, 200, 150),          # Light Blue
        'SHADE': (128, 128, 128),         # Gray
    }
    
    for det in detections:
        bbox = det.detection.bbox
        x1, y1, x2, y2 = map(int, bbox)
        fault_name = det.fault_type.name
        color = colors.get(fault_name, (255, 255, 255))
        
        # Draw box
        thickness = 3 if det.action_required.value == 'urgent_repair_required' else 2
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)
        
        # Draw filled label background
        label = f"{fault_name}: {det.confidence:.0%}"
        (label_w, label_h), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
        )
        cv2.rectangle(annotated, (x1, y1 - label_h - 10), 
                     (x1 + label_w + 5, y1), color, -1)
        cv2.putText(annotated, label, (x1 + 2, y1 - 5),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Severity indicator
        severity_text = f"Severity: {det.severity_score:.0f}/100"
        cv2.putText(annotated, severity_text, (x1, y2 + 20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # Action indicator
        action = det.action_required.value.replace('_', ' ').title()
        cv2.putText(annotated, action, (x1, y2 + 40),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # Draw mask if available
        if det.mask is not None:
            mask_color = np.array(color[::-1], dtype=np.uint8)  # RGB
            overlay = annotated.copy()
            overlay[det.mask > 0] = overlay[det.mask > 0] * 0.5 + mask_color * 0.5
            annotated = overlay
    
    return annotated


def create_segmentation_overlay(image, detections):
    """Create a segmentation mask overlay."""
    h, w = image.shape[:2]
    mask_overlay = np.zeros((h, w, 3), dtype=np.uint8)
    
    colors = {
        'NON_DEFECTIVE': (0, 255, 0),
        'DEFECTIVE': (255, 0, 0),
        'DUST': (255, 165, 0),
        'BIRD_DROP': (128, 0, 128),
        'SNOW': (150, 200, 255),
        'SHADE': (128, 128, 128),
    }
    
    for det in detections:
        fault_name = det.fault_type.name
        color = colors.get(fault_name, (255, 255, 255))
        
        if det.mask is not None:
            # Use actual SAM3 mask
            mask_overlay[det.mask > 0] = color
        else:
            # Fall back to bbox fill
            x1, y1, x2, y2 = map(int, det.detection.bbox)
            cv2.rectangle(mask_overlay, (x1, y1), (x2, y2), color, -1)
    
    # Blend with original
    alpha = 0.4
    blended = cv2.addWeighted(image, 1 - alpha, mask_overlay, alpha, 0)
    
    return blended


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy' if pipeline else 'pipeline_not_loaded',
        'pipeline': {
            'yolo': pipeline._yolo_model is not None if pipeline else False,
            'rtdetr': pipeline._rtdetr_model is not None if pipeline else False,
            'sam3': pipeline._sam3_model is not None if pipeline else False
        },
        'architecture': 'YOLOv13-L → RT-DETR → SAM3',
        'timestamp': time.time()
    })


@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    """
    Analyze a solar panel image using the full 3-stage pipeline.
    
    Pipeline:
        1. YOLOv13-L: Detect panels, classify as Defective/Non-Defective
        2. RT-DETR: For defective panels, classify specific fault type
        3. SAM3: Generate precise segmentation masks (if enabled)
    
    Request:
        - image: Image file (multipart/form-data)
    
    Response:
        - original_image: Base64 encoded original image
        - detection_image: Base64 encoded image with detection boxes
        - segmentation_image: Base64 encoded segmentation overlay
        - detections: List of detected faults with full analysis
        - inference_time: Total inference time in ms
        - stages_used: Which pipeline stages were used
    """
    if pipeline is None:
        return jsonify({'error': 'Pipeline not loaded'}), 500
    
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No image selected'}), 400
    
    try:
        start_time = time.time()
        
        # Read image
        image_pil = Image.open(file.stream).convert('RGB')
        image_np = np.array(image_pil)
        # Convert RGB to BGR for OpenCV/pipeline
        image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        
        # Run full pipeline
        results = pipeline.process_image(image_bgr)
        
        inference_time = (time.time() - start_time) * 1000
        
        # Create annotated images
        detection_image = annotate_image(image_bgr, results)
        segmentation_image = create_segmentation_overlay(image_bgr, results)
        
        # Convert detections to JSON-serializable format
        detections = []
        stages_used = set()
        
        for r in results:
            det_dict = {
                'class_id': r.detection.class_id,
                'class_name': r.detection.class_name,
                'fault_type': r.fault_type.name,
                'confidence': float(r.confidence),
                'severity_score': float(r.severity_score),
                'affected_area_percent': float(r.affected_area_percent),
                'action_required': r.action_required.value,
                'bbox': list(r.detection.bbox),
                'has_mask': r.mask is not None
            }
            detections.append(det_dict)
            
            # Track stages used
            if 'stages_used' in r.metadata:
                stages_used.update(r.metadata['stages_used'])
        
        # Prepare response
        response = {
            'original_image': image_to_base64(image_np),
            'detection_image': image_to_base64(detection_image),
            'segmentation_image': image_to_base64(segmentation_image),
            'detections': detections,
            'inference_time': inference_time,
            'stages_used': list(stages_used) or ['yolo', 'rtdetr'],
            'model': 'YOLOv13-L + RT-DETR Pipeline',
            'image_size': [image_pil.width, image_pil.height]
        }
        
        return jsonify(response)
    
    except Exception as e:
        print(f"Error analyzing image: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/analyze-video', methods=['POST'])
def analyze_video():
    """
    Analyze a solar panel video using the full 3-stage pipeline.
    
    Request:
        - video: Video file (multipart/form-data)
        - frame_interval: Analyze every Nth frame (default: 30)
    
    Response:
        - frames: List of frame results with detections
        - total_frames: Number of frames analyzed
        - summary: Aggregated statistics
    """
    if pipeline is None:
        return jsonify({'error': 'Pipeline not loaded'}), 500
    
    if 'video' not in request.files:
        return jsonify({'error': 'No video provided'}), 400
    
    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': 'No video selected'}), 400
    
    frame_interval = int(request.form.get('frame_interval', 30))
    
    try:
        start_time = time.time()
        
        # Save video to temp file
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            file.save(tmp.name)
            video_path = tmp.name
        
        # Open video
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return jsonify({'error': 'Could not open video file'}), 400
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_video_frames / fps if fps > 0 else 0
        
        print(f"📹 Processing video: {total_video_frames} frames, {duration:.1f}s")
        print(f"   Using full pipeline: YOLOv13-L → RT-DETR")
        print(f"   Analyzing every {frame_interval} frames...")
        
        frames_results = []
        frame_count = 0
        analyzed_count = 0
        
        # Aggregate stats
        all_fault_counts = {}
        all_action_counts = {}
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % frame_interval == 0:
                timestamp = frame_count / fps if fps > 0 else 0
                
                # Run full pipeline on frame
                results = pipeline.process_image(frame)
                
                # Create annotated images
                detection_image = annotate_image(frame, results)
                segmentation_image = create_segmentation_overlay(frame, results)
                
                # Convert results
                detections = []
                for r in results:
                    det_dict = {
                        'class_name': r.detection.class_name,
                        'fault_type': r.fault_type.name,
                        'confidence': float(r.confidence),
                        'severity_score': float(r.severity_score),
                        'action_required': r.action_required.value,
                        'bbox': list(r.detection.bbox)
                    }
                    detections.append(det_dict)
                    
                    # Aggregate counts
                    ft = r.fault_type.name
                    all_fault_counts[ft] = all_fault_counts.get(ft, 0) + 1
                    act = r.action_required.value
                    all_action_counts[act] = all_action_counts.get(act, 0) + 1
                
                # Convert BGR to RGB for output
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                frames_results.append({
                    'frame_number': frame_count,
                    'timestamp': f"{timestamp:.2f}",
                    'original_image': image_to_base64(frame_rgb),
                    'detection_image': image_to_base64(detection_image),
                    'segmentation_image': image_to_base64(segmentation_image),
                    'detections': detections,
                    'has_faults': any(r.fault_type.name != 'NON_DEFECTIVE' for r in results)
                })
                
                analyzed_count += 1
                if analyzed_count % 10 == 0:
                    print(f"   Processed {analyzed_count} frames...")
            
            frame_count += 1
        
        cap.release()
        
        # Clean up temp file
        try:
            os.unlink(video_path)
        except:
            pass
        
        total_time = time.time() - start_time
        
        # Generate recommendations
        recommendations = []
        urgent = all_action_counts.get('urgent_repair_required', 0)
        if urgent > 0:
            recommendations.append(f"🚨 {urgent} urgent repairs needed")
        
        cleaning = all_fault_counts.get('DUST', 0) + all_fault_counts.get('BIRD_DROP', 0)
        if cleaning > 3:
            recommendations.append(f"🧹 {cleaning} panels need cleaning")
        
        if not recommendations:
            recommendations.append("✅ No critical issues detected")
        
        print(f"✅ Video analysis complete: {analyzed_count} frames in {total_time:.1f}s")
        
        return jsonify({
            'frames': frames_results,
            'total_frames': analyzed_count,
            'total_video_frames': total_video_frames,
            'total_time': total_time,
            'video_duration': duration,
            'fps': fps,
            'model': 'YOLOv13-L + RT-DETR Pipeline',
            'summary': {
                'fault_distribution': all_fault_counts,
                'action_distribution': all_action_counts,
                'recommendations': recommendations
            }
        })
    
    except Exception as e:
        print(f"Error analyzing video: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/detect', methods=['POST'])
def detect_only():
    """Run detection only (Stage 1 YOLO only)."""
    if pipeline is None:
        return jsonify({'error': 'Pipeline not loaded'}), 500
    
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    
    try:
        image_pil = Image.open(file.stream).convert('RGB')
        image_np = np.array(image_pil)
        image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        
        start_time = time.time()
        
        # Run only Stage 1 (YOLO)
        detections = pipeline._run_stage1_yolo(image_bgr)
        
        inference_time = (time.time() - start_time) * 1000
        
        # Draw boxes
        annotated = image_bgr.copy()
        for det in detections:
            x1, y1, x2, y2 = map(int, det.bbox)
            color = (0, 255, 0) if det.class_id == 0 else (0, 0, 255)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            label = f"{det.class_name}: {det.confidence:.2f}"
            cv2.putText(annotated, label, (x1, y1-10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        
        return jsonify({
            'original_image': image_to_base64(image_np),
            'detection_image': image_to_base64(annotated),
            'detections': [
                {
                    'class_id': d.class_id,
                    'class_name': d.class_name,
                    'confidence': d.confidence,
                    'bbox': list(d.bbox)
                } for d in detections
            ],
            'inference_time': inference_time,
            'model': 'YOLOv13-L (Stage 1 Only)'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/', methods=['GET'])
def index():
    """Root endpoint - API info."""
    return jsonify({
        'name': 'PV Fault Detector API',
        'version': '2.0.0',
        'architecture': {
            'stage1': 'YOLOv13-L (Hypergraph-Enhanced) - Panel detection & defect check',
            'stage2': 'RT-DETR - Fault classification (Dust, Bird Drop, Snow, Shade)',
            'stage3': 'SAM3 - Precise segmentation masks'
        },
        'endpoints': {
            '/api/health': 'Health check with pipeline status',
            '/api/analyze': 'Full pipeline analysis (POST image)',
            '/api/analyze-video': 'Full pipeline video analysis (POST video)',
            '/api/detect': 'Stage 1 only - fast detection (POST image)'
        },
        'supported_formats': {
            'images': ['jpg', 'png', 'webp'],
            'videos': ['mp4', 'webm', 'mov', 'avi']
        }
    })


if __name__ == '__main__':
    load_pipeline()
    
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    
    print(f"\n🌐 Starting API server at http://{host}:{port}")
    print("=" * 60)
    
    app.run(host=host, port=port, debug=False, threaded=True)
