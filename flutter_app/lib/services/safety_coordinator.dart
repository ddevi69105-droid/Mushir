import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/constants/app_constants.dart';
import '../models/detection_result.dart';
import '../models/navigation_step.dart';
import '../models/user_location.dart';
import 'compass_service.dart';
import 'location_service.dart';
import 'routing_service.dart';
import 'tts_service.dart';
import 'vision_service.dart';

class SafetyCoordinator {
  final TtsService tts;
  final LocationService location;
  final RoutingService routing;
  final VisionService vision;
  final CompassService compass;

  List<DetectionResult> _currentDetections = [];
  DateTime _lastHazardWarning = DateTime.fromMillisecondsSinceEpoch(0);
  bool _isAssistanceActive = true;

  SafetyCoordinator({
    required this.tts,
    required this.location,
    required this.routing,
    required this.vision,
    required this.compass,
  }) {
    vision.addDetectionListener(_handleDetections);
    location.addLocationListener(_handleLocationUpdate);
  }

  void setAssistanceActive(bool active) {
    _isAssistanceActive = active;
    if (active) {
      tts.speak('Mushir assistance active. Optical perception online.', priority: SpeechPriority.critical);
    } else {
      tts.speak('Assistance paused.', priority: SpeechPriority.critical);
    }
  }

  void _handleDetections(List<DetectionResult> detections) {
    _currentDetections = detections;
    if (!_isAssistanceActive) return;

    final now = DateTime.now();
    final isHi = tts.currentLanguage.startsWith('hi');

    // 1. Priority 1: URGENT GROUND HAZARDS (open manhole, pothole, stairs down)
    final urgentGroundHazards = detections.where((d) {
      final clean = d.label.toLowerCase();
      final isGround = clean.contains('manhole') || clean.contains('pothole') || clean.contains('stairs down') || clean.contains('curb');
      final dist = d.estimatedDistance ?? 2.0;
      return isGround && dist < 2.8;
    }).toList();

    if (urgentGroundHazards.isNotEmpty && now.difference(_lastHazardWarning).inMilliseconds > 2500) {
      _lastHazardWarning = now;
      final h = urgentGroundHazards.first;
      final distStr = h.estimatedDistance != null ? '${h.estimatedDistance!.toStringAsFixed(1)} मीटर' : 'समीप';
      final distStrEn = h.estimatedDistance != null ? '${h.estimatedDistance!.toStringAsFixed(1)} meters' : 'ahead';
      final msg = isHi
          ? 'रुकिए! सामने $distStr पर ${h.label} है! तुरंत अपनी सफेद छड़ी से जमीन की जांच करें!'
          : 'Stop! ${h.label} detected $distStrEn directly ahead! Probe ground with your white cane immediately!';
      tts.speak(msg, priority: SpeechPriority.critical);
      return;
    }

    // 2. Priority 2: APPROACHING DYNAMIC TRAFFIC (auto rickshaws, motorcycles, cattle)
    final approachingTraffic = detections.where((d) {
      final clean = d.label.toLowerCase();
      final isTraffic = clean.contains('auto') || clean.contains('two wheeler') || clean.contains('motorcycle') || clean.contains('cattle') || clean.contains('bus');
      final isApproaching = d.motionAction.toLowerCase().contains('approach') || d.motionAction.toLowerCase().contains('rapid');
      final dist = d.estimatedDistance ?? 3.5;
      return isTraffic && (isApproaching || dist < 2.8);
    }).toList();

    if (approachingTraffic.isNotEmpty && now.difference(_lastHazardWarning).inMilliseconds > 3000) {
      _lastHazardWarning = now;
      final t = approachingTraffic.first;
      final distStr = t.estimatedDistance != null ? '${t.estimatedDistance!.toStringAsFixed(1)}m' : '';
      final msg = isHi
          ? 'चेतावनी: आपकी ${t.sectorLabel} पर ${t.label} $distStr आ रहा है। किनारे रहें।'
          : 'Alert: ${t.label} approaching on your ${t.sectorLabel} $distStr. Stay clear of roadway.';
      tts.speak(msg, priority: SpeechPriority.critical);
      return;
    }

    // 3. Priority 3: STANDARD CENTER PATH OBSTACLES (poles, bollards, barricades, pedestrians)
    final centerHazards = detections.where(
      (d) => d.sector == SpatialSector.center &&
             d.estimatedDistance != null &&
             d.estimatedDistance! < 1.8 &&
             !d.isDistanceUncertain,
    ).toList();

    if (centerHazards.isNotEmpty && now.difference(_lastHazardWarning).inMilliseconds > 3500) {
      _lastHazardWarning = now;
      final hazard = centerHazards.first;
      final msg = isHi
          ? 'सावधान: सामने ${hazard.label} है (${hazard.estimatedDistance!.toStringAsFixed(1)} मीटर)। गति धीमी करें।'
          : 'Caution: ${hazard.label} directly ahead at ${hazard.estimatedDistance!.toStringAsFixed(1)} meters. Slow down.';
      tts.speak(msg, priority: SpeechPriority.critical);
    }
  }

