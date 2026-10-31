/**
 * Mushir Context Coordinator & Tactical Alert Engine
 * Evaluates both obstacle behaviors ("What is it doing?") and
 * directional guidance ("When and where to go forward, right, left, back").
 */

import { audioService } from './audio_service.js';
import { navigationService } from './navigation_service.js';

class ContextCoordinator {
  constructor() {
    this.latestDetections = [];
    this.latestOrientation = null;
    this.recentAnnouncements = new Map();
    this.announcementCooldownMs = 4500;
    this.isAssistanceActive = false;
    this.onAlertDispatched = null;
    this.onRadarDataUpdated = null;
  }

  setAssistanceActive(active) {
    this.isAssistanceActive = active;
    const isHi = audioService.currentLanguage.startsWith('hi');
    if (active) {
      const msg = isHi ? "मुशीर सहायता सक्रिय है। आपके मार्ग और रुकावटों की निगरानी की जा रही है।" : "Mushir mobility assistance active. Scanning path and tracking obstacle behaviors.";
      audioService.speak(msg, 'normal');
    } else {
      const msg = isHi ? "सहायता रोक दी गई है।" : "Mobility assistance paused. Camera perception is idle.";
      audioService.speak(msg, 'normal');
    }
  }

  updateDetections(detections) {
    this.latestDetections = detections || [];

    if (this.isAssistanceActive) {
      this.evaluateObstacleAlerts(this.latestDetections);
    }

    if (this.onRadarDataUpdated) {
      this.onRadarDataUpdated(this.latestDetections, this.latestOrientation);
    }
  }

  updateOrientation(orientationData) {
    this.latestOrientation = orientationData;
    if (this.onRadarDataUpdated) {
      this.onRadarDataUpdated(this.latestDetections, this.latestOrientation);
    }
  }

  /**
   * Evaluates urgent path obstructions & moving threats
   */
  evaluateObstacleAlerts(detections) {
    const now = Date.now();
    const isHi = audioService.currentLanguage.startsWith('hi');

    for (const det of detections) {
      const isApproachingFast = det.behavior === 'Approaching Fast' || det.behavior === 'Approaching';
      const isCritical = (det.label.includes('car') || det.label.includes('vehicle') || det.label.includes('truck')) && det.distance < 3.5;
      const isCenterHazard = det.zone.includes('centre') && det.distance < 1.8;

      if (isCritical) {
        const key = `critical_${det.label}`;
        if (!this.recentAnnouncements.has(key) || (now - this.recentAnnouncements.get(key) > 4000)) {
          this.recentAnnouncements.set(key, now);
          const pan = det.zone.includes('left') ? -0.7 : (det.zone.includes('right') ? 0.7 : 0);
          audioService.playChime('critical_hazard', { pan });
          const msg = isHi ? `सावधान: वाहन आगे आ रहा है, दूरी ${det.distance} मीटर।` : `Warning: vehicle ahead at ${det.distance} meters (${det.actionDescription || 'moving'}). Caution.`;
          audioService.speak(msg, 'critical');
          this.dispatchAlert('CRITICAL', `${det.label.toUpperCase()} ${det.distance}m · ${det.behavior || 'APPROACHING'}`);
          return;
        }
      } else if (isCenterHazard) {
        const key = `hazard_${det.label}_${det.zone}`;
        if (!this.recentAnnouncements.has(key) || (now - this.recentAnnouncements.get(key) > this.announcementCooldownMs)) {
          this.recentAnnouncements.set(key, now);
          const pan = det.zone.includes('left') ? -0.8 : (det.zone.includes('right') ? 0.8 : 0);
          audioService.playChime('obstacle', { pan, distance: det.distance });
          const actionText = det.actionDescription || 'in center walking path';
          const msg = isHi ? `रास्ते में रुकावट: ${det.label}, ${det.distance} मीटर आगे (${actionText})।` : `Obstacle ahead: ${det.label} at ${det.distance} meters, ${actionText}.`;
          audioService.speak(msg, 'normal');
          this.dispatchAlert('OBSTACLE', `${det.label} ${det.distance}m · ${det.behavior || 'BLOCKING'}`);
          return;
        }
      } else if (isApproachingFast && det.distance < 2.5) {
        const key = `approaching_${det.label}`;
        if (!this.recentAnnouncements.has(key) || (now - this.recentAnnouncements.get(key) > 4000)) {
          this.recentAnnouncements.set(key, now);
          const pan = det.zone.includes('left') ? -0.7 : (det.zone.includes('right') ? 0.7 : 0);
          audioService.playChime('obstacle', { pan, distance: det.distance });
          audioService.speak(`Attention: ${det.label} on your ${det.zoneLabel || det.zone} is moving towards you at ${det.distance} meters.`, 'normal');
          this.dispatchAlert('OBSTACLE', `${det.label} ${det.distance}m · APPROACHING`);
          return;
        }
      }
    }
  }

