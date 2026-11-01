import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/app_constants.dart';
import '../../models/detection_result.dart';
import '../../services/compass_service.dart';
import '../../services/gemini_service.dart';
import '../../services/location_service.dart';
import '../../services/routing_service.dart';
import '../../services/safety_coordinator.dart';
import '../../services/tts_service.dart';
import '../../services/vision_service.dart';
import '../../services/voice_service.dart';

class HomeScreen extends StatefulWidget {
  final List<CameraDescription> cameras;

  const HomeScreen({super.key, required this.cameras});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  late final TtsService _ttsService;
  late final LocationService _locationService;
  late final RoutingService _routingService;
  late final VisionService _visionService;
  late final CompassService _compassService;
  late final SafetyCoordinator _safetyCoordinator;
  late final VoiceService _voiceService;
  late final GeminiService _geminiService;

  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  String _liveTranscript = 'Listening automatically... Speak naturally.';
  String _spokenText = 'Hii! How can I assist you today, you are currently on the location Anand Chowk Lane, Dehradun.';
  List<DetectionResult> _activeDetections = [];
  bool _isListening = false;

  @override
  void initState() {
    super.initState();
    _initServices();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.12).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  Future<void> _initServices() async {
    _ttsService = TtsService();
    _locationService = LocationService();
    _routingService = RoutingService();
    _visionService = VisionService();
    _compassService = CompassService();
    _voiceService = VoiceService();
    _geminiService = GeminiService();

    await _ttsService.initialize();
    await _geminiService.initialize();
    await _voiceService.initialize();

    _safetyCoordinator = SafetyCoordinator(
      tts: _ttsService,
      location: _locationService,
      routing: _routingService,
      vision: _visionService,
      compass: _compassService,
    );

    // Wire Voice recognition callbacks
    _voiceService.onListeningStateChanged = (listening) {
      if (mounted) setState(() => _isListening = listening);
    };

    _voiceService.onTranscriptUpdated = (text) {
      if (mounted) setState(() => _liveTranscript = text);
    };

    _voiceService.onIntentRecognized = _handleVoiceIntent;

    // Vision detections listener
    _visionService.addDetectionListener((detections) {
      if (mounted) setState(() => _activeDetections = detections);
    });

    // Start background services
    _compassService.startListening();
    _locationService.startPositionTracking();
    await _visionService.initializeCamera(widget.cameras);

    // Fetch exact location and greet user warmly
    final locResult = await _locationService.getCurrentLocation();
    final place = locResult.location?.street != null 
        ? '${locResult.location!.street}, ${locResult.location!.city ?? "Dehradun"}'
        : (locResult.location?.address ?? 'Anand Chowk Lane, Dehradun');
    final greeting = 'Hii! How can I assist you today, you are currently on the location $place.';
    if (mounted) setState(() => _spokenText = greeting);
    await _ttsService.speak(greeting, priority: SpeechPriority.normal);

    // Auto-start listening
    await Future.delayed(const Duration(milliseconds: 500));
    _voiceService.startListening();
  }

  void _handleVoiceIntent(VoiceIntent intent) async {
    HapticFeedback.mediumImpact();

    switch (intent.type) {
      case VoiceIntentType.locationQuery:
        await _safetyCoordinator.handleLocationQuery();
        break;

      case VoiceIntentType.navigationQuery:
        if (intent.action == 'NAVIGATE_TO_DESTINATION') {
          await _safetyCoordinator.handleNavigationRequest(intent.entity ?? 'pharmacy');
        } else if (intent.action == 'STOP_NAVIGATION') {
          _routingService.stopNavigation();
          await _ttsService.speak('Navigation stopped.', priority: SpeechPriority.critical);
        } else if (intent.action == 'REPEAT_DIRECTIONS') {
          await _ttsService.repeatLast();
        }
        break;

      case VoiceIntentType.environmentQuery:
        if (intent.action == 'DESCRIBE_OBSTACLE_BEHAVIORS' || intent.action == 'DESCRIBE_SURROUNDINGS') {
          _safetyCoordinator.describeSurroundings();
        } else if (intent.action == 'CHECK_OBSTACLE_AHEAD') {
          _safetyCoordinator.checkObstacleAhead();
        } else if (intent.action == 'DESCRIBE_SECTOR') {
          _safetyCoordinator.describeSector(intent.entity ?? 'left');
        }
        break;

      case VoiceIntentType.appCommand:
        if (intent.action == 'START_ASSISTANCE') {
          _safetyCoordinator.setAssistanceActive(true);
        } else if (intent.action == 'STOP_ASSISTANCE') {
          _safetyCoordinator.setAssistanceActive(false);
        } else if (intent.action == 'REPEAT_LAST') {
          await _ttsService.repeatLast();
        } else if (intent.action == 'SPEAK_SLOWER') {
          await _ttsService.decreaseSpeechRate();
        } else if (intent.action == 'SPEAK_FASTER') {
          await _ttsService.increaseSpeechRate();
        } else if (intent.action == 'SWITCH_TO_HINDI') {
          await _ttsService.setLanguage(AppConstants.hindiLanguage);
          _voiceService.setLanguage(AppConstants.hindiLanguage);
        } else if (intent.action == 'SWITCH_TO_ENGLISH') {
          await _ttsService.setLanguage(AppConstants.defaultLanguage);
          _voiceService.setLanguage(AppConstants.defaultLanguage);
        } else if (intent.action == 'HELP') {
          await _ttsService.speak(
            'You can ask: Where am I, navigate to nearest pharmacy, what is ahead, describe surroundings, or speak slower.',
            priority: SpeechPriority.normal,
          );
        }
        break;

      case VoiceIntentType.conversationalQuery:
        final reply = await _geminiService.answerQuery(
          question: intent.rawTranscript,
          sceneContext: _activeDetections.map((d) => d.spokenDescription).join('. '),
        );
        await _ttsService.speak(reply, priority: SpeechPriority.normal);
        break;
    }

    if (mounted) {
      setState(() => _spokenText = _ttsService.lastSpoken);
    }
  }

