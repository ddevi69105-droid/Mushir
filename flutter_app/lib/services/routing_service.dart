import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/navigation_step.dart';
import '../models/user_location.dart';

class RoutingService {
  WalkingRoute? _activeRoute;
  int _currentStepIndex = 0;
  bool _isNavigating = false;

  WalkingRoute? get activeRoute => _activeRoute;
  int get currentStepIndex => _currentStepIndex;
  bool get isNavigating => _isNavigating;

  /// Search and geocode destination by place name using OpenStreetMap Nominatim
  Future<Map<String, dynamic>?> searchDestination(String query, {UserLocation? userLocation}) async {
    try {
      String searchQuery = query.trim();
      // If relative query like 'nearest pharmacy', combine with user's city if available
      if (userLocation != null && userLocation.city != null && !searchQuery.toLowerCase().contains(userLocation.city!.toLowerCase())) {
        searchQuery = '$searchQuery ${userLocation.city}';
      }

      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/search?format=json&q=${Uri.encodeComponent(searchQuery)}&limit=3&addressdetails=1',
      );
      final response = await http.get(
        url,
        headers: {'User-Agent': 'MushirMobilityAssistant/1.0 (accessibility@mushir.app)'},
      ).timeout(const Duration(seconds: 7));

      if (response.statusCode == 200) {
        final List<dynamic> results = jsonDecode(response.body);
        if (results.isNotEmpty) {
          final first = results[0];
          return {
            'name': first['display_name'].split(',')[0],
            'fullName': first['display_name'],
            'lat': double.parse(first['lat']),
            'lng': double.parse(first['lon']),
          };
        }
      }
    } catch (e) {
      debugPrint('Destination geocoding error: $e');
    }
    return null;
  }

  /// Fetches real walking route using the OSRM pedestrian routing engine
  Future<WalkingRoute?> fetchPedestrianRoute({
    required double startLat,
    required double startLng,
    required double destLat,
    required double destLng,
    required String destName,
  }) async {
    try {
      final url = Uri.parse(
        'https://router.project-osrm.org/route/v1/foot/$startLng,$startLat;$destLng,$destLat?overview=full&steps=true',
      );
      final response = await http.get(url).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['code'] == 'Ok' && data['routes'] != null && (data['routes'] as List).isNotEmpty) {
          final routeData = data['routes'][0];
          final totalDist = (routeData['distance'] as num).toDouble();
          final totalDur = (routeData['duration'] as num).toDouble();
          final legs = routeData['legs'] as List<dynamic>;

          final List<NavigationStep> steps = [];
          if (legs.isNotEmpty) {
            final rawSteps = legs[0]['steps'] as List<dynamic>;
            for (final s in rawSteps) {
              final maneuver = s['maneuver'] as Map<String, dynamic>;
              final mType = maneuver['type'] as String? ?? 'turn';
              final modifier = maneuver['modifier'] as String? ?? '';
              final street = (s['name'] as String? ?? '').isNotEmpty ? s['name'] : 'pedestrian walkway';
              final dist = (s['distance'] as num).toDouble();
              final dur = (s['duration'] as num).toDouble();

              String instruction;
              if (mType == 'depart') {
                instruction = 'Head $modifier on $street';
              } else if (mType == 'arrive') {
                instruction = 'Arrive at $destName';
              } else {
                instruction = modifier.isNotEmpty
                    ? 'Turn $modifier onto $street'
                    : 'Continue onto $street';
              }

              steps.add(NavigationStep(
                instruction: instruction,
                maneuver: modifier.isNotEmpty ? modifier : mType,
                distanceMeters: dist,
                durationSeconds: dur,
                streetName: street,
                startLat: maneuver['location'] != null ? (maneuver['location'][1] as num).toDouble() : null,
                startLng: maneuver['location'] != null ? (maneuver['location'][0] as num).toDouble() : null,
              ));
            }
          }

          final route = WalkingRoute(
            destinationName: destName,
            destLat: destLat,
            destLng: destLng,
            totalDistanceMeters: totalDist,
            totalDurationSeconds: totalDur,
            steps: steps,
          );

          _activeRoute = route;
          _currentStepIndex = 0;
          return route;
        }
      }
    } catch (e) {
      debugPrint('Pedestrian routing error: $e');
    }
    return null;
  }

  void startNavigation(WalkingRoute route) {
    _activeRoute = route;
    _currentStepIndex = 0;
    _isNavigating = true;
  }

  void stopNavigation() {
    _activeRoute = null;
    _currentStepIndex = 0;
    _isNavigating = false;
  }

  /// Updates progress along the walking route given user's current GPS position
  NavigationStep? updateProgress(UserLocation userLoc) {
    if (!_isNavigating || _activeRoute == null) return null;

    if (_currentStepIndex >= _activeRoute!.steps.length) {
      _isNavigating = false;
      return null;
    }

    final currentStep = _activeRoute!.steps[_currentStepIndex];

    // Check distance to next waypoint if coordinates are available
    if (currentStep.startLat != null && currentStep.startLng != null) {
      final distToStep = calculateHaversineDistance(
        userLoc.latitude, userLoc.longitude,
        currentStep.startLat!, currentStep.startLng!,
      );

      // If user is within 12 meters of step waypoint, advance to next instruction
      if (distToStep < 12.0 && _currentStepIndex < _activeRoute!.steps.length - 1) {
        _currentStepIndex++;
        return _activeRoute!.steps[_currentStepIndex];
      }
    }

    // Check if arrived at destination
    final distToDest = calculateHaversineDistance(
      userLoc.latitude, userLoc.longitude,
      _activeRoute!.destLat, _activeRoute!.destLng,
    );

    if (distToDest < 15.0) {
      _isNavigating = false;
      return NavigationStep(
        instruction: 'You have arrived at ${_activeRoute!.destinationName}.',
        maneuver: 'arrive',
        distanceMeters: 0,
        durationSeconds: 0,
        streetName: _activeRoute!.destinationName,
      );
    }

    return currentStep;
  }

  /// Haversine distance in meters
  static double calculateHaversineDistance(double lat1, double lon1, double lat2, double lon2) {
    const R = 6371000.0; // Earth radius in meters
    final dLat = (lat2 - lat1) * pi / 180.0;
    final dLon = (lon2 - lon1) * pi / 180.0;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180.0) * cos(lat2 * pi / 180.0) * sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return R * c;
  }

  /// Compass bearing from point 1 to point 2 (0° to 360°)
  static double calculateBearing(double lat1, double lon1, double lat2, double lon2) {
    final y = sin((lon2 - lon1) * pi / 180.0) * cos(lat2 * pi / 180.0);
    final x = cos(lat1 * pi / 180.0) * sin(lat2 * pi / 180.0) -
        sin(lat1 * pi / 180.0) * cos(lat2 * pi / 180.0) * cos((lon2 - lon1) * pi / 180.0);
    final brng = atan2(y, x) * 180.0 / pi;
    return (brng + 360.0) % 360.0;
  }
}
