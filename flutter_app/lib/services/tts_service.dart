import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import '../core/constants/app_constants.dart';

enum SpeechPriority { critical, normal, ambient }

class TtsService {
  final FlutterTts _flutterTts = FlutterTts();
  String _currentLanguage = AppConstants.defaultLanguage;
  double _speechRate = AppConstants.defaultSpeechRate;
  bool _isSpeaking = false;
  String _lastSpoken = '';
  DateTime _lastSpeechTime = DateTime.fromMillisecondsSinceEpoch(0);

  bool get isSpeaking => _isSpeaking;
  String get currentLanguage => _currentLanguage;
  double get speechRate => _speechRate;
  String get lastSpoken => _lastSpoken;

  Future<void> initialize() async {
    try {
      await _flutterTts.setLanguage(_currentLanguage);
      await _flutterTts.setSpeechRate(_speechRate);
      await _flutterTts.setVolume(1.0);
      await _flutterTts.setPitch(1.0);

      _flutterTts.setStartHandler(() {
        _isSpeaking = true;
      });

      _flutterTts.setCompletionHandler(() {
        _isSpeaking = false;
      });

      _flutterTts.setErrorHandler((msg) {
        _isSpeaking = false;
        debugPrint('TTS error: $msg');
      });
    } catch (e) {
      debugPrint('TTS initialization notice: $e');
    }
  }

  Future<void> setLanguage(String langCode) async {
    _currentLanguage = langCode;
    await _flutterTts.setLanguage(langCode);
    if (langCode.startsWith('hi')) {
      await speak('भाषा बदलकर हिंदी कर दी गई है।', priority: SpeechPriority.critical);
    } else {
      await speak('Language switched to English.', priority: SpeechPriority.critical);
    }
  }

  Future<void> increaseSpeechRate() async {
    _speechRate = (_speechRate + 0.15).clamp(0.6, 1.8);
    await _flutterTts.setSpeechRate(_speechRate);
    final text = _currentLanguage.startsWith('hi')
        ? 'आवाज की गति बढ़ा दी गई है।'
        : 'Speech rate increased to ${_speechRate.toStringAsFixed(2)}x.';
    await speak(text, priority: SpeechPriority.critical);
  }

  Future<void> decreaseSpeechRate() async {
    _speechRate = (_speechRate - 0.15).clamp(0.6, 1.8);
    await _flutterTts.setSpeechRate(_speechRate);
    final text = _currentLanguage.startsWith('hi')
        ? 'आवाज की गति घटा दी गई है।'
        : 'Speech rate decreased to ${_speechRate.toStringAsFixed(2)}x.';
    await speak(text, priority: SpeechPriority.critical);
  }

  Future<void> speak(
    String text, {
    SpeechPriority priority = SpeechPriority.normal,
  }) async {
    if (text.isEmpty) return;

    final now = DateTime.now();

    // Critical priority (hazard alert): interrupt immediately
    if (priority == SpeechPriority.critical) {
      await _flutterTts.stop();
      _lastSpoken = text;
      _lastSpeechTime = now;
      await _flutterTts.speak(text);
      return;
    }

    // Ambient priority: if speaking or spoken recently, drop to avoid audio clutter
    if (priority == SpeechPriority.ambient) {
      if (_isSpeaking || now.difference(_lastSpeechTime).inMilliseconds < AppConstants.speechDeduplicationCooldownMs) {
        return;
      }
    }

    _lastSpoken = text;
    _lastSpeechTime = now;
    await _flutterTts.speak(text);
  }

  Future<void> repeatLast() async {
    if (_lastSpoken.isNotEmpty) {
      await speak(_lastSpoken, priority: SpeechPriority.critical);
    }
  }

  Future<void> stop() async {
    _isSpeaking = false;
    await _flutterTts.stop();
  }

  void dispose() {
    _flutterTts.stop();
  }
}