  void _toggleMic() {
    HapticFeedback.heavyImpact();
    if (_isListening) {
      _voiceService.stopListening();
    } else {
      _voiceService.startListening();
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _safetyCoordinator.dispose();
    _visionService.dispose();
    _locationService.dispose();
    _compassService.dispose();
    _voiceService.dispose();
    _ttsService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // 1. Live Camera Stream in Background
          if (_visionService.cameraController != null && _visionService.cameraController!.value.isInitialized)
            SizedBox.expand(
              child: FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: _visionService.cameraController!.value.previewSize?.height ?? 640,
                  height: _visionService.cameraController!.value.previewSize?.width ?? 480,
                  child: CameraPreview(_visionService.cameraController!),
                ),
              ),
            ),

          // 2. Subtle Vignette Scrim
          Container(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 1.0,
                colors: [
                  Colors.black.withOpacity(0.15),
                  Colors.black.withOpacity(0.60),
                ],
              ),
            ),
          ),

          // 3. Foreground Accessibility-First Interface
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('M', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 16)),
                          ),
                          const SizedBox(width: 10),
                          const Text('MUSHIR', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.7),
                          border: Border.all(color: Colors.white24),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          _isListening ? '● LISTENING' : '○ MUTED',
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'monospace'),
                        ),
                      ),
                    ],
                  ),

                  // Center Stage: Spoken Feedback & Prominent Voice Button
                  Column(
                    children: [
                      // Speech Feedback Console Card
                      Semantics(
                        liveRegion: true,
                        label: 'Speech feedback console',
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.85),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white38),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'HEARD: "$_liveTranscript"',
                                style: const TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'monospace'),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _spokenText,
                                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 32),

                      // Prominent Round Voice Command Button
                      Semantics(
                        button: true,
                        label: _isListening ? 'Microphone active. Tap to mute.' : 'Microphone muted. Tap to speak.',
                        child: AnimatedBuilder(
                          animation: _pulseAnimation,
                          builder: (context, child) {
                            return Transform.scale(
                              scale: _isListening ? _pulseAnimation.value : 1.0,
                              child: GestureDetector(
                                onTap: _toggleMic,
                                child: Container(
                                  width: 115,
                                  height: 115,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: _isListening ? Colors.white : Colors.black,
                                    border: Border.all(color: Colors.white, width: 3.5),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.white.withOpacity(_isListening ? 0.6 : 0.2),
                                        blurRadius: _isListening ? 28 : 12,
                                        spreadRadius: 2,
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    _isListening ? Icons.mic : Icons.mic_off,
                                    color: _isListening ? Colors.black : Colors.white,
                                    size: 48,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),

                      const SizedBox(height: 16),
                      Text(
                        _isListening ? 'SPEAK NATURALLY' : 'TAP TO LISTEN',
                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                      ),
                    ],
                  ),

                  // Bottom Telemetry Strip
                  Semantics(
                    label: 'Navigation and obstacle status',
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.85),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          Text(
                            _activeDetections.isEmpty ? 'PATH: CLEAR' : 'OBSTACLES: ${_activeDetections.length}',
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                          ),
                          const Text('·', style: TextStyle(color: Colors.white38)),
                          Text(
                            _routingService.isNavigating ? 'NAV: ACTIVE' : 'NAV: STANDBY',
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
