import os
import sys
import math
import time
import json
import base64
import threading
import numpy as np
import cv2
from flask import Flask, render_template, Response, jsonify, request
from flask_cors import CORS
from keras.models import load_model
from cvzone.HandTrackingModule import HandDetector
import pyttsx3
import enchant

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(current_dir, 'cnn8grps_rad1_model.h5')
white_path = os.path.join(current_dir, 'white.jpg')

class SignLanguageEngine:
    def __init__(self):
        self.lock = threading.Lock()
        self.vs = None
        self.model = None
        self.dict_enchant = None
        self.hd = None
        self.offset = 29
        
        self.current_symbol = "-"
        self.confidence = 0.0
        self.sentence = ""
        self.word = ""
        self.suggestions = []
        self.hand_detected = False
        self.pts = []
        
        self.count = -1
        self.ten_prev_char = [" "] * 10
        self.prev_char = ""
        
        self.raw_frame = None
        self.mode = "word"  # 'word' (one-gesture full word) or 'letter' (fingerspelling)
        self.detected_emoji = "👋"
        self.word_hold_counter = 0
        self.last_detected_candidate = ""
        self.last_committed_time = 0
        self.last_committed_word = ""
        
        # Async prediction buffer
        self.pending_skeleton = None
        self.pending_lock = threading.Lock()
        self.is_predicting = False
        
        self.initialize_engine()

    def initialize_engine(self):
        print("[Engine] Loading model...")
        self.model = load_model(model_path)
        print("[Engine] Initializing detector...")
        self.hd = HandDetector(maxHands=1, detectionCon=0.65, minTrackCon=0.5)
        try:
            self.dict_enchant = enchant.Dict("en-US")
        except Exception as e:
            print(f"[Engine] Enchant warning: {e}")
            self.dict_enchant = None
            
        print("[Engine] Initializing camera...")
        self.vs = cv2.VideoCapture(0)
        self.vs.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.vs.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.vs.set(cv2.CAP_PROP_FPS, 30)
        self.vs.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        self.running = True
        
        # Start camera capture thread (fast 30+ FPS)
        self.camera_thread = threading.Thread(target=self._process_camera_loop, daemon=True)
        self.camera_thread.start()
        
        # Start async worker thread for neural prediction
        self.worker_thread = threading.Thread(target=self._async_predict_worker, daemon=True)
        self.worker_thread.start()

    def distance(self, x, y):
        return math.sqrt(((x[0] - y[0]) ** 2) + ((x[1] - y[1]) ** 2))

    def _detect_direct_word_gesture(self, pts):
        if not pts or len(pts) < 21:
            return None
            
        # Check finger vertical extension (tip above PIP joint)
        index_up = pts[8][1] < pts[6][1]
        middle_up = pts[12][1] < pts[10][1]
        ring_up = pts[16][1] < pts[14][1]
        pinky_up = pts[20][1] < pts[18][1]
        
        # Check finger horizontal/vertical thumb states
        thumb_up = (pts[4][1] < pts[3][1]) and (pts[4][1] < pts[5][1])
        thumb_down = (pts[4][1] > pts[3][1]) and (pts[4][1] > pts[17][1])
        thumb_extended = self.distance(pts[4], pts[9]) > 55
        
        # Distances between key fingertips
        thumb_index_dist = self.distance(pts[4], pts[8])
        index_middle_dist = self.distance(pts[8], pts[12])
        thumb_pinky_dist = self.distance(pts[4], pts[20])
        
        # 1. "I LOVE YOU" (🤟)
        if index_up and pinky_up and not middle_up and not ring_up and thumb_extended:
            return "I LOVE YOU", 0.98, "🤟"
            
        # 2. "CALL ME" (🤙)
        if pinky_up and thumb_extended and not index_up and not middle_up and not ring_up:
            return "CALL ME", 0.96, "🤙"
            
        # 3. "PEACE / VICTORY" (✌️)
        if index_up and middle_up and not ring_up and not pinky_up:
            if index_middle_dist > 25:
                return "PEACE", 0.97, "✌️"
            else:
                return "YES", 0.90, "✌️"
                
        # 4. "OK / PERFECT" (👌)
        if thumb_index_dist < 45 and middle_up and ring_up and pinky_up:
            return "OK", 0.98, "👌"
            
        # 5. "GOOD / AWESOME" (👍)
        if thumb_up and not index_up and not middle_up and not ring_up and not pinky_up:
            return "GOOD", 0.99, "👍"
            
        # 6. "BAD" (👎)
        if thumb_down and not index_up and not middle_up and not ring_up and not pinky_up:
            return "BAD", 0.98, "👎"
            
        # 7. "HELLO" (👋)
        if index_up and middle_up and ring_up and pinky_up and thumb_extended:
            return "HELLO", 0.96, "👋"
            
        # 8. "STOP" (🛑)
        if index_up and middle_up and ring_up and pinky_up and not thumb_extended:
            return "STOP", 0.95, "🛑"
            
        # 9. "WATER" (💧) - W shape
        if index_up and middle_up and ring_up and not pinky_up:
            return "WATER", 0.95, "💧"
            
        # 10. "YOU" (👉) - Pointing index
        if index_up and not middle_up and not ring_up and not pinky_up and not thumb_extended:
            return "YOU", 0.96, "👉"
            
        # 11. "ROCK ON" (🤘)
        if index_up and pinky_up and not middle_up and not ring_up and not thumb_extended:
            return "ROCK ON", 0.95, "🤘"
            
        # 12. "YES" (✊) - Closed fist
        if not index_up and not middle_up and not ring_up and not pinky_up and not thumb_up and not thumb_extended:
            return "YES", 0.92, "✊"
            
        # 13. "NO" (🤏) - Pinch
        if thumb_index_dist < 40 and not middle_up and not ring_up and not pinky_up:
            return "NO", 0.94, "🤏"
            
        return None

    def _process_camera_loop(self):
        while self.running:
            if not self.vs or not self.vs.isOpened():
                time.sleep(0.05)
                continue
                
            success, frame = self.vs.read()
            if not success or frame is None:
                time.sleep(0.01)
                continue
                
            frame = cv2.flip(frame, 1)
            
            white = np.ones((400, 400, 3), np.uint8) * 255
            hands, _ = self.hd.findHands(frame, draw=False, flipType=True)
            detected = False
            
            if hands:
                hand = hands[0]
                self.pts = hand['lmList']
                x, y, w, h = hand['bbox']
                detected = True
                
                # Bounding box on camera frame
                xmin = max(0, x - self.offset)
                xmax = min(frame.shape[1], x + w + self.offset)
                ymin = max(0, y - self.offset)
                ymax = min(frame.shape[0], y + h + self.offset)
                cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), (0, 230, 115), 2)
                
                # Transform landmarks relative to hand bounding box & center on 400x400 white canvas
                os_x = ((400 - w) // 2) - 15
                os_y = ((400 - h) // 2) - 15
                
                # Scale landmark coordinates from frame to bounding box ROI
                pts_canvas = []
                for pt in self.pts:
                    px = (pt[0] - x) + os_x
                    py = (pt[1] - y) + os_y
                    pts_canvas.append((int(px), int(py)))
                
                # Draw hand skeletal connections on white canvas
                if len(pts_canvas) >= 21:
                    for t in range(0, 4, 1):
                        cv2.line(white, pts_canvas[t], pts_canvas[t + 1], (0, 255, 0), 3)
                    for t in range(5, 8, 1):
                        cv2.line(white, pts_canvas[t], pts_canvas[t + 1], (0, 255, 0), 3)
                    for t in range(9, 12, 1):
                        cv2.line(white, pts_canvas[t], pts_canvas[t + 1], (0, 255, 0), 3)
                    for t in range(13, 16, 1):
                        cv2.line(white, pts_canvas[t], pts_canvas[t + 1], (0, 255, 0), 3)
                    for t in range(17, 20, 1):
                        cv2.line(white, pts_canvas[t], pts_canvas[t + 1], (0, 255, 0), 3)
                                 
                    cv2.line(white, pts_canvas[5], pts_canvas[9], (0, 255, 0), 3)
                    cv2.line(white, pts_canvas[9], pts_canvas[13], (0, 255, 0), 3)
                    cv2.line(white, pts_canvas[13], pts_canvas[17], (0, 255, 0), 3)
                    cv2.line(white, pts_canvas[0], pts_canvas[5], (0, 255, 0), 3)
                    cv2.line(white, pts_canvas[0], pts_canvas[17], (0, 255, 0), 3)

                    for i in range(21):
                        cv2.circle(white, pts_canvas[i], 3, (0, 0, 255), -1)

                    # Send to background prediction queue without blocking video stream
                    with self.pending_lock:
                        self.pending_skeleton = white.copy()
            else:
                detected = False
                self.pts = []
                self.word_hold_counter = 0
                self.last_detected_candidate = ""
                with self.pending_lock:
                    self.pending_skeleton = None

            with self.lock:
                self.hand_detected = detected
                self.raw_frame = frame
                self.skeleton_frame = white
                if not detected:
                    self.current_symbol = "-"
                    self.confidence = 0.0
                
            time.sleep(0.005)

    def _async_predict_worker(self):
        while self.running:
            skeleton_to_process = None
            with self.pending_lock:
                if self.pending_skeleton is not None:
                    skeleton_to_process = self.pending_skeleton
                    self.pending_skeleton = None
                    
            if skeleton_to_process is not None and self.hand_detected and len(self.pts) >= 21:
                try:
                    self._predict(skeleton_to_process)
                except Exception as e:
                    print(f"Prediction worker error: {e}")
            else:
                if not self.hand_detected:
                    with self.lock:
                        self.current_symbol = "-"
                        self.confidence = 0.0
                time.sleep(0.02)

    def _predict(self, test_image):
        if not self.hand_detected or not self.pts or len(self.pts) < 21:
            with self.lock:
                self.current_symbol = "-"
                self.confidence = 0.0
            return

        if self.mode == "word":
            direct = self._detect_direct_word_gesture(self.pts)
            if direct:
                word, conf, emoji = direct
                with self.lock:
                    self.current_symbol = f"{emoji} {word}"
                    self.detected_emoji = emoji
                    self.confidence = conf
                    
                now = time.time()
                if word == self.last_detected_candidate:
                    self.word_hold_counter += 1
                else:
                    self.last_detected_candidate = word
                    self.word_hold_counter = 1
                    
                # If held steady for 3 cycles (~150ms) and not recently committed
                if self.word_hold_counter >= 3 and (word != self.last_committed_word or (now - self.last_committed_time) > 2.2):
                    self.last_committed_word = word
                    self.last_committed_time = now
                    with self.lock:
                        if self.sentence and not self.sentence.endswith(" "):
                            self.sentence += " "
                        self.sentence += word + " "
                        self._update_suggestions()
                        
                    # Auto-speak recognized word via TTS
                    def _speak(w):
                        try:
                            eng = pyttsx3.init()
                            eng.say(w)
                            eng.runAndWait()
                        except Exception:
                            pass
                    threading.Thread(target=_speak, args=(word,), daemon=True).start()
                return
            else:
                with self.lock:
                    self.current_symbol = "-"
                    self.detected_emoji = "🖐️"
                    self.confidence = 0.0
                return

        # Fallback to Letter-by-Letter Fingerspelling Mode
        white = test_image.reshape(1, 400, 400, 3).astype(np.float32)
        # Direct graph call is 3x-5x faster than model.predict()
        preds = self.model(white, training=False).numpy()
        prob = np.array(preds[0], dtype='float32')
        conf = float(np.max(prob))
        
        ch1 = int(np.argmax(prob, axis=0))
        prob[ch1] = 0
        ch2 = int(np.argmax(prob, axis=0))
        prob[ch2] = 0
        ch3 = int(np.argmax(prob, axis=0))
        prob[ch3] = 0

        pl = [ch1, ch2]

        # condition for [Aemnst]
        l = [[5, 2], [5, 3], [3, 5], [3, 6], [3, 0], [3, 2], [6, 4], [6, 1], [6, 2], [6, 6], [6, 7], [6, 0], [6, 5],
             [4, 1], [1, 0], [1, 1], [6, 3], [1, 6], [5, 6], [5, 1], [4, 5], [1, 4], [1, 5], [2, 0], [2, 6], [4, 6],
             [1, 0], [5, 7], [1, 6], [6, 1], [7, 6], [2, 5], [7, 1], [5, 4], [7, 0], [7, 5], [7, 2]]
        if pl in l:
            if (self.pts[6][1] < self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1]):
                ch1 = 0

        # condition for [o][s]
        l = [[2, 2], [2, 1]]
        if pl in l:
            if (self.pts[5][0] < self.pts[4][0]):
                ch1 = 0

        # condition for [c0][aemnst]
        l = [[0, 0], [0, 6], [0, 2], [0, 5], [0, 1], [0, 7], [5, 2], [7, 6], [7, 1]]
        if pl in l:
            if (self.pts[0][0] > self.pts[8][0] and self.pts[0][0] > self.pts[4][0] and self.pts[0][0] > self.pts[12][0] and self.pts[0][0] > self.pts[16][0] and self.pts[0][0] > self.pts[20][0]) and self.pts[5][0] > self.pts[4][0]:
                ch1 = 2

        # condition for [c0][aemnst]
        l = [[6, 0], [6, 6], [6, 2]]
        if pl in l:
            if self.distance(self.pts[8], self.pts[16]) < 52:
                ch1 = 2

        # condition for [gh][bdfikruvw]
        l = [[1, 4], [1, 5], [1, 6], [1, 3], [1, 0]]
        if pl in l:
            if self.pts[6][1] > self.pts[8][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1] and self.pts[0][0] < self.pts[8][0] and self.pts[0][0] < self.pts[12][0] and self.pts[0][0] < self.pts[16][0] and self.pts[0][0] < self.pts[20][0]:
                ch1 = 3

        # con for [gh][l]
        l = [[4, 6], [4, 1], [4, 5], [4, 3], [4, 7]]
        if pl in l:
            if self.pts[4][0] > self.pts[0][0]:
                ch1 = 3

        # con for [gh][pqz]
        l = [[5, 3], [5, 0], [5, 7], [5, 4], [5, 2], [5, 1], [5, 5]]
        if pl in l:
            if self.pts[2][1] + 15 < self.pts[16][1]:
                ch1 = 3

        # con for [l][x]
        l = [[6, 4], [6, 1], [6, 2]]
        if pl in l:
            if self.distance(self.pts[4], self.pts[11]) > 55:
                ch1 = 4

        # con for [l][d]
        l = [[1, 4], [1, 6], [1, 1]]
        if pl in l:
            if (self.distance(self.pts[4], self.pts[11]) > 50) and (
                    self.pts[6][1] > self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1]):
                ch1 = 4

        # con for [l][gh]
        l = [[3, 6], [3, 4]]
        if pl in l:
            if (self.pts[4][0] < self.pts[0][0]):
                ch1 = 4

        # con for [l][c0]
        l = [[2, 2], [2, 5], [2, 4]]
        if pl in l:
            if (self.pts[1][0] < self.pts[12][0]):
                ch1 = 4

        # con for [gh][z]
        l = [[3, 6], [3, 5], [3, 4]]
        if pl in l:
            if (self.pts[6][1] > self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1]) and self.pts[4][1] > self.pts[10][1]:
                ch1 = 5

        # con for [gh][pq]
        l = [[3, 2], [3, 1], [3, 6]]
        if pl in l:
            if self.pts[4][1] + 17 > self.pts[8][1] and self.pts[4][1] + 17 > self.pts[12][1] and self.pts[4][1] + 17 > self.pts[16][1] and self.pts[4][1] + 17 > self.pts[20][1]:
                ch1 = 5

        # con for [l][pqz]
        l = [[4, 4], [4, 5], [4, 2], [7, 5], [7, 6], [7, 0]]
        if pl in l:
            if self.pts[4][0] > self.pts[0][0]:
                ch1 = 5

        # con for [pqz][aemnst]
        l = [[0, 2], [0, 6], [0, 1], [0, 5], [0, 0], [0, 7], [0, 4], [0, 3], [2, 7]]
        if pl in l:
            if self.pts[0][0] < self.pts[8][0] and self.pts[0][0] < self.pts[12][0] and self.pts[0][0] < self.pts[16][0] and self.pts[0][0] < self.pts[20][0]:
                ch1 = 5

        # con for [pqz][yj]
        l = [[5, 7], [5, 2], [5, 6]]
        if pl in l:
            if self.pts[3][0] < self.pts[0][0]:
                ch1 = 7

        # con for [l][yj]
        l = [[4, 6], [4, 2], [4, 4], [4, 1], [4, 5], [4, 7]]
        if pl in l:
            if self.pts[6][1] < self.pts[8][1]:
                ch1 = 7

        # con for [x][yj]
        l = [[6, 7], [0, 7], [0, 1], [0, 0], [6, 4], [6, 6], [6, 5], [6, 1]]
        if pl in l:
            if self.pts[18][1] > self.pts[20][1]:
                ch1 = 7

        # condition for [x][aemnst]
        l = [[0, 4], [0, 2], [0, 3], [0, 1], [0, 6]]
        if pl in l:
            if self.pts[5][0] > self.pts[16][0]:
                ch1 = 6

        # condition for [yj][x]
        l = [[7, 2]]
        if pl in l:
            if self.pts[18][1] < self.pts[20][1] and self.pts[8][1] < self.pts[10][1]:
                ch1 = 6

        # condition for [c0][x]
        l = [[2, 1], [2, 2], [2, 6], [2, 7], [2, 0]]
        if pl in l:
            if self.distance(self.pts[8], self.pts[16]) > 50:
                ch1 = 6

        # con for [l][x]
        l = [[4, 6], [4, 2], [4, 1], [4, 4]]
        if pl in l:
            if self.distance(self.pts[4], self.pts[11]) < 60:
                ch1 = 6

        # con for [x][d]
        l = [[1, 4], [1, 6], [1, 0], [1, 2]]
        if pl in l:
            if self.pts[5][0] - self.pts[4][0] - 15 > 0:
                ch1 = 6

        # con for [b][pqz]
        l = [[5, 0], [5, 1], [5, 4], [5, 5], [5, 6], [6, 1], [7, 6], [0, 2], [7, 1], [7, 4], [6, 6], [7, 2], [5, 0],
             [6, 3], [6, 4], [7, 5], [7, 2]]
        if pl in l:
            if (self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] > self.pts[16][1] and self.pts[18][1] > self.pts[20][1]):
                ch1 = 1

        # con for [f][pqz]
        l = [[6, 1], [6, 0], [0, 3], [6, 4], [2, 2], [0, 6], [6, 2], [7, 6], [4, 6], [4, 1], [4, 2], [0, 2], [7, 1],
             [7, 4], [6, 6], [7, 2], [7, 5], [7, 2]]
        if pl in l:
            if (self.pts[6][1] < self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] > self.pts[16][1] and
                    self.pts[18][1] > self.pts[20][1]):
                ch1 = 1

        l = [[6, 1], [6, 0], [4, 2], [4, 1], [4, 6], [4, 4]]
        if pl in l:
            if (self.pts[10][1] > self.pts[12][1] and self.pts[14][1] > self.pts[16][1] and self.pts[18][1] > self.pts[20][1]):
                ch1 = 1

        # con for [d][pqz]
        l = [[5, 0], [3, 4], [3, 0], [3, 1], [3, 5], [5, 5], [5, 4], [5, 1], [7, 6]]
        if pl in l:
            if ((self.pts[6][1] > self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and
                 self.pts[18][1] < self.pts[20][1]) and (self.pts[2][0] < self.pts[0][0]) and self.pts[4][1] > self.pts[14][1]):
                ch1 = 1

        l = [[4, 1], [4, 2], [4, 4]]
        if pl in l:
            if (self.distance(self.pts[4], self.pts[11]) < 50) and (
                    self.pts[6][1] > self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1]):
                ch1 = 1

        l = [[3, 4], [3, 0], [3, 1], [3, 5], [3, 6]]
        if pl in l:
            if ((self.pts[6][1] > self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and
                 self.pts[18][1] < self.pts[20][1]) and (self.pts[2][0] < self.pts[0][0]) and self.pts[14][1] < self.pts[4][1]):
                ch1 = 1

        l = [[6, 6], [6, 4], [6, 1], [6, 2]]
        if pl in l:
            if self.pts[5][0] - self.pts[4][0] - 15 < 0:
                ch1 = 1

        # con for [i][pqz]
        l = [[5, 4], [5, 5], [5, 1], [0, 3], [0, 7], [5, 0], [0, 2], [6, 2], [7, 5], [7, 1], [7, 6], [7, 7]]
        if pl in l:
            if ((self.pts[6][1] < self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and
                 self.pts[18][1] > self.pts[20][1])):
                ch1 = 1

        # con for [yj][bfdi]
        l = [[1, 5], [1, 7], [1, 1], [1, 6], [1, 3], [1, 0]]
        if pl in l:
            if (self.pts[4][0] < self.pts[5][0] + 15) and (
            (self.pts[6][1] < self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and
             self.pts[18][1] > self.pts[20][1])):
                ch1 = 7

        # con for [uvr]
        l = [[5, 5], [5, 0], [5, 4], [5, 1], [4, 6], [4, 1], [7, 6], [3, 0], [3, 5]]
        if pl in l:
            if ((self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and
                 self.pts[18][1] < self.pts[20][1])) and self.pts[4][1] > self.pts[14][1]:
                ch1 = 1

        # con for [w]
        fg = 13
        l = [[3, 5], [3, 0], [3, 6], [5, 1], [4, 1], [2, 0], [5, 0], [5, 5]]
        if pl in l:
            if not (self.pts[0][0] + fg < self.pts[8][0] and self.pts[0][0] + fg < self.pts[12][0] and self.pts[0][0] + fg < self.pts[16][0] and
                    self.pts[0][0] + fg < self.pts[20][0]) and not (
                    self.pts[0][0] > self.pts[8][0] and self.pts[0][0] > self.pts[12][0] and self.pts[0][0] > self.pts[16][0] and self.pts[0][0] > self.pts[20][0]) and self.distance(self.pts[4], self.pts[11]) < 50:
                ch1 = 1

        l = [[5, 0], [5, 5], [0, 1]]
        if pl in l:
            if self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] > self.pts[16][1]:
                ch1 = 1

        # subgroup conditions
        char_res = str(ch1)
        if ch1 == 0:
            char_res = 'S'
            if self.pts[4][0] < self.pts[6][0] and self.pts[4][0] < self.pts[10][0] and self.pts[4][0] < self.pts[14][0] and self.pts[4][0] < self.pts[18][0]:
                char_res = 'A'
            if self.pts[4][0] > self.pts[6][0] and self.pts[4][0] < self.pts[10][0] and self.pts[4][0] < self.pts[14][0] and self.pts[4][0] < self.pts[18][0] and self.pts[4][1] < self.pts[14][1] and self.pts[4][1] < self.pts[18][1]:
                char_res = 'T'
            if self.pts[4][1] > self.pts[8][1] and self.pts[4][1] > self.pts[12][1] and self.pts[4][1] > self.pts[16][1] and self.pts[4][1] > self.pts[20][1]:
                char_res = 'E'
            if self.pts[4][0] > self.pts[6][0] and self.pts[4][0] > self.pts[10][0] and self.pts[4][0] > self.pts[14][0] and self.pts[4][1] < self.pts[18][1]:
                char_res = 'M'
            if self.pts[4][0] > self.pts[6][0] and self.pts[4][0] > self.pts[10][0] and self.pts[4][1] < self.pts[18][1] and self.pts[4][1] < self.pts[14][1]:
                char_res = 'N'

        elif ch1 == 2:
            if self.distance(self.pts[12], self.pts[4]) > 42:
                char_res = 'C'
            else:
                char_res = 'O'

        elif ch1 == 3:
            if (self.distance(self.pts[8], self.pts[12])) > 72:
                char_res = 'G'
            else:
                char_res = 'H'

        elif ch1 == 7:
            if self.distance(self.pts[8], self.pts[4]) > 42:
                char_res = 'Y'
            else:
                char_res = 'J'

        elif ch1 == 4:
            char_res = 'L'

        elif ch1 == 6:
            char_res = 'X'

        elif ch1 == 5:
            if self.pts[4][0] > self.pts[12][0] and self.pts[4][0] > self.pts[16][0] and self.pts[4][0] > self.pts[20][0]:
                if self.pts[8][1] < self.pts[5][1]:
                    char_res = 'Z'
                else:
                    char_res = 'Q'
            else:
                char_res = 'P'

        elif ch1 == 1:
            if (self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] > self.pts[16][1] and self.pts[18][1] > self.pts[20][1]):
                char_res = 'B'
            if (self.pts[6][1] > self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1]):
                char_res = 'D'
            if (self.pts[6][1] < self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] > self.pts[16][1] and self.pts[18][1] > self.pts[20][1]):
                char_res = 'F'
            if (self.pts[6][1] < self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] > self.pts[20][1]):
                char_res = 'I'
            if (self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] > self.pts[16][1] and self.pts[18][1] < self.pts[20][1]):
                char_res = 'W'
            if (self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1]) and self.pts[4][1] < self.pts[9][1]:
                char_res = 'K'
            if ((self.distance(self.pts[8], self.pts[12]) - self.distance(self.pts[6], self.pts[10])) < 8) and (
                    self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1]):
                char_res = 'U'
            if ((self.distance(self.pts[8], self.pts[12]) - self.distance(self.pts[6], self.pts[10])) >= 8) and (
                    self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1]) and (self.pts[4][1] > self.pts[9][1]):
                char_res = 'V'
            if (self.pts[8][0] > self.pts[12][0]) and (
                    self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] < self.pts[20][1]):
                char_res = 'R'

        if char_res in ['1', 'E', 'S', 'X', 'Y', 'B']:
            if (self.pts[6][1] > self.pts[8][1] and self.pts[10][1] < self.pts[12][1] and self.pts[14][1] < self.pts[16][1] and self.pts[18][1] > self.pts[20][1]):
                char_res = " "

        if char_res in ['E', 'Y', 'B']:
            if (self.pts[4][0] < self.pts[5][0]) and (self.pts[6][1] > self.pts[8][1] and self.pts[10][1] > self.pts[12][1] and self.pts[14][1] > self.pts[16][1] and self.pts[18][1] > self.pts[20][1]):
                char_res = "next"

        if char_res in ['Next', 'B', 'C', 'H', 'F', 'X', 'next']:
            if (self.pts[0][0] > self.pts[8][0] and self.pts[0][0] > self.pts[12][0] and self.pts[0][0] > self.pts[16][0] and self.pts[0][0] > self.pts[20][0]) and (self.pts[4][1] < self.pts[8][1] and self.pts[4][1] < self.pts[12][1] and self.pts[4][1] < self.pts[16][1] and self.pts[4][1] < self.pts[20][1]) and (self.pts[4][1] < self.pts[6][1] and self.pts[4][1] < self.pts[10][1] and self.pts[4][1] < self.pts[14][1] and self.pts[4][1] < self.pts[18][1]):
                char_res = 'Backspace'

        if char_res == "next" and self.prev_char != "next":
            prev_idx = (self.count - 2) % 10
            if self.ten_prev_char[prev_idx] != "next":
                if self.ten_prev_char[prev_idx] == "Backspace":
                    self.sentence = self.sentence[0:-1]
                else:
                    self.sentence += self.ten_prev_char[prev_idx]
            else:
                curr_idx = (self.count - 0) % 10
                if self.ten_prev_char[curr_idx] != "Backspace":
                    self.sentence += self.ten_prev_char[curr_idx]

        if char_res == "  " and self.prev_char != "  ":
            self.sentence += " "

        self.prev_char = char_res
        self.current_symbol = char_res
        self.confidence = conf
        self.count += 1
        self.ten_prev_char[self.count % 10] = char_res

        # Calculate word suggestions
        sugg = []
        if len(self.sentence.strip()) != 0:
            st = self.sentence.rfind(" ")
            ed = len(self.sentence)
            word = self.sentence[st + 1:ed]
            self.word = word
            if len(word.strip()) != 0 and self.dict_enchant:
                try:
                    sugg = self.dict_enchant.suggest(word)[:4]
                except Exception:
                    pass
        self.suggestions = sugg

    def add_char(self, char):
        with self.lock:
            if char == "Backspace":
                self.sentence = self.sentence[:-1]
            elif char == "Space":
                self.sentence += " "
            else:
                self.sentence += char
            self._update_suggestions()

    def replace_last_word(self, replacement):
        with self.lock:
            idx_space = self.sentence.rfind(" ")
            if idx_space == -1:
                self.sentence = replacement.upper() + " "
            else:
                self.sentence = self.sentence[:idx_space + 1] + replacement.upper() + " "
            self._update_suggestions()

    def clear(self):
        with self.lock:
            self.sentence = ""
            self.word = ""
            self.suggestions = []

    def _update_suggestions(self):
        sugg = []
        if len(self.sentence.strip()) != 0:
            st = self.sentence.rfind(" ")
            word = self.sentence[st + 1:]
            self.word = word
            if len(word.strip()) != 0 and self.dict_enchant:
                try:
                    sugg = self.dict_enchant.suggest(word)[:4]
                except Exception:
                    pass
        self.suggestions = sugg

    def get_status(self):
        with self.lock:
            return {
                "mode": self.mode,
                "symbol": self.current_symbol,
                "emoji": self.detected_emoji,
                "confidence": round(float(self.confidence) * 100, 1),
                "sentence": self.sentence,
                "word": self.word,
                "suggestions": self.suggestions,
                "hand_detected": self.hand_detected
            }

