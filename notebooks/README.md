# Mushir 1-Click Cloud Training Notebooks (Free GPUs)

If your local computer does not have a dedicated NVIDIA GPU, you can train and export Mushir models for **free** on **Kaggle** (30 hours/week) or **Google Colab**.

---

## 🏆 Option 1: Kaggle.com (Recommended — 30 Hours Free GPU)
*Full guide:* [docs/kaggle_training_guide.md](../docs/kaggle_training_guide.md)

1. Open [kaggle.com/code](https://www.kaggle.com/code) and click **New Notebook**.
2. Go to **File > Import Notebook** and upload [`Mushir_YOLO_Training_Kaggle.ipynb`](./Mushir_YOLO_Training_Kaggle.ipynb).
3. In the right-hand **Notebook options** sidebar:
   - **Accelerator**: Select **GPU T4 x 2** (Dual GPU) or **GPU P100**.
   - **Internet**: Switch to **On**.
4. Click **Run All** (or run cells step-by-step).
5. At the final step, click the generated download link or download `mushir_yolov8n.tflite` from the **Output** panel on the right.
6. Copy `mushir_yolov8n.tflite` to `flutter_app/assets/models/mushir_yolov8n.tflite`.

---

## 🚀 Option 2: Google Colab
1. Open [Google Colab](https://colab.research.google.com/).
2. Select **File > Upload Notebook** and upload [`Mushir_YOLO_Training_Colab.ipynb`](./Mushir_YOLO_Training_Colab.ipynb).
3. Go to **Runtime > Change runtime type** and select **T4 GPU**.
4. Run each cell sequentially. The final cell downloads the model directly to your browser.

