import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import '../models/user_location.dart';

class LocationResult {
  final UserLocation? location;
  final String? errorMessage;
  final bool isPermissionDenied;
  final bool isServiceDisabled;

  LocationResult({
    this.location,
    this.errorMessage,
    this.isPermissionDenied = false,
    this.isServiceDisabled = false,
  });

  bool get isSuccess => location != null && errorMessage == null;
}

class LocationService {
  UserLocation? _lastKnownLocation;
  StreamSubscription<Position>? _positionStreamSub;
  final List<void Function(UserLocation)> _listeners = [];

  UserLocation? get lastKnownLocation => _lastKnownLocation;

  void addLocationListener(void Function(UserLocation) listener) {
    _listeners.add(listener);
  }

  void removeLocationListener(void Function(UserLocation) listener) {
    _listeners.remove(listener);
  }

  /// Request Android permissions and check GPS status
  Future<LocationResult> checkAndRequestPermissions() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return LocationResult(
        isServiceDisabled: true,
        errorMessage: 'Location services are disabled on your device. Please enable GPS in device settings.',
      );
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return LocationResult(
          isPermissionDenied: true,
          errorMessage: 'Location permissions were denied. Mushir requires location access to navigate.',
        );
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return LocationResult(
        isPermissionDenied: true,
        errorMessage: 'Location permissions are permanently denied. Please enable them in Android App Settings.',
      );
    }

    return LocationResult();
  }

  /// Retrieves the actual physical location of the device via GPS
  Future<LocationResult> getCurrentLocation({bool refreshAddress = true}) async {
    final permCheck = await checkAndRequestPermissions();
    if (!permCheck.isSuccess && permCheck.errorMessage != null) {
      return permCheck;
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      String address = 'Coordinates: ${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}';
      String? street;
      String? area;
      String? city;

      if (refreshAddress) {
        final geocodeData = await reverseGeocode(position.latitude, position.longitude);
        if (geocodeData != null) {
          address = geocodeData['display_name'] ?? address;
          street = geocodeData['road'];
          area = geocodeData['suburb'] ?? geocodeData['neighbourhood'];
          city = geocodeData['city'] ?? geocodeData['town'];
        }
      }

      final userLoc = UserLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        altitude: position.altitude,
        speed: position.speed,
        heading: position.heading,
        address: address,
        street: street,
        area: area,
        city: city,
        timestamp: position.timestamp,
      );

      _lastKnownLocation = userLoc;
      for (final listener in _listeners) {
        listener(userLoc);
      }

      return LocationResult(location: userLoc);
    } on TimeoutException {
      // If high accuracy GPS timed out, try last known position
      final lastPos = await Geolocator.getLastKnownPosition();
      if (lastPos != null) {
        final userLoc = UserLocation(
          latitude: lastPos.latitude,
          longitude: lastPos.longitude,
          accuracy: lastPos.accuracy,
          address: 'Last known location (GPS signal acquired previously)',
        );
        _lastKnownLocation = userLoc;
        return LocationResult(location: userLoc);
      }
      return LocationResult(
        errorMessage: 'Unable to acquire accurate GPS satellite fix. Please ensure you have an open view of the sky.',
      );
    } catch (e) {
      debugPrint('Location acquisition error: $e');
      return LocationResult(errorMessage: 'Error acquiring location: ${e.toString()}');
    }
  }

  /// Reverse geocodes coordinates to street and place names using OpenStreetMap Nominatim
  Future<Map<String, String>?> reverseGeocode(double lat, double lng) async {
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=18&addressdetails=1',
      );
      final response = await http.get(
        url,
        headers: {'User-Agent': 'MushirMobilityAssistant/1.0 (accessibility@mushir.app)'},
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final address = data['address'] as Map<String, dynamic>? ?? {};
        return {
          'display_name': data['display_name'] ?? '',
          'road': address['road'] ?? address['pedestrian'] ?? address['footway'] ?? '',
          'suburb': address['suburb'] ?? address['neighbourhood'] ?? address['city_district'] ?? '',
          'city': address['city'] ?? address['town'] ?? address['village'] ?? address['county'] ?? '',
          'state': address['state'] ?? '',
        };
      }
    } catch (e) {
      debugPrint('Reverse geocoding notice: $e');
    }
    return null;
  }

  /// Starts continuous GPS tracking stream for navigation
  void startPositionTracking() {
    _positionStreamSub?.cancel();
    _positionStreamSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 3, // Update every 3 meters
      ),
    ).listen((position) async {
      final userLoc = UserLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        speed: position.speed,
        heading: position.heading,
        address: _lastKnownLocation?.address ?? '',
        street: _lastKnownLocation?.street,
        area: _lastKnownLocation?.area,
        city: _lastKnownLocation?.city,
        timestamp: position.timestamp,
      );
      _lastKnownLocation = userLoc;
      for (final listener in _listeners) {
        listener(userLoc);
      }
    });
  }

  void stopPositionTracking() {
    _positionStreamSub?.cancel();
    _positionStreamSub = null;
  }

  void dispose() {
    stopPositionTracking();
    _listeners.clear();
  }
}
