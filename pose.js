// Global variables
let camera = null;
let pose = null;
let isRunning = false;
let debugMode = true;
let sendToUnity = true;
let lastFrameTime = 0;
let frameCount = 0;
let fps = 0;
let lastPoseData = null;
let unityConnected = false;
let lastUnityCheck = 0;

// Configuration
const config = {
    showVideo: true,
    showSkeleton: true,
    videoWidth: 1280,
    videoHeight: 720
};

// DOM Elements
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
const loadingElement = document.querySelector('.loading');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const showVideoCheckbox = document.getElementById('showVideo');
const showSkeletonCheckbox = document.getElementById('showSkeleton');
const debugModeCheckbox = document.getElementById('debugMode');
const sendToUnityCheckbox = document.getElementById('sendToUnity');
const fpsCounter = document.getElementById('fpsCounter');
const landmarkCounter = document.getElementById('landmarkCounter');
const lastSentTime = document.getElementById('lastSentTime');

function checkUnityConnection() {
  const now = Date.now();
  if (now - lastUnityCheck > 5000) { // Check every 5 seconds
      lastUnityCheck = now;
      const isConnected = !!window.unityInstance;
      if (isConnected !== unityConnected) {
          unityConnected = isConnected;
          console.log(`Unity connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
      }
  }
}

// Initialize MediaPipe Pose
function initializePose() {
    console.log('Initializing MediaPipe Pose...');
    pose = new window.Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4/${file}`;
        }
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);
}

// Update FPS counter
function updateFPS() {
    const now = performance.now();
    const delta = now - lastFrameTime;
    fps = 1000 / delta;
    lastFrameTime = now;
    frameCount++;

    if (debugMode) {
        fpsCounter.textContent = fps.toFixed(1);
    }
}

// Handle pose detection results
function onResults(results) {
    // Update FPS
    updateFPS();

    // Hide loading screen
    loadingElement.classList.add('hidden');

    // Clear canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw video frame if enabled
    if (config.showVideo) {
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    }

    // Draw skeleton if enabled and landmarks are detected
    if (config.showSkeleton && results.poseLandmarks) {
        window.drawConnectors(
            canvasCtx,
            results.poseLandmarks,
            window.POSE_CONNECTIONS,
            { color: '#00FF00', lineWidth: 4 }
        );
        window.drawLandmarks(
            canvasCtx,
            results.poseLandmarks,
            { color: '#FF0000', lineWidth: 2 }
        );
    }

    // Debug information
    if (debugMode && results.poseWorldLandmarks) {
        landmarkCounter.textContent = results.poseWorldLandmarks.length;
    }

    checkUnityConnection();

    // Send data to Unity if available
    if (results.poseWorldLandmarks && window.unityInstance && sendToUnity) {
        const poseData = {
            landmarks: results.poseWorldLandmarks.map(landmark => ({
                x: landmark.x,
                y: landmark.y,
                z: landmark.z,
                visibility: landmark.visibility
            }))
        };

        // Store last pose data for debugging
        lastPoseData = poseData;

        try {
          window.unityInstance.SendMessage('PoseManager', 'UpdatePoseData', JSON.stringify(poseData));
          
          if (debugMode) {
              lastSentTime.textContent = new Date().toLocaleTimeString();
              lastSentTime.className = 'data-flowing';
              
              // Log every 60 frames
              if (frameCount % 60 === 0) {
                  console.log('Pose data transmission:', {
                      unityConnected: unityConnected,
                      landmarksCount: poseData.landmarks.length,
                      firstLandmark: poseData.landmarks[0],
                      timestamp: new Date().toLocaleTimeString()
                  });
              }
          }
      } catch (error) {
          console.error('Error sending to Unity:', error);
          if (debugMode) {
              lastSentTime.className = 'data-stopped';
          }
      }
    }
}

// Initialize camera
function initializeCamera() {
    console.log('Initializing camera...');
    try {
        camera = new window.Camera(videoElement, {
            onFrame: async () => {
                if (isRunning) {
                    await pose.send({ image: videoElement });
                }
            },
            width: config.videoWidth,
            height: config.videoHeight
        });
    } catch (error) {
        console.error('Error initializing camera:', error);
        alert('Failed to initialize camera. Please make sure you have granted camera permissions.');
    }
}

// Initialize debugging features
function initializeDebugging() {
    console.log('Initializing debugging features...');
    // Initialize debug display
    document.querySelector('.debug-info').style.display = debugMode ? 'block' : 'none';
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        switch(e.key.toLowerCase()) {
            case 'd': // Toggle debug mode
                debugModeCheckbox.checked = !debugModeCheckbox.checked;
                debugModeCheckbox.dispatchEvent(new Event('change'));
                break;
            case 'u': // Toggle Unity data transmission
                sendToUnityCheckbox.checked = !sendToUnityCheckbox.checked;
                sendToUnityCheckbox.dispatchEvent(new Event('change'));
                break;
            case 'p': // Print last pose data
                if (lastPoseData) {
                    console.log('Last pose data:', lastPoseData);
                }
                break;
        }
    });

    // Add debug commands to window for console access
    window.poseDebug = {
        toggleSend: () => {
            sendToUnity = !sendToUnity;
            console.log(`Data transmission ${sendToUnity ? 'enabled' : 'disabled'}`);
            return sendToUnity;
        },
        getLastPose: () => lastPoseData,
        getFPS: () => fps,
        getConfig: () => config
    };
}

