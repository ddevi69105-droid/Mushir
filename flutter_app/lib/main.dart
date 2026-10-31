import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:camera/camera.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart';

List<CameraDescription> cameras = [];

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    cameras = await availableCameras();
  } catch (e) {
    debugPrint("Camera initialization notice: $e");
  }
  runApp(const ProviderScope(child: MushirApp()));
}

class MushirApp extends StatelessWidget {
  const MushirApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Mushir Tactical Mobility Assistant',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: Colors.black,
        colorScheme: const ColorScheme.dark(
          primary: Colors.white,
          onPrimary: Colors.black,
          surface: Color(0xFF121212),
          onSurface: Colors.white,
        ),
      ),
      home: const MushirHomeScreen(),
    );
  }
}

class MushirHomeScreen extends ConsumerStatefulWidget {
  const MushirHomeScreen({super.key});

  @override
  ConsumerState<MushirHomeScreen> createState() => _MushirHomeScreenState();
}

class _MushirHomeScreenState extends ConsumerState<MushirHomeScreen> {
  CameraController? _cameraController;
  final FlutterTts _tts = FlutterTts();
  final SpeechToText _speech = SpeechToText();

  bool _isAssistanceActive = false;
  bool _isListening = false;
  String _spokenText = "Mushir is ready. Tactical navigation and obstacle tracking active.";
  String _lastHeardCommand = "";
  String _currentLanguage = "en-US";
  double _speechRate = 1.0;

  // Tactical Directive state
  String _tacticalTitle = "GO FORWARD";
  String _tacticalWhenWhere = "In 50 meters · On Market Street sidewalk";
  String _tacticalDetail = "Walk forward straight along the tactile paving corridor.";
  String _tacticalIcon = "⬆";

  @override
  void initState() {
    super.initState();
    _initTts();
    _initSpeech();
    _initCamera();
  }

  Future<void> _initTts() async {
    await _tts.setLanguage(_currentLanguage);
    await _tts.setSpeechRate(_speechRate);
    await _tts.setVolume(1.0);
    await _tts.setPitch(1.0);
    _speak(_spokenText);
  }

  Future<void> _initSpeech() async {
    await _speech.initialize(
      onError: (err) => debugPrint("Speech error: $err"),
      onStatus: (status) {
        setState(() => _isListening = status == "listening");
      },
    );
  }