  /**
   * Command: "What obstacles are around me and what are they doing?"
   */
  describeObstaclesAndActions() {
    if (!this.latestDetections || this.latestDetections.length === 0) {
      audioService.speak("No obstacles currently recognized in the camera view. Walkway is unobstructed ahead. Please verify ground with white cane.", 'normal');
      return;
    }

    const descriptions = this.latestDetections.map(d => {
      const sector = d.zoneLabel || d.zone;
      const action = d.actionDescription || 'standing stationary';
      const level = d.groundClearance || 'mid level';
      return `${d.label} at ${d.distance} meters on your ${sector}, ${action} (${level})`;
    });

    const response = `Obstacles around you: ${descriptions.join('. ')}.`;
    audioService.speak(response, 'normal');
    this.dispatchAlert('AMBIENT', 'Obstacle behaviors described');
  }

  /**
   * Command: "Is there an obstacle ahead?"
   */
  checkObstacleAhead() {
    const isHi = audioService.currentLanguage.startsWith('hi');
    const centerObstacles = this.latestDetections.filter(d => d.zone.includes('centre'));

    if (centerObstacles.length === 0) {
      const msg = isHi ? "कैमरे के दृश्य में आगे कोई सीधी रुकावट नहीं दिखाई दे रही है। सफेद छड़ी से जांच करते हुए आगे बढ़ें।" : "No obstacles currently detected directly in front within camera view. Walking path is clear. Proceed with white cane.";
      audioService.speak(msg, 'normal');
    } else {
      const closest = centerObstacles.reduce((prev, curr) => curr.distance < prev.distance ? curr : prev, centerObstacles[0]);
      audioService.playChime('obstacle', { pan: 0, distance: closest.distance });
      const action = closest.actionDescription || 'blocking path';
      const msg = isHi ? `आगे ${closest.distance} मीटर पर ${closest.label} है (${action})। कृपया गति धीमी करें।` : `Yes, there is a ${closest.label} directly ahead at ${closest.distance} meters, ${action}. Please slow down.`;
      audioService.speak(msg, 'normal');
    }
  }

  describeCenterPath() {
    this.checkObstacleAhead();
  }

  describeSurroundings() {
    this.describeObstaclesAndActions();
  }

  handleConversationalQuery(question) {
    const q = (question || '').toLowerCase();

    if (q === 'hi' || q === 'hii' || q === 'hello' || q === 'hey' || q === 'namaste' || q.includes('who are you') || q.includes('who r u')) {
      const isHi = audioService.currentLanguage.startsWith('hi');
      const greeting = isHi
        ? "नमस्ते, मैं मुशीर हूँ। मैं आपकी क्या मदद कर सकता हूँ? आप कहाँ जाना चाहते हैं?"
        : "Hi, I am Mushir. How can I help you? Where do you want to go?";
      audioService.speak(greeting, 'normal');
      return;
    }

    if (q.includes('locate') || q.includes('where i am') || q.includes('where am i') || q.includes('where i m') || q.includes('position')) {
      navigationService.identifyCurrentStandingLocation(true);
      return;
    }

    if (q.includes('want to go') || q.includes('how far') || q.includes('premnagar') || q.includes('navigate')) {
      navigationService.queryDestinationGuidance(question);
      return;
    }

    if (q.includes('what is it doing') || q.includes('doing') || q.includes('obstacle doing')) {
      this.describeObstaclesAndActions();
    } else if (q.includes('forward') || q.includes('ahead') || q.includes('walk forward')) {
      audioService.speak("Check ground contact with cane and proceed forward along the path.", 'normal');
    } else if (q.includes('battery')) {
      audioService.speak("Device battery, orientation sensors, and LiteRT vision model are running optimally.", 'normal');
    } else {
      this.describeObstaclesAndActions();
    }
  }

  dispatchAlert(level, text) {
    if (this.onAlertDispatched) {
      this.onAlertDispatched({
        level,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    }
  }
}

export const contextCoordinator = new ContextCoordinator();