// Event Listeners
startButton.addEventListener('click', async () => {
    if (!isRunning) {
        try {
            isRunning = true;
            startButton.disabled = true;
            stopButton.disabled = false;
            await camera.start();
            console.log('Camera started successfully');
        } catch (error) {
            console.error('Error starting camera:', error);
            isRunning = false;
            startButton.disabled = false;
            stopButton.disabled = true;
        }
    }
});

stopButton.addEventListener('click', () => {
    if (isRunning) {
        isRunning = false;
        startButton.disabled = false;
        stopButton.disabled = true;
        camera.stop();
        console.log('Camera stopped');
    }
});

showVideoCheckbox.addEventListener('change', (e) => {
    config.showVideo = e.target.checked;
});

showSkeletonCheckbox.addEventListener('change', (e) => {
    config.showSkeleton = e.target.checked;
});

debugModeCheckbox.addEventListener('change', (e) => {
    debugMode = e.target.checked;
    document.querySelector('.debug-info').style.display = debugMode ? 'block' : 'none';
    console.log(`Debug mode ${debugMode ? 'enabled' : 'disabled'}`);
});

sendToUnityCheckbox.addEventListener('change', (e) => {
    sendToUnity = e.target.checked;
    console.log(`Data transmission to Unity ${sendToUnity ? 'enabled' : 'disabled'}`);
});

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing application...');
    initializePose();
    initializeCamera();
    initializeDebugging();
    stopButton.disabled = true;
});

// Add error handling for Unity loading
window.addEventListener('error', (event) => {
    console.error('Error:', event.message);
});

// Export debug interface to window for console access
window.poseDebug = {
    toggleDebug: () => {
        debugMode = !debugMode;
        debugModeCheckbox.checked = debugMode;
        document.querySelector('.debug-info').style.display = debugMode ? 'block' : 'none';
        return debugMode;
    },
    toggleSend: () => {
        sendToUnity = !sendToUnity;
        sendToUnityCheckbox.checked = sendToUnity;
        return sendToUnity;
    },
    getLastPose: () => lastPoseData,
    getFPS: () => fps,
    getConfig: () => config,
    setVideoResolution: (width, height) => {
        config.videoWidth = width;
        config.videoHeight = height;
        if (camera) {
            camera.stop();
            initializeCamera();
            if (isRunning) camera.start();
        }
    }
};