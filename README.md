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

## 🖐️ Hand Gestures Guide & Mechanics

### 1. ⚡ One-Gesture Direct Full-Word Signs
In **One-Gesture Word Mode**, holding any of the following gestures in front of the camera for 1 second will immediately output the full word, speak it aloud, and append it to your sentence:

| Sign | Emoji | Word | Hand Mechanics & Gesture Execution |
| :--- | :---: | :--- | :--- |
| **I Love You** | 🤟 | `I LOVE YOU` | Extend **Thumb, Index, and Pinky** fingers up; keep Middle and Ring fingers curled down. |
| **Hello** | 👋 | `HELLO` | Open **5-finger palm** facing forward upright with fingers spread and thumb extended. |
| **Good / Awesome** | 👍 | `GOOD` | Make a closed fist with **Thumb pointing straight upward**. |
| **Bad** | 👎 | `BAD` | Make a closed fist with **Thumb pointing straight downward**. |
| **Peace / Victory** | ✌️ | `PEACE` | Extend **Index and Middle fingers** in a separated 'V' shape; curl other fingers. |
| **OK / Perfect** | 👌 | `OK` | Touch **Thumb tip to Index tip** forming a circle; extend Middle, Ring, and Pinky fingers upward. |
| **Call Me** | 🤙 | `CALL ME` | Extend **Thumb and Pinky** outwards (Shaka sign); keep 3 middle fingers curled. |
| **Water** | 💧 | `WATER` | Extend **Index, Middle, and Ring fingers** in a 'W' shape; hold Thumb over Pinky. |
| **Stop** | 🛑 | `STOP` | Extend **4 fingers flat upright** together with thumb folded against palm. |
| **You** | 👉 | `YOU` | Extend **Index finger straight forward/outward**; keep all other fingers folded. |
| **Rock On** | 🤘 | `ROCK ON` | Extend **Index and Pinky** fingers upright; fold Thumb across Middle and Ring fingers. |
| **Yes** | ✊ | `YES` | Form a **closed fist** facing forward; nod fist slightly downward. |
| **No** | 🤏 | `NO` | Snap **Index and Middle fingers together against Thumb** in a quick pinch gesture. |

---

### 2. 🔤 ASL Alphabet Fingerspelling (A – Z)
In **Alphabet Spelling Mode**, the system classifies the standard 26 ASL alphabet handshapes in real-time:

| Letter | Handshape & Description | Letter | Handshape & Description |
| :---: | :--- | :---: | :--- |
| **A** | Closed fist with thumb resting alongside index finger. | **N** | Fist with thumb tucked under index and middle fingers. |
| **B** | Flat open hand with 4 fingers straight up, thumb across palm. | **O** | All fingers curved touching thumb tip, forming an 'O' circle. |
| **C** | Curved hand forming a 'C' shape facing sideways. | **P** | 'K' shape pointing downward with middle finger horizontal. |
| **D** | Index finger pointing straight up, other fingers touch thumb. | **Q** | 'G' shape pointing downward with thumb and index apart. |
| **E** | All 4 fingertips curled in, resting on edge of thumb. | **R** | Index and middle fingers crossed over each other. |
| **F** | Index and thumb touch in circle, other 3 fingers straight up. | **S** | Closed fist with thumb crossed in front of all fingers. |
| **G** | Index and thumb extended parallel pointing sideways. | **T** | Fist with thumb tucked between index and middle finger. |
| **H** | Index and middle fingers extended parallel sideways. | **U** | Index and middle fingers straight up held tightly together. |
| **I** | Pinky finger extended straight up, all other fingers closed. | **V** | Index and middle fingers straight up spread in a 'V' shape. |
| **J** | Pinky finger traces a 'J' curve in the air. | **W** | Index, middle, and ring fingers extended up in 'W' shape. |
| **K** | Index up, middle forward at 45 degrees, thumb on middle knuckle. | **X** | Index finger hooked/curved like a pirate's hook. |
| **L** | 'L' shape formed by extending thumb and index at right angles. | **Y** | Thumb and pinky extended outward (horns), middle 3 closed. |
| **M** | Fist with thumb tucked under 3 fingers (index, middle, ring). | **Z** | Index finger traces a 'Z' path in the air. |

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
