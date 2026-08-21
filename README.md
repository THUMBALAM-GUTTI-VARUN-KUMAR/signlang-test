# Sign Language To Text and Speech Conversion (SignAI Studio)

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange.svg)](https://tensorflow.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-brightgreen.svg)](https://google.github.io/mediapipe/)
[![Flask](https://img.shields.io/badge/Flask-Web%20App-lightgrey.svg)](https://flask.palletsprojects.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📌 Abstract

Sign language is one of the oldest and most natural forms of communication for deaf and mute individuals. This project delivers a **real-time, zero-lag neural pipeline** using MediaPipe and Convolutional Neural Networks (CNN) for American Sign Language (ASL) gesture recognition, continuous sentence construction, and two-way speech-to-sign conversion.

By converting 21-point MediaPipe hand landmark coordinates into normalized skeletal vectors, the system achieves invariant recognition across any background and lighting conditions with **over 97% accuracy**.

---

## ✨ Key Features

### 1. ⚡ 30+ FPS Zero-Lag Neural Engine
- Decoupled asynchronous worker thread separating real-time camera streaming from deep learning inference.
- Graph-level direct tensor evaluations executing under 80ms per frame.
- Immediate no-hand reset protection to eliminate ghost predictions when hands leave camera view.

### 2. 🤟 Dual Recognition Modes
- **⚡ One-Gesture Direct Full-Word Mode**: Show single static gestures to instantly recognize full words (e.g. `🤟 I LOVE YOU`, `👋 HELLO`, `💧 WATER`, `👍 GOOD`, `✌️ PEACE`, `👌 OK`, `🤙 CALL ME`, `🛑 STOP`, `👉 YOU`) with automatic voice synthesis.
- **🔤 Alphabet Fingerspelling Mode**: Real-time A–Z classification with PyEnchant smart dictionary suggestions and autocorrect.

### 3. 📖 Words & Phrases Studio (50+ Words)
- Comprehensive educational database categorized into *Greetings, Essentials, Food & Drink, Daily Life, Feelings, and Questions*.
- **Detailed Meanings & Definitions**: Linguistic breakdown of each word.
- **Step-by-Step Hand Mechanics**: Explicit directions for handshape, palm orientation, location, and movement.
- **Example Context & Sentences**: Real-world communication dialogues.
- **Facial Grammar & Cultural Notes**: ASL non-manual markers (eyebrow positioning, head tilts).

### 4. 🎯 Interactive Live Camera Word Practice HUD
- Step-by-step checklist with real-time camera scoring and letter checkmarks.
- Dynamic progress bar, live tips, and completion celebrations.

### 5. 💬 Two-Way Live Conversation Dialog
- Multi-turn communication thread between deaf signers (camera sign ➔ spoken audio) and hearing individuals (voice / text ➔ animated vector hand gestures).

### 6. 🖐️ Vector 21-Point Skeletal Hand Player
- Smooth HTML5 Canvas animation engine with timeline scrubber and adjustable playback speeds (0.5x – 2.0x).

---

## 📸 System Architecture & Methodology

### 1. MediaPipe 21-Point Hand Landmark Detection
Landmarks are captured from the webcam ROI and drawn onto a normalized 400x400 white canvas to eliminate background noise:

![MediaPipe Landmarks](https://user-images.githubusercontent.com/99630855/201489741-3649959e-df4d-4c32-898a-8f994be92ca2.png)

```
       8   12  16  20  (Fingertips)
       |   |   |   |
   4   7   11  15  19
    \  |   |   |   |
     3 6   10  14  18
      \|   |   |   |
       2   5---9---13--17 (Knuckles)
        \ /
         1
         |
         0 (Wrist)
```

### 2. Gesture Classification Pipeline
1. **MediaPipe Hand Tracking**: Extracts 21 3D coordinates.
2. **ROI Normalization**: Bounding box centering and coordinate scaling.
3. **CNN Feature Classifier**: Multi-layer Convolutional Neural Network trained on skeleton images.
4. **Direct Heuristic Solver**: High-precision geometric distance and angle computation for instant one-shot gestures.
5. **Speech Synthesis**: Real-time Web Speech API + `pyttsx3` text-to-speech.

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.9 or higher
- Webcam

### 1. Clone the Repository
```bash
git clone https://github.com/THUMBALAM-GUTTI-VARUN-KUMAR/signlang-test.git
cd signlang-test
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
# or install core packages:
pip install flask opencv-python mediapipe tensorflow keras pyttsx3 pyenchant cvzone
```

### 3. Run the Web Application
```bash
python app.py
```

### 4. Open in Browser
Visit **[http://localhost:5000](http://localhost:5000)** in Google Chrome, Edge, or Firefox.

---

## 📊 System Flowchart

![System Flowchart](https://user-images.githubusercontent.com/99630855/201490238-224f65aa-071f-473a-8c23-a9d60e0a47d8.png)

---

## 🛠️ Tech Stack
- **Backend**: Python 3, Flask, OpenCV, MediaPipe, TensorFlow/Keras, Pyttsx3, PyEnchant
- **Frontend**: HTML5, Vanilla CSS3 (Glassmorphic Design), JavaScript (ES6+), HTML5 Canvas, Web Speech API
- **Model**: Custom CNN (`cnn8grps_rad1_model.h5`) + 21-Landmark Geometric Classifier

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
