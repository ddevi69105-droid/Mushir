# Mushir Dataset Directory Structure

This folder contains walking-height dataset splits for training and fine-tuning Mushir's vision models.

## Folder Organization
```
datasets/mushir/
├── mushir.yaml          # YOLOv8 / YOLO11 dataset manifest
├── images/
│   ├── train/          # 70% of video footage frames
│   ├── val/            # 20% of video footage frames
│   └── test/           # 10% completely unseen location test frames
└── labels/
    ├── train/          # Normalized YOLO txt annotations (class x_center y_center w h)
    ├── val/
    └── test/
```

## Recommended Collection Guidelines
1. **Camera Position**: Chest-height or hand-held at waist level, tilted ~10-15° down towards the footpath.
2. **Video Splitting Rule**: Split by **entire video / street location**, NEVER random frame shuffling.
3. **Safety Critical Labels**: Ensure `open_manhole`, `pothole`, `stairs_down`, `pole`, and `auto_rickshaw` have balanced representation.