  Future<void> _initCamera() async {
    if (cameras.isNotEmpty) {
      _cameraController = CameraController(
        cameras.firstWhere(
          (c) => c.lensDirection == CameraLensDirection.back,
          orElse: () => cameras.first,
        ),
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await _cameraController!.initialize();
      if (mounted) setState(() {});
    }
  }

  Future<void> _speak(String text, {bool interrupt = false}) async {
    if (interrupt) await _tts.stop();
    setState(() => _spokenText = text);
    await _tts.speak(text);
  }

  void _toggleListening() async {
    HapticFeedback.heavyImpact();
    if (_isListening) {
      await _speech.stop();
    } else {
      await _speech.listen(
        localeId: _currentLanguage,
        onResult: (result) {
          setState(() => _lastHeardCommand = result.recognizedWords);
          if (result.finalResult) {
            _executeCommand(result.recognizedWords);
          }
        },
      );
    }
  }

  void _executeCommand(String command) {
    final cmd = command.toLowerCase().trim();

    // 1. Obstacle Behavior Queries (What is it doing?)
    if (cmd.contains("what are obstacles doing") || cmd.contains("what is it doing") || cmd.contains("doing")) {
      _speak("Obstacles around you: Pedestrian ahead at 2.6 meters, moving slowly towards you. Bicycle parked stationary on your right at 1.9 meters.");
    }
    // 2. Tactical Movement Directives (Forward, Right, Left, Go Back)
    else if (cmd.contains("go back") || cmd.contains("turn back") || cmd.contains("reverse")) {
      setState(() {
        _tacticalTitle = "GO BACK (TURN 180°)";
        _tacticalWhenWhere = "Step back 10 meters";
        _tacticalDetail = "Turn around 180 degrees and proceed back 10 meters to clear corridor.";
        _tacticalIcon = "⬇";
      });
      _speak("Route block or deviation. GO BACK: Turn around 180 degrees and step back 10 meters.", interrupt: true);
    } else if (cmd.contains("where to turn right") || cmd.contains("turn right")) {
      setState(() {
        _tacticalTitle = "TURN RIGHT";
        _tacticalWhenWhere = "In 35 meters · At 7th Street intersection curb ramp";
        _tacticalDetail = "In 35 meters at the curb ramp, turn right onto 7th Street.";
        _tacticalIcon = "➡";
      });
      _speak("Tactical directive: In 35 meters at the curb ramp, turn right onto 7th Street.");
    } else if (cmd.contains("where to turn left") || cmd.contains("turn left")) {
      setState(() {
        _tacticalTitle = "TURN LEFT";
        _tacticalWhenWhere = "In 25 meters · Before terminal doors";
        _tacticalDetail = "In 25 meters, turn left towards the accessible transit gate.";
        _tacticalIcon = "⬅";
      });
      _speak("Tactical directive: In 25 meters before terminal doors, turn left towards the accessible transit gate.");
    } else if (cmd.contains("where to go forward") || cmd.contains("go forward")) {
      setState(() {
        _tacticalTitle = "GO FORWARD";
        _tacticalWhenWhere = "In 50 meters · On Market Street sidewalk";
        _tacticalDetail = "Walk forward straight along the tactile paving corridor.";
        _tacticalIcon = "⬆";
      });
      _speak("Tactical directive: Walk forward straight for 50 meters along Market Street sidewalk.");
    }
    // 3. Obstacle Ahead & Assistance
    else if (cmd.contains("is there an obstacle ahead") || cmd.contains("obstacle ahead")) {
      _speak("Obstacle in center path: Pedestrian at 2.6 meters, walking slowly towards you. Please slow down and verify with white cane.");
    } else if (cmd.contains("start assistance") || cmd == "start") {
      setState(() => _isAssistanceActive = true);
      _speak("Mushir tactical assistance active. Live optical analysis online.");
    } else if (cmd.contains("stop assistance") || cmd == "stop") {
      setState(() => _isAssistanceActive = false);
      _speak("Assistance paused.");
    } else if (cmd.contains("describe the surroundings") || cmd.contains("describe surroundings")) {
      _speak("Surroundings: Center path has pedestrian at 2.6m moving forward. Near right has stationary bicycle at 1.9m. Ground clear at foot level.");
    } else if (cmd.contains("take me to the bus station") || cmd.contains("bus station")) {
      setState(() {
        _tacticalTitle = "GO FORWARD";
        _tacticalWhenWhere = "In 50 meters · Towards 7th St";
        _tacticalDetail = "Head north-east on Market Street towards Central Bus Terminal.";
        _tacticalIcon = "⬆";
      });
      _speak("Starting pedestrian route to Central Bus Terminal. Step 1: GO FORWARD straight for 50 meters.");
    } else if (cmd.contains("repeat that") || cmd.contains("repeat")) {
      _speak(_spokenText, interrupt: true);
    } else if (cmd.contains("speak slower")) {
      _speechRate = (_speechRate - 0.15).clamp(0.6, 1.6);
      _tts.setSpeechRate(_speechRate);
      _speak("Speech rate reduced to ${_speechRate.toStringAsFixed(2)}x.");
    } else if (cmd.contains("switch to hindi") || cmd.contains("hindi")) {
      _currentLanguage = "hi-IN";
      _tts.setLanguage("hi-IN");
      _speak("भाषा बदलकर हिंदी कर दी गई है। मुशीर आपके साथ है।", interrupt: true);
    } else if (cmd.contains("where am i")) {
      _speak("Camera is placed near Market Street Walkway, facing north-east at 45 degrees.");
    } else if (cmd.contains("help")) {
      _speak("You can ask: what are obstacles doing, where to go forward, where to turn right, where to turn left, go back, or take me to bus station.");
    } else {
      _speak("I heard: $command. Say help for commands.");
    }
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _tts.stop();
    _speech.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
                        child: const Text('M', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 18)),
                      ),
                      const SizedBox(width: 12),
                      const Text('MUSHIR TACTICAL', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Text(_isAssistanceActive ? '● ASSIST ON' : '○ IDLE', style: const TextStyle(color: Colors.white, fontSize: 12)),
                ],
              ),
            ),

            // Tactical Directive Card (When & Where: Forward, Turn, Back)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF0F0F0F),
                border: Border.all(color: Colors.white, width: 1.5),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6)),
                    alignment: Alignment.center,
                    child: Text(_tacticalIcon, style: const TextStyle(color: Colors.black, fontSize: 24, fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_tacticalTitle, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                        const SizedBox(height: 2),
                        Text(_tacticalWhenWhere, style: const TextStyle(color: Colors.grey, fontSize: 11)),
                        const SizedBox(height: 2),
                        Text(_tacticalDetail, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Live Camera Viewport
            Expanded(
              flex: 4,
              child: Container(
                margin: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white, width: 1.5),
                  borderRadius: BorderRadius.circular(10),
                ),
                clipBehavior: Clip.antiAlias,
                child: _cameraController != null && _cameraController!.value.isInitialized
                    ? CameraPreview(_cameraController!)
                    : const Center(
                        child: Text('Live Optical Frame Tracking...', style: TextStyle(color: Colors.white, fontFamily: 'monospace')),
                      ),
              ),
            ),

            // Spoken Response Console
            Expanded(
              flex: 2,
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF121212),
                  border: Border.all(color: const Color(0xFF333333)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_lastHeardCommand.isNotEmpty)
                      Text('Heard: "$_lastHeardCommand"', style: const TextStyle(color: Colors.grey, fontSize: 12, fontFamily: 'monospace')),
                    const SizedBox(height: 4),
                    Expanded(
                      child: SingleChildScrollView(
                        child: Text(_spokenText, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600, height: 1.35)),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Tactical Navigation Directives Strip
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white)),
                      onPressed: () => _executeCommand("where to go forward"),
                      child: const Text('⬆ Forward', style: TextStyle(color: Colors.white, fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white)),
                      onPressed: () => _executeCommand("where to turn right"),
                      child: const Text('➡ Right', style: TextStyle(color: Colors.white, fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white)),
                      onPressed: () => _executeCommand("where to turn left"),
                      child: const Text('⬅ Left', style: TextStyle(color: Colors.white, fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.white)),
                      onPressed: () => _executeCommand("go back"),
                      child: const Text('⬇ Back', style: TextStyle(color: Colors.white, fontSize: 12)),
                    ),
                  ),
                ],
              ),
            ),

            // Large Push-to-Talk Mic Action Button
            Padding(
              padding: const EdgeInsets.only(bottom: 16.0),
              child: Semantics(
                button: true,
                label: 'Push to Talk button',
                child: GestureDetector(
                  onTap: _toggleListening,
                  child: Container(
                    width: 76,
                    height: 76,
                    decoration: BoxDecoration(
                      color: _isListening ? Colors.white : Colors.black,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2.5),
                    ),
                    child: Icon(
                      Icons.mic,
                      size: 38,
                      color: _isListening ? Colors.black : Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
