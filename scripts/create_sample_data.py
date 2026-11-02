#!/usr/bin/env python3
"""
Mushir — Synthetic Walking Frame & Annotation Starter Generator
Creates initial synthetic test samples for all 21 Indian mobility hazard classes
to verify dataset pipelines, annotations, and training configs without external downloads.
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw

MUSHIR_CLASSES = [
    "person", "auto_rickshaw", "two_wheeler", "car", "bus", "truck", "bicycle",
    "cattle", "stray_dog", "pole", "bollard", "pothole", "open_manhole",
    "stairs_down", "stairs_up", "curb", "barricade", "vendor_cart", "tree_branch",
    "traffic_light", "crosswalk"
]

def generate_sample_session(output_dir="datasets/mushir", session_name="session_dehradun_walk01"):
    output_dir = Path(output_dir)
    
    samples = [
        # (split, filename, [(class_id, xc, yc, w, h), ...], scene_color)
        ("train", f"{session_name}_f000010", [(0, 0.45, 0.50, 0.22, 0.65), (9, 0.82, 0.40, 0.08, 0.75)], (180, 180, 175)),
        ("train", f"{session_name}_f000020", [(1, 0.60, 0.55, 0.35, 0.50), (11, 0.35, 0.85, 0.20, 0.12)], (170, 175, 170)),
        ("train", f"{session_name}_f000030", [(7, 0.30, 0.60, 0.30, 0.45), (12, 0.50, 0.88, 0.18, 0.10)], (165, 170, 165)),
        ("val",   f"session_dehradun_val01_f000005", [(17, 0.70, 0.52, 0.32, 0.55), (15, 0.15, 0.90, 0.25, 0.08)], (190, 185, 180)),
        ("val",   f"session_dehradun_val01_f000015", [(2, 0.55, 0.58, 0.22, 0.45), (16, 0.25, 0.65, 0.28, 0.40)], (175, 180, 185)),
        ("test",  f"session_dehradun_test_unseen_f000001", [(13, 0.50, 0.82, 0.40, 0.22), (0, 0.25, 0.48, 0.18, 0.60)], (160, 160, 165)),
    ]

    for split, stem, boxes, bg_color in samples:
        img_dir = output_dir / "images" / split
        lbl_dir = output_dir / "labels" / split
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)

        # Draw 640x640 frame
        img = Image.new("RGB", (640, 640), color=bg_color)
        draw = ImageDraw.Draw(img)

        # Draw sidewalk / horizon simulation
        draw.rectangle([(0, 420), (640, 640)], fill=(120, 120, 120)) # Footpath paving
        draw.line([(0, 420), (640, 420)], fill=(90, 90, 90), width=3) # Curb edge

        # Write labels file
        lbl_lines = []
        for (cid, xc, yc, w, h) in boxes:
            lbl_lines.append(f"{cid} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}\n")
            # Draw visual box on image for human inspection
            x1 = int((xc - w/2) * 640)
            y1 = int((yc - h/2) * 640)
            x2 = int((xc + w/2) * 640)
            y2 = int((yc + h/2) * 640)
            draw.rectangle([x1, y1, x2, y2], outline=(0, 255, 0), width=2)
            draw.text((x1 + 4, y1 + 4), MUSHIR_CLASSES[cid], fill=(255, 255, 0))

        img.save(img_dir / f"{stem}.jpg", quality=95)
        with open(lbl_dir / f"{stem}.txt", "w") as f:
            f.writelines(lbl_lines)

    print(f"Generated sample dataset in {output_dir}")

if __name__ == "__main__":
    generate_sample_session()