  void _handleLocationUpdate(UserLocation userLoc) {
    if (!routing.isNavigating) return;

    final nextStep = routing.updateProgress(userLoc);
    if (nextStep != null) {
      if (nextStep.maneuver == 'arrive') {
        tts.speak(nextStep.instruction, priority: SpeechPriority.critical);
      } else {
        // Calculate relative turn advice using compass heading if available
        String directionalAdvice = nextStep.spokenDirective;
        if (compass.isAvailable && nextStep.startLat != null && nextStep.startLng != null) {
          final targetBearing = RoutingService.calculateBearing(
            userLoc.latitude, userLoc.longitude,
            nextStep.startLat!, nextStep.startLng!,
          );
          final turnGuidance = compass.calculateRelativeTurnInstruction(targetBearing: targetBearing);
          directionalAdvice = '$turnGuidance ${nextStep.instruction}.';
        }
        tts.speak(directionalAdvice, priority: SpeechPriority.normal);
      }
    }
  }

  /// Command: "Where am I?" / "Locate me"
  Future<void> handleLocationQuery() async {
    final result = await location.getCurrentLocation(refreshAddress: true);
    if (result.isSuccess && result.location != null) {
      final loc = result.location!;
      final text = tts.currentLanguage.startsWith('hi')
          ? 'आप अभी ${loc.spokenAddress} के पास हैं। सटीकता ${loc.accuracy.round()} मीटर।'
          : loc.fullSpokenLocation;
      await tts.speak(text, priority: SpeechPriority.critical);
    } else {
      final err = result.errorMessage ?? 'Unable to determine GPS location.';
      await tts.speak(err, priority: SpeechPriority.critical);
    }
  }

  /// Command: "Take me to [Destination]"
  Future<void> handleNavigationRequest(String destinationQuery) async {
    await tts.speak('Searching for $destinationQuery.', priority: SpeechPriority.normal);

    final currentLocResult = await location.getCurrentLocation(refreshAddress: false);
    final userLoc = currentLocResult.location;

    if (userLoc == null) {
      await tts.speak('Unable to acquire your current location to calculate route.', priority: SpeechPriority.critical);
      return;
    }

    final destData = await routing.searchDestination(destinationQuery, userLocation: userLoc);
    if (destData == null) {
      await tts.speak('Could not find destination matching "$destinationQuery". Please verify place name.', priority: SpeechPriority.critical);
      return;
    }

    final destName = destData['name'] as String;
    final destLat = destData['lat'] as double;
    final destLng = destData['lng'] as double;

    await tts.speak('Calculating walking route to $destName.', priority: SpeechPriority.normal);

    final route = await routing.fetchPedestrianRoute(
      startLat: userLoc.latitude,
      startLng: userLoc.longitude,
      destLat: destLat,
      destLng: destLng,
      destName: destName,
    );

    if (route != null) {
      routing.startNavigation(route);
      final firstStep = route.steps.isNotEmpty ? route.steps.first.spokenDirective : 'Follow walking path.';
      final speech = tts.currentLanguage.startsWith('hi')
          ? '$destName के लिए पैदल मार्ग शुरू किया गया। कुल दूरी ${route.totalDistanceFormatted}। पहला कदम: $firstStep'
          : 'Walking route to $destName started. Distance: ${route.totalDistanceFormatted}, estimated duration: ${route.totalDurationFormatted}. First instruction: $firstStep';
      await tts.speak(speech, priority: SpeechPriority.critical);
    } else {
      await tts.speak('Failed to retrieve pedestrian walking directions. Please try again.', priority: SpeechPriority.critical);
    }
  }

  /// Command: "Describe my surroundings"
  void describeSurroundings() {
    if (_currentDetections.isEmpty) {
      final msg = tts.currentLanguage.startsWith('hi')
          ? 'कैमरे के दृश्य में कोई रुकावट नहीं दिख रही है। छड़ी से जमीन की जांच करते हुए आगे बढ़ें।'
          : 'No obstacles currently recognized in the camera view. Walkway is unobstructed ahead. Please verify ground with white cane.';
      tts.speak(msg, priority: SpeechPriority.normal);
      return;
    }

    final List<String> descriptions = _currentDetections.map((d) {
      final distStr = d.estimatedDistance != null && !d.isDistanceUncertain
          ? 'at ${d.estimatedDistance!.toStringAsFixed(1)} meters'
          : 'at uncertain distance';
      return '${d.label} on your ${d.sectorLabel} $distStr, ${d.motionAction}';
    }).toList();

    final text = 'Surroundings: ${descriptions.join(". ")}.';
    tts.speak(text, priority: SpeechPriority.normal);
  }

  /// Command: "Is there an obstacle ahead?"
  void checkObstacleAhead() {
    final centerObjects = _currentDetections.where((d) => d.sector == SpatialSector.center).toList();
    if (centerObjects.isEmpty) {
      tts.speak('Center walking path is clear of visible obstacles. Proceed with cane.', priority: SpeechPriority.normal);
    } else {
      final closest = centerObjects.first;
      final dist = closest.estimatedDistance != null ? '${closest.estimatedDistance!.toStringAsFixed(1)} meters' : 'uncertain distance';
      tts.speak('Yes, there is a ${closest.label} directly ahead at $dist, ${closest.motionAction}.', priority: SpeechPriority.critical);
    }
  }

  void describeSector(String sector) {
    final match = _currentDetections.where((d) => d.sector.name == sector).toList();
    if (match.isEmpty) {
      tts.speak('No obstacles detected on your $sector.', priority: SpeechPriority.normal);
    } else {
      final descriptions = match.map((d) => '${d.label} ${d.estimatedDistance != null ? "at ${d.estimatedDistance}m" : ""}').join(', ');
      tts.speak('On your $sector: $descriptions.', priority: SpeechPriority.normal);
    }
  }

  void dispose() {
    vision.removeDetectionListener(_handleDetections);
    location.removeLocationListener(_handleLocationUpdate);
  }
}
