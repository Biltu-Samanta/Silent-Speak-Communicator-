const TTS_COOLDOWN_MS = 2500;

const GESTURE_COOLDOWN_MS = 600;

const GESTURE_CONFIRM_FRAMES = 7;

const MIN_HAND_PRESENCE_CONFIDENCE = 0.65;


const TRANSLATIONS = {
    en: {
        Hello: "Hello", Good: "Good", Stop: "Stop",
        Sorry: "Sorry", "Thank You": "Thank You", Bye: "Bye",
        Yes: "Yes", No: "No", Help: "Help",
    },
    hi: {
        Hello: "नमस्ते", Good: "अच्छा", Stop: "रुको",
        Sorry: "माफ़ कीजिए", "Thank You": "धन्यवाद", Bye: "अलविदा",
        Yes: "हाँ", No: "नहीं", Help: "मदद",
    },
};


const GESTURE_MAP = {
    "01000": "Hello",
    "10000": "Good",
    "11111": "Stop",
    "00000": "Sorry",
    "01100": "Thank You",
    "00001": "Bye",
    "11000": "Yes",
    "10001": "No",
    "01110": "Help",
};


const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
];


const webcamEl         = document.getElementById("webcam");
const canvasEl         = document.getElementById("outputCanvas");
const canvasCtx        = canvasEl.getContext("2d");

const cameraOverlay    = document.getElementById("cameraOverlay");
const errorOverlay     = document.getElementById("errorOverlay");
const startBtn         = document.getElementById("startBtn");
const stopBtn          = document.getElementById("stopBtn");

const gestureTextEl    = document.getElementById("gestureText");
const translatedTextEl = document.getElementById("translatedText");
const fpsBadgeEl       = document.getElementById("fpsBadge");
const subtitleTextEl   = document.getElementById("subtitleText");
const gestureCardEl    = document.getElementById("gestureCard");

const voiceToggleEl    = document.getElementById("voiceToggle");
const voiceStatusText  = document.getElementById("voiceStatusText");
const statusDotEl      = document.getElementById("statusDot");
const voiceInfoEl      = document.getElementById("voiceInfo");

const languageSelectEl = document.getElementById("languageSelect");
const guideToggleEl    = document.getElementById("guideToggle");
const guidePanelEl     = document.getElementById("guidePanel");

const fingerEls = {
    thumb:  document.getElementById("finger-thumb"),
    index:  document.getElementById("finger-index"),
    middle: document.getElementById("finger-middle"),
    ring:   document.getElementById("finger-ring"),
    pinky:  document.getElementById("finger-pinky"),
};


let handLandmarker = null;
let isDetecting = false;
let animationFrameId = null;

let currentLanguage = "en";
let voiceEnabled = true;

let lastGesture = "";
let lastGestureTime = 0;
let lastTTSTime = 0;
let lastTTSGesture = "";

let prevFrameTime = performance.now();

const gestureBuffer = [];

let noHandFrameCount = 0;
const NO_HAND_DEBOUNCE_FRAMES = 8;


async function init() {
    console.log("SpeechLess — Initialising...");

    setupEventListeners();

    voiceInfoEl.textContent = "Browser Voice TTS — English & Hindi";

    try {
        await initMediaPipe();
        console.log("MediaPipe HandLandmarker loaded");
    } catch (err) {
        console.error("Failed to load MediaPipe:", err);
        cameraOverlay.querySelector("p").textContent =
            "Failed to load AI model. Please refresh.";
        return;
    }

    try {
        await initWebcam();
        console.log("Webcam stream active");
    } catch (err) {
        console.error("Webcam access denied:", err);
        cameraOverlay.style.display = "none";
        errorOverlay.style.display = "flex";
        return;
    }

    cameraOverlay.style.display = "none";
    startBtn.disabled = false;

    startDetection();
}


async function initMediaPipe() {
    const vision = await import(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs"
    );

    const { HandLandmarker, FilesetResolver } = vision;

    const wasmFileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
    );

    const modelAssetPath =
        "https://storage.googleapis.com/mediapipe-models/" +
        "hand_landmarker/hand_landmarker/float16/latest/" +
        "hand_landmarker.task";

    const commonOptions = {
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.7,
        minHandPresenceConfidence: 0.7,
        minTrackingConfidence: 0.6,
    };

    try {
        handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
            ...commonOptions,
            baseOptions: { modelAssetPath, delegate: "GPU" },
        });
        console.log("HandLandmarker: GPU delegate active");
    } catch (gpuErr) {
        console.warn("GPU delegate failed, falling back to CPU:", gpuErr.message);
        handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
            ...commonOptions,
            baseOptions: { modelAssetPath, delegate: "CPU" },
        });
        console.log("HandLandmarker: CPU delegate active");
    }
}


async function initWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
        },
        audio: false,
    });

    webcamEl.srcObject = stream;

    await new Promise((resolve) => {
        webcamEl.onloadedmetadata = () => {
            canvasEl.width = webcamEl.videoWidth;
            canvasEl.height = webcamEl.videoHeight;
            resolve();
        };
    });
}


