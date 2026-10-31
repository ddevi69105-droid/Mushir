class NavigationStep {
  final String instruction;
  final String maneuver; // 'turn-left', 'turn-right', 'continue', 'arrive', 'depart'
  final double distanceMeters;
  final double durationSeconds;
  final String streetName;
  final double? startLat;
  final double? startLng;

  NavigationStep({
    required this.instruction,
    required this.maneuver,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.streetName,
    this.startLat,
    this.startLng,
  });

  String get spokenDirective {
    if (maneuver == 'arrive') {
      return 'You have arrived at your destination: $streetName.';
    }
    final distText = distanceMeters >= 1000
        ? '${(distanceMeters / 1000).toStringAsFixed(1)} kilometers'
        : '${distanceMeters.round()} meters';
    return '$instruction in $distText.';
  }
}

class WalkingRoute {
  final String destinationName;
  final double destLat;
  final double destLng;
  final double totalDistanceMeters;
  final double totalDurationSeconds;
  final List<NavigationStep> steps;

  WalkingRoute({
    required this.destinationName,
    required this.destLat,
    required this.destLng,
    required this.totalDistanceMeters,
    required this.totalDurationSeconds,
    required this.steps,
  });

  String get totalDistanceFormatted {
    if (totalDistanceMeters >= 1000) {
      return '${(totalDistanceMeters / 1000).toStringAsFixed(1)} km';
    }
    return '${totalDistanceMeters.round()} meters';
  }

  String get totalDurationFormatted {
    final minutes = (totalDurationSeconds / 60).round();
    if (minutes < 1) return 'less than 1 minute';
    return '$minutes minutes';
  }
}
