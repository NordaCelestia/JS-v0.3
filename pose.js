// Global variables
let camera = null
let pose = null
let isRunning = false
let debugMode = false
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
const lastSkeletonDrawTime = 0
let skeletonDrawInterval = 1000 / 15 // Draw skeleton at 15 FPS to save resources
let performanceMode = "low" // Default to low performance mode

// Configuration
const config = {
  showVideo: true,
  showSkeleton: true,
  videoWidth: 640, // Reduced from 1280
  videoHeight: 360, // Reduced from 720
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
    modelComplexity: 0,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })

  pose.onResults(onResults)
}

function updatePerformanceMode(mode) {
  performanceMode = mode

  if (mode === "high") {
    // High performance settings
    pose.setOptions({
      modelComplexity: 1, // Medium complexity
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    // Set higher FPS for high-end devices
    setCaptureFPS(30)
    window.poseDebug.setSendRate(30)

    console.log("Switched to high performance mode")
  } else {
    // Low performance settings
    pose.setOptions({
      modelComplexity: 0, // Lowest complexity
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    // Set lower FPS for low-end devices
    setCaptureFPS(15)
    window.poseDebug.setSendRate(15)

    console.log("Switched to low performance mode")
  }

  // Update UI sliders to reflect new settings
  if (captureFpsSlider) {
    captureFpsSlider.value = targetFPS
    captureFpsValue.textContent = targetFPS
  }

  if (sendRateSlider) {
    sendRateSlider.value = Math.round(1000 / sendInterval)
    sendRateValue.textContent = Math.round(1000 / sendInterval)
  }
}

// Less frequent FPS updates to reduce DOM operations
let fpsUpdateCounter = 0
function updateFPS() {
  const now = performance.now()
  const delta = now - lastFrameTime
  fps = 1000 / delta
  lastFrameTime = now
  frameCount++

  if (debugMode && ++fpsUpdateCounter >= 10) {
    // Update every 10 frames
    fpsCounter.textContent = fps.toFixed(1)
    fpsUpdateCounter = 0
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

// Change the shouldDrawSkeleton function to always return true
// This will ensure the skeleton is drawn on every frame
function shouldDrawSkeleton() {
  return true
}

// Store the last pose landmarks for drawing
let lastPoseLandmarks = null

function onResults(results) {
  updateFPS()
  loadingElement.classList.add("hidden")

  // Store the latest pose landmarks
  if (results.poseLandmarks) {
    lastPoseLandmarks = results.poseLandmarks
  }

  // Update debug info less frequently
  if (debugMode && frameCount % 10 === 0 && results.poseWorldLandmarks) {
    landmarkCounter.textContent = results.poseWorldLandmarks.length
  }

  // Check Unity connection less frequently
  if (frameCount % 30 === 0) {
    checkUnityConnection()
  }

  // Only send data if enough time has passed since last send
  if (results.poseWorldLandmarks && window.unityInstance && sendToUnity && shouldSendData()) {
    // Create a simplified data structure with only necessary data
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

      // Update UI elements less frequently
      if (debugMode && frameCount % 5 === 0) {
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

        // Log less frequently
        if (frameCount % 300 === 0) {
          console.log("Pose data transmission:", {
            unityConnected: unityConnected,
            landmarksCount: poseData.landmarks.length,
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
    // Set canvas size to match config
    canvasElement.width = config.videoWidth
    canvasElement.height = config.videoHeight

    camera = new window.Camera(videoElement, {
      onFrame: async () => {
        if (isRunning) {
          // Always draw the camera feed at full frame rate for smooth display
          // Modify the camera onFrame function to always draw the skeleton if available
          // Replace the existing if block for drawing the skeleton with this:
          if (config.showVideo) {
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height)
            canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height)

            // Always draw skeleton if we have landmarks, regardless of timing
            if (config.showSkeleton && lastPoseLandmarks) {
              window.drawConnectors(canvasCtx, lastPoseLandmarks, window.POSE_CONNECTIONS, {
                color: "#00FF00",
                lineWidth: 3,
              })
              window.drawLandmarks(canvasCtx, lastPoseLandmarks, {
                color: "#FF0000",
                lineWidth: 1,
              })
            }
          }

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
      frameRate: {
        ideal: 30,
        max: 30,
      },
    })

    console.log(`Camera initialized with resolution ${config.videoWidth}x${config.videoHeight}`)
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

  // Add the performance mode UI
  addPerformanceModeUI()
  console.log("Performance mode UI should be added now")

  // Set up debug info display
  const debugInfo = document.querySelector(".debug-info")
  if (debugInfo) {
    debugInfo.style.display = debugMode ? "block" : "none"
  } else {
    console.warn("Debug info element not found")
  }

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

function addPerformanceModeUI() {
  console.log("Adding performance mode UI...")

  // Find the existing settings container
  const settingsDiv = document.querySelector(".settings")

  if (!settingsDiv) {
    console.error("Settings div not found!")
    return
  }

  // Create the performance mode section
  const performanceDiv = document.createElement("div")
  performanceDiv.className = "performance-settings"
  performanceDiv.style.marginTop = "10px"

  const performanceTitle = document.createElement("label")
  performanceTitle.textContent = "Performance Mode:"
  performanceTitle.style.display = "block"
  performanceTitle.style.marginBottom = "5px"

  const radioContainer = document.createElement("div")
  radioContainer.style.display = "flex"
  radioContainer.style.gap = "10px"

  // Low performance option
  const lowLabel = document.createElement("label")
  lowLabel.style.display = "flex"
  lowLabel.style.alignItems = "center"
  lowLabel.style.gap = "4px"

  const lowRadio = document.createElement("input")
  lowRadio.type = "radio"
  lowRadio.name = "performanceMode"
  lowRadio.value = "low"
  lowRadio.checked = performanceMode === "low"
  lowRadio.id = "lowPerformance"

  lowLabel.appendChild(lowRadio)
  lowLabel.appendChild(document.createTextNode("Low-end Device"))

  // High performance option
  const highLabel = document.createElement("label")
  highLabel.style.display = "flex"
  highLabel.style.alignItems = "center"
  highLabel.style.gap = "4px"

  const highRadio = document.createElement("input")
  highRadio.type = "radio"
  highRadio.name = "performanceMode"
  highRadio.value = "high"
  highRadio.checked = performanceMode === "high"
  highRadio.id = "highPerformance"

  highLabel.appendChild(highRadio)
  highLabel.appendChild(document.createTextNode("High-end Device"))

  // Add event listeners
  lowRadio.addEventListener("change", () => {
    if (lowRadio.checked) {
      updatePerformanceMode("low")
    }
  })

  highRadio.addEventListener("change", () => {
    if (highRadio.checked) {
      updatePerformanceMode("high")
    }
  })

  // Assemble the UI
  radioContainer.appendChild(lowLabel)
  radioContainer.appendChild(highLabel)

  performanceDiv.appendChild(performanceTitle)
  performanceDiv.appendChild(radioContainer)

  // Add description
  const description = document.createElement("div")
  description.textContent = "Low: Less accurate but faster. High: More accurate but requires more processing power."
  description.style.fontSize = "12px"
  description.style.marginTop = "5px"
  description.style.color = "#666"

  performanceDiv.appendChild(description)

  // Insert the performance settings after the last existing setting
  const lastSetting = settingsDiv.lastElementChild
  if (lastSetting) {
    lastSetting.after(performanceDiv)
  } else {
    settingsDiv.appendChild(performanceDiv)
  }

  console.log("Performance mode UI added successfully")
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

  // Set canvas size to match config
  canvasElement.width = config.videoWidth
  canvasElement.height = config.videoHeight

  initializePose()
  initializeCamera()
  initializeDebugging() // This line is crucial
  stopButton.disabled = true

  console.log("Application initialization complete")
})

// Clean up resources when page is unloaded
window.addEventListener("beforeunload", () => {
  if (camera && isRunning) {
    camera.stop()
  }
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
      console.log(`Send rate set to ${fps} FPS (every ${sendInterval.toFixed(1)}ms`)
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

    // Update canvas size
    canvasElement.width = width
    canvasElement.height = height

    if (camera) {
      camera.stop()
      initializeCamera()
      if (isRunning) camera.start()
    }

    console.log(`Resolution changed to ${width}x${height}`)
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
  setSkeletonDrawRate: (fps) => {
    if (fps > 0 && fps <= 60) {
      skeletonDrawInterval = 1000 / fps
      console.log(`Skeleton draw rate set to ${fps} FPS (every ${skeletonDrawInterval.toFixed(1)}ms)`)
      return true
    }
    return false
  },
  getSkeletonDrawRate: () => 1000 / skeletonDrawInterval,

  // Add these new methods
  setPerformanceMode: (mode) => {
    if (mode === "high" || mode === "low") {
      updatePerformanceMode(mode)

      // Update radio buttons
      const lowRadio = document.getElementById("lowPerformance")
      const highRadio = document.getElementById("highPerformance")

      if (lowRadio && highRadio) {
        lowRadio.checked = mode === "low"
        highRadio.checked = mode === "high"
      }

      return true
    }
    return false
  },

  getPerformanceMode: () => performanceMode,
}