engine = SignLanguageEngine()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/mode', methods=['GET', 'POST'])
def api_mode():
    if request.method == 'POST':
        data = request.json or {}
        new_mode = data.get('mode', 'word')
        if new_mode in ['word', 'letter']:
            engine.mode = new_mode
            with engine.lock:
                engine.current_symbol = "-"
                engine.confidence = 0.0
        return jsonify({"status": "success", "mode": engine.mode})
    return jsonify({"mode": engine.mode})

def gen_frames(feed_type='camera'):
    while True:
        frame = None
        with engine.lock:
            if feed_type == 'camera' and engine.raw_frame is not None:
                frame = engine.raw_frame
            elif feed_type == 'skeleton' and engine.skeleton_frame is not None:
                frame = engine.skeleton_frame
                
        if frame is None:
            frame = np.zeros((300, 300, 3), np.uint8)
            cv2.putText(frame, "Waiting for Camera...", (30, 150),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                        
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
        if ret:
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.015)

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames('camera'), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/skeleton_feed')
def skeleton_feed():
    return Response(gen_frames('skeleton'), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/status')
def api_status():
    return jsonify(engine.get_status())

@app.route('/api/action', methods=['POST'])
def api_action():
    data = request.json or {}
    action = data.get('action')
    value = data.get('value', '')
    
    if action == 'clear':
        engine.clear()
    elif action == 'add':
        engine.add_char(value)
    elif action == 'suggest':
        engine.replace_last_word(value)
    elif action == 'speak':
        text = engine.sentence
        def _speak_thread(t):
            try:
                engine_speak = pyttsx3.init()
                engine_speak.say(t)
                engine_speak.runAndWait()
            except Exception as e:
                print(f"TTS error: {e}")
        if text.strip():
            threading.Thread(target=_speak_thread, args=(text,), daemon=True).start()
            
    return jsonify(engine.get_status())

# Two-Way Conversation Storage
conversation_history = []

@app.route('/api/text-to-sign', methods=['POST'])
def api_text_to_sign():
    data = request.json or {}
    text = data.get('text', '').strip().upper()
    if not text:
        return jsonify({"tokens": [], "sequence": [], "message": "Empty text provided"})
        
    words = text.split()
    tokens = []
    sign_sequence = []
    
    # Common phrase dictionary mappings
    phrases_map = {
        "HELLO": "HELLO",
        "THANK YOU": "THANK YOU",
        "THANKS": "THANK YOU",
        "PLEASE": "PLEASE",
        "YES": "YES",
        "NO": "NO",
        "HELP": "HELP",
        "LOVE": "LOVE",
        "GOODBYE": "GOODBYE",
        "BYE": "GOODBYE"
    }
    
    # Check if full phrase is mapped
    if text in phrases_map:
        phrase_key = phrases_map[text]
        tokens.append({"type": "phrase", "word": phrase_key})
        for ch in phrase_key:
            sign_sequence.append(ch)
    else:
        for w in words:
            if w in phrases_map:
                tokens.append({"type": "phrase", "word": phrases_map[w]})
            else:
                tokens.append({"type": "word", "word": w, "letters": list(w)})
            for ch in w:
                if ch.isalnum() or ch == ' ':
                    sign_sequence.append(ch)
            sign_sequence.append(' ') # Pause between words
            
    if sign_sequence and sign_sequence[-1] == ' ':
        sign_sequence.pop()

    return jsonify({
        "original_text": text,
        "tokens": tokens,
        "sequence": sign_sequence,
        "count": len(sign_sequence)
    })

@app.route('/api/conversation', methods=['GET', 'POST'])
def api_conversation():
    global conversation_history
    if request.method == 'POST':
        data = request.json or {}
        sender = data.get('sender', 'user') # 'deaf' (sign) or 'hearing' (speech/text)
        message = data.get('message', '').strip()
        if message:
            item = {
                "id": len(conversation_history) + 1,
                "sender": sender,
                "message": message,
                "timestamp": time.strftime("%H:%M:%S")
            }
            conversation_history.append(item)
            if len(conversation_history) > 50:
                conversation_history.pop(0)
            return jsonify({"status": "success", "item": item, "history": conversation_history})
    elif request.method == 'GET':
        if request.args.get('action') == 'clear':
            conversation_history = []
        return jsonify({"history": conversation_history})

@app.route('/api/words/verify', methods=['POST'])
def api_verify_word():
    data = request.json or {}
    target_word = data.get('target_word', '').strip().upper()
    signed_sequence = data.get('signed_sequence', [])
    
    if not target_word:
        return jsonify({"valid": False, "progress": 0, "completed": False})
        
    target_letters = [c for c in target_word if c.isalnum()]
    cleaned_signed = [s for s in signed_sequence if s.isalnum()]
    
    matched_count = 0
    for i in range(min(len(target_letters), len(cleaned_signed))):
        if target_letters[i] == cleaned_signed[i]:
            matched_count += 1
        else:
            break
            
    is_completed = (matched_count == len(target_letters))
    progress = round((matched_count / len(target_letters)) * 100, 1) if target_letters else 0
    
    return jsonify({
        "target_word": target_word,
        "matched_count": matched_count,
        "total_letters": len(target_letters),
        "progress": progress,
        "completed": is_completed
    })

if __name__ == '__main__':
    print("\n=======================================================")
    print("  Sign Language Web Application Server Started!")
    print("  Open in Browser: http://localhost:5000")
    print("=======================================================\n")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
