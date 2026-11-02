# Mushir On-Device TFLite Model Directory

This directory holds the quantized TensorFlow Lite (`.tflite`) model used for real-time camera object detection and obstacle hazard analysis on Android phones.

## Model Specifications:
- **Architecture**: YOLOv8n / YOLO11n (Ultralytics Nano Detector)
- **Input Dimensions**: `[1, 640, 640, 3]` (RGB Float32 normalized 0..1 or INT8)
- **Output Dimensions**: `[1, 25, 8400]` (4 bounding box coordinates + 21 class probabilities across 8400 anchor candidates)
- **Quantization**: INT8 post-training quantization for optimal 15-30 FPS performance on Snapdragon 600+ / MediaTek Helio G-series mobile processors.

## How to Deploy Your Own Trained Weights:
1. Train with your custom walking footage:
   ```bash
   python scripts/train_mushir_yolo.py --epochs 80 --batch 16
   ```
2. Export directly into this directory:
   ```bash
   python scripts/export_tflite.py --weights runs/detect/mushir/weights/best.pt --int8
   ```
3. The script automatically updates `flutter_app/assets/models/mushir_yolov8n.tflite` and `flutter_app/assets/labels/mushir_labels.txt`.
