# 🤟 SpeechLess — AI Hand Gesture Communication

> An AI-powered hand gesture recognition system that enables speech-impaired individuals to communicate using real-time webcam-based sign language detection.

---

## 📋 Table of Contents

1. [Objective of the Milestone](#1-objective-of-the-milestone)
2. [Methodology / Process Followed](#2-methodology--process-followed)
3. [Results / Progress Achieved](#3-results--progress-achieved)
4. [Problems Faced](#4-problems-faced)
5. [Conclusion](#5-conclusion)

---

## 1. Objective of the Milestone

The primary objective of this milestone was to build a **fully functional, browser-based sign language translator** that bridges the communication gap for speech-impaired individuals — without requiring any specialized hardware beyond a standard webcam.

### Specific Goals

| Goal | Description |
|------|-------------|
| 🎯 Real-time gesture detection | Detect hand gestures from a live webcam feed with minimal latency |
| 🌐 Multilingual support | Translate recognized gestures into English and Hindi |
| 🔊 Voice output | Speak out the detected gesture using browser-native Text-to-Speech (TTS) |
| 📡 ESP32-CAM integration | Extend the system to work with an ESP32-CAM hardware module over Wi-Fi |
| ♿ Accessibility-first design | Build an intuitive, clean UI usable by individuals with communication challenges |

### Target Users

- Individuals with speech impairments or hearing loss
- Caregivers and assistants working with non-verbal individuals
- Educators and researchers in assistive technology

---

## 2. Methodology / Process Followed

### 2.1 System Architecture

The project was built in **two parallel tracks**:

```
Track 1: Browser-Only (Webcam)          Track 2: ESP32-CAM Hardware
┌────────────────────────────┐          ┌────────────────────────────┐
│  Browser Webcam            │          │  ESP32-CAM (AI-Thinker)    │
│  → MediaPipe HandLandmarker│          │  → Captures JPEG frames     │
│  → Gesture Classification  │          │  → Serves /capture endpoint │
│  → UI Display              │          │  → Self-contained Web UI   │
│  → Web Speech API (TTS)    │          │  → MediaPipe in browser     │
└────────────────────────────┘          └────────────────────────────┘
```

---

### 2.2 Technology Stack

| Component | Technology Used |
|-----------|----------------|
| Frontend UI | HTML5, CSS3, Vanilla JavaScript |
| Hand Detection | [MediaPipe HandLandmarker](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) (Tasks Vision API v0.10.18) |
| TTS (Voice Output) | Web Speech API (`SpeechSynthesisUtterance`) |
| Hardware Firmware | Arduino C++ for ESP32-CAM (AI-Thinker board) |
| Camera Streaming | ESP32 HTTP Server — `/capture` (JPEG polling) and `/stream` (MJPEG) |
| Fonts | Google Fonts — Inter |

---

### 2.3 Gesture Recognition Algorithm

The recognition pipeline follows these steps for every video frame:

```
Webcam Frame
     │
     ▼
MediaPipe HandLandmarker
(21 normalized 3D landmarks)
     │
     ▼
Finger State Detection (Curl-Ratio + Hysteresis)
  ┌──────────────────────────────────────────┐
  │  • Thumb: tip-to-index-MCP distance ratio│
  │  • Index/Middle/Ring/Pinky: curl ratio   │
  │    curlRatio = fingerLen / fingerBase    │
  │  • Hysteresis thresholds: UP=1.6, DN=1.2│
  └──────────────────────────────────────────┘
     │
     ▼
Binary Finger Pattern (e.g., "01000")
     │
     ▼
Gesture Map Lookup
     │
     ▼
Majority-Vote Smoothing Buffer (7 frames)
     │
     ▼
Confirmed Gesture → Display + TTS
```

**Supported Gestures:**

| Gesture Pattern | Fingers Up | Detected Word |
|----------------|------------|---------------|
| `01000` | Index only | Hello |
| `10000` | Thumb only | Good |
| `11111` | All 5 fingers | Stop |
| `00000` | Closed fist | Sorry |
| `01100` | Index + Middle (V sign) | Thank You |
| `00001` | Pinky only | Bye |
| `11000` | Thumb + Index | Yes |
| `10001` | Thumb + Pinky | No |
| `01110` | Index + Middle + Ring | Help |

---

### 2.4 Anti-Jitter & Stability Mechanisms

Multiple layers were implemented to prevent flickering and false detections:

1. **Confidence Threshold** — Only accepts hand detections with `score ≥ 0.65`
2. **Hysteresis** — Finger state changes require crossing different UP/DOWN thresholds
3. **Majority-Vote Buffer** — Gesture must dominate in 7 consecutive frames (>50%)
4. **Gesture Cooldown** — Minimum 600ms between display updates
5. **TTS Cooldown** — Minimum 2500ms between spoken outputs
6. **No-Hand Debounce** — 8 frames of no-hand before resetting (avoids brief occlusion flicker)

---

### 2.5 ESP32-CAM Firmware

The hardware track involved programming an **AI-Thinker ESP32-CAM** to:

- Serve a self-contained web UI stored in flash (`PROGMEM`)
- Expose HTTP endpoints: `GET /`, `GET /capture`, `GET /stream`, `GET /status`
- Stream JPEG frames via polling to the browser
- Run MediaPipe hand detection in-browser on the received frames
- Send JSON status (`uptime`, `fps`, `heap`) every 5 seconds
- Auto-reconnect to Wi-Fi and restart on connection failure

**Camera Configuration:**
- Resolution: `QVGA (320×240)`
- JPEG quality: 12
- Frame buffers: 2 (PSRAM) / 1 (DRAM fallback)
- GPU delegate: Tried first, falls back to CPU automatically

---

## 3. Results / Progress Achieved

### ✅ Completed Features

| Feature | Status |
|---------|--------|
| Real-time webcam hand detection (browser) | ✅ Complete |
| 9-gesture classification with finger-state algorithm | ✅ Complete |
| Multilingual display (English + Hindi) | ✅ Complete |
| Voice output using Web Speech API | ✅ Complete |
| FPS counter and live performance badge | ✅ Complete |
| Finger status indicator panel (UP/DOWN) | ✅ Complete |
| Live subtitle bar with detected gesture | ✅ Complete |
| Floating gesture guide panel | ✅ Complete |
| GPU/CPU auto-fallback for MediaPipe | ✅ Complete |
| ESP32-CAM firmware with MJPEG + JPEG polling | ✅ Complete |
| ESP32-CAM self-hosted web UI with hand detection | ✅ Complete |
| Wi-Fi auto-reconnect and restart logic | ✅ Complete |
| Gesture history log (ESP32 version) | ✅ Complete |

### 📊 Performance Metrics (Observed)

| Metric | Result |
|--------|--------|
| Detection framerate (browser) | ~25–60 FPS (GPU delegate) |
| Gesture confirmation latency | ~400–700 ms |
| TTS response latency | <200 ms (browser TTS) |
| ESP32-CAM JPEG polling rate | ~8–12 FPS (Wi-Fi dependent) |
| Hand detection confidence threshold | 0.65–0.70 |

### 🌍 Languages Supported

| Language | Code | Sample Translation |
|----------|------|--------------------|
| English | `en` | "Hello", "Thank You", "Help" |
| Hindi | `hi` | "नमस्ते", "धन्यवाद", "मदद" |

---

## 4. Problems Faced

### 4.1 Gesture Jitter / False Positives

**Problem:** Initial versions displayed rapidly flickering gestures even when the hand was held still, particularly for the closed-fist ("Sorry") and thumb gestures.

**Root Cause:** MediaPipe landmark coordinates have minor frame-to-frame variance, causing finger state to toggle on threshold boundaries.

**Solution:** Implemented a **dual-threshold hysteresis** system (separate UP and DOWN ratios) combined with a **7-frame majority-vote buffer**. This eliminated visible jitter while keeping sub-second latency.

---

### 4.2 Thumb Detection Unreliability

**Problem:** The thumb was the most difficult finger to classify — it moves laterally, not vertically, and behaves differently for left vs. right hands.

**Root Cause:** Early approaches used `y`-coordinate comparison (tip above base), which fails when the thumb points sideways.

**Solution:** Replaced with a **normalized tip-to-index-MCP distance ratio** (`thumbSpan / handSize`), which is:
- Independent of hand orientation
- Scale-invariant (works at any camera distance)
- Handedness-agnostic (no MediaPipe label needed)

---

### 4.3 ESP32-CAM Memory Overflow (`FB-OVF`)

**Problem:** The ESP32-CAM frequently crashed with frame buffer overflow errors at startup, causing the firmware to restart in a loop.

**Root Cause:** Frame buffers were not flushed before the HTTP server started, causing stale frames to accumulate.

**Solution:** Added a **3-frame flush loop** after camera initialization with `esp_camera_fb_get()` / `esp_camera_fb_return()` + `delay(50)` between each. Also switched to `CAMERA_GRAB_WHEN_EMPTY` mode.

---

### 4.4 MediaPipe WASM Loading Failures (Browser)

**Problem:** MediaPipe Tasks Vision API occasionally failed to load the WASM runtime in certain browser/GPU driver combinations.

**Root Cause:** Some browsers block GPU access for WASM worklets, or GPU delegate initialization fails silently.

**Solution:** Wrapped `HandLandmarker.createFromOptions()` in a `try/catch` block — **tries GPU first**, then automatically **falls back to CPU delegate** with a console warning.

---

### 4.5 Camera Permission Denied (No Recovery)

**Problem:** When camera access was denied by the browser, the UI showed a loading spinner indefinitely with no user feedback.

**Solution:** Added a dedicated **error overlay** (`#errorOverlay`) shown on `getUserMedia()` failure, with a "Retry" button that reloads the page.

---

### 4.6 ESP32-CAM Single-Core Memory Constraint

**Problem:** The ESP32 has limited RAM (~320KB DRAM available to the app). Embedding the full web UI HTML/CSS/JS in `PROGMEM` and serving it over HTTP caused stack overflows on large single-send calls.

**Solution:** Switched to **chunked HTTP responses** (4KB chunks) using `httpd_resp_send_chunk()`, which is safer and more reliable than attempting a single large `httpd_resp_send()`.

---

## 5. Conclusion

### Summary

The **SpeechLess** project successfully demonstrates a low-cost, accessible, and real-time hand gesture communication system. It achieves its core objective of enabling speech-impaired individuals to communicate common phrases through hand signs — with no specialized hardware required for the browser-based version.

The milestone delivered:
- A **polished, production-quality web UI** with gesture visualization, voice output, multilingual support, and live performance indicators
- A **robust gesture classification pipeline** using MediaPipe landmarks, curl-ratio finger detection, hysteresis, and temporal smoothing
- A **self-contained ESP32-CAM firmware** that streams camera frames and runs hand detection entirely over a local Wi-Fi network

### Key Learnings

1. **Landmark geometry > raw coordinates** — Using ratios and distances (rather than raw x/y positions) makes gesture detection robust to scale, distance, and orientation changes.
2. **Temporal smoothing is essential** — Even a 7-frame majority vote dramatically improves user experience without introducing noticeable lag.
3. **Graceful degradation matters** — GPU→CPU fallback and camera error overlays made the system significantly more robust across devices.
4. **Embedded web UIs on microcontrollers are feasible** — PROGMEM + chunked HTTP serving allows a complete interactive UI to be served from an ESP32's flash.

### Future Scope

- [ ] Add more gestures (full ASL/ISL alphabet support)
- [ ] Bengali (`bn`) language translation support (partially scaffolded)
- [ ] Machine learning-based gesture model (replace rule-based classifier)
- [ ] Mobile-responsive layout improvements for phone cameras
- [ ] Offline PWA support with cached MediaPipe WASM assets
- [ ] Two-hand gesture recognition

---

## 🚀 Quick Start

### Browser Version (No Hardware Required)

1. Clone this repository:
   ```bash
   git clone https://github.com/Biltu-Samanta/speech-less-translator.git
   cd speech-less-translator
   ```

2. Open `index.html` in any modern browser (Chrome recommended for best MediaPipe performance).

3. Allow camera access when prompted — detection starts automatically.

### ESP32-CAM Version

1. Open `esp32cam_stream.ino` in **Arduino IDE**.
2. Update the WiFi credentials:
   ```cpp
   const char* WIFI_SSID     = "YourNetworkName";
   const char* WIFI_PASSWORD = "YourPassword";
   ```
3. Select board: **AI-Thinker ESP32-CAM** and upload.
4. Open Serial Monitor at **115200 baud** to find the device IP address.
5. Navigate to `http://<device-ip>` in your browser and click **Connect**.

---

## 📁 Project Structure

```
speech-less-translator/
├── index.html          # Main browser UI — layout and structure
├── style.css           # Glassmorphism UI design, dark/light tokens
├── script.js           # MediaPipe integration, gesture logic, TTS
└── esp32cam_stream.ino # ESP32-CAM firmware (camera + embedded web UI)
```

---

## 🛠️ Tech & Tools

- **MediaPipe Tasks Vision** — Hand landmark detection
- **Web Speech API** — Text-to-speech output
- **ESP-IDF HTTP Server** — Embedded HTTP server on ESP32
- **Arduino IDE** — ESP32-CAM firmware development
- **Google Fonts (Inter)** — Typography

---

*Built with ❤️ for accessibility.*