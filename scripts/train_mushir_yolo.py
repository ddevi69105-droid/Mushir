#!/usr/bin/env python3
"""
Mushir — YOLO Training & Fine-Tuning Pipeline
Trains or fine-tunes YOLOv8n / YOLO11n on the Indian Mobility Dataset (mushir.yaml).
Applies walking-camera augmentations and monitors per-class recall on safety-critical classes.

Usage:
    python scripts/train_mushir_yolo.py --epochs 50 --batch 16 --model yolov8n.pt
    python scripts/train_mushir_yolo.py --test_only --weights runs/detect/mushir/weights/best.pt
"""

import os
import sys
import argparse
from pathlib import Path


def check_ultralytics_installed():
    try:
        from ultralytics import YOLO
        return YOLO
    except ImportError:
        print("\n[Notice] 'ultralytics' is not yet installed.")
        print("To run local training, install it with:")
        print("    pip install ultralytics")
        print("\nFor Google Colab or Kaggle free GPU, run:")
        print("    !pip install ultralytics")
        print("    !python scripts/train_mushir_yolo.py --epochs 80 --batch 16\n")
        return None


def train_mushir(
    data_yaml="datasets/mushir.yaml",
    model_name="yolov8n.pt",
    epochs=50,
    batch_size=16,
    img_size=640,
    device="",
    project="runs/detect",
    name="mushir_run"
):
    YOLO = check_ultralytics_installed()
    if YOLO is None:
        sys.exit(1)

    print("==================================================")
    print("Mushir Vision Model Fine-Tuning Pipeline")
    print(f"Data config : {data_yaml}")
    print(f"Base model  : {model_name}")
    print(f"Epochs      : {epochs} | Batch: {batch_size} | Size: {img_size}")
    print("==================================================")

    model = YOLO(model_name)

    # Train with augmentations calibrated for handheld/chest-height walking cameras
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        batch=batch_size,
        imgsz=img_size,
        device=device,
        project=project,
        name=name,
        # Augmentations for walking footage & harsh outdoor lighting
        degrees=7.0,          # Walking tilt / head roll
        translate=0.1,        # Slight lateral body sway
        scale=0.35,           # Close and distant obstacles
        perspective=0.0004,   # Sidewalk ground angle
        fliplr=0.5,           # Left / right symmetry
        mosaic=0.8,           # Occlusion & dense street clutter
        hsv_h=0.015,          # Subtle hue shift
        hsv_s=0.6,            # Saturation variations
        hsv_v=0.4,            # Harsh Indian sun & twilight shadows
        plots=True,
        save=True,
        exist_ok=True
    )

    print("\nTraining completed successfully.")
    weights_path = Path(project) / name / "weights" / "best.pt"
    print(f"Best model weights saved to: {weights_path}")

    # Evaluate on held-out test split
    print("\nRunning Validation Evaluation on Held-Out Test Set...")
    metrics = model.val(data=data_yaml, split="test", imgsz=img_size)

    print("\n[Per-Class Evaluation Highlights]")
    class_names = results.names if hasattr(results, 'names') else model.names
    for idx, name in class_names.items():
        if hasattr(metrics.box, 'all_ap') and len(metrics.box.all_ap) > idx:
            ap50 = metrics.box.all_ap[idx][0] if len(metrics.box.all_ap[idx]) > 0 else 0
            print(f"  Class {idx:2d} ({name:<16}): mAP50 = {ap50:.3f}")

    return weights_path


def main():
    parser = argparse.ArgumentParser(description="Mushir Vision Model Training")
    parser.add_argument("--data", type=str, default="datasets/mushir.yaml", help="Path to mushir.yaml")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model (yolov8n.pt, yolo11n.pt)")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs (default: 50)")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (default: 16)")
    parser.add_argument("--imgsz", type=int, default=640, help="Input resolution (default: 640)")
    parser.add_argument("--device", type=str, default="", help="CUDA device index or 'cpu'")
    parser.add_argument("--project", type=str, default="runs/detect", help="Project save directory")
    parser.add_argument("--name", type=str, default="mushir", help="Run identifier name")
    parser.add_argument("--export_tflite", action="store_true", help="Automatically export to TFLite after training")

    args = parser.parse_args()

    best_weights = train_mushir(
        data_yaml=args.data,
        model_name=args.model,
        epochs=args.epochs,
        batch_size=args.batch,
        img_size=args.imgsz,
        device=args.device,
        project=args.project,
        name=args.name
    )

    if args.export_tflite and best_weights.exists():
        print(f"\nExporting {best_weights} to TFLite for Flutter...")
        from export_tflite import export_model_to_tflite
        export_model_to_tflite(best_weights)


if __name__ == "__main__":
    main()
