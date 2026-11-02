#!/usr/bin/env python3
"""
Mushir — Dataset Splitting, Annotation Validator & Preprocessor
Splits labeled footage into Train (70%), Val (20%), and Test (10%).

CRITICAL BLIND SAFETY RULE:
Splits by VIDEO / LOCATION SESSION, never random frame shuffle.
This ensures test evaluations measure generalization to completely unseen streets.

Usage:
    python scripts/prepare_dataset.py --source_dir datasets/labeled_sessions/ --output_dir datasets/mushir
    python scripts/prepare_dataset.py --validate datasets/mushir
"""

import os
import sys
import shutil
import random
import argparse
from pathlib import Path
from collections import defaultdict, Counter

MUSHIR_CLASSES = [
    "person",          # 0
    "auto_rickshaw",   # 1
    "two_wheeler",     # 2
    "car",             # 3
    "bus",             # 4
    "truck",           # 5
    "bicycle",         # 6
    "cattle",          # 7
    "stray_dog",       # 8
    "pole",            # 9
    "bollard",         # 10
    "pothole",         # 11
    "open_manhole",    # 12
    "stairs_down",     # 13
    "stairs_up",       # 14
    "curb",            # 15
    "barricade",       # 16
    "vendor_cart",     # 17
    "tree_branch",     # 18
    "traffic_light",   # 19
    "crosswalk"        # 20
]

SAFETY_CRITICAL_CLASSES = {
    "open_manhole": 12,
    "pothole": 11,
    "stairs_down": 13,
    "pole": 9,
    "auto_rickshaw": 1,
    "cattle": 7
}


def validate_yolo_labels(labels_file, num_classes=21):
    """
    Validates a YOLO format annotation file:
    Each line must be: <class_id> <x_center> <y_center> <width> <height>
    All values must be within valid normalized ranges [0.0, 1.0].
    """
    valid_boxes = []
    issues = []
    
    if not os.path.exists(labels_file):
        return valid_boxes, ["File does not exist"]

    with open(labels_file, "r") as f:
        for line_no, line in enumerate(f, 1):
            parts = line.strip().split()
            if not parts:
                continue
            if len(parts) != 5:
                issues.append(f"Line {line_no}: Expected 5 elements, found {len(parts)}")
                continue

            try:
                cls_id = int(parts[0])
                xc = float(parts[1])
                yc = float(parts[2])
                w = float(parts[3])
                h = float(parts[4])
            except ValueError:
                issues.append(f"Line {line_no}: Non-numeric value in box definition")
                continue

            if cls_id < 0 or cls_id >= num_classes:
                issues.append(f"Line {line_no}: Invalid class ID {cls_id} (allowed 0-{num_classes-1})")
                continue

            if not (0.0 <= xc <= 1.0 and 0.0 <= yc <= 1.0 and 0.0 < w <= 1.0 and 0.0 < h <= 1.0):
                issues.append(f"Line {line_no}: Coordinates out of range [0, 1]: ({xc}, {yc}, {w}, {h})")
                continue

            valid_boxes.append((cls_id, xc, yc, w, h))

    return valid_boxes, issues


