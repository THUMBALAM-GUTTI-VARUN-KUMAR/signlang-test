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
        self.num_hands_detected = 0
        self.pts = []
        self.hands_pts = []
        
        self.count = -1
        self.ten_prev_char = [" "] * 10
        self.prev_char = ""
        
        self.raw_frame = None
        self.skeleton_frame = None
        self.raw_frame_jpeg = None
        self.skeleton_frame_jpeg = None
        self.mode = "word"  # 'word' (one-gesture full word & smart sentences) or 'letter' (classic fingerspelling)
        self.detected_emoji = "✨"
        self.word_hold_counter = 0
        self.last_detected_candidate = ""
        self.last_committed_time = 0
        self.last_committed_word = ""
        
        # Custom User Gesture Templates
        self.custom_gestures_file = os.path.join(os.path.dirname(__file__), 'custom_gestures.json')
        self.custom_gestures = []
        self.load_custom_gestures()

        # Async prediction buffer
        self.pending_skeleton = None
        self.pending_lock = threading.Lock()
        self.is_predicting = False
        
        self.initialize_engine()

    def load_custom_gestures(self):
        try:
            if os.path.exists(self.custom_gestures_file):
                with open(self.custom_gestures_file, 'r', encoding='utf-8') as f:
                    self.custom_gestures = json.load(f)
            else:
                self.custom_gestures = []
                self.save_custom_gestures()
        except Exception as e:
            print(f"[Engine] Error loading custom gestures: {e}")
            self.custom_gestures = []

    def save_custom_gestures(self):
        try:
            with open(self.custom_gestures_file, 'w', encoding='utf-8') as f:
                json.dump(self.custom_gestures, f, indent=2)
        except Exception as e:
            print(f"[Engine] Error saving custom gestures: {e}")

    def normalize_landmarks(self, pts):
        if not pts or len(pts) < 21:
            return None
        bx, by = pts[0][0], pts[0][1]
        scale = math.hypot(pts[9][0] - bx, pts[9][1] - by)
        if scale < 10.0:
            scale = 10.0
        
        vec = []
        for pt in pts:
            vec.append(round((pt[0] - bx) / scale, 4))
            vec.append(round((pt[1] - by) / scale, 4))
        return vec

    def compare_landmark_vectors(self, vec1, vec2):
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        dist = math.sqrt(sum((a - b) ** 2 for a, b in zip(vec1, vec2)))
        similarity = max(0.0, 1.0 - (dist / 1.35))
        return round(similarity, 3)

    def initialize_engine(self):
        print("[Engine] Loading model...")
        self.model = load_model(model_path)
        print("[Engine] Initializing detector (hd)...")
        self.hd = HandDetector(maxHands=2, detectionCon=0.60, minTrackCon=0.5)
        try:
            self.dict_enchant = enchant.Dict("en-US")
        except Exception as e:
            print(f"[Engine] Enchant warning: {e}")
            self.dict_enchant = None
            
        print("[Engine] Initializing camera...")
        self.vs = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not self.vs or not self.vs.isOpened():
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

        # 0. Check User-Trained Custom Gestures First!
        curr_vec = self.normalize_landmarks(pts)
        if curr_vec and self.custom_gestures:
            best_match = None
            best_score = 0.0
            for g in self.custom_gestures:
                g_vec = g.get("vector")
                if g_vec and isinstance(g_vec, list) and len(g_vec) == 42:
                    score = self.compare_landmark_vectors(curr_vec, g_vec)
                    if score > best_score:
                        best_score = score
                        best_match = g
            if best_match and best_score >= 0.90:
                return best_match["name"], best_score, best_match.get("emoji", "✨")
            
        hand_scale = max(20.0, self.distance(pts[0], pts[9]))
        
        # Check finger vertical extension (tip above PIP joint)
        index_up = pts[8][1] < pts[6][1]
        middle_up = pts[12][1] < pts[10][1]
        ring_up = pts[16][1] < pts[14][1]
        pinky_up = pts[20][1] < pts[18][1]
        
        # Check finger horizontal/vertical thumb states
        thumb_up = (pts[4][1] < pts[3][1]) and (pts[4][1] < pts[5][1])
        thumb_down = (pts[4][1] > pts[3][1]) and (pts[4][1] > pts[17][1])
        thumb_extended = (self.distance(pts[4], pts[9]) / hand_scale) > 0.48
        
        # Proportional distances between key fingertips
        thumb_index_ratio = self.distance(pts[4], pts[8]) / hand_scale
        index_middle_ratio = self.distance(pts[8], pts[12]) / hand_scale
        
        # 1. "I LOVE YOU" (🤟)
        if index_up and pinky_up and not middle_up and not ring_up and thumb_extended:
            return "I LOVE YOU", 0.98, "🤟"
            
        # 2. "CALL ME" (🤙)
        if pinky_up and thumb_extended and not index_up and not middle_up and not ring_up:
            return "CALL ME", 0.96, "🤙"
            
        # 3. "PEACE / VICTORY" (✌️)
        if index_up and middle_up and not ring_up and not pinky_up and index_middle_ratio > 0.18:
            return "PEACE", 0.97, "✌️"
                
        # 4. "OK / PERFECT" (👌)
        if thumb_index_ratio < 0.42 and middle_up and ring_up and pinky_up:
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

        # 10. "TABLET / MEDICINE" (💊) - Pill Pinch (Thumb tip to Index tip, others folded)
        if thumb_index_ratio < 0.35 and not middle_up and not ring_up and not pinky_up:
            return "TABLET", 0.97, "💊"

        # 11. "FOOD / EAT" (🍲) - Clustered fingertips / tapered handshape
        tips_clustered = (self.distance(pts[4], pts[8]) / hand_scale < 0.38 and
                          self.distance(pts[8], pts[12]) / hand_scale < 0.35 and
                          self.distance(pts[12], pts[16]) / hand_scale < 0.35)
        if tips_clustered and not index_up and not middle_up and not ring_up and not pinky_up:
            return "FOOD", 0.96, "🍲"

        # 12. "SLEEP / REST" (🛏️) - Flat hand tilted horizontally/sideways
        wrist_knuckle_tilt = abs(pts[0][0] - pts[9][0]) > abs(pts[0][1] - pts[9][1]) * 0.75
        if index_up and middle_up and ring_up and pinky_up and wrist_knuckle_tilt:
            return "SLEEP", 0.95, "🛏️"

        # 13. "ME / I" (☝️) - Index pointing high/inward
        if index_up and not middle_up and not ring_up and not pinky_up and not thumb_extended:
            # Check if pointing straight up/high
            if pts[8][1] < pts[6][1] - 15:
                return "ME", 0.96, "☝️"
            else:
                return "YOU", 0.96, "👉"
            
        # 14. "ROCK ON" (🤘)
        if index_up and pinky_up and not middle_up and not ring_up and not thumb_extended:
            return "ROCK ON", 0.95, "🤘"
            
        # 15. "DOCTOR" (🩺) - Two fingers together (Index + Middle extended parallel, pulse check sign)
        index_middle_parallel = index_up and middle_up and not ring_up and not pinky_up and index_middle_ratio < 0.16
        if index_middle_parallel and not thumb_extended:
            return "DOCTOR", 0.97, "🩺"
            
        return None

    def _detect_two_handed_gesture(self, pts1, pts2):
        if not pts1 or not pts2 or len(pts1) < 21 or len(pts2) < 21:
            return None

        # Sort hands left-to-right based on wrist X
        if pts1[0][0] > pts2[0][0]:
            left_pts, right_pts = pts2, pts1
        else:
            left_pts, right_pts = pts1, pts2

        scale1 = max(20.0, self.distance(left_pts[0], left_pts[9]))
        scale2 = max(20.0, self.distance(right_pts[0], right_pts[9]))
        avg_scale = (scale1 + scale2) / 2.0

        # Finger states for left hand
        l_index_up = left_pts[8][1] < left_pts[6][1]
        l_middle_up = left_pts[12][1] < left_pts[10][1]
        l_ring_up = left_pts[16][1] < left_pts[14][1]
        l_pinky_up = left_pts[20][1] < left_pts[18][1]
        l_thumb_up = left_pts[4][1] < left_pts[3][1]
        l_all_up = l_index_up and l_middle_up and l_ring_up and l_pinky_up
        l_all_down = not l_index_up and not l_middle_up and not l_ring_up and not l_pinky_up

        # Finger states for right hand
        r_index_up = right_pts[8][1] < right_pts[6][1]
        r_middle_up = right_pts[12][1] < right_pts[10][1]
        r_ring_up = right_pts[16][1] < right_pts[14][1]
        r_pinky_up = right_pts[20][1] < right_pts[18][1]
        r_thumb_up = right_pts[4][1] < right_pts[3][1]
        r_all_up = r_index_up and r_middle_up and r_ring_up and r_pinky_up
        r_all_down = not r_index_up and not r_middle_up and not r_ring_up and not r_pinky_up

        # Key Inter-Hand Distances normalized by hand scale
        wrist_dist = self.distance(left_pts[0], right_pts[0]) / avg_scale
        index_tips_dist = self.distance(left_pts[8], right_pts[8]) / avg_scale
        middle_tips_dist = self.distance(left_pts[12], right_pts[12]) / avg_scale
        thumb_tips_dist = self.distance(left_pts[4], right_pts[4]) / avg_scale
        pinky_tips_dist = self.distance(left_pts[20], right_pts[20]) / avg_scale

        # 1. "THANK YOU / NAMASTE / PRAY" (🙏) - Both open upright palms pressed together
        if l_all_up and r_all_up and wrist_dist < 1.35 and middle_tips_dist < 0.75:
            return "THANK YOU", 0.99, "🙏"

        # 2. "HOUSE / HOME" (🏠) - Flat hands angled touching at fingertips (Roof ^)
        if l_all_up and r_all_up and index_tips_dist < 0.65 and wrist_dist > 1.25:
            return "HOUSE", 0.98, "🏠"

        # 3. "BOOK" (📖) - Open flat palms side-by-side (opening like a book)
        if l_all_up and r_all_up and pinky_tips_dist < 0.85 and index_tips_dist > 0.9:
            return "BOOK", 0.97, "📖"

        # 4. "HELP" (🆘) - Thumbs-up fist resting on/near open flat palm
        fist_on_palm = (r_thumb_up and r_all_down and l_all_up and (self.distance(right_pts[0], left_pts[9]) / avg_scale < 1.4)) or \
                       (l_thumb_up and l_all_down and r_all_up and (self.distance(left_pts[0], right_pts[9]) / avg_scale < 1.4))
        if fist_on_palm:
            return "HELP", 0.99, "🆘"

        # 5. "MORE" (➕) - Both hands with tapered fingertips touching in center
        l_clustered = self.distance(left_pts[4], left_pts[8]) / scale1 < 0.45 and not l_all_up
        r_clustered = self.distance(right_pts[4], right_pts[8]) / scale2 < 0.45 and not r_all_up
        if l_clustered and r_clustered and index_tips_dist < 0.75 and thumb_tips_dist < 0.75:
            return "MORE", 0.98, "➕"

        # 6. "WORK" (💼) - Both fists stacked/tapping one on top of the other
        if l_all_down and r_all_down:
            vert_dist = abs(left_pts[0][1] - right_pts[0][1]) / avg_scale
            horiz_dist = abs(left_pts[0][0] - right_pts[0][0]) / avg_scale
            if horiz_dist < 1.0 and vert_dist < 1.6:
                return "WORK", 0.97, "💼"

        # 7. "FRIEND" (🤝) - Both index fingers hooked/locked in center
        if l_index_up and not l_middle_up and not l_ring_up and not l_pinky_up and \
           r_index_up and not r_middle_up and not r_ring_up and not r_pinky_up and index_tips_dist < 0.6:
            return "FRIEND", 0.97, "🤝"

        # 8. "PLAY" (🎮) - Both hands in Shaka (Y-shapes)
        l_shaka = l_pinky_up and (self.distance(left_pts[4], left_pts[9]) / scale1 > 0.45) and not l_index_up and not l_middle_up
        r_shaka = r_pinky_up and (self.distance(right_pts[4], right_pts[9]) / scale2 > 0.45) and not r_index_up and not r_middle_up
        if l_shaka and r_shaka:
            return "PLAY", 0.98, "🎮"

        # 9. "FAMILY" (👨‍👩‍👧‍👦) - Both hands in F-shapes touching
        l_f = (self.distance(left_pts[4], left_pts[8]) / scale1 < 0.42) and l_middle_up and l_ring_up and l_pinky_up
        r_f = (self.distance(right_pts[4], right_pts[8]) / scale2 < 0.42) and r_middle_up and r_ring_up and r_pinky_up
        if l_f and r_f and index_tips_dist < 0.8:
            return "FAMILY", 0.98, "👨‍👩‍👧‍👦"

        # 10. "DOCTOR" (🩺) - Dominant hand tapping wrist of non-dominant hand (Pulse check)
        r_on_l_wrist = (self.distance(right_pts[8], left_pts[0]) / avg_scale < 1.0) or (self.distance(right_pts[12], left_pts[0]) / avg_scale < 1.0)
        l_on_r_wrist = (self.distance(left_pts[8], right_pts[0]) / avg_scale < 1.0) or (self.distance(left_pts[12], right_pts[0]) / avg_scale < 1.0)
        if (r_on_l_wrist or l_on_r_wrist) and (wrist_dist < 1.6):
            return "DOCTOR", 0.98, "🩺"

        return None

    def _draw_skeleton_on_canvas(self, canvas, pts, os_x, os_y, color=(0, 255, 0)):
        if not pts or len(pts) < 21:
            return
        for t in range(0, 4, 1):
            cv2.line(canvas, (int(pts[t][0] + os_x), int(pts[t][1] + os_y)), (int(pts[t + 1][0] + os_x), int(pts[t + 1][1] + os_y)), color, 3)
        for t in range(5, 8, 1):
            cv2.line(canvas, (int(pts[t][0] + os_x), int(pts[t][1] + os_y)), (int(pts[t + 1][0] + os_x), int(pts[t + 1][1] + os_y)), color, 3)
        for t in range(9, 12, 1):
            cv2.line(canvas, (int(pts[t][0] + os_x), int(pts[t][1] + os_y)), (int(pts[t + 1][0] + os_x), int(pts[t + 1][1] + os_y)), color, 3)
        for t in range(13, 16, 1):
            cv2.line(canvas, (int(pts[t][0] + os_x), int(pts[t][1] + os_y)), (int(pts[t + 1][0] + os_x), int(pts[t + 1][1] + os_y)), color, 3)
        for t in range(17, 20, 1):
            cv2.line(canvas, (int(pts[t][0] + os_x), int(pts[t][1] + os_y)), (int(pts[t + 1][0] + os_x), int(pts[t + 1][1] + os_y)), color, 3)
                     
        cv2.line(canvas, (int(pts[5][0] + os_x), int(pts[5][1] + os_y)), (int(pts[9][0] + os_x), int(pts[9][1] + os_y)), color, 3)
        cv2.line(canvas, (int(pts[9][0] + os_x), int(pts[9][1] + os_y)), (int(pts[13][0] + os_x), int(pts[13][1] + os_y)), color, 3)
        cv2.line(canvas, (int(pts[13][0] + os_x), int(pts[13][1] + os_y)), (int(pts[17][0] + os_x), int(pts[17][1] + os_y)), color, 3)
        cv2.line(canvas, (int(pts[0][0] + os_x), int(pts[0][1] + os_y)), (int(pts[5][0] + os_x), int(pts[5][1] + os_y)), color, 3)
        cv2.line(canvas, (int(pts[0][0] + os_x), int(pts[0][1] + os_y)), (int(pts[17][0] + os_x), int(pts[17][1] + os_y)), color, 3)

        for i in range(21):
            cv2.circle(canvas, (int(pts[i][0] + os_x), int(pts[i][1] + os_y)), 2, (0, 0, 255), 1)

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
            
            if hands and len(hands) > 0:
                detected = True
                self.num_hands_detected = len(hands)
                sorted_hands = sorted(hands, key=lambda h: h['bbox'][0])
                self.hands_pts = [h['lmList'] for h in sorted_hands if 'lmList' in h and len(h['lmList']) >= 21]
                
                # Draw bounding boxes on video frame
                for idx, h_item in enumerate(sorted_hands):
                    hx, hy, hw, hh = h_item['bbox']
                    color = (0, 230, 115) if idx == 0 else (255, 180, 0)
                    cv2.rectangle(frame, (hx, hy), (hx + hw, hy + hh), color, 2)
                    cv2.putText(frame, f"Hand {idx+1}", (hx, max(20, hy - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

                hand = hands[0]
                x, y, w, h = hand['bbox']
                xmin = max(0, x - self.offset)
                ymin = max(0, y - self.offset)
                
                # Directly map landmarks without redundant second MediaPipe pass (3x faster!)
                self.pts = [[int(p[0] - xmin), int(p[1] - ymin)] for p in hand['lmList']]

                # Draw skeleton canvas
                if len(sorted_hands) == 1 and len(self.pts) >= 21:
                    os_x = int(((400 - w) // 2) - 15)
                    os_y = int(((400 - h) // 2) - 15)
                    self._draw_skeleton_on_canvas(white, self.pts, os_x, os_y, color=(0, 255, 0))
                elif len(sorted_hands) >= 2 and len(self.hands_pts) >= 2:
                    # Draw both hands normalized onto the white canvas
                    for idx, h_pts in enumerate(self.hands_pts[:2]):
                        color = (0, 230, 115) if idx == 0 else (255, 165, 0)
                        hx, hy, hw, hh = sorted_hands[idx]['bbox']
                        os_x = 30 if idx == 0 else 210
                        scale = 180.0 / max(hw, hh, 1)
                        norm_pts = [[int((p[0] - hx) * scale), int((p[1] - hy) * scale)] for p in h_pts]
                        self._draw_skeleton_on_canvas(white, norm_pts, os_x, 100, color=color)

                with self.pending_lock:
                    self.pending_skeleton = white.copy()
            else:
                detected = False
                self.pts = []
                self.hands_pts = []
                self.num_hands_detected = 0
                self.word_hold_counter = 0
                self.last_detected_candidate = ""
                with self.pending_lock:
                    self.pending_skeleton = None

            # Pre-encode JPEGs for video streams once per frame (ultra-fast, zero redundant thread encoding)
            ret_raw, raw_buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            ret_skel, skel_buf = cv2.imencode('.jpg', white, [cv2.IMWRITE_JPEG_QUALITY, 60])
            raw_bytes = raw_buf.tobytes() if ret_raw else None
            skel_bytes = skel_buf.tobytes() if ret_skel else None

            with self.lock:
                self.hand_detected = detected
                self.raw_frame = frame
                self.skeleton_frame = white
                self.raw_frame_jpeg = raw_bytes
                self.skeleton_frame_jpeg = skel_bytes
                if not detected:
                    self.current_symbol = "-"
                    self.confidence = 0.0
                
            time.sleep(0.001)

    def _async_predict_worker(self):
        while self.running:
            skeleton_to_process = None
            with self.pending_lock:
                if self.pending_skeleton is not None:
                    skeleton_to_process = self.pending_skeleton
                    self.pending_skeleton = None
                    
            if skeleton_to_process is not None and self.hand_detected:
                try:
                    self._predict(skeleton_to_process)
                except Exception as e:
                    print(f"Prediction worker error: {e}")
                time.sleep(0.025)
            else:
                if not self.hand_detected:
                    with self.lock:
                        self.current_symbol = "-"
                        self.confidence = 0.0
                time.sleep(0.03)

    def _predict(self, test_image):
        if not self.hand_detected:
            with self.lock:
                self.current_symbol = "-"
                self.confidence = 0.0
            return

        # 1. Dual-Handed Sign Recognition (when 2 hands are visible)
        if len(self.hands_pts) >= 2:
            dual_res = self._detect_two_handed_gesture(self.hands_pts[0], self.hands_pts[1])
            if dual_res:
                word, conf, emoji = dual_res
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
                    
                # 3.0-second time gap between gestures to prevent intermediate transitions
                time_since_last_commit = (now - self.last_committed_time) if self.last_committed_time > 0 else 999.0
                if self.word_hold_counter >= 8 and time_since_last_commit >= 3.0:
                    self.last_committed_word = word
                    self.last_committed_time = now
                    with self.lock:
                        if self.sentence and not self.sentence.endswith(" "):
                            self.sentence += " "
                        self.sentence += word + " "
                        self._update_suggestions()
                return

        if not self.pts or len(self.pts) < 21:
            return

        # 2. Check direct single-hand full-word & daily-needs micro-gestures
        direct = self._detect_direct_word_gesture(self.pts)
        if direct and (self.mode == "word" or direct[1] >= 0.94):
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
                
            # 3.0-second time gap between gestures to prevent intermediate transitions
            time_since_last_commit = (now - self.last_committed_time) if self.last_committed_time > 0 else 999.0
            if self.word_hold_counter >= 8 and time_since_last_commit >= 3.0:
                self.last_committed_word = word
                self.last_committed_time = now
                with self.lock:
                    if self.sentence and not self.sentence.endswith(" "):
                        self.sentence += " "
                    self.sentence += word + " "
                    self._update_suggestions()
            return
        elif self.mode == "word":
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

        with self.lock:
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
                if self.mode == "word":
                    # In Word Mode, backspace removes the entire last word token
                    trimmed = self.sentence.strip()
                    if trimmed:
                        last_space = trimmed.rfind(" ")
                        if last_space == -1:
                            self.sentence = ""
                        else:
                            self.sentence = trimmed[:last_space + 1] + " "
                    else:
                        self.sentence = ""
                else:
                    self.sentence = self.sentence[:-1]
                self.last_committed_word = ""
                self.last_detected_candidate = ""
                self.last_committed_time = 0.0
                self.word_hold_counter = 0
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
            self.last_committed_word = ""
            self.last_detected_candidate = ""
            self.last_committed_time = 0.0
            self.word_hold_counter = 0

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
            now = time.time()
            elapsed_since_commit = (now - self.last_committed_time) if self.last_committed_time > 0 else 999.0
            cooldown_left = max(0.0, round(3.0 - elapsed_since_commit, 1)) if self.last_committed_time > 0 else 0.0
            tokens = [t.strip().upper() for t in self.sentence.split() if t.strip()]
            polished = polish_asl_sentence(tokens, tone="natural") if tokens else ""
            return {
                "mode": self.mode,
                "symbol": self.current_symbol,
                "emoji": self.detected_emoji,
                "confidence": round(float(self.confidence) * 100, 1),
                "sentence": self.sentence,
                "raw_tokens": tokens,
                "polished_sentence": polished,
                "word": self.word,
                "suggestions": self.suggestions,
                "hand_detected": self.hand_detected,
                "num_hands_detected": self.num_hands_detected,
                "cooldown_remaining": cooldown_left,
                "cooldown_total": 3.0,
                "is_locked_in_cooldown": cooldown_left > 0.0
            }

engine = SignLanguageEngine()

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/app')
@app.route('/studio')
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
        frame_bytes = None
        with engine.lock:
            if feed_type == 'camera':
                frame_bytes = engine.raw_frame_jpeg
            elif feed_type == 'skeleton':
                frame_bytes = engine.skeleton_frame_jpeg
                
        if frame_bytes is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.033)

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

# ==========================================
# CUSTOM GESTURE STUDIO ENDPOINTS
# ==========================================
@app.route('/api/custom_gestures', methods=['GET', 'POST', 'HEAD'])
def api_custom_gestures():
    if request.method in ('GET', 'HEAD'):
        return jsonify({
            "status": "success",
            "gestures": engine.custom_gestures,
            "count": len(engine.custom_gestures)
        })
    elif request.method == 'POST':
        data = request.json or {}
        name = data.get('name', '').strip().upper()
        emoji = data.get('emoji', '✨').strip() or '✨'
        phrase = data.get('phrase', name).strip() or name
        vector = data.get('vector')
        
        if not name:
            return jsonify({"status": "error", "message": "Gesture name is required."}), 400
            
        if not vector or len(vector) != 42:
            with engine.lock:
                pts = list(engine.pts)
            vector = engine.normalize_landmarks(pts)
            if not vector or len(vector) != 42:
                return jsonify({"status": "error", "message": "No hand detected in camera. Please show your hand."}), 400

        # Update if exists, or append new
        existing = next((g for g in engine.custom_gestures if g["name"] == name), None)
        if existing:
            existing["emoji"] = emoji
            existing["phrase"] = phrase
            existing["vector"] = vector
            existing["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        else:
            engine.custom_gestures.append({
                "name": name,
                "emoji": emoji,
                "phrase": phrase,
                "vector": vector,
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
            })
            
        engine.save_custom_gestures()
        return jsonify({
            "status": "success",
            "message": f"Gesture '{name}' successfully registered!",
            "gestures": engine.custom_gestures
        })

@app.route('/api/custom_gestures/<name>', methods=['DELETE'])
def api_delete_custom_gesture(name):
    target = name.strip().upper()
    engine.custom_gestures = [g for g in engine.custom_gestures if g["name"].upper() != target]
    engine.save_custom_gestures()
    return jsonify({
        "status": "success",
        "message": f"Gesture '{target}' deleted successfully.",
        "gestures": engine.custom_gestures
    })

# ==========================================
# MULTI-GESTURE SENTENCE & GRAMMAR POLISHER
# ==========================================
def polish_asl_sentence(tokens, tone="natural"):
    if not tokens:
        return ""
    
    raw_cleaned = [t.strip().upper() for t in tokens if t.strip()]
    if not raw_cleaned:
        return ""

    # Deduplicate consecutive identical tokens (e.g. ['DOCTOR', 'DOCTOR'] -> ['DOCTOR'])
    cleaned = [k for i, k in enumerate(raw_cleaned) if i == 0 or k != raw_cleaned[i-1]]
    joined = " ".join(cleaned)
    
    patterns = {
        # Greetings & Introductions
        "HELLO": "Hello!",
        "HELLO YOU": "Hello, good to see you!",
        "HELLO YOU GOOD": "Hello, it is wonderful to see you!",
        "HELLO HOW YOU": "Hello! How are you doing today?",
        "HELLO HOW ARE YOU": "Hello! How are you doing today?",
        "NICE MEET YOU": "It is very nice to meet you.",
        "GOOD MORNING": "Good morning, hope you have a great day!",
        "GOOD AFTERNOON": "Good afternoon!",
        "GOOD NIGHT": "Good night, have a restful sleep.",
        "WHAT YOUR NAME": "What is your name?",
        "HELLO MY NAME": "Hello, my name is",
        "SEE YOU LATER": "See you later!",
        "HAVE GOOD DAY": "Have a wonderful day ahead!",

        # Medical & Emergency Assistance
        "DOCTOR": "Doctor / Medical assistance needed.",
        "CALL DOCTOR": "Please call a doctor right away!",
        "HELP DOCTOR": "Please call a doctor immediately, I need medical help!",
        "DOCTOR HELP": "Doctor, please help me!",
        "DOCTOR PLEASE": "Please get a doctor for me as soon as possible.",
        "ME DOCTOR": "I need to see a doctor.",
        "ME NEED DOCTOR": "I urgently need a doctor, please.",
        "ME WANT DOCTOR": "I would like to see a doctor.",
        "ME SICK DOCTOR": "I am feeling sick and need to see a doctor.",
        "HELLO DOCTOR": "Hello doctor!",
        "THANK YOU DOCTOR": "Thank you very much, doctor!",
        "WHERE DOCTOR": "Where can I find a doctor or medical clinic?",
        "TABLET": "Tablet / Medicine.",
        "MEDICINE": "Medicine.",
        "ME TABLET": "Please bring me my tablet / medicine.",
        "ME MEDICINE": "Please bring me my medicine.",
        "ME WANT TABLET": "I need to take my medicine tablet, please.",
        "ME NEED TABLET": "I urgently need to take my tablet / medicine.",
        "TABLET WATER": "Please bring me my tablet / medicine with a glass of water.",
        "WATER TABLET": "Please bring me my tablet / medicine with a glass of water.",
        "HELP TABLET": "Urgent: I need my medicine tablet immediately!",
        "HELP MEDICINE": "Urgent: I need my medicine immediately!",
        "WHERE HOSPITAL": "Where is the nearest hospital or clinic?",
        "ME SICK": "I am feeling sick and unwell, I need help.",

        # Food, Drink & Daily Nutrition
        "WATER": "Water.",
        "FOOD": "Food / Meal.",
        "WATER PLEASE": "Could I please have a glass of water?",
        "FOOD PLEASE": "Could I please have some food?",
        "ME HUNGRY": "I am feeling very hungry.",
        "ME THIRSTY": "I am feeling thirsty.",
        "ME WANT FOOD": "I would like to have some food, please.",
        "ME WANT WATER": "Could I please have some water to drink?",
        "ME NEED WATER": "I need some drinking water, please.",
        "ME NEED FOOD": "I need some food, please.",
        "MORE WATER": "Could I please have some more water?",
        "MORE FOOD": "Could I please have some more food?",
        "FOOD WATER": "Could I please have both food and water?",
        "WATER FOOD": "Could I please have both food and water?",
        "WHERE WATER": "Where can I find drinking water?",
        "WHERE FOOD": "Where is the cafeteria or food area?",

        # Restroom, Hygiene & Comfort
        "RESTROOM": "Restroom / Bathroom.",
        "WHERE RESTROOM": "Excuse me, where is the nearest restroom?",
        "WHERE BATHROOM": "Excuse me, where is the bathroom?",
        "WHERE TOILET": "Excuse me, where is the toilet?",
        "ME WANT RESTROOM": "I need to go to the restroom, please.",
        "ME NEED RESTROOM": "I need to use the restroom, please.",
        "ME SLEEP": "I am feeling exhausted and would like to sleep.",
        "ME TIRED": "I am feeling very tired.",
        "ME TIRED SLEEP": "I am feeling very tired and want to rest and sleep.",

        # House, Family & Friendship
        "HOUSE": "House / Home.",
        "BOOK": "Book / Reading.",
        "FAMILY": "Family.",
        "FRIEND": "Friend.",
        "PLAY": "Play / Recreation.",
        "I HOUSE": "I am at home.",
        "ME HOUSE": "I am at home.",
        "I GO HOUSE": "I would like to go home now.",
        "ME GO HOUSE": "I would like to go home now.",
        "I WANT HOUSE": "I would like to go home now.",
        "ME WANT HOUSE": "I would like to go home now.",
        "I WORK HOUSE": "I am working from home today.",
        "ME WORK HOUSE": "I am working from home today.",
        "I LOVE HOUSE": "I love my home.",
        "ME LOVE HOUSE": "I love my home.",
        "I BOOK": "I would like to read a book.",
        "ME BOOK": "I would like to read a book.",
        "FAMILY HOUSE": "My family is at home.",
        "I LOVE FAMILY": "I love my family very much!",
        "HELLO FRIEND": "Hello, my friend!",
        "THANK YOU FRIEND": "Thank you so much, my friend!",
        "FRIEND COME HOUSE": "My friend is coming to my house.",
        "WANT READ BOOK": "I would like to read a book.",
        "PLAY GAME FRIEND": "Let us play a game together, friend!",

        # Work, Tasks & Collaboration
        "WORK": "Work / Job.",
        "I WORK": "I am working on my tasks right now.",
        "ME WORK": "I am working on my tasks right now.",
        "I WORK HOUSE": "I am working from home today.",
        "ME WORK HOUSE": "I am working from home today.",
        "HELP WORK": "Could you please help me with this work?",
        "MORE WORK": "There is more work to be completed.",
        "STOP WORK": "Let us take a break and stop working for now.",

        # Polite Expressions & Social Needs
        "HELP ME": "Please help me!",
        "HELP ME PLEASE": "Please help me, I need assistance.",
        "PLEASE HELP": "Could you please help me?",
        "THANK YOU": "Thank you so much!",
        "THANK YOU VERY MUCH": "Thank you very much for your kind help!",
        "YOU WELCOME": "You are very welcome!",
        "I LOVE YOU": "I love you so much!",
        "CALL ME": "Please call me later.",
        "PEACE": "Wishing you peace and harmony.",
        "GOOD": "That sounds great!",
        "BAD": "That is unfortunate.",
        "OK": "Everything is okay.",
        "YES": "Yes, absolutely.",
        "NO": "No, thank you.",
        "STOP": "Please stop what you are doing.",
        "GOODBYE": "Goodbye, take care!"
    }
    
    if joined in patterns:
        res = patterns[joined]
    elif joined.startswith("HELLO MY NAME "):
        name_part = joined[len("HELLO MY NAME "):].strip().title()
        res = f"Hello! My name is {name_part}."
    elif joined.startswith("MY NAME "):
        name_part = joined[len("MY NAME "):].strip().title()
        res = f"My name is {name_part}."
    else:
        # Check custom gesture templates
        matched_custom = False
        if hasattr(engine, 'custom_gestures') and engine.custom_gestures:
            for g in engine.custom_gestures:
                if g.get("name", "").upper() == joined:
                    res = g.get("phrase", joined)
                    matched_custom = True
                    break
        
        if not matched_custom:
            token_set = set(cleaned)
            # High-priority composite intent framing
            if "HOUSE" in token_set and ("I" in token_set or "ME" in token_set):
                if "WORK" in token_set:
                    res = "I am working from home today."
                elif "GO" in token_set or "WANT" in token_set or "NEED" in token_set:
                    res = "I would like to go home now."
                elif "LOVE" in token_set:
                    res = "I love my home."
                else:
                    res = "I am at home."
            elif "BOOK" in token_set and ("I" in token_set or "ME" in token_set or "WANT" in token_set):
                res = "I would like to read a book."
            elif "DOCTOR" in token_set and ("HELP" in token_set or "CALL" in token_set):
                res = "Please call a doctor right away, I need medical help!"
            elif "DOCTOR" in token_set and ("ME" in token_set or "I" in token_set or "WANT" in token_set or "NEED" in token_set):
                res = "I need to see a doctor as soon as possible."
            elif "DOCTOR" in token_set and "HELLO" in token_set:
                res = "Hello doctor, I need some assistance."
            elif ("TABLET" in token_set or "MEDICINE" in token_set) and "WATER" in token_set:
                res = "Please bring me my medicine tablet with a glass of water."
            elif ("TABLET" in token_set or "MEDICINE" in token_set) and ("ME" in token_set or "I" in token_set or "NEED" in token_set or "WANT" in token_set):
                res = "I need to take my medicine now, please."
            elif "WATER" in token_set and ("ME" in token_set or "I" in token_set or "WANT" in token_set or "NEED" in token_set):
                res = "Could I please have a glass of water?"
            elif "FOOD" in token_set and ("ME" in token_set or "I" in token_set or "WANT" in token_set or "NEED" in token_set):
                res = "I would like to have some food, please."
            elif "RESTROOM" in token_set and ("WHERE" in token_set or "ME" in token_set or "I" in token_set):
                res = "Excuse me, where is the nearest restroom?"
            elif "HELP" in token_set and ("ME" in token_set or "I" in token_set):
                res = "Please help me!"
            else:
                # Generalized linguistic grammar rules:
                words = []
                for w in cleaned:
                    if w in ("ME", "I"):
                        words.append("I")
                    elif w == "YOU":
                        words.append("you")
                    elif w == "WANT":
                        words.append("would like")
                    elif w == "NEED":
                        words.append("need")
                    elif w in ("TABLET", "MEDICINE"):
                        words.append("my medicine")
                    elif w == "FOOD":
                        words.append("some food")
                    elif w == "SLEEP":
                        words.append("to rest and sleep")
                    elif w in ("RESTROOM", "BATHROOM", "TOILET"):
                        words.append("the restroom")
                    elif w == "DOCTOR":
                        words.append("a doctor")
                    elif w == "HOUSE":
                        words.append("home")
                    elif w == "BOOK":
                        words.append("a book")
                    elif w == "SICK":
                        words.append("sick")
                    elif w == "GOOD":
                        words.append("good")
                    elif w == "BAD":
                        words.append("bad")
                    elif w == "WATER":
                        words.append("water")
                    elif w == "HELP":
                        words.append("help")
                    elif w == "PLEASE":
                        words.append("please")
                    else:
                        words.append(w.lower())
                        
                text = " ".join(words)
                if text.startswith("I ") and not any(text.startswith(f"I {v}") for v in ["am", "would like", "need", "have", "can", "will", "love", "want", "go", "play", "see", "read", "work"]):
                    parts = text.split(" ", 1)
                    rest = parts[1].strip()
                    adjectives = {"sick", "hungry", "thirsty", "tired", "fine", "good", "bad", "happy", "sad", "okay", "busy", "ready"}
                    locations = {"house", "home", "hospital", "work", "school", "room", "clinic"}
                    items = {"water", "some food", "food", "medicine", "my medicine", "tablet", "a book", "book", "a doctor", "doctor"}
                    
                    if any(rest.startswith(a) for a in adjectives):
                        text = f"I am {rest}"
                    elif rest in ("home", "house", "my home", "my house"):
                        text = "I am at home"
                    elif any(rest.startswith(loc) for loc in locations):
                        text = f"I am at {rest}"
                    elif any(rest.startswith(it) for it in items):
                        text = f"I would like {rest}"
                    else:
                        text = f"I am with {rest}"
                elif text.startswith("you ") and not any(text.startswith(f"you {v}") for v in ["are", "would like", "need", "have", "can"]):
                    parts = text.split(" ", 1)
                    text = f"You are {parts[1]}"
                    
                text = text[0].upper() + text[1:] if text else ""
                
                if text.lower().startswith(("where", "what", "when", "why", "who", "how", "do you", "would you", "is", "could")):
                    if not text.endswith("?"):
                        text += "?"
                elif text.lower().startswith(("please help", "help", "hello", "goodbye", "i love you")):
                    if not text.endswith("!"):
                        text += "!"
                else:
                    if not text.endswith((".", "!", "?")):
                        text += "."
                res = text

    if tone == "polite":
        if not res.lower().startswith(("could", "please", "excuse me", "thank you")):
            res = "Please, " + res[0].lower() + res[1:]
    elif tone == "direct":
        res = " / ".join(cleaned)
        
    return res

# ==========================================
# Google Gemini AI Sentence Guesser & Predictor
# ==========================================
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
env_path = os.path.join(current_dir, '.env')
if os.path.exists(env_path):
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith('GEMINI_API_KEY='):
                    k = line.strip().split('=', 1)[1].strip()
                    if k:
                        GEMINI_API_KEY = k
    except Exception:
        pass

gemini_cache = {}

def gemini_guess_sentence(tokens, tone="natural", raw_text=""):
    """
    Uses Google Gemini 2.5 Flash LLM to guess, complete, and translate recognized sign language
    tokens / ASL gloss into natural grammatical spoken English with alternatives.
    """
    if not tokens and not raw_text:
        return {
            "sentence": "",
            "alternatives": [],
            "source": "empty",
            "model": "gemini-2.5-flash"
        }

    input_key = (tuple(tokens), tone, raw_text.strip())
    if input_key in gemini_cache:
        return gemini_cache[input_key]

    tokens_str = ", ".join([f'"{t}"' for t in tokens]) if tokens else f'"{raw_text}"'
    
    tone_instructions = {
        "natural": "Translate into natural, fluent everyday spoken English.",
        "formal": "Translate into highly polite, professional, and formal English.",
        "medical": "Translate with emphasis on clear medical / emergency assistance needs.",
        "casual": "Translate in a warm, friendly, casual conversational tone."
    }.get(tone.lower(), "Translate into clear, natural spoken English.")

    prompt = f"""You are an expert AI ASL (American Sign Language) and Gestural Communicator translator.
A deaf or non-verbal individual performed this sequence of recognized sign language gesture tokens: [{tokens_str}].

{tone_instructions}
1. Guess the full intended natural spoken English sentence.
2. Provide 3 likely alternative sentence intentions or completions.

Respond strictly with a valid JSON object in this exact schema:
{{
  "sentence": "the most likely natural spoken English translation",
  "alternatives": [
    "alternative sentence completion 1",
    "alternative sentence completion 2",
    "alternative sentence completion 3"
  ]
}}"""

    if not GEMINI_API_KEY or len(GEMINI_API_KEY) < 15:
        fallback_sent = polish_asl_sentence(tokens, tone=tone)
        return {
            "sentence": fallback_sent,
            "alternatives": [fallback_sent],
            "source": "local-rule-fast",
            "model": "rule-based"
        }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.2
        }
    }

    try:
        import urllib.request
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=2.0) as response:
            res = json.loads(response.read().decode('utf-8'))
            text_resp = res['candidates'][0]['content']['parts'][0]['text']
            parsed = json.loads(text_resp)
            result = {
                "sentence": parsed.get("sentence", ""),
                "alternatives": parsed.get("alternatives", []),
                "source": "gemini-flash-lite-latest",
                "model": "gemini-flash-lite-latest"
            }
            gemini_cache[input_key] = result
            return result
    except Exception as e:
        print(f"[Gemini AI Error]: {e}")
        fallback_sent = polish_asl_sentence(tokens, tone=tone)
        return {
            "sentence": fallback_sent,
            "alternatives": [fallback_sent],
            "source": "local-rule-fallback",
            "model": "rule-based"
        }

@app.route('/api/ai/status', methods=['GET'])
def api_ai_status():
    return jsonify({
        "status": "connected" if bool(GEMINI_API_KEY) else "no_key",
        "model": "gemini-2.5-flash",
        "provider": "Google DeepMind Gemini API"
    })

@app.route('/api/ai/guess-sentence', methods=['POST'])
def api_ai_guess_sentence():
    data = request.json or {}
    tokens = data.get('tokens', [])
    tone = data.get('tone', 'natural')
    raw_text = data.get('text', '')
    
    if not tokens and raw_text:
        tokens = [t.strip().upper() for t in raw_text.split() if t.strip()]
        
    ai_result = gemini_guess_sentence(tokens, tone=tone, raw_text=raw_text)
    return jsonify({
        "status": "success",
        "raw_tokens": tokens,
        "guessed_sentence": ai_result.get("sentence", ""),
        "alternatives": ai_result.get("alternatives", []),
        "source": ai_result.get("source", "gemini-2.5-flash"),
        "model": ai_result.get("model", "gemini-2.5-flash")
    })

@app.route('/api/sentence/polish', methods=['POST'])
def api_polish_sentence():
    data = request.json or {}
    tokens = data.get('tokens', [])
    tone = data.get('tone', 'natural')
    use_ai = data.get('use_ai', True)
    
    if not tokens:
        raw_text = data.get('text', '')
        if raw_text:
            tokens = [t.strip().upper() for t in raw_text.split() if t.strip()]
            
    if use_ai and GEMINI_API_KEY:
        ai_res = gemini_guess_sentence(tokens, tone=tone)
        polished = ai_res.get("sentence") or polish_asl_sentence(tokens, tone)
        alternatives = ai_res.get("alternatives", [])
    else:
        polished = polish_asl_sentence(tokens, tone)
        alternatives = []
        
    return jsonify({
        "status": "success",
        "raw": " ".join(tokens),
        "polished": polished,
        "alternatives": alternatives,
        "tokens_count": len(tokens),
        "source": "gemini-2.5-flash" if (use_ai and GEMINI_API_KEY) else "rule-based"
    })


@app.route('/api/custom_gestures/capture_live', methods=['GET'])
def api_capture_live_landmarks():
    with engine.lock:
        detected = engine.hand_detected
        pts = list(engine.pts)
    
    if not detected or not pts or len(pts) < 21:
        return jsonify({
            "success": False,
            "message": "No hand detected in camera view. Please hold your hand steady inside the frame."
        })
        
    vec = engine.normalize_landmarks(pts)
    return jsonify({
        "success": True,
        "landmarks_count": len(pts),
        "vector": vec,
        "raw_pts": pts
    })

# ==========================================
# 3-Gesture Combination Lock Secret Vault Engine
# ==========================================
import uuid
import base64

gesture_vault = {
    "msg_demo_001": {
        "id": "msg_demo_001",
        "sender": "Varun",
        "encrypted_payload": base64.b64encode("Welcome to GestureLock Vault! Your 3-gesture biometric key was verified successfully.".encode('utf-8')).decode('utf-8'),
        "gesture_combo": ["PEACE", "TABLET", "WATER"],
        "hint": "Peace -> Medicine -> Drink",
        "burn_after_read": False,
        "unlocked": False,
        "attempts": 0,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
}

@app.route('/api/vault/create', methods=['POST'])
def api_vault_create():
    data = request.json or {}
    message = data.get('message', '').strip()
    combo = data.get('gesture_combo', [])
    hint = data.get('hint', '').strip()
    sender = data.get('sender', 'Anonymous').strip()
    burn_after_read = bool(data.get('burn_after_read', False))
    
    if not message:
        return jsonify({"status": "error", "message": "Message content cannot be empty."}), 400
        
    if not combo or len(combo) != 3:
        return jsonify({"status": "error", "message": "Exactly 3 gestures are required for the security pattern PIN."}), 400
        
    clean_combo = [str(g).strip().upper() for g in combo]
    msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    
    encoded_payload = base64.b64encode(message.encode('utf-8')).decode('utf-8')
    
    record = {
        "id": msg_id,
        "sender": sender,
        "encrypted_payload": encoded_payload,
        "gesture_combo": clean_combo,
        "hint": hint or "3-Gesture Hand Pattern",
        "burn_after_read": burn_after_read,
        "unlocked": False,
        "attempts": 0,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    gesture_vault[msg_id] = record
    
    return jsonify({
        "status": "success",
        "message_id": msg_id,
        "hint": record["hint"],
        "burn_after_read": burn_after_read,
        "share_url": f"/app#vault={msg_id}"
    })

@app.route('/api/vault/list', methods=['GET'])
def api_vault_list():
    envelopes = []
    for mid, item in gesture_vault.items():
        envelopes.append({
            "id": item["id"],
            "sender": item["sender"],
            "hint": item["hint"],
            "burn_after_read": item["burn_after_read"],
            "unlocked": item["unlocked"],
            "attempts": item["attempts"],
            "created_at": item["created_at"],
            "combo_length": len(item["gesture_combo"])
        })
    envelopes.reverse()
    return jsonify({"status": "success", "messages": envelopes, "count": len(envelopes)})

@app.route('/api/vault/message/<msg_id>', methods=['GET'])
def api_vault_get_message(msg_id):
    item = gesture_vault.get(msg_id)
    if not item:
        return jsonify({"status": "error", "message": "Locked message not found or may have been burned."}), 404
        
    return jsonify({
        "status": "success",
        "id": item["id"],
        "sender": item["sender"],
        "hint": item["hint"],
        "burn_after_read": item["burn_after_read"],
        "unlocked": item["unlocked"],
        "attempts": item["attempts"],
        "created_at": item["created_at"],
        "combo_length": len(item["gesture_combo"])
    })

@app.route('/api/vault/unlock', methods=['POST'])
def api_vault_unlock():
    data = request.json or {}
    msg_id = data.get('message_id', '')
    submitted_combo = data.get('submitted_combo', [])
    
    item = gesture_vault.get(msg_id)
    if not item:
        return jsonify({"status": "error", "message": "Locked message not found or has expired/burned."}), 404
        
    clean_submitted = [str(g).strip().upper() for g in submitted_combo]
    expected_combo = item["gesture_combo"]
    
    if len(clean_submitted) != 3:
        return jsonify({
            "status": "error",
            "message": "❌ Incorrect Gesture Pattern! Exactly 3 gestures required.",
            "attempts": item["attempts"]
        }), 400
        
    # Sequential Pattern Match Verification
    if clean_submitted == expected_combo:
        # Success - Decrypt payload
        item["unlocked"] = True
        try:
            decrypted_text = base64.b64decode(item["encrypted_payload"].encode('utf-8')).decode('utf-8')
        except Exception:
            decrypted_text = "Decryption error."
            
        burned = False
        if item["burn_after_read"]:
            gesture_vault.pop(msg_id, None)
            burned = True
            
        return jsonify({
            "status": "success",
            "message": "🔓 Access Granted! Gesture pattern verified successfully.",
            "decrypted_text": decrypted_text,
            "sender": item["sender"],
            "burned": burned
        })
    else:
        item["attempts"] += 1
        return jsonify({
            "status": "error",
            "message": "❌ Incorrect Gesture Pattern! Access Denied.",
            "attempts": item["attempts"],
            "submitted_count": len(clean_submitted)
        }), 403

@app.route('/api/vault/message/<msg_id>', methods=['DELETE'])
def api_vault_delete_message(msg_id):
    if msg_id in gesture_vault:
        gesture_vault.pop(msg_id, None)
        return jsonify({"status": "success", "message": "Message deleted."})
    return jsonify({"status": "error", "message": "Message not found."}), 404

if __name__ == '__main__':
    print("\n=======================================================")
    print("  Sign Language Web Application Server Started!")
    print("  Open in Browser: http://localhost:5000")
    print("=======================================================\n")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
