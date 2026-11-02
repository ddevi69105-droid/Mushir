class AppConstants {
  static const String appName = 'Mushir';
  static const String tagline = 'See Beyond Sight. Move with Confidence.';

  // Safety Disclaimers
  static const String safetyWarningEn = 
      'Mushir is an assistive perception tool. It complements, but NEVER replaces, a primary white cane, guide dog, or mobility training. Always verify ground with your cane.';
  static const String safetyWarningHi = 
      'मुशीर एक सहायक तकनीक है। यह कभी भी सफेद छड़ी या गाइड डॉग का विकल्प नहीं है। हमेशा अपनी छड़ी से जमीन की जांच करें।';

  // Supported Object Detection Classes (Indian Footpath & Mobility Hazard Taxonomy)
  static const List<String> supportedObjectClasses = [
    'person',
    'auto_rickshaw',
    'two_wheeler',
    'car',
    'bus',
    'truck',
    'bicycle',
    'cattle',
    'stray_dog',
    'pole',
    'bollard',
    'pothole',
    'open_manhole',
    'stairs_down',
    'stairs_up',
    'curb',
    'barricade',
    'vendor_cart',
    'tree_branch',
    'traffic_light',
    'crosswalk',
  ];

  // Optical Pinhole Reference Heights (Meters)
  static const Map<String, double> realWorldObjectHeights = {
    'person': 1.70,
    'auto_rickshaw': 1.80,
    'two_wheeler': 1.15,
    'car': 1.50,
    'bus': 3.10,
    'truck': 2.70,
    'bicycle': 1.05,
    'cattle': 1.40,
    'stray_dog': 0.55,
    'pole': 3.50,
    'bollard': 0.85,
    'pothole': 0.30,
    'open_manhole': 0.40,
    'stairs_down': 0.90,
    'stairs_up': 1.30,
    'curb': 0.20,
    'barricade': 1.10,
    'vendor_cart': 1.60,
    'tree_branch': 1.20,
    'traffic_light': 2.50,
    'crosswalk': 0.50,
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