def split_by_session(source_dir, output_dir, train_ratio=0.70, val_ratio=0.20, test_ratio=0.10, seed=42):
    """
    Splits video recording sessions into train, val, and test groups.
    Assumes images and labels are stored in subdirectories per video session, or have session prefixes.
    """
    source_dir = Path(source_dir)
    output_dir = Path(output_dir)
    random.seed(seed)

    # Prepare standard directory structure
    for split in ["train", "val", "test"]:
        (output_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (output_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    # Group image files by session prefix
    image_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    all_images = [p for p in source_dir.rglob("*") if p.suffix.lower() in image_extensions]

    if not all_images:
        print(f"[Warning] No image files found in {source_dir}")
        return

    # Group by session name (parent folder or filename prefix up to first underscore)
    session_map = defaultdict(list)
    for img_path in all_images:
        # If placed in session folders, use parent folder name; otherwise prefix
        if img_path.parent != source_dir:
            session_name = img_path.parent.name
        else:
            session_name = img_path.stem.split("_f")[0]
        session_map[session_name].append(img_path)

    sessions = list(session_map.keys())
    random.shuffle(sessions)
    print(f"Discovered {len(sessions)} distinct recording sessions ({len(all_images)} total images).")

    n_sessions = len(sessions)
    n_train = max(1, int(round(n_sessions * train_ratio)))
    n_val = max(1, int(round(n_sessions * val_ratio))) if n_sessions > 1 else 0

    train_sessions = set(sessions[:n_train])
    val_sessions = set(sessions[n_train:n_train + n_val])
    test_sessions = set(sessions[n_train + n_val:])

    if not test_sessions and n_sessions >= 3:
        test_sessions = {sessions[-1]}
        val_sessions.discard(sessions[-1])

    print(f"Session Allocation:")
    print(f"  Train sessions ({len(train_sessions)}): {', '.join(sorted(train_sessions))}")
    print(f"  Val sessions   ({len(val_sessions)}): {', '.join(sorted(val_sessions))}")
    print(f"  Test sessions  ({len(test_sessions)}): {', '.join(sorted(test_sessions))}")

    split_counts = Counter()
    class_counts = defaultdict(Counter)

    for session_name, images in session_map.items():
        if session_name in test_sessions:
            dest_split = "test"
        elif session_name in val_sessions:
            dest_split = "val"
        else:
            dest_split = "train"

        for img_path in images:
            # Find matching label file (.txt)
            label_path = img_path.with_suffix(".txt")
            if not label_path.exists():
                # Check parallel labels directory
                alt_label = Path(str(img_path).replace("images", "labels")).with_suffix(".txt")
                if alt_label.exists():
                    label_path = alt_label

            dest_img = output_dir / "images" / dest_split / img_path.name
            dest_lbl = output_dir / "labels" / dest_split / f"{img_path.stem}.txt"

            shutil.copy2(img_path, dest_img)
            split_counts[dest_split] += 1

            if label_path.exists():
                shutil.copy2(label_path, dest_lbl)
                boxes, _ = validate_yolo_labels(label_path, len(MUSHIR_CLASSES))
                for (cls_id, _, _, _, _) in boxes:
                    class_name = MUSHIR_CLASSES[cls_id]
                    class_counts[dest_split][class_name] += 1
            else:
                # Negative background sample (no obstacles)
                dest_lbl.touch()

    print("\n[Split Summary]")
    for split in ["train", "val", "test"]:
        print(f"  {split.upper()}: {split_counts[split]} images")

    print("\n[Class Instance Distribution in Train Split]")
    for idx, name in enumerate(MUSHIR_CLASSES):
        cnt = class_counts["train"][name]
        is_crit = name in SAFETY_CRITICAL_CLASSES
        flag = " [CRITICAL]" if is_crit else ""
        print(f"  {idx:2d}: {name:<16} - {cnt:4d} instances{flag}")

    print("\nDataset preparation complete in:", output_dir)


def validate_existing_dataset(dataset_dir):
    """
    Validates an existing dataset directory structure and prints class diagnostics.
    """
    dataset_dir = Path(dataset_dir)
    print(f"\nValidating dataset at: {dataset_dir}")

    total_images = 0
    total_labels = 0
    class_counter = Counter()

    for split in ["train", "val", "test"]:
        img_dir = dataset_dir / "images" / split
        lbl_dir = dataset_dir / "labels" / split

        imgs = list(img_dir.glob("*.*")) if img_dir.exists() else []
        lbls = list(lbl_dir.glob("*.txt")) if lbl_dir.exists() else []

        print(f"  Split '{split}': {len(imgs)} images, {len(lbls)} label files")
        total_images += len(imgs)
        total_labels += len(lbls)

        for l in lbls:
            boxes, issues = validate_yolo_labels(l, len(MUSHIR_CLASSES))
            for (c, _, _, _, _) in boxes:
                class_counter[MUSHIR_CLASSES[c]] += 1

    print(f"\nTotal: {total_images} images across all splits.")
    print("\nClass Coverage Health Check:")
    for name, c_id in SAFETY_CRITICAL_CLASSES.items():
        cnt = class_counter[name]
        status = "OK" if cnt >= 50 else ("LOW - Collect more samples" if cnt > 0 else "MISSING - Add training footage!")
        print(f"  {name:<16} (class {c_id:2d}): {cnt:5d} boxes -> {status}")


def main():
    parser = argparse.ArgumentParser(description="Mushir Dataset Splitter & Validator")
    parser.add_argument("--source_dir", type=str, help="Source directory containing labeled walking footage")
    parser.add_argument("--output_dir", type=str, default="datasets/mushir", help="Destination YOLO dataset directory")
    parser.add_argument("--validate", type=str, help="Validate an existing YOLO dataset folder")
    parser.add_argument("--train_ratio", type=float, default=0.70, help="Train split proportion (default: 0.70)")
    parser.add_argument("--val_ratio", type=float, default=0.20, help="Val split proportion (default: 0.20)")
    parser.add_argument("--test_ratio", type=float, default=0.10, help="Test split proportion (default: 0.10)")

    args = parser.parse_args()

    if args.validate:
        validate_existing_dataset(args.validate)
    elif args.source_dir:
        split_by_session(args.source_dir, args.output_dir, args.train_ratio, args.val_ratio, args.test_ratio)
    else:
        # Default run: validate datasets/mushir
        validate_existing_dataset("datasets/mushir")


if __name__ == "__main__":
    main()
