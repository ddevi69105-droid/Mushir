class AppConstants {
  static const String appName = 'Mushir';
  static const String tagline = 'See Beyond Sight. Move with Confidence.';

  // Safety Disclaimers
  static const String safetyWarningEn = 
      'Mushir is an assistive perception tool. It complements, but NEVER replaces, a primary white cane, guide dog, or mobility training. Always verify ground with your cane.';
  static const String safetyWarningHi = 
      'मुशीर एक सहायक तकनीक है। यह कभी भी सफेद छड़ी या गाइड डॉग का विकल्प नहीं है। हमेशा अपनी छड़ी से जमीन की जांच करें।';

  // Supported Object Detection Classes (COCO / YOLO)
  static const List<String> supportedObjectClasses = [
    'person',
    'car',
    'motorcycle',
    'bicycle',
    'bus',
    'truck',
    'dog',
    'chair',
    'couch',
    'table',
    'traffic light',
    'stop sign',
    'fire hydrant',
    'potted plant',
    'backpack',
    'handbag',
    'bottle',
    'cell phone',
    'laptop',
    'door',
    'stairs',
  ];

  // Optical Pinhole Reference Heights (Meters)
  static const Map<String, double> realWorldObjectHeights = {
    'person': 1.70,
    'bicycle': 1.05,
    'car': 1.50,
    'motorcycle': 1.15,
    'bus': 3.10,
    'truck': 2.70,
    'dog': 0.60,
    'chair': 0.85,
    'table': 0.75,
    'bottle': 0.25,
    'cell phone': 0.15,
    'laptop': 0.25,
    'door': 2.05,
    'stairs': 1.20,
    'default': 1.00,
  };

  // Spatial Sectors
  static const double sectorFarLeftEnd = 0.20;
  static const double sectorNearLeftEnd = 0.35;
  static const double sectorCenterEnd = 0.65;
  static const double sectorNearRightEnd = 0.80;

  // Audio / Speech Defaults
  static const String defaultLanguage = 'en-US';
  static const String hindiLanguage = 'hi-IN';
  static const double defaultSpeechRate = 1.0;
  static const int speechDeduplicationCooldownMs = 4500;
}
