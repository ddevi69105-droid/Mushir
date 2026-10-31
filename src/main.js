/**
 * Mushir — Voice-First AI Mobility Assistant
 * Auto-activated round voice command button in front.
 * Working optical obstacle tracking in the background.
 * Headless tactical navigation & Gemini Vision API support.
 */

import { audioService } from './services/audio_service.js';
import { voiceService } from './services/voice_service.js';
import { visionService } from './services/vision_service.js';
import { navigationService } from './services/navigation_service.js';
import { contextCoordinator } from './services/context_coordinator.js';
import { geminiService } from './services/gemini_service.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const btnVoiceMic = document.getElementById('btn-voice-mic');
  const micIcon = document.getElementById('mic-icon');
  const micSublabel = document.getElementById('mic-sublabel');
  const liveTranscript = document.getElementById('live-transcript');
  const spokenResponseText = document.getElementById('spoken-response-text');

  const statusCamera = document.getElementById('camera-state-text');
  const statusVoice = document.getElementById('voice-state-text');
  const statusApi = document.getElementById('api-state-text');

  // Background Camera Viewport Elements
  const cameraVideo = document.getElementById('camera-video');
  const visionCanvas = document.getElementById('vision-canvas');
  const btnFlipCamera = document.getElementById('btn-flip-camera');
  const btnRepeatLast = document.getElementById('btn-repeat-last');
  const btnQueryBehaviors = document.getElementById('btn-query-behaviors');
  const btnLocateCamera = document.getElementById('btn-locate-camera');

  // Background Telemetry Ticker
  const tickerPathStatus = document.getElementById('ticker-path-status');
  const tickerNearestObst = document.getElementById('ticker-nearest-obst');
  const tickerNearestAction = document.getElementById('ticker-nearest-action');
  const tickerManeuver = document.getElementById('ticker-maneuver');

  // Settings & API Key Elements
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const inputGeminiKey = document.getElementById('input-gemini-key');
  const btnSaveKey = document.getElementById('btn-save-key');
  const btnClearKey = document.getElementById('btn-clear-key');
  const apiKeyStatusMsg = document.getElementById('api-key-status-msg');

  const btnLangEn = document.getElementById('btn-lang-en');
  const btnLangHi = document.getElementById('btn-lang-hi');
  const btnSpeedDown = document.getElementById('btn-speed-down');
  const btnSpeedUp = document.getElementById('btn-speed-up');

  // 1. Initialize Working Live Camera Identification in Background
  await visionService.init(cameraVideo, visionCanvas);
  updateCameraState();

  // 2. Initialize Headless Navigation Service in Background
  navigationService.startNavigation('bus_station');

  // 3. Initialize API Status
  updateApiStatus();
  inputGeminiKey.value = geminiService.getApiKey();

  // 4. Auto-Activate Voice Recognition on Startup
  setTimeout(() => {
    voiceService.startListening(true);
    audioService.playChime('wake');
  }, 400);

  function updateCameraState() {
    if (visionService.cameraPermissionGranted) {
      statusCamera.textContent = `Live (${visionService.facingMode === 'environment' ? 'Rear' : 'Front'})`;
    } else {
      statusCamera.textContent = 'Scanner';
    }
  }

  function updateApiStatus() {
    if (geminiService.hasApiKey()) {
      statusApi.textContent = 'Gemini AI';
      statusApi.parentElement.classList.add('active');
    } else {
      statusApi.textContent = 'Local AI';
    }
  }

  // --- Voice Service Event Listeners ---

  voiceService.onListeningChange = (isListening) => {
    btnVoiceMic.classList.toggle('auto-listening', isListening);
    micIcon.textContent = isListening ? '🎙' : '🔇';
    statusVoice.textContent = isListening ? 'Listening' : 'Muted';
    micSublabel.textContent = isListening
      ? 'Auto-Listening Active · Speak Naturally or Press Spacebar'
      : 'Microphone Muted · Tap or Spacebar to Listen';
  };

  voiceService.onTranscriptUpdate = (text) => {
    liveTranscript.textContent = `"${text}"`;
  };

  voiceService.onCommandRecognized = (command) => {
    handleVoiceCommand(command);
  };

  audioService.onSpeakingStateChange = (isSpeaking, text) => {
    if (isSpeaking) {
      spokenResponseText.textContent = text;
    }
  };

  // --- Real-Time Background Vision Telemetry & Auto Spoken Alerts ---

  visionService.onSurroundingsAnalysis = (analysis) => {
    // Update bottom ticker
    tickerPathStatus.textContent = analysis.pathSafety;
    tickerPathStatus.style.color = analysis.pathSafety === 'BLOCKED' ? '#ff4444' : (analysis.pathSafety === 'CAUTION' ? '#ffaa00' : '#ffffff');

    if (analysis.nearestObstacle) {
      tickerNearestObst.textContent = `${analysis.nearestObstacle.label} ${analysis.nearestObstacle.distance}m [${(analysis.nearestObstacle.zoneLabel || analysis.nearestObstacle.zone)}]`;
      tickerNearestAction.textContent = analysis.nearestObstacle.actionDescription || analysis.nearestObstacle.behavior || 'Stationary';
    } else {
      tickerNearestObst.textContent = 'None < 4m';
      tickerNearestAction.textContent = 'Clear';
    }
  };

  visionService.onDetectionsUpdated = (detections) => {
    contextCoordinator.updateDetections(detections);
  };

  // Tactical Directives from Background Navigation
  navigationService.onTacticalDirective = (dir) => {
    tickerManeuver.textContent = `${dir.title} (${dir.distance}m)`;
  };

  // --- Voice Command Intent Router ---
  async function handleVoiceCommand(cmd) {
    console.log("Mushir Auto-Voice Intent:", cmd.type, cmd);

    switch (cmd.type) {
      case 'DESCRIBE_OBSTACLES_AND_ACTIONS':
        // If Gemini API is available and user wants general description, call Gemini
        if (geminiService.hasApiKey()) {
          audioService.speak("Analyzing live camera scene with Gemini Vision...", 'normal');
          try {
            const desc = await geminiService.describeSceneWithGemini(visionCanvas, "What obstacles are around me and what are they doing?");
            audioService.speak(desc, 'normal');
          } catch (e) {
            contextCoordinator.describeObstaclesAndActions();
          }
        } else {
          contextCoordinator.describeObstaclesAndActions();
        }
        break;

      case 'QUERY_TACTICAL_DIRECTION': {
        const dir = cmd.direction;
        if (dir === 'FORWARD') {
          audioService.speak("Tactical directive: Walk forward straight along the sidewalk tactile path.", 'normal');
        } else if (dir === 'RIGHT') {
          audioService.speak("Right turn landmark: In 35 meters at the intersection curb ramp, turn right onto 7th Street.", 'normal');
        } else if (dir === 'LEFT') {
          audioService.speak("Left turn landmark: In 25 meters before terminal doors, turn left towards the accessible transit gate.", 'normal');
        }
        break;
      }

      case 'GO_BACK_REVERSE':
        navigationService.executeGoBackInstruction();
        break;

      case 'CHECK_OBSTACLE_AHEAD':
        contextCoordinator.checkObstacleAhead();
        break;

      case 'WHAT_IS_IN_FRONT':
        contextCoordinator.describeCenterPath();
        break;

      case 'DESCRIBE_SURROUNDINGS':
        if (geminiService.hasApiKey()) {
          audioService.speak("Scanning surroundings with Gemini Vision...", 'normal');
          try {
            const desc = await geminiService.describeSceneWithGemini(visionCanvas, "Describe my immediate surroundings for pedestrian walking.");
            audioService.speak(desc, 'normal');
          } catch (e) {
            contextCoordinator.describeSurroundings();
          }
        } else {
          contextCoordinator.describeSurroundings();
        }
        break;

      case 'LOCATE_CAMERA':
        navigationService.locateCurrentCamera();
        break;

      case 'QUERY_DESTINATION_GUIDANCE':
      case 'NAVIGATE_TO':
        await navigationService.queryDestinationGuidance(cmd.destination);
        break;

      case 'CANCEL_NAVIGATION':
        navigationService.stopNavigation();
        break;

      case 'REPEAT_LAST':
        audioService.repeatLastInstruction();
        break;

      case 'SPEAK_SLOWER':
        audioService.decreaseSpeechRate();
        break;

      case 'SPEAK_FASTER':
        audioService.increaseSpeechRate();
        break;

      case 'SWITCH_TO_HINDI':
        setAppLanguage('hi-IN');
        break;

      case 'SWITCH_TO_ENGLISH':
        setAppLanguage('en-US');
        break;

      case 'START_ASSISTANCE':
        contextCoordinator.setAssistanceActive(true);
        break;

      case 'STOP_ASSISTANCE':
        contextCoordinator.setAssistanceActive(false);
        break;

      case 'WHERE_AM_I_STANDING':
      case 'WHERE_AM_I':
        await navigationService.identifyCurrentStandingLocation(true);
        break;

      case 'HELP': {
        const isHi = audioService.currentLanguage.startsWith('hi');
        const helpMsg = isHi
          ? "आप बोल सकते हैं: आगे रुकावट है क्या, सामने क्या है, आसपास क्या हो रहा है, बस स्टेशन ले चलो, या गति धीमी करो।"
          : "You can say: what are obstacles doing, is there an obstacle ahead, what is in front of me, take me to bus station, where to turn right, or speak slower.";
        audioService.speak(helpMsg, 'normal');
        break;
      }

      case 'CONVERSATIONAL_AI':
      default:
        if (geminiService.hasApiKey()) {
          try {
            const reply = await geminiService.describeSceneWithGemini(visionCanvas, cmd.question || cmd.raw);
            audioService.speak(reply, 'normal');
          } catch (e) {
            contextCoordinator.handleConversationalQuery(cmd.question || cmd.raw);
          }
        } else {
          contextCoordinator.handleConversationalQuery(cmd.question || cmd.raw);
        }
        break;
    }
  }

  function setAppLanguage(langCode) {
    audioService.setLanguage(langCode);
    voiceService.setLanguage(langCode);
    btnLangEn.classList.toggle('active', langCode === 'en-US');
    btnLangHi.classList.toggle('active', langCode === 'hi-IN');
  }

  // --- UI Event Handlers ---

  // Round Voice Button Toggle
  btnVoiceMic.addEventListener('click', () => {
    voiceService.toggleListening();
  });

  if (btnRepeatLast) {
    btnRepeatLast.addEventListener('click', () => {
      audioService.repeatLastInstruction();
    });
  }

  if (btnQueryBehaviors) {
    btnQueryBehaviors.addEventListener('click', () => {
      contextCoordinator.describeObstaclesAndActions();
    });
  }

  if (btnFlipCamera) {
    btnFlipCamera.addEventListener('click', async () => {
      await visionService.flipCamera();
      updateCameraState();
      audioService.speak(`Flipped to ${visionService.facingMode === 'environment' ? 'rear' : 'front'} camera.`, 'normal');
    });
  }

  if (btnLocateCamera) {
    btnLocateCamera.addEventListener('click', () => {
      navigationService.locateCurrentCamera();
    });
  }

  // Settings Modal Handlers
  btnOpenSettings.addEventListener('click', () => {
    inputGeminiKey.value = geminiService.getApiKey();
    settingsModal.classList.add('open');
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.remove('open');
    audioService.playChime('command_ok');
  });

  btnSaveKey.addEventListener('click', () => {
    geminiService.setApiKey(inputGeminiKey.value);
    updateApiStatus();
    apiKeyStatusMsg.textContent = "Gemini API key saved successfully.";
    apiKeyStatusMsg.style.color = "#00ff88";
    audioService.speak("API key saved. Cloud vision features ready.", 'normal');
  });

  btnClearKey.addEventListener('click', () => {
    geminiService.setApiKey('');
    inputGeminiKey.value = '';
    updateApiStatus();
    apiKeyStatusMsg.textContent = "API key cleared. Using local AI.";
    apiKeyStatusMsg.style.color = "#ffffff";
    audioService.speak("API key cleared.", 'normal');
  });

  btnLangEn.addEventListener('click', () => setAppLanguage('en-US'));
  btnLangHi.addEventListener('click', () => setAppLanguage('hi-IN'));
  btnSpeedDown.addEventListener('click', () => audioService.decreaseSpeechRate());
  btnSpeedUp.addEventListener('click', () => audioService.increaseSpeechRate());

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())) return;

    if (e.code === 'Space') {
      e.preventDefault();
      voiceService.toggleListening();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      audioService.repeatLastInstruction();
    } else if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      contextCoordinator.describeObstaclesAndActions();
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      contextCoordinator.checkObstacleAhead();
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      navigationService.locateCurrentCamera();
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      visionService.flipCamera().then(() => {
        updateCameraState();
        audioService.speak(`Flipped to ${visionService.facingMode === 'environment' ? 'rear' : 'front'} camera.`, 'normal');
      });
    } else if (e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      navigationService.identifyCurrentStandingLocation(true);
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      navigationService.queryDestinationGuidance('Premnagar');
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      settingsModal.classList.toggle('open');
    } else if (e.key === 'Escape') {
      audioService.stopSpeaking();
      settingsModal.classList.remove('open');
    }
  });
});
