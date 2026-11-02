#!/usr/bin/env python3
"""
Mushir — Video Frame Extractor & Preprocessor for Walking Datasets
Extracts clean, walking-height frames from mobile phone videos at a configurable FPS.
Includes automatic blur detection to filter out excessive walking shake.

Usage:
    python scripts/extract_frames.py --video path/to/walking_walk.mp4 --output_dir datasets/raw_frames/walk_01
    python scripts/extract_frames.py --video_dir path/to/videos/ --output_dir datasets/raw_frames/
"""

import os
import sys
import argparse
import glob
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError:
    print("Error: opencv-python is required. Install via: pip install opencv-python numpy")
    sys.exit(1)


def is_frame_blurry(image, threshold=60.0):
    """
    Computes Laplacian variance to estimate frame focus/sharpness.
    Walking footage with excessive shake will fall below threshold.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return variance < threshold, variance


def extract_frames_from_video(video_path, output_dir, fps=2, min_blur_score=50.0, save_blurry=False):
    """
    Extracts frames from a video at target fps and saves to output directory.
    """
    video_path = Path(video_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    blurry_dir = output_dir / "blurry_discarded"
    if save_blurry:
        blurry_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"[Error] Failed to open video file: {video_path}")
        return 0, 0

    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0 or np.isnan(video_fps):
        video_fps = 30.0

    frame_interval = max(1, int(round(video_fps / fps)))
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    video_stem = video_path.stem.replace(" ", "_")
    print(f"\nProcessing '{video_path.name}': {total_video_frames} frames @ {video_fps:.1f} fps")
    print(f"Sampling every {frame_interval} frames (target: ~{fps} fps)...")

    frame_idx = 0
    saved_count = 0
    blurry_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            blurry, score = is_frame_blurry(frame, threshold=min_blur_score)
            time_sec = frame_idx / video_fps
            filename = f"{video_stem}_f{frame_idx:06d}_t{time_sec:.1f}s.jpg"

            if blurry:
                blurry_count += 1
                if save_blurry:
                    cv2.imwrite(str(blurry_dir / filename), frame)
            else:
                out_path = output_dir / filename
                cv2.imwrite(str(out_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
                saved_count += 1

        frame_idx += 1

    cap.release()
    print(f"Done: Saved {saved_count} sharp frames ({blurry_count} discarded for motion blur) to {output_dir}")
    return saved_count, blurry_count


def main():
    parser = argparse.ArgumentParser(description="Mushir Walking Video Frame Extractor")
    parser.add_argument("--video", type=str, help="Path to single video file (.mp4, .mov, .mkv)")
    parser.add_argument("--video_dir", type=str, help="Directory containing multiple walking videos")
    parser.add_argument("--output_dir", type=str, default="datasets/raw_frames", help="Output directory for extracted frames")
    parser.add_argument("--fps", type=float, default=2.0, help="Target extraction frames per second (default: 2.0)")
    parser.add_argument("--min_blur_score", type=float, default=50.0, help="Laplacian variance threshold for blur rejection (default: 50.0)")
    parser.add_argument("--save_blurry", action="store_true", help="Save blurry discarded frames into a subfolder for inspection")

    args = parser.parse_args()

    if not args.video and not args.video_dir:
        parser.print_help()
        print("\nPlease specify either --video or --video_dir")
        sys.exit(1)

    total_saved = 0
    total_blurry = 0

    if args.video:
        s, b = extract_frames_from_video(args.video, args.output_dir, args.fps, args.min_blur_score, args.save_blurry)
        total_saved += s
        total_blurry += b
    elif args.video_dir:
        extensions = ["*.mp4", "*.mov", "*.mkv", "*.avi", "*.MP4", "*.MOV"]
        video_files = []
        for ext in extensions:
            video_files.extend(glob.glob(os.path.join(args.video_dir, ext)))

        if not video_files:
            print(f"No video files found in {args.video_dir}")
            sys.exit(1)

        print(f"Found {len(video_files)} videos in {args.video_dir}")
        for v in video_files:
            session_out = os.path.join(args.output_dir, Path(v).stem)
            s, b = extract_frames_from_video(v, session_out, args.fps, args.min_blur_score, args.save_blurry)
            total_saved += s
            total_blurry += b

    print(f"\n==========================================")
    print(f"Summary: Extracted {total_saved} total frames for labeling.")
    print(f"Next Step: Label bounding boxes using CVAT, Roboflow, or Label Studio")
    print(f"==========================================")


if __name__ == "__main__":
    main()