function startDetection() {
    if (isDetecting) return;
    isDetecting = true;

    startBtn.disabled = true;
    stopBtn.disabled = false;

    gestureBuffer.length = 0;
    noHandFrameCount = 0;

    console.log("Detection started");
    detectFrame();
}


function stopDetection() {
    isDetecting = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;

    console.log("Detection stopped");
}


function detectFrame() {
    if (!isDetecting) return;

    const now = performance.now();

    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(webcamEl, -canvasEl.width, 0, canvasEl.width, canvasEl.height);
    canvasCtx.restore();

    let results = null;
    try {
        results = handLandmarker.detectForVideo(webcamEl, now);
    } catch (err) {
    }

    const handPresent =
        results &&
        results.landmarks &&
        results.landmarks.length > 0 &&
        isHandConfident(results);

    if (handPresent) {
        noHandFrameCount = 0;

        const landmarks = results.landmarks[0];

        drawHandLandmarks(landmarks);

        const fingers = detectFingers(landmarks, results);

        updateFingerUI(fingers);

        const rawGesture = recogniseGesture(fingers);

        gestureBuffer.push(rawGesture);
        if (gestureBuffer.length > GESTURE_CONFIRM_FRAMES) gestureBuffer.shift();

        if (gestureBuffer.length === GESTURE_CONFIRM_FRAMES) {
            const confirmedGesture = getMajorityGesture(gestureBuffer);

            if (
                confirmedGesture &&
                (now - lastGestureTime > GESTURE_COOLDOWN_MS || confirmedGesture !== lastGesture)
            ) {
                updateGestureDisplay(confirmedGesture);
                lastGesture = confirmedGesture;
                lastGestureTime = now;

                if (
                    voiceEnabled &&
                    (now - lastTTSTime > TTS_COOLDOWN_MS || confirmedGesture !== lastTTSGesture)
                ) {
                    triggerTTS(confirmedGesture);
                    lastTTSTime = now;
                    lastTTSGesture = confirmedGesture;
                }
            }
        }
    } else {
        noHandFrameCount++;
        if (noHandFrameCount >= NO_HAND_DEBOUNCE_FRAMES) {
            gestureBuffer.length = 0;
            updateFingerUI([false, false, false, false, false]);
        }
    }

    const fps = 1000 / (now - prevFrameTime + 0.1);
    prevFrameTime = now;
    fpsBadgeEl.textContent = `${Math.round(fps)} FPS`;

    animationFrameId = requestAnimationFrame(detectFrame);
}


function isHandConfident(results) {
    if (results.handedness && results.handedness.length > 0) {
        const score = results.handedness[0][0]?.score ?? 1.0;
        return score >= MIN_HAND_PRESENCE_CONFIDENCE;
    }
    return true;
}


function getMajorityGesture(buffer) {
    const counts = {};
    let maxCount = 0;
    let majority = null;

    for (const key of buffer) {
        if (key === null) continue;
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] > maxCount) {
            maxCount = counts[key];
            majority = key;
        }
    }

    return maxCount > buffer.length / 2 ? majority : null;
}


function drawHandLandmarks(landmarks) {
    const w = canvasEl.width;
    const h = canvasEl.height;

    const points = landmarks.map(lm => ({
        x: (1.0 - lm.x) * w,
        y: lm.y * h,
    }));

    canvasCtx.strokeStyle = "rgba(0, 109, 104, 0.75)";
    canvasCtx.lineWidth = 2.5;

    for (const [start, end] of HAND_CONNECTIONS) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(points[start].x, points[start].y);
        canvasCtx.lineTo(points[end].x, points[end].y);
        canvasCtx.stroke();
    }

    for (let i = 0; i < points.length; i++) {
        const { x, y } = points[i];
        const isTip = [4, 8, 12, 16, 20].includes(i);

        canvasCtx.beginPath();
        canvasCtx.arc(x, y, isTip ? 6 : 3.5, 0, 2 * Math.PI);
        canvasCtx.fillStyle = isTip ? "#F0EDE5" : "rgba(0, 109, 104, 0.9)";
        canvasCtx.fill();

        canvasCtx.strokeStyle = "#004643";
        canvasCtx.lineWidth = 1.5;
        canvasCtx.stroke();
    }
}


const fingerStates = [false, false, false, false, false];

