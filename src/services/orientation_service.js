/**
 * Mushir Orientation & Compass Service
 * Reads DeviceOrientationEvent and tracks camera heading (0-360°),
 * pitch, roll, and cardinal directions.
 */

class OrientationService {
  constructor() {
    this.heading = 0; // 0° = North, 90° = East, etc.
    this.pitch = 0;   // Tilt forward/backward
    this.roll = 0;    // Tilt left/right
    this.isSensorAvailable = false;
    this.onOrientationChange = null;
    this.simulatedHeadingOffset = 0;
    this.cameraFovDegrees = 70; // Standard smartphone rear camera horizontal FOV

    this.init();
  }

  init() {
    if (window.DeviceOrientationEvent) {
      // For iOS 13+ permission request if needed
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // Will be called on user interaction
      } else {
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
      }
    }
  }

  async requestPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
          return true;
        }
      } catch (err) {
        console.warn("DeviceOrientation permission error:", err);
      }
    }
    return false;
  }

  handleOrientation(event) {
    if (event.alpha !== null) {
      this.isSensorAvailable = true;
      // Compass heading calculation
      let compassHeading = event.alpha;
      if (event.webkitCompassHeading) {
        // iOS devices
        compassHeading = event.webkitCompassHeading;
      } else {
        // Android / standard: alpha is 0 at start or relative to magnetic North
        compassHeading = (360 - event.alpha) % 360;
      }

      this.heading = Math.round((compassHeading + this.simulatedHeadingOffset) % 360);
      this.pitch = Math.round(event.beta || 0);
      this.roll = Math.round(event.gamma || 0);

      if (this.onOrientationChange) {
        this.onOrientationChange(this.getOrientationData());
      }
    }
  }

  setManualHeading(deg) {
    this.heading = (deg + 360) % 360;
    if (this.onOrientationChange) {
      this.onOrientationChange(this.getOrientationData());
    }
  }

  rotateHeading(deltaDeg) {
    this.setManualHeading(this.heading + deltaDeg);
  }

  getCardinalDirection(heading) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    const index = Math.round((heading % 360) / 45);
    return directions[index];
  }

  getOrientationData() {
    return {
      heading: this.heading,
      pitch: this.pitch,
      roll: this.roll,
      cardinal: this.getCardinalDirection(this.heading),
      fov: this.cameraFovDegrees,
      isSensorAvailable: this.isSensorAvailable
    };
  }
}

export const orientationService = new OrientationService();
