import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../core/constants/app_constants.dart';

enum VoiceIntentType {
  locationQuery,
  navigationQuery,
  environmentQuery,
  appCommand,
  conversationalQuery,
}

class VoiceIntent {
  final VoiceIntentType type;
  final String action;
  final String? entity; // Extracted destination, sector, or parameter
  final String rawTranscript;

  VoiceIntent({
    required this.type,
    required this.action,
    this.entity,
    required this.rawTranscript,
  });
}

class VoiceService {
  final SpeechToText _speech = SpeechToText();
  bool _isAvailable = false;
  bool _isListening = false;
  String _currentLanguage = AppConstants.defaultLanguage;
  void Function(VoiceIntent)? onIntentRecognized;
  void Function(String)? onTranscriptUpdated;
  void Function(bool)? onListeningStateChanged;

  bool get isAvailable => _isAvailable;
  bool get isListening => _isListening;
  String get currentLanguage => _currentLanguage;

  Future<bool> initialize() async {
    try {
      _isAvailable = await _speech.initialize(
        onError: (err) {
          debugPrint('Speech recognition error: ${err.errorMsg}');
          _isListening = false;
          onListeningStateChanged?.call(false);
        },
        onStatus: (status) {
          _isListening = status == 'listening';
          onListeningStateChanged?.call(_isListening);
        },
      );
      return _isAvailable;
    } catch (e) {
      debugPrint('Speech initialization notice: $e');
      _isAvailable = false;
      return false;
    }
  }

  void setLanguage(String langCode) {
    _currentLanguage = langCode;
  }

  Future<void> startListening() async {
    if (!_isAvailable) {
      await initialize();
    }

    if (_isAvailable && !_isListening) {
      try {
        await _speech.listen(
          localeId: _currentLanguage,
          listenFor: const Duration(seconds: 12),
          pauseFor: const Duration(seconds: 3),
          cancelOnError: false,
          partialResults: true,
          onResult: (result) {
            onTranscriptUpdated?.call(result.recognizedWords);
            if (result.finalResult) {
              final intent = classifyIntent(result.recognizedWords);
              onIntentRecognized?.call(intent);
            }
          },
        );
      } catch (e) {
        debugPrint('Listen error: $e');
      }
    }
  }

  Future<void> stopListening() async {
    if (_isListening) {
      await _speech.stop();
      _isListening = false;
      onListeningStateChanged?.call(false);
    }
  }