function landmarkDist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function detectFingers(landmarks, results) {
    if (!landmarks || landmarks.length < 21) return [false, false, false, false, false];

    let isRightHandModel = true;
    if (results && results.handedness && results.handedness.length > 0) {
        const label = results.handedness[0][0]?.categoryName ?? "Right";
        isRightHandModel = (label === "Right");
    }

    const handSize   = landmarkDist(landmarks[0], landmarks[9]);
    const thumbSpan  = landmarkDist(landmarks[4], landmarks[5]);
    const thumbRatio = handSize > 0.01 ? thumbSpan / handSize : 0;

    const thumbGoUp   = 0.48;
    const thumbGoDown = 0.32;

    if (fingerStates[0]) {
        if (thumbRatio < thumbGoDown) fingerStates[0] = false;
    } else {
        if (thumbRatio > thumbGoUp)   fingerStates[0] = true;
    }

    const fingerLandmarks = [
        [5,  6,  7,  8],
        [9,  10, 11, 12],
        [13, 14, 15, 16],
        [17, 18, 19, 20],
    ];

    const goUpRatio   = 1.6;
    const goDownRatio = 1.2;

    for (let i = 0; i < fingerLandmarks.length; i++) {
        const [mcp, pip, , tip] = fingerLandmarks[i];
        const fingerLen  = landmarkDist(landmarks[mcp], landmarks[tip]);
        const fingerBase = landmarkDist(landmarks[mcp], landmarks[pip]);

        if (fingerBase < 0.001) continue;

        const curlRatio = fingerLen / fingerBase;
        const stateIdx = i + 1;

        const tipAbovePip = landmarks[tip].y < landmarks[pip].y;

        if (fingerStates[stateIdx]) {
            if (curlRatio < goDownRatio || !tipAbovePip) {
                fingerStates[stateIdx] = false;
            }
        } else {
            if (curlRatio > goUpRatio && tipAbovePip) {
                fingerStates[stateIdx] = true;
            }
        }
    }

    return [...fingerStates];
}

function recogniseGesture(fingers) {
    const key = fingers.map(f => f ? "1" : "0").join("");
    return GESTURE_MAP[key] || null;
}


function updateFingerUI(fingers) {
    const names = ["thumb", "index", "middle", "ring", "pinky"];
    names.forEach((name, i) => {
        const el = fingerEls[name];
        const stateEl = el.querySelector(".finger-state");
        const isUp = fingers[i];
        el.classList.toggle("active", isUp);
        if (stateEl) {
            stateEl.textContent = isUp ? "UP" : "DOWN";
            stateEl.style.color = isUp ? "var(--finger-up)" : "var(--text-muted)";
        }
    });
}

function updateGestureDisplay(gesture) {
    const langMap = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
    const translated = langMap[gesture] || gesture;

    gestureTextEl.textContent = gesture;
    translatedTextEl.textContent = currentLanguage !== "en" ? translated : "";

    gestureTextEl.classList.remove("pulse");
    void gestureTextEl.offsetWidth;
    gestureTextEl.classList.add("pulse");

    subtitleTextEl.textContent = currentLanguage === "en" ? gesture : `${translated} (${gesture})`;
    subtitleTextEl.classList.add("active");
    setTimeout(() => subtitleTextEl.classList.remove("active"), 1500);

    console.log(`[GESTURE] ${gesture} → ${translated}`);
}


function triggerTTS(gesture) {
    const langMap = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
    const textToSpeak = langMap[gesture] || gesture;
    speakBrowser(textToSpeak, currentLanguage);
}

function speakBrowser(text, language) {
    if (!("speechSynthesis" in window)) {
        console.warn("Browser does not support speech synthesis.");
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langCodes = { en: "en-US", hi: "hi-IN" };
    utterance.lang = langCodes[language] || "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onstart = () => updateVoiceStatus("speaking", "Speaking...");
    utterance.onend   = () => updateVoiceStatus("ready", "Ready");
    utterance.onerror = () => updateVoiceStatus("ready", "Ready");
    window.speechSynthesis.speak(utterance);
}

function updateVoiceStatus(state, text) {
    voiceStatusText.textContent = text;
    statusDotEl.classList.remove("speaking", "error");
    if (state === "speaking") statusDotEl.classList.add("speaking");
    else if (state === "error") statusDotEl.classList.add("error");
}


function setupEventListeners() {
    startBtn.addEventListener("click", startDetection);
    stopBtn.addEventListener("click", stopDetection);

    voiceToggleEl.addEventListener("click", () => {
        voiceEnabled = !voiceEnabled;
        voiceToggleEl.textContent = voiceEnabled ? "Voice On" : "Voice Off";
        voiceToggleEl.classList.toggle("btn-accent", voiceEnabled);
        voiceToggleEl.classList.toggle("btn-secondary", !voiceEnabled);
    });

    languageSelectEl.addEventListener("change", (e) => {
        currentLanguage = e.target.value;
        console.log("Language changed to:", currentLanguage);
        if (lastGesture) updateGestureDisplay(lastGesture);
    });

    guideToggleEl.addEventListener("click", () => {
        const panel = guidePanelEl;
        panel.style.display = panel.style.display === "none" ? "block" : "none";
    });

    document.addEventListener("click", (e) => {
        if (!guidePanelEl.contains(e.target) && e.target !== guideToggleEl) {
            guidePanelEl.style.display = "none";
        }
    });
}


init();
