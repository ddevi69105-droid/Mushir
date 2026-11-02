# Mushir 1-Click Cloud Training Notebook

If your local computer does not have a dedicated NVIDIA GPU, you can train and export Mushir models for **free** on Google Colab or Kaggle.

## How to Run:
1. Open [Google Colab](https://colab.research.google.com/).
2. Select **File > Upload Notebook** and select [`Mushir_YOLO_Training_Colab.ipynb`](./Mushir_YOLO_Training_Colab.ipynb).
3. In the top menu, go to **Runtime > Change runtime type** and select **T4 GPU** (free tier).
4. Run each cell step by step.
5. In Step 8, Colab will automatically download the exported `mushir_yolov8n.tflite` file directly to your downloads folder!
6. Copy that `.tflite` file into `flutter_app/assets/models/mushir_yolov8n.tflite`.
