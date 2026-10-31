import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_compass/flutter_compass.dart';

class CompassService {
  double? _currentHeading;
  double? _accuracy;
  StreamSubscription<CompassEvent>? _compassSubscription;
  bool _isAvailable = false;

  double? get currentHeading => _currentHeading;
  double? get accuracy => _accuracy;
  bool get isAvailable => _isAvailable;

  void startListening() {
    try {
      _compassSubscription = FlutterCompass.events?.listen(
        (CompassEvent event) {
          _currentHeading = event.heading;
          _accuracy = event.accuracy;
          _isAvailable = event.heading != null;
        },
        onError: (err) {
          debugPrint('Compass stream notice: $err');
          _isAvailable = false;
        },
      );
    } catch (e) {
      debugPrint('Compass hardware not available: $e');
      _isAvailable = false;
    }
  }

  void stopListening() {
    _compassSubscription?.cancel();
    _compassSubscription = null;
  }

  /// Calculates relative turn required from current heading to target bearing
  /// Negative degrees = Turn Left, Positive degrees = Turn Right
  String calculateRelativeTurnInstruction({
    required double targetBearing,
    double? customHeading,
  }) {
    final heading = customHeading ?? _currentHeading;
    if (heading == null) {
      return 'Continue towards the next route instruction.';
    }

    double diff = (targetBearing - heading + 360.0) % 360.0;
    if (diff > 180.0) {
      diff -= 360.0;
    }

    if (diff.abs() <= 25.0) {
      return 'Continue straight forward.';
    } else if (diff > 25.0 && diff <= 70.0) {
      return 'Bear slight right.';
    } else if (diff > 70.0 && diff <= 115.0) {
      return 'Turn right onto the walkway.';
    } else if (diff > 115.0 && diff <= 160.0) {
      return 'Turn sharp right.';
    } else if (diff < -25.0 && diff >= -70.0) {
      return 'Bear slight left.';
    } else if (diff < -70.0 && diff >= -115.0) {
      return 'Turn left onto the walkway.';
    } else if (diff < -115.0 && diff >= -160.0) {
      return 'Turn sharp left.';
    } else {
      return 'Turn around 180 degrees.';
    }
  }

  void dispose() {
    stopListening();
  }
}
