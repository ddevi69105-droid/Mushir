import 'dart:async';
import 'dart:ui';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import '../core/constants/app_constants.dart';
import '../models/detection_result.dart';
import 'tflite_detection_service.dart';

class VisionService {
  CameraController? _cameraController;
  final TfliteDetectionService _tfliteService = TfliteDetectionService();
  bool _isProcessingFrame = false;
  bool _isModelLoaded = false;
  int _nextTrackId = 1;
  final Map<int, DetectionResult> _trackedObjects = {};
  DateTime _lastInferenceTime = DateTime.now();

  // Listeners
  final List<void Function(List<DetectionResult>)> _detectionListeners = [];

  bool get isModelLoaded => _isModelLoaded;
  CameraController? get cameraController => _cameraController;
  TfliteDetectionService get tfliteService => _tfliteService;

  void addDetectionListener(void Function(List<DetectionResult>) listener) {
    _detectionListeners.add(listener);
  }

  void removeDetectionListener(void Function(List<DetectionResult>) listener) {
    _detectionListeners.remove(listener);
  }

  /// Initialize camera stream and on-device model
  Future<bool> initializeCamera(List<CameraDescription> cameras) async {
    if (cameras.isEmpty) return false;

    try {
      final camera = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );

      _cameraController = CameraController(
        camera,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.yuv420,
      );

      await _cameraController!.initialize();

      // Initialize on-device TFLite model and labels
      await _tfliteService.initialize();
      _isModelLoaded = true;

      // Start live camera frame stream for computer vision
      await _startFrameStreaming();
      return true;
    } catch (e) {
      debugPrint('Camera initialization error: $e');
      return false;
    }
  }

  Future<void> _startFrameStreaming() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) return;

    try {
      await _cameraController!.startImageStream((CameraImage image) {
        final now = DateTime.now();
        // Throttle inference to ~6-8 FPS to preserve Android CPU & battery
        if (_isProcessingFrame || now.difference(_lastInferenceTime).inMilliseconds < 130) {
          return;
        }

        _isProcessingFrame = true;
        _lastInferenceTime = now;

        _processCameraImage(image).then((results) {
          _isProcessingFrame = false;
          final tracked = _updateObjectTracking(results);
          for (final listener in _detectionListeners) {
            listener(tracked);
          }
        }).catchError((err) {
          _isProcessingFrame = false;
          debugPrint('Frame inference error: $err');
        });
      });
    } catch (e) {
      debugPrint('Error starting camera stream: $e');
    }
  }

  /// Real-time frame inference pipeline via TFLite
  Future<List<DetectionResult>> _processCameraImage(CameraImage image) async {
    final List<DetectionResult> detections = [];
    final rawDetections = await _tfliteService.detectFromCameraImage(image);

    for (final raw in rawDetections) {
      final centerX = (raw.box.left + raw.box.width / 2.0).clamp(0.0, 1.0);
      final sectorData = calculateSpatialSector(centerX);
      final distanceData = calculateOpticalDistance(raw.label, raw.box.height);

      detections.add(DetectionResult(
        id: _nextTrackId++,
        label: raw.label.replaceAll('_', ' '),
        confidence: raw.confidence,
        boundingBox: raw.box,
        sector: sectorData['sector'] as SpatialSector,
        sectorLabel: sectorData['label'] as String,
        estimatedDistance: distanceData['distance'] as double?,
        isDistanceUncertain: distanceData['isUncertain'] as bool,
        motionAction: 'Stationary in path',
      ));
    }

    return detections;
  }

  /// Estimates spatial sector based on actual normalized horizontal coordinate (0.0 to 1.0)
  Map<String, dynamic> calculateSpatialSector(double normalizedCenterX) {
    if (normalizedCenterX < AppConstants.sectorNearLeftEnd) {
      return {'sector': SpatialSector.left, 'label': 'left side of the camera view'};
    } else if (normalizedCenterX <= AppConstants.sectorCenterEnd) {
      return {'sector': SpatialSector.center, 'label': 'centre of the camera view'};
    } else {
      return {'sector': SpatialSector.right, 'label': 'right side of the camera view'};
    }
  }

  /// Pinhole optical distance calculation with explicit uncertainty communication
  Map<String, dynamic> calculateOpticalDistance(String label, double normalizedHeight) {
    final realHeight = AppConstants.realWorldObjectHeights[label.toLowerCase()] ?? AppConstants.realWorldObjectHeights['default']!;
    const focalLengthNormalized = 1.35; // Calibrated for standard Android wide-angle rear camera

    if (normalizedHeight < 0.08) {
      // Too small in frame to guarantee physical distance
      return {'distance': null, 'isUncertain': true};
    }

    final distance = (realHeight * focalLengthNormalized) / normalizedHeight;
    final boundedDist = distance.clamp(0.5, 9.5);
    return {'distance': double.parse(boundedDist.toStringAsFixed(1)), 'isUncertain': false};
  }

  /// Multi-frame object tracker: prevents spamming repeated announcements for stationary objects
  List<DetectionResult> _updateObjectTracking(List<DetectionResult> rawDetections) {
    final now = DateTime.now();
    final List<DetectionResult> updated = [];

    for (final det in rawDetections) {
      int? matchedId;
      for (final entry in _trackedObjects.entries) {
        final existing = entry.value;
        // Check bounding box overlap / proximity
        final xDiff = (det.boundingBox.center.dx - existing.boundingBox.center.dx).abs();
        final yDiff = (det.boundingBox.center.dy - existing.boundingBox.center.dy).abs();
        if (xDiff < 0.15 && yDiff < 0.15 && det.label == existing.label) {
          matchedId = entry.key;
          break;
        }
      }

      if (matchedId != null) {
        final existing = _trackedObjects[matchedId]!;
        String action = existing.motionAction;
        if (det.estimatedDistance != null && existing.estimatedDistance != null) {
          final distDiff = existing.estimatedDistance! - det.estimatedDistance!;
          if (distDiff > 0.4) {
            action = 'Approaching rapidly towards you';
          } else if (distDiff < -0.4) {
            action = 'Moving away into the distance';
          } else {
            action = 'Stationary in path';
          }
        }

        final tracked = DetectionResult(
          id: matchedId,
          label: det.label,
          confidence: det.confidence,
          boundingBox: det.boundingBox,
          sector: det.sector,
          sectorLabel: det.sectorLabel,
          estimatedDistance: det.estimatedDistance,
          isDistanceUncertain: det.isDistanceUncertain,
          motionAction: action,
          timestamp: now,
        );
        _trackedObjects[matchedId] = tracked;
        updated.add(tracked);
      } else {
        final newId = _nextTrackId++;
        final tracked = DetectionResult(
          id: newId,
          label: det.label,
          confidence: det.confidence,
          boundingBox: det.boundingBox,
          sector: det.sector,
          sectorLabel: det.sectorLabel,
          estimatedDistance: det.estimatedDistance,
          isDistanceUncertain: det.isDistanceUncertain,
          motionAction: 'Stationary in path',
          timestamp: now,
        );
        _trackedObjects[newId] = tracked;
        updated.add(tracked);
      }
    }

    // Prune stale tracks older than 1.5 seconds
    _trackedObjects.removeWhere((id, obj) => now.difference(obj.timestamp).inMilliseconds > 1500);

    return updated;
  }

  void dispose() {
    _cameraController?.dispose();
    _cameraController = null;
    _tfliteService.dispose();
    _trackedObjects.clear();
    _detectionListeners.clear();
  }
}
