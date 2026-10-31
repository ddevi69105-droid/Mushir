class UserLocation {
  final double latitude;
  final double longitude;
  final double accuracy; // In meters
  final double? altitude;
  final double? speed;
  final double? heading;
  final String address;
  final String? street;
  final String? area;
  final String? city;
  final DateTime timestamp;

  UserLocation({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    this.altitude,
    this.speed,
    this.heading,
    required this.address,
    this.street,
    this.area,
    this.city,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  String get spokenAddress {
    final parts = [street, area, city].where((p) => p != null && p.isNotEmpty).toList();
    if (parts.isNotEmpty) {
      return parts.join(', ');
    }
    return address.isNotEmpty ? address : 'Latitude ${latitude.toStringAsFixed(4)}, Longitude ${longitude.toStringAsFixed(4)}';
  }

  String get fullSpokenLocation {
    return 'You are currently near $spokenAddress. Your approximate coordinates are ${latitude.toStringAsFixed(4)} and ${longitude.toStringAsFixed(4)}, accurate within ${accuracy.round()} meters.';
  }
}
