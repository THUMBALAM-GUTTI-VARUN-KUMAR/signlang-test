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
        self.hd2 = None
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
        self.skeleton_frame = None
        
        self.initialize_engine()

    def initialize_engine(self):
        print("[Engine] Loading model...")
        self.model = load_model(model_path)
        print("[Engine] Initializing detectors...")
        self.hd = HandDetector(maxHands=1)
        self.hd2 = HandDetector(maxHands=1)
        try:
            self.dict_enchant = enchant.Dict("en-US")
        except Exception as e:
            print(f"[Engine] Enchant warning: {e}")
            self.dict_enchant = None
            
        print("[Engine] Initializing camera...")
        self.vs = cv2.VideoCapture(0)
        self.running = True
        self.thread = threading.Thread(target=self._process_camera_loop, daemon=True)
        self.thread.start()

    def distance(self, x, y):
        return math.sqrt(((x[0] - y[0]) ** 2) + ((x[1] - y[1]) ** 2))

    def _process_camera_loop(self):
        while self.running:
            if not self.vs or not self.vs.isOpened():
                time.sleep(0.1)
                continue
                
            success, frame = self.vs.read()
            if not success or frame is None:
                time.sleep(0.03)
                continue
                
            frame = cv2.flip(frame, 1)
            cv2image_copy = np.array(frame)
            
            white = cv2.imread(white_path)
            if white is None:
                white = np.ones((400, 400, 3), np.uint8) * 255
            else:
                white = white.copy()

            hands, _ = self.hd.findHands(frame, draw=False, flipType=True)
            detected = False
            
            if hands:
                hand = hands[0]
                x, y, w, h = hand['bbox']
                # Safe crop with boundary checks
                ymin = max(0, y - self.offset)
                ymax = min(frame.shape[0], y + h + self.offset)
                xmin = max(0, x - self.offset)
                xmax = min(frame.shape[1], x + w + self.offset)
                
                image = cv2image_copy[ymin:ymax, xmin:xmax]
                
                if image.size > 0:
                    handz, _ = self.hd2.findHands(image, draw=False, flipType=True)
                    if handz:
                        hand_inner = handz[0]
                        self.pts = hand_inner['lmList']
                        detected = True
                        
                        os_x = ((400 - w) // 2) - 15
                        os_y = ((400 - h) // 2) - 15
                        
                        # Draw hand skeletal connections on white canvas
                        for t in range(0, 4, 1):
                            cv2.line(white, (self.pts[t][0] + os_x, self.pts[t][1] + os_y),
                                     (self.pts[t + 1][0] + os_x, self.pts[t + 1][1] + os_y), (0, 255, 0), 3)
                        for t in range(5, 8, 1):
                            cv2.line(white, (self.pts[t][0] + os_x, self.pts[t][1] + os_y),
                                     (self.pts[t + 1][0] + os_x, self.pts[t + 1][1] + os_y), (0, 255, 0), 3)
                        for t in range(9, 12, 1):
                            cv2.line(white, (self.pts[t][0] + os_x, self.pts[t][1] + os_y),
                                     (self.pts[t + 1][0] + os_x, self.pts[t + 1][1] + os_y), (0, 255, 0), 3)
                        for t in range(13, 16, 1):
                            cv2.line(white, (self.pts[t][0] + os_x, self.pts[t][1] + os_y),
                                     (self.pts[t + 1][0] + os_x, self.pts[t + 1][1] + os_y), (0, 255, 0), 3)
                        for t in range(17, 20, 1):
                            cv2.line(white, (self.pts[t][0] + os_x, self.pts[t][1] + os_y),
                                     (self.pts[t + 1][0] + os_x, self.pts[t + 1][1] + os_y), (0, 255, 0), 3)
                                     
                        cv2.line(white, (self.pts[5][0] + os_x, self.pts[5][1] + os_y), (self.pts[9][0] + os_x, self.pts[9][1] + os_y), (0, 255, 0), 3)
                        cv2.line(white, (self.pts[9][0] + os_x, self.pts[9][1] + os_y), (self.pts[13][0] + os_x, self.pts[13][1] + os_y), (0, 255, 0), 3)
                        cv2.line(white, (self.pts[13][0] + os_x, self.pts[13][1] + os_y), (self.pts[17][0] + os_x, self.pts[17][1] + os_y), (0, 255, 0), 3)
                        cv2.line(white, (self.pts[0][0] + os_x, self.pts[0][1] + os_y), (self.pts[5][0] + os_x, self.pts[5][1] + os_y), (0, 255, 0), 3)
                        cv2.line(white, (self.pts[0][0] + os_x, self.pts[0][1] + os_y), (self.pts[17][0] + os_x, self.pts[17][1] + os_y), (0, 255, 0), 3)

                        for i in range(21):
                            cv2.circle(white, (self.pts[i][0] + os_x, self.pts[i][1] + os_y), 3, (0, 0, 255), -1)

                        # Overlay bounding box on camera frame
                        cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), (0, 230, 115), 2)
                        
                        # Run classification
                        self._predict(white)

            with self.lock:
                self.hand_detected = detected
                self.raw_frame = frame
                self.skeleton_frame = white
                
            time.sleep(0.02)

    def _predict(self, test_image):
        white = test_image.reshape(1, 400, 400, 3)
        prob = np.array(self.model.predict(white, verbose=0)[0], dtype='float32')
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
                "symbol": self.current_symbol,
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

def gen_frames(feed_type='camera'):
    while True:
        frame = None
        with engine.lock:
            if feed_type == 'camera' and engine.raw_frame is not None:
                frame = engine.raw_frame.copy()
            elif feed_type == 'skeleton' and engine.skeleton_frame is not None:
                frame = engine.skeleton_frame.copy()
                
        if frame is None:
            frame = np.zeros((400, 400, 3), np.uint8)
            cv2.putText(frame, "Waiting for Camera...", (50, 200),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                        
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.03)

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

if __name__ == '__main__':
    print("\n=======================================================")
    print("  Sign Language Web Application Server Started!")
    print("  Open in Browser: http://localhost:5000")
    print("=======================================================\n")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
