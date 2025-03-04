// Global variables
let camera = null
let pose = null
let isRunning = false
let debugMode = true
let sendToUnity = true
let lastFrameTime = 0
let frameCount = 0
let fps = 0
let lastPoseData = null
let unityConnected = false
let lastUnityCheck = 0
let lastSendTime = 0
let sendInterval = 1000 / 30
let targetFPS = 30 // Default camera FPS
let lastProcessTime = 0
let processInterval = 1000 / targetFPS

// Configuration
const config = {
  showVideo: true,
  showSkeleton: true,
  videoWidth: 1280,
  videoHeight: 720,
}

// DOM Elements
const videoElement = document.getElementsByClassName("input_video")[0]
const canvasElement = document.getElementsByClassName("output_canvas")[0]
const canvasCtx = canvasElement.getContext("2d")
const loadingElement = document.querySelector(".loading")
const startButton = document.getElementById("startButton")
const stopButton = document.getElementById("stopButton")
const showVideoCheckbox = document.getElementById("showVideo")
const showSkeletonCheckbox = document.getElementById("showSkeleton")
const debugModeCheckbox = document.getElementById("debugMode")
const sendToUnityCheckbox = document.getElementById("sendToUnity")
const fpsCounter = document.getElementById("fpsCounter")
const landmarkCounter = document.getElementById("landmarkCounter")
const lastSentTime = document.getElementById("lastSentTime")
const leftElbowAngleElement = document.getElementById("leftElbowAngle")
const rightElbowAngleElement = document.getElementById("rightElbowAngle")
const leftShoulderAngleElement = document.getElementById("leftShoulderAngle")
const rightShoulderAngleElement = document.getElementById("rightShoulderAngle")
const sendRateSlider = document.getElementById("sendRateSlider")
const sendRateValue = document.getElementById("sendRateValue")
const captureFpsSlider = document.getElementById("captureFpsSlider")
const captureFpsValue = document.getElementById("captureFpsValue")

function checkUnityConnection() {
  const now = Date.now()
  if (now - lastUnityCheck > 5000) {
    lastUnityCheck = now
    const isConnected = !!window.unityInstance
    if (isConnected !== unityConnected) {
      unityConnected = isConnected
      console.log(`Unity connection status: ${isConnected ? "Connected" : "Disconnected"}`)
    }
  }
}

