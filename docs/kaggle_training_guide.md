# How to Train Mushir on Kaggle.com (Free GPU Tutorial)

Kaggle provides **30 hours per week of free NVIDIA GPU compute** (Dual Tesla T4 or P100 GPUs), which is ideal for training and fine-tuning Mushir's 21-class Indian Footpath & Mobility Hazard model.

---

## ⚡ Prerequisites on Kaggle
1. Sign in to your account at [kaggle.com](https://www.kaggle.com/).
2. **Verify your phone number** (Kaggle requires one-time SMS verification to unlock the free GPU and Internet access):
   - Go to your Profile > **Settings** > **Phone verification**.

---

## Step-by-Step Training Walkthrough

### 1. Create a New Notebook
1. Go to [kaggle.com/code](https://www.kaggle.com/code).
2. Click the **"New Notebook"** button in the top right.

---

### 2. Configure Kaggle GPU & Internet (Crucial!)
In the right-hand **Notebook options** sidebar:

1. **Accelerator**:
   - Click **None** → Select **GPU T4 x 2** (or **GPU P100**).
2. **Internet**:
   - Toggle to **Internet ON** (Required to download Ultralytics and clone your GitHub repository).

> 💡 *Note: If Internet toggle is greyed out, make sure your phone number is verified in Kaggle Settings.*

---

### 3. Upload the Mushir Training Notebook
1. In the top notebook menu, click **File** > **Import Notebook**.
2. Upload the file [`notebooks/Mushir_YOLO_Training_Kaggle.ipynb`](../notebooks/Mushir_YOLO_Training_Kaggle.ipynb) from your local project.

Alternatively, if creating from scratch, you can copy-paste the cells from the notebook directly.

---

### 4. Run the Pipeline Cells

#### Cell 1: Check GPU Acceleration
```bash
!nvidia-smi
```
*Confirms that your Tesla T4 or P100 GPU is active.*

#### Cell 2: Install Ultralytics
```bash
!pip install -q ultralytics roboflow opencv-python-headless
```

#### Cell 3: Clone Mushir Repository into Kaggle
```python
!git clone https://github.com/ddevi69105-droid/Mushir.git /kaggle/working/Mushir
%cd /kaggle/working/Mushir
```

#### Cell 4: Validate Dataset & Classes
```bash
!python scripts/prepare_dataset.py --validate datasets/mushir
```

#### Cell 5: Train YOLOv8n on Kaggle GPU
```python
from ultralytics import YOLO
import torch

device = 0 if torch.cuda.is_available() else 'cpu'
model = YOLO('yolov8n.pt')

results = model.train(
    data='/kaggle/working/Mushir/datasets/mushir.yaml',
    epochs=80,
    imgsz=640,
    batch=16,
    device=device,
    # Augmentations for walking camera tilt, glare, and street clutter
    degrees=7.0,
    translate=0.1,
    scale=0.35,
    perspective=0.0004,
    fliplr=0.5,
    mosaic=0.8,
    hsv_h=0.015,
    hsv_s=0.6,
    hsv_v=0.4,
    project='/kaggle/working/runs/detect',
    name='mushir_kaggle',
    save=True
)
```
*Training 80 epochs takes approximately 15 to 25 minutes on Kaggle T4 GPU.*

#### Cell 6: Check Safety-Critical Hazard Metrics
```bash
!yolo detect val model=/kaggle/working/runs/detect/mushir_kaggle/weights/best.pt data=/kaggle/working/Mushir/datasets/mushir.yaml split=test
```
*Inspect recall specifically for:*
- `open_manhole` (class 12)
- `pothole` (class 11)
- `stairs_down` (class 13)
- `pole` (class 9)
- `auto_rickshaw` (class 1)

#### Cell 7: Export to INT8 Quantized TFLite
```python
best_weights = '/kaggle/working/runs/detect/mushir_kaggle/weights/best.pt'
trained_model = YOLO(best_weights)
trained_model.export(format='tflite', imgsz=640, int8=True, nms=False)
```

#### Cell 8: Download Model File
```python
import shutil, glob
from IPython.display import FileLink, display

tflite_candidates = glob.glob('/kaggle/working/runs/detect/mushir_kaggle/weights/*tflite*/*.tflite')
if tflite_candidates:
    shutil.copy2(tflite_candidates[0], '/kaggle/working/mushir_yolov8n.tflite')
    display(FileLink('mushir_yolov8n.tflite'))
```

---

### 5. How to Download the Trained `.tflite` File from Kaggle

You have two easy ways to download your model:
1. **Direct Link**: Click the clickable download link generated in the last notebook cell.
2. **Kaggle Output Panel**:
   - In the right-hand sidebar, look at the **Output** tab.
   - Click on the `...` menu next to **`mushir_yolov8n.tflite`**.
   - Click **Download**.

---

### 6. Put the Model into Your Flutter App

1. Copy the downloaded `mushir_yolov8n.tflite` into your project at:
   ```
   flutter_app/assets/models/mushir_yolov8n.tflite
   ```
2. Connect your Android phone and run:
   ```bash
   cd flutter_app
   flutter run --release
   ```
Mushir will automatically load your new fine-tuned model and start real-time detection on the live camera stream!
