import 'dart:ui';

enum SpatialSector { left, center, right }

class DetectionResult {
  final int id;
  final String label;
  final double confidence;
  final Rect boundingBox; // Normalized (0.0 to 1.0)
  final SpatialSector sector;
  final String sectorLabel;
  final double? estimatedDistance; // In meters, null if uncertain
  final bool isDistanceUncertain;
  final String motionAction; // 'Approaching', 'Stationary', 'Crossing', 'Receding'
  final DateTime timestamp;

  DetectionResult({
    required this.id,
    required this.label,
    required this.confidence,
    required this.boundingBox,
    required this.sector,
    required this.sectorLabel,
    this.estimatedDistance,
    this.isDistanceUncertain = false,
    this.motionAction = 'Stationary',
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  String get spokenDescription {
    final distStr = estimatedDistance != null && !isDistanceUncertain
        ? 'at ${estimatedDistance!.toStringAsFixed(1)} meters'
        : 'at unknown distance';
    return '$label detected on the $sectorLabel $distStr, $motionAction.';
  }

  bool isSignificantlyDifferent(DetectionResult other) {
    if (label != other.label) return true;
    if (sector != other.sector) return true;
    if (estimatedDistance != null && other.estimatedDistance != null) {
      if ((estimatedDistance! - other.estimatedDistance!).abs() > 0.8) {
        return true;
      }
    }
    return false;
  }
}