function initializePose() {
  console.log("Initializing MediaPipe Pose...")
  pose = new window.Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4/${file}`
    },
  })

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })

  pose.onResults(onResults)
}

function updateFPS() {
  const now = performance.now()
  const delta = now - lastFrameTime
  fps = 1000 / delta
  lastFrameTime = now
  frameCount++

  if (debugMode) {
    fpsCounter.textContent = fps.toFixed(1)
  }
}

function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs((radians * 180.0) / Math.PI)

  if (angle > 180.0) {
    angle = 360 - angle
  }

  return angle
}

function shouldSendData() {
  const currentTime = performance.now()
  if (currentTime - lastSendTime >= sendInterval) {
    lastSendTime = currentTime
    return true
  }
  return false
}

function onResults(results) {
  updateFPS()
  loadingElement.classList.add("hidden")

 
 
  if (config.showSkeleton && results.poseLandmarks) {
    window.drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 4,
    })
    window.drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: "#FF0000",
      lineWidth: 2,
    })
  }

  if (debugMode && results.poseWorldLandmarks) {
    landmarkCounter.textContent = results.poseWorldLandmarks.length
  }

  checkUnityConnection()

  // Only send data if enough time has passed since last send
  if (results.poseWorldLandmarks && window.unityInstance && sendToUnity && shouldSendData()) {
    const poseData = {
      landmarks: results.poseWorldLandmarks.map((landmark) => ({
        x: -landmark.x,
        y: -landmark.y,
        z: landmark.z,
        visibility: landmark.visibility,
      })),
    }

    if (results.poseLandmarks) {
      const leftShoulder = results.poseLandmarks[11]
      const leftElbow = results.poseLandmarks[13]
      const leftWrist = results.poseLandmarks[15]
      const rightShoulder = results.poseLandmarks[12]
      const rightElbow = results.poseLandmarks[14]
      const rightWrist = results.poseLandmarks[16]
      const leftHip = results.poseLandmarks[23]
      const rightHip = results.poseLandmarks[24]

      const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist)
      const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist)
      const leftShoulderAngle = calculateAngle(leftHip, leftShoulder, leftElbow)
      const rightShoulderAngle = calculateAngle(rightHip, rightShoulder, rightElbow)

      poseData.armAngles = {
        leftElbow: leftElbowAngle,
        rightElbow: rightElbowAngle,
        leftShoulder: leftShoulderAngle,
        rightShoulder: rightShoulderAngle,
      }

      if (debugMode) {
        leftElbowAngleElement.textContent = leftElbowAngle.toFixed(1)
        rightElbowAngleElement.textContent = rightElbowAngle.toFixed(1)
        leftShoulderAngleElement.textContent = leftShoulderAngle.toFixed(1)
        rightShoulderAngleElement.textContent = rightShoulderAngle.toFixed(1)
      }
    }

    lastPoseData = poseData

    try {
      window.unityInstance.SendMessage("PoseManager", "UpdatePoseData", JSON.stringify(poseData))

      if (debugMode) {
        lastSentTime.textContent = new Date().toLocaleTimeString()
        lastSentTime.className = "data-flowing"

        if (frameCount % 60 === 0) {
          console.log("Pose data transmission:", {
            unityConnected: unityConnected,
            landmarksCount: poseData.landmarks.length,
            firstLandmark: poseData.landmarks[0],
            armAngles: poseData.armAngles,
            timestamp: new Date().toLocaleTimeString(),
            sendRate: `${(1000 / sendInterval).toFixed(1)} FPS`,
          })
        }
      }
    } catch (error) {
      console.error("Error sending to Unity:", error)
      if (debugMode) {
        lastSentTime.className = "data-stopped"
      }
    }
  }
}

function initializeCamera() {
  console.log("Initializing camera...")
  try {
    camera = new window.Camera(videoElement, {
      onFrame: async () => {
        if (isRunning) {
          canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height)

          // Only process pose detection at the target processing rate
          const currentTime = performance.now()
          if (currentTime - lastProcessTime >= processInterval) {
            lastProcessTime = currentTime
            await pose.send({ image: videoElement })
          }
        }
      },
      width: config.videoWidth,
      height: config.videoHeight,
      // Always request 60 FPS from the camera for smooth display
      frameRate: {
        ideal: 30,
        max: 30,
      },
    })
  } catch (error) {
    console.error("Error initializing camera:", error)
    alert("Failed to initialize camera. Please make sure you have granted camera permissions.")
  }
}

function setCaptureFPS(fps) {
  if (fps > 0 && fps <= 60) {
    targetFPS = fps
    processInterval = 1000 / fps
    console.log(`Pose processing rate set to ${fps} FPS (processing every ${processInterval.toFixed(1)}ms)`)
    return true
  } else {
    console.error("FPS must be between 1 and 60")
    return false
  }
}

function initializeDebugging() {
  console.log("Initializing debugging features...")
  document.querySelector(".debug-info").style.display = debugMode ? "block" : "none"

  document.addEventListener("keydown", (e) => {
    switch (e.key.toLowerCase()) {
      case "d":
        debugModeCheckbox.checked = !debugModeCheckbox.checked
        debugModeCheckbox.dispatchEvent(new Event("change"))
        break
      case "u":
        sendToUnityCheckbox.checked = !sendToUnityCheckbox.checked
        sendToUnityCheckbox.dispatchEvent(new Event("change"))
        break
      case "p":
        if (lastPoseData) {
          console.log("Last pose data:", lastPoseData)
        }
        break
    }
  })
}

// Event Listeners
startButton.addEventListener("click", async () => {
  if (!isRunning) {
    try {
      isRunning = true
      startButton.disabled = true
      stopButton.disabled = false
      await camera.start()
      console.log("Camera started successfully")
    } catch (error) {
      console.error("Error starting camera:", error)
      isRunning = false
      startButton.disabled = false
      stopButton.disabled = true
    }
  }
})

stopButton.addEventListener("click", () => {
  if (isRunning) {
    isRunning = false
    startButton.disabled = false
    stopButton.disabled = true
    camera.stop()
    console.log("Camera stopped")
  }
})

showVideoCheckbox.addEventListener("change", (e) => {
  config.showVideo = e.target.checked
})

showSkeletonCheckbox.addEventListener("change", (e) => {
  config.showSkeleton = e.target.checked
})

debugModeCheckbox.addEventListener("change", (e) => {
  debugMode = e.target.checked
  document.querySelector(".debug-info").style.display = debugMode ? "block" : "none"
  console.log(`Debug mode ${debugMode ? "enabled" : "disabled"}`)
})

sendToUnityCheckbox.addEventListener("change", (e) => {
  sendToUnity = e.target.checked
  console.log(`Data transmission to Unity ${sendToUnity ? "enabled" : "disabled"}`)
})

// New send rate slider event listener
if (sendRateSlider) {
  sendRateSlider.addEventListener("input", (e) => {
    const fps = Number.parseInt(e.target.value)
    sendInterval = 1000 / fps
    if (sendRateValue) {
      sendRateValue.textContent = fps
    }
    console.log(`Send rate set to ${fps} FPS (every ${sendInterval.toFixed(1)}ms)`)
  })
}

if (captureFpsSlider) {
  captureFpsSlider.addEventListener("input", (e) => {
    const fps = Number.parseInt(e.target.value)
    setCaptureFPS(fps)
    if (captureFpsValue) {
      captureFpsValue.textContent = fps
    }
  })
}

// Initialize everything when the page loads
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing application...")
  initializePose()
  initializeCamera()
  initializeDebugging()
  stopButton.disabled = true
})

// Add error handling for Unity loading
window.addEventListener("error", (event) => {
  console.error("Error:", event.message)
})

// Export debug interface
window.poseDebug = {
  toggleDebug: () => {
    debugMode = !debugMode
    debugModeCheckbox.checked = debugMode
    document.querySelector(".debug-info").style.display = debugMode ? "block" : "none"
    return debugMode
  },
  toggleSend: () => {
    sendToUnity = !sendToUnity
    sendToUnityCheckbox.checked = sendToUnity
    return sendToUnity
  },
  getLastPose: () => lastPoseData,
  getFPS: () => fps,
  getConfig: () => config,
  setSendRate: (fps) => {
    if (fps > 0 && fps <= 60) {
      sendInterval = 1000 / fps
      if (sendRateSlider) {
        sendRateSlider.value = fps
      }
      if (sendRateValue) {
        sendRateValue.textContent = fps
      }
      console.log(`Send rate set to ${fps} FPS (every ${sendInterval.toFixed(1)}ms)`)
      return true
    } else {
      console.error("FPS must be between 1 and 60")
      return false
    }
  },
  getSendRate: () => 1000 / sendInterval,
  setVideoResolution: (width, height) => {
    config.videoWidth = width
    config.videoHeight = height
    if (camera) {
      camera.stop()
      initializeCamera()
      if (isRunning) camera.start()
    }
  },
  setCaptureFPS: (fps) => {
    return setCaptureFPS(fps)
  },

  getCaptureFPS: () => {
    return targetFPS
  },

  getCurrentFPS: () => {
    return fps
  },
}