  /// Command-intent classifier and entity extractor
  VoiceIntent classifyIntent(String rawText) {
    final clean = rawText.toLowerCase().replaceAll(RegExp(r'[^\w\s]'), '').trim();

    // 1. Location Commands
    if (clean.contains('where am i') ||
        clean.contains('locate me') ||
        clean.contains('where i am') ||
        clean.contains('where i m') ||
        clean.contains('my location') ||
        clean.contains('my position') ||
        clean.contains('current address') ||
        clean.contains('tell me my coordinates') ||
        clean.contains('kahan hoon') ||
        clean.contains('meri location')) {
      return VoiceIntent(
        type: VoiceIntentType.locationQuery,
        action: 'GET_CURRENT_LOCATION',
        rawTranscript: rawText,
      );
    }

    // 2. Navigation Commands
    if (clean.contains('take me to') ||
        clean.contains('navigate to') ||
        clean.contains('navigate me to') ||
        clean.contains('find the nearest') ||
        clean.contains('find nearest') ||
        clean.contains('directions to') ||
        clean.contains('i want to go') ||
        clean.contains('if i want to go') ||
        clean.contains('how far is') ||
        clean.contains('jana hai')) {
      
      String destination = '';
      final triggers = [
        'take me to',
        'navigate me to',
        'navigate to',
        'find the nearest',
        'find nearest',
        'directions to',
        'if i want to go to',
        'if i want to go',
        'i want to go to',
        'i want to go',
        'how far is',
      ];

      for (final t in triggers) {
        if (clean.contains(t)) {
          destination = clean.substring(clean.indexOf(t) + t.length);
          break;
        }
      }

      destination = destination
          .replaceAll(RegExp(r'\b(the|from me|from here|from u|please)\b'), '')
          .trim();

      if (destination.isEmpty && clean.contains('jana hai')) {
        destination = clean.replaceAll('jana hai', '').replaceAll('mujhe', '').trim();
      }

      return VoiceIntent(
        type: VoiceIntentType.navigationQuery,
        action: 'NAVIGATE_TO_DESTINATION',
        entity: destination.isNotEmpty ? destination : 'nearest destination',
        rawTranscript: rawText,
      );
    }

    if (clean.contains('where should i turn') || clean.contains('next turn') || clean.contains('repeat directions')) {
      return VoiceIntent(
        type: VoiceIntentType.navigationQuery,
        action: 'REPEAT_DIRECTIONS',
        rawTranscript: rawText,
      );
    }

    if (clean.contains('stop navigation') || clean.contains('cancel navigation')) {
      return VoiceIntent(
        type: VoiceIntentType.navigationQuery,
        action: 'STOP_NAVIGATION',
        rawTranscript: rawText,
      );
    }

    // 3. Environment & Obstacle Commands
    if (clean.contains('what is it doing') ||
        clean.contains('what are they doing') ||
        clean.contains('obstacle doing') ||
        clean.contains('doing around me')) {
      return VoiceIntent(
        type: VoiceIntentType.environmentQuery,
        action: 'DESCRIBE_OBSTACLE_BEHAVIORS',
        rawTranscript: rawText,
      );
    }

    if (clean.contains('what is on my left') || clean.contains('what is on the left')) {
      return VoiceIntent(
        type: VoiceIntentType.environmentQuery,
        action: 'DESCRIBE_SECTOR',
        entity: 'left',
        rawTranscript: rawText,
      );
    }

    if (clean.contains('what is on my right') || clean.contains('what is on the right')) {
      return VoiceIntent(
        type: VoiceIntentType.environmentQuery,
        action: 'DESCRIBE_SECTOR',
        entity: 'right',
        rawTranscript: rawText,
      );
    }

    if (clean.contains('what is in front of me') || clean.contains('is there an obstacle ahead') || clean.contains('obstacle ahead')) {
      return VoiceIntent(
        type: VoiceIntentType.environmentQuery,
        action: 'CHECK_OBSTACLE_AHEAD',
        rawTranscript: rawText,
      );
    }

    if (clean.contains('describe my surroundings') || clean.contains('describe surroundings') || clean.contains('what is around me')) {
      return VoiceIntent(
        type: VoiceIntentType.environmentQuery,
        action: 'DESCRIBE_SURROUNDINGS',
        rawTranscript: rawText,
      );
    }

    // 4. Application Commands
    if (clean.contains('start assistance') || clean == 'start') {
      return VoiceIntent(type: VoiceIntentType.appCommand, action: 'START_ASSISTANCE', rawTranscript: rawText);
    }

    if (clean.contains('stop assistance') || clean == 'stop' || clean == 'pause') {
      return VoiceIntent(type: VoiceIntentType.appCommand, action: 'STOP_ASSISTANCE', rawTranscript: rawText);
    }

    if (clean.contains('repeat that') || clean == 'repeat') {
      return VoiceIntent(type: VoiceIntentType.appCommand, action: 'REPEAT_LAST', rawTranscript: rawText);
    }

    if (clean.contains('speak slower') || clean.contains('slower')) {
      return VoiceIntent(type: VoiceIntentType.appCommand, action: 'SPEAK_SLOWER', rawTranscript: rawText);
    }

    if (clean.contains('speak faster') || clean.contains('speak louder')) {
      return VoiceIntent(type: VoiceIntentType.appCommand, action: 'SPEAK_FASTER', rawTranscript: rawText);
    }

    if (clean.contains('switch to hindi') || clean == 'hindi') {
      return VoiceIntent(type: VoiceIntentType.appCommand, action: 'SWITCH_TO_HINDI', rawTranscript: rawText);
    }

    if (clean.contains('switch to english') || clean == 'english') {
      return VoiceIntent(type: VoiceIntentType.appCommand, action: 'SWITCH_TO_ENGLISH', rawTranscript: rawText);
    }

    if (clean.contains('help')) {
      return VoiceIntent(type: VoiceIntentType.appCommand, action: 'HELP', rawTranscript: rawText);
    }

    // 5. General Conversational / AI Query
    return VoiceIntent(
      type: VoiceIntentType.conversationalQuery,
      action: 'ASK_GEMINI_AI',
      rawTranscript: rawText,
    );
  }

  void dispose() {
    _speech.stop();
  }
}
