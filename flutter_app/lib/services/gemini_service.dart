import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class GeminiService {
  static const String _keyStorageKey = 'mushir_gemini_api_key';
  String? _apiKey;

  String? get apiKey => _apiKey;
  bool get hasApiKey => _apiKey != null && _apiKey!.trim().isNotEmpty;

  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    _apiKey = prefs.getString(_keyStorageKey);
  }

  Future<void> setApiKey(String key) async {
    _apiKey = key.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyStorageKey, _apiKey!);
  }

  /// Sends scene reasoning query to Gemini 1.5 Flash
  Future<String> answerQuery({
    required String question,
    String? sceneContext,
  }) async {
    if (!hasApiKey) {
      return 'AI cloud assistant requires an API key in Settings. Operating in local on-device safety mode.';
    }

    try {
      final prompt = '''
You are Mushir, an assistive audio guide for a blind pedestrian.
The user is asking: "$question".
Current visual scene context: "${sceneContext ?? 'Pedestrian corridor'}".
Provide a concise, direct, spoken answer (maximum 2 sentences) describing safety hazards, landmarks, or text.
Do not use markdown, bullet points, or visual formatting. Speak directly to the user.
''';

      final url = Uri.parse(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$_apiKey',
      );

      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'contents': [
            {
              'parts': [
                {'text': prompt}
              ]
            }
          ]
        }),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final candidates = data['candidates'] as List<dynamic>?;
        if (candidates != null && candidates.isNotEmpty) {
          final content = candidates[0]['content'];
          final parts = content['parts'] as List<dynamic>;
          return parts[0]['text'].toString().trim();
        }
      }
      return 'Unable to process scene question at this moment.';
    } catch (e) {
      debugPrint('Gemini API error: $e');
      return 'Cloud assistant query timed out. Please rely on local obstacle perception.';
    }
  }
}
