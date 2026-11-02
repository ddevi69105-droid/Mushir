#!/usr/bin/env python3
"""
Mushir — TFLite Model Exporter for Flutter Android Deployment
Converts PyTorch YOLO weights into optimized INT8 / Float32 TFLite format
and automatically copies the artifacts into flutter_app/assets/models/ and labels/.

Usage:
    python scripts/export_tflite.py --weights runs/detect/mushir/weights/best.pt
    python scripts/export_tflite.py --weights yolov8n.pt --int8
"""

import os
import sys
import shutil
import argparse
from pathlib import Path


def export_model_to_tflite(weights_path, imgsz=640, int8=False, flutter_assets_dir="flutter_app/assets"):
    weights_path = Path(weights_path)
    if not weights_path.exists():
        print(f"[Error] Weights file not found: {weights_path}")
        return False

    try:
        from ultralytics import YOLO
    except ImportError:
        print("[Error] 'ultralytics' is required for TFLite export.")
        print("Install via: pip install ultralytics")
        return False

    print("==================================================")
    print("Mushir TFLite Mobile Model Exporter")
    print(f"Source weights: {weights_path}")
    print(f"Target size   : {imgsz}x{imgsz}")
    print(f"INT8 Quantized: {int8}")
    print("==================================================")

    model = YOLO(str(weights_path))

    # Export to TFLite
    print("\nStarting export (this converts PyTorch -> ONNX -> TF -> TFLite)...")
    exported_path = model.export(
        format="tflite",
        imgsz=imgsz,
        int8=int8,
        nms=False  # NMS is processed natively in Dart for low-latency spatial zones
    )

    exported_path = Path(exported_path)
    print(f"\nExport complete: {exported_path}")

    # Copy into Flutter Assets
    flutter_models_dir = Path(flutter_assets_dir) / "models"
    flutter_labels_dir = Path(flutter_assets_dir) / "labels"
    flutter_models_dir.mkdir(parents=True, exist_ok=True)
    flutter_labels_dir.mkdir(parents=True, exist_ok=True)

    dest_tflite = flutter_models_dir / "mushir_yolov8n.tflite"

    # If exported_path is a directory containing the .tflite, locate it
    if exported_path.is_dir():
        tflite_candidates = list(exported_path.glob("*.tflite"))
        if tflite_candidates:
            shutil.copy2(tflite_candidates[0], dest_tflite)
        else:
            print(f"[Warning] No .tflite file found in directory {exported_path}")
            return False
    else:
        shutil.copy2(exported_path, dest_tflite)

    print(f"Deployed model to Flutter: {dest_tflite} ({dest_tflite.stat().st_size / (1024*1024):.2f} MB)")

    # Export label map
    dest_labels = flutter_labels_dir / "mushir_labels.txt"
    class_names = model.names
    with open(dest_labels, "w", encoding="utf-8") as f:
        for idx in range(len(class_names)):
            f.write(f"{class_names[idx]}\n")

    print(f"Deployed label map to Flutter: {dest_labels} ({len(class_names)} classes)")
    print("\nReady! Launch Flutter app with: cd flutter_app && flutter run")
    return True


def main():
    parser = argparse.ArgumentParser(description="Export Mushir YOLO Model to TFLite for Flutter")
    parser.add_argument("--weights", type=str, default="yolov8n.pt", help="Path to .pt weights file")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference resolution (default: 640)")
    parser.add_argument("--int8", action="store_true", help="Enable INT8 quantization for maximum mobile CPU speed")
    parser.add_argument("--flutter_assets", type=str, default="flutter_app/assets", help="Flutter assets directory")

    args = parser.parse_args()
    export_model_to_tflite(args.weights, args.imgsz, args.int8, args.flutter_assets)


if __name__ == "__main__":
    main()
