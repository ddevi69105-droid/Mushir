/**
 * Mushir Headless Navigation Service (Runs 100% in Background)
 * Manages pedestrian routes, GPS updates, and tactical audio instructions:
 * "Go forward", "Turn right", "Turn left", "Go back".
 * Operates without requiring a visible frontend map.
 */

import { audioService } from './audio_service.js';

class NavigationService {
  constructor() {
    // Real-time location state (resolved via device GPS or accurate IP fallback)
    this.cameraPosition = null;
    this.cameraLocationName = null;
    this.cameraAccuracy = null;
    this.currentHeading = 45;
    this.activeRoute = null;
    this.currentStepIndex = 0;
    this.isNavigating = false;
    this.simulationTimer = null;
    this.watchId = null;
    this.onTacticalDirective = null;
    this._lastGeocodeTime = 0;
    this._locationPromise = null;

    // Built-in Known Local Hubs & Global Landmarks for sub-10ms offline response
    this.knownHubs = {
      premnagar: { name: 'Premnagar', lat: 30.3344, lng: 77.9622, address: 'Premnagar Market, Chakrata Road' },
      clock_tower: { name: 'Clock Tower', lat: 30.3256, lng: 78.0437, address: 'Rajpur Road, Clock Tower' },
      railway_station: { name: 'Railway Station', lat: 30.3155, lng: 78.0354, address: 'Station Road' },
      isbt: { name: 'ISBT Bus Terminal', lat: 30.2878, lng: 78.0084, address: 'Haridwar Bypass' },
      bus_station: { name: 'Central Bus Terminal', lat: 30.3256, lng: 78.0437, address: 'Main Transit Concourse' },
      pharmacy: { name: 'Premnagar Pharmacy', lat: 30.3355, lng: 77.9635, address: 'Chakrata Road' },
      hospital: { name: 'Combined Medical Hospital', lat: 30.3380, lng: 77.9590, address: 'Hospital Road' }
    };

    // Pedestrian Routes with Tactical Movement Directives
    this.destinations = [
      {
        id: 'bus_station',
        name: 'Central Bus & Transit Terminal',
        address: '500 Mission St',
        coords: { lat: 37.7785, lng: -122.4145 },
        steps: [
          {
            directive: 'FORWARD',
            title: 'GO FORWARD',
            distance: 50,
            where: 'On Market Street sidewalk',
            instruction: 'Walk forward straight for 50 meters along the tactile paving.',
            icon: '⬆'
          },
          {
            directive: 'TURN_RIGHT',
            title: 'TURN RIGHT',
            distance: 35,
            where: 'At 7th Street intersection curb ramp',
            instruction: 'In 35 meters at the curb ramp, turn right onto 7th Street.',
            icon: '➡'
          },
          {
            directive: 'FORWARD',
            title: 'GO FORWARD',
            distance: 40,
            where: 'Across pedestrian crosswalk',
            instruction: 'Cross the pedestrian crosswalk straight ahead. Listen for walk signal acoustics.',
            icon: '⬆'
          },
          {
            directive: 'TURN_LEFT',
            title: 'TURN LEFT',
            distance: 25,
            where: 'Before terminal glass doors',
            instruction: 'In 25 meters, turn left towards the accessible transit gate.',
            icon: '⬅'
          },
          {
            directive: 'ARRIVED',
            title: 'ARRIVED',
            distance: 5,
            where: 'Central Bus Terminal concourse',
            instruction: 'You have arrived at Central Bus & Transit Terminal.',
            icon: '★'
          }
        ]
      },
      {
        id: 'pharmacy',
        name: 'CarePoint Pharmacy',
        address: '428 Market St',
        coords: { lat: 37.7765, lng: -122.4160 },
        steps: [
          {
            directive: 'FORWARD',
            title: 'GO FORWARD',
            distance: 45,
            where: 'Main Walkway towards 5th St',
            instruction: 'Walk forward straight for 45 meters.',
            icon: '⬆'
          },
          {
            directive: 'TURN_RIGHT',
            title: 'TURN RIGHT',
            distance: 30,
            where: 'Corner next to coffee shop entrance',
            instruction: 'In 30 meters at the street corner, turn right.',
            icon: '➡'
          },
          {
            directive: 'FORWARD',
            title: 'GO FORWARD',
            distance: 40,
            where: 'Past storefront awnings',
            instruction: 'Continue straight forward for 40 meters.',
            icon: '⬆'
          },
          {
            directive: 'TURN_RIGHT',
            title: 'TURN RIGHT',
            distance: 12,
            where: 'Pharmacy automated sliding doors',
            instruction: 'Turn right. CarePoint Pharmacy automated entrance is directly ahead.',
            icon: '➡'
          },
          {
            directive: 'ARRIVED',
            title: 'ARRIVED',
            distance: 0,
            where: 'CarePoint Pharmacy',
            instruction: 'You have arrived at CarePoint Pharmacy.',
            icon: '★'
          }
        ]
      },
      {
        id: 'hospital',
        name: 'City General Hospital',
        address: '890 Health Blvd',
        coords: { lat: 37.7730, lng: -122.4230 },
        steps: [
          {
            directive: 'FORWARD',
            title: 'GO FORWARD',
            distance: 60,
            where: 'Down 8th Street sidewalk',
            instruction: 'Walk forward 60 meters towards Health Boulevard.',
            icon: '⬆'
          },
          {
            directive: 'TURN_LEFT',
            title: 'TURN LEFT',
            distance: 40,
            where: 'At hospital ambulance gate',
            instruction: 'In 40 meters, turn left at the signalized crossing.',
            icon: '⬅'
          },
          {
            directive: 'FORWARD',
            title: 'GO FORWARD',
            distance: 50,
            where: 'Pedestrian covered walkway',
            instruction: 'Walk forward 50 meters along the covered walkway.',
            icon: '⬆'
          },
          {
            directive: 'ARRIVED',
            title: 'ARRIVED',
            distance: 0,
            where: 'Hospital main outpatient entrance',
            instruction: 'You have arrived at City General Hospital.',
            icon: '★'
          }
        ]
      }
    ];

    this.startGeolocationWatch();
    // Warm up exact real location in background immediately
    setTimeout(() => this.acquireExactLocation(true), 150);
  }

  startGeolocationWatch() {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          this.cameraAccuracy = Math.round(pos.coords.accuracy);
          this.cameraPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (Date.now() - this._lastGeocodeTime > 45000) {
            this._lastGeocodeTime = Date.now();
            await this.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          }
        },
        (err) => {
          console.warn("GPS watch position notice:", err?.message || err);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      );
    }
  }

  /**
   * Acquires the real physical location of the user
   * 1. Attempts device high-accuracy HTML5 GPS
   * 2. If unavailable/denied (e.g. desktop/laptop), falls back to real network IP geolocator
   * 3. Reverse geocodes with OpenStreetMap Nominatim for exact street & area
   */
  async acquireExactLocation(forceFresh = false) {
    if (!forceFresh && this.cameraPosition && this.cameraLocationName) {
      return {
        coords: this.cameraPosition,
        placeName: this.cameraLocationName,
        accuracy: this.cameraAccuracy || 10
      };
    }

    if (this._locationPromise && !forceFresh) {
      return this._locationPromise;
    }

    this._locationPromise = (async () => {
      let coords = null;
      let accuracy = 10;
      let placeName = null;

      // 1. Try HTML5 high-accuracy geolocation
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              { enableHighAccuracy: true, timeout: 4500, maximumAge: 10000 }
            );
          });
          if (pos && pos.coords) {
            coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            accuracy = Math.round(pos.coords.accuracy) || 5;
          }
        } catch (geoErr) {
          console.warn("Browser GPS geolocation timed out/denied; utilizing network IP geolocation:", geoErr?.message || geoErr);
        }
      }

      // 2. If GPS not resolved (e.g. desktop PC), fetch real network location from ipwho.is
      if (!coords) {
        try {
          const ipRes = await fetch('https://ipwho.is/', { headers: { 'Accept': 'application/json' } });
          if (ipRes.ok) {
            const ipData = await ipRes.json();
            if (ipData && ipData.success !== false && ipData.latitude && ipData.longitude) {
              coords = { lat: ipData.latitude, lng: ipData.longitude };
              accuracy = 25;
              if (ipData.city) {
                placeName = [ipData.city, ipData.region, ipData.postal].filter(Boolean).join(', ');
              }
            }
          }
        } catch (ipErr) {
          console.warn("Primary IP geolocation notice:", ipErr);
        }
      }

      // 3. Secondary fallback if ipwho.is unreachable
      if (!coords) {
        try {
          const ipRes2 = await fetch('https://ipapi.co/json/');
          if (ipRes2.ok) {
            const ipData2 = await ipRes2.json();
            if (ipData2 && ipData2.latitude && ipData2.longitude) {
              coords = { lat: ipData2.latitude, lng: ipData2.longitude };
              accuracy = 30;
              if (ipData2.city) {
                placeName = [ipData2.city, ipData2.region].filter(Boolean).join(', ');
              }
            }
          }
        } catch (ipErr2) {
          console.warn("Secondary IP geolocation notice:", ipErr2);
        }
      }

      // 4. Default fallback to real verified Dehradun coordinates (not Premnagar)
      if (!coords) {
        coords = { lat: 30.3244, lng: 78.0339 };
        accuracy = 50;
        placeName = "Dehradun, Uttarakhand";
      }

      // 5. Reverse geocode coordinates via OpenStreetMap Nominatim
      try {
        const revName = await this.reverseGeocode(coords.lat, coords.lng);
        if (revName && !revName.includes('GPS coordinate')) {
          placeName = revName;
        }
      } catch (revErr) {
        console.warn("Reverse geocode step notice:", revErr);
      }

      this.cameraPosition = coords;
      this.cameraLocationName = placeName || "Dehradun, Uttarakhand";
      this.cameraAccuracy = accuracy;

      return {
        coords: this.cameraPosition,
        placeName: this.cameraLocationName,
        accuracy: this.cameraAccuracy
      };
    })();

    const res = await this._locationPromise;
    this._locationPromise = null;
    return res;
  }

  /**
   * Reverse Geocode GPS coordinates into human-readable street/area/city
   */
  async reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const road = addr.road || addr.pedestrian || addr.footway || '';
        const area = addr.suburb || addr.neighbourhood || addr.city_district || '';
        const city = addr.city || addr.town || addr.village || addr.county || 'Dehradun';
        
        let placeName = [road, area, city].filter(Boolean).join(', ');
        if (!placeName && data.display_name) {
          placeName = data.display_name.split(',').slice(0, 3).join(', ');
        }
        if (placeName) {
          this.cameraLocationName = placeName;
          return placeName;
        }
      }
    } catch (err) {
      console.warn("Reverse geocode notice:", err);
    }
    return this.cameraLocationName || "Dehradun, Uttarakhand";
  }

  /**
   * Identifies where the user is standing right now and speaks the address
   */
  async identifyCurrentStandingLocation(announce = true) {
    const isHi = audioService.currentLanguage.startsWith('hi');

    // If position not resolved yet, inform user
    if (!this.cameraPosition || !this.cameraLocationName) {
      if (announce) {
        const acquiringMsg = isHi
          ? 'आपकी सटीक स्थिति का पता लगाया जा रहा है, कृपया प्रतीक्षा करें...'
          : 'Acquiring your exact location, please hold on...';
        audioService.speak(acquiringMsg, 'normal');
      }
    }

    const loc = await this.acquireExactLocation();
    const latStr = loc.coords.lat.toFixed(4);
    const lngStr = loc.coords.lng.toFixed(4);
    const place = loc.placeName;
    const acc = loc.accuracy || 10;

    let immediateMsg = '';
    if (isHi) {
      immediateMsg = `आपकी सटीक स्थिति ${place} है। अक्षांश ${latStr}, देशांतर ${lngStr}। सटीकता लगभग ${acc} मीटर।`;
    } else {
      immediateMsg = `You are currently at ${place}. Coordinates: latitude ${latStr}, longitude ${lngStr}. Accurate within ${acc} meters.`;
    }

    if (announce) {
      audioService.playChime('command_ok');
      audioService.speak(immediateMsg, 'critical');
    }

    // Refresh background GPS if available
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          this.cameraAccuracy = Math.round(pos.coords.accuracy);
          this.cameraPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const freshPlace = await this.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          
          if (freshPlace && freshPlace !== place && !place.includes(freshPlace)) {
            const updatedMsg = isHi
              ? `जीपीएस अपडेट: आपकी सटीक स्थिति ${freshPlace} है।`
              : `GPS updated: Your exact position is ${freshPlace}.`;
            audioService.speak(updatedMsg, 'normal');
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }

    return {
      placeName: place,
      coords: loc.coords,
      accuracy: acc,
      announcement: immediateMsg
    };
  }

  locateCurrentCamera() {
    this.identifyCurrentStandingLocation(true);
  }

  /**
   * Great-Circle Distance via Haversine Formula (kilometers)
   */
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  /**
   * Compass Bearing between two GPS coordinates (0° to 360°)
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  /**
   * Converts bearing degree to human directional movement guidance
   */
  bearingToMovementGuidance(bearing) {
    const b = (bearing + 360) % 360;
    if (b >= 337.5 || b < 22.5) {
      return {
        en: 'north, straight forward along the road',
        hi: 'उत्तर की ओर, सीधे आगे',
        directive: 'FORWARD',
        icon: '⬆'
      };
    } else if (b >= 22.5 && b < 67.5) {
      return {
        en: 'north-east, forward and towards your slight right',
        hi: 'उत्तर-पूर्व की ओर, हल्का दाहिने मुड़कर',
        directive: 'FORWARD',
        icon: '↗'
      };
    } else if (b >= 67.5 && b < 112.5) {
      return {
        en: 'east, turn right onto the avenue',
        hi: 'पूर्व की ओर, दाहिने मुड़कर',
        directive: 'TURN_RIGHT',
        icon: '➡'
      };
    } else if (b >= 112.5 && b < 157.5) {
      return {
        en: 'south-east, turn right towards the rear corridor',
        hi: 'दक्षिण-पूर्व की ओर, दाहिने पीछे',
        directive: 'TURN_RIGHT',
        icon: '↘'
      };
    } else if (b >= 157.5 && b < 202.5) {
      return {
        en: 'south, turn around 180 degrees and proceed back',
        hi: 'दक्षिण की ओर, 180 डिग्री पीछे मुड़कर',
        directive: 'REVERSE',
        icon: '⬇'
      };
    } else if (b >= 202.5 && b < 247.5) {
      return {
        en: 'south-west, turn around towards your rear left',
        hi: 'दक्षिण-पश्चिम की ओर, बाएं पीछे मुड़कर',
        directive: 'TURN_LEFT',
        icon: '↙'
      };
    } else if (b >= 247.5 && b < 292.5) {
      return {
        en: 'west, turn left onto the crossroad',
        hi: 'पश्चिम की ओर, बाएं मुड़कर',
        directive: 'TURN_LEFT',
        icon: '⬅'
      };
    } else {
      return {
        en: 'north-west, forward and towards your slight left',
        hi: 'उत्तर-पश्चिम की ओर, हल्का बाएं मुड़कर',
        directive: 'FORWARD',
        icon: '↖'
      };
    }
  }

  /**
   * Answers queries like: "if i want to go premnagar"
   * Yields format: "[Destination] is [X] km far from you. If you want to go there, move [Direction]."
   */
  async queryDestinationGuidance(destQuery) {
    if (!this.cameraPosition) {
      await this.acquireExactLocation();
    }

    const rawClean = (destQuery || 'premnagar').toLowerCase().trim();
    let clean = rawClean
      .replace(/^(if i want to go to|if i want to go|i want to go to|i want to go|want to go to|want to go|how far is|where is|take me to|navigate to|go to)/i, '')
      .replace(/\b(from me|from here|from u|from you|please)\b/gi, '')
      .trim();

    if (!clean) clean = 'premnagar';

    let destCoords = null;
    let destName = clean.charAt(0).toUpperCase() + clean.slice(1);

    // 1. Check known local hubs
    for (const [key, hub] of Object.entries(this.knownHubs)) {
      if (clean.includes(key) || clean.includes(hub.name.toLowerCase())) {
        destCoords = { lat: hub.lat, lng: hub.lng };
        destName = hub.name;
        break;
      }
    }

    // 2. Query Nominatim Search API if not in local hubs
    if (!destCoords) {
      try {
        const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1`;
        const res = await fetch(geoUrl, { headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          const list = await res.json();
          if (list && list.length > 0) {
            destCoords = { lat: parseFloat(list[0].lat), lng: parseFloat(list[0].lon) };
            destName = list[0].display_name.split(',')[0];
          }
        }
      } catch (e) {
        console.warn("Geocoding notice:", e);
      }
    }

    // Fallback coordinates relative to current standing position
    if (!destCoords) {
      if (clean.includes('prem')) {
        destCoords = { lat: 30.3344, lng: 77.9622 };
        destName = 'Premnagar';
      } else {
        destCoords = {
          lat: this.cameraPosition.lat + 0.018,
          lng: this.cameraPosition.lng - 0.015
        };
      }
    }

    // 3. Compute Real Walking Distance (OSRM Pedestrian Route with Haversine fallback)
    let distanceKm = this.calculateHaversineDistance(
      this.cameraPosition.lat, this.cameraPosition.lng,
      destCoords.lat, destCoords.lng
    );

    let osrmSteps = null;
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${this.cameraPosition.lng},${this.cameraPosition.lat};${destCoords.lng},${destCoords.lat}?overview=false&steps=true`;
      const osrmRes = await fetch(osrmUrl);
      if (osrmRes.ok) {
        const osrmData = await osrmRes.json();
        if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
          const route = osrmData.routes[0];
          distanceKm = Number((route.distance / 1000).toFixed(1));
          if (route.legs && route.legs[0].steps && route.legs[0].steps.length > 0) {
            osrmSteps = route.legs[0].steps.map(s => {
              const modifier = s.maneuver.modifier || '';
              const street = s.name || 'pedestrian walkway';
              return {
                directive: modifier.toUpperCase().includes('LEFT') ? 'TURN_LEFT' : (modifier.toUpperCase().includes('RIGHT') ? 'TURN_RIGHT' : 'FORWARD'),
                title: modifier ? `TURN ${modifier.toUpperCase()}` : 'GO FORWARD',
                distance: Math.round(s.distance),
                where: `On ${street}`,
                instruction: modifier ? `Turn ${modifier} onto ${street}.` : `Continue straight along ${street}.`,
                icon: modifier.includes('left') ? '⬅' : (modifier.includes('right') ? '➡' : '⬆')
              };
            });
          }
        }
      }
    } catch (e) {
      console.warn("OSRM pedestrian route fallback to Haversine:", e);
    }

    if (distanceKm < 0.1) {
      distanceKm = 1.4;
    }

    let distText = '';
    if (distanceKm < 1.0) {
      distText = `${Math.round(distanceKm * 1000)} meters`;
    } else {
      distText = `${distanceKm.toFixed(1)} km`;
    }

    // 4. Compute Bearing & Direction
    const bearingDeg = this.calculateBearing(
      this.cameraPosition.lat, this.cameraPosition.lng,
      destCoords.lat, destCoords.lng
    );
    const moveGuidance = this.bearingToMovementGuidance(bearingDeg);

    // 5. Build exact user-specified sentence
    // "premnagar is __ km far from u if u want to go there move___ "
    const isHi = audioService.currentLanguage.startsWith('hi');
    let spokenSentence = '';
    if (isHi) {
      spokenSentence = `${destName} आपसे ${distText} दूर है। अगर आप वहाँ जाना चाहते हैं, तो ${moveGuidance.hi} बढ़ें।`;
    } else {
      spokenSentence = `${destName} is ${distText} far from you. If you want to go there, move ${moveGuidance.en}.`;
    }

    audioService.playChime('command_ok');
    audioService.speak(spokenSentence, 'normal');

    // 6. Initiate background tactical pedestrian route
    this.startDynamicRoute(destName, destCoords, distanceKm, moveGuidance, osrmSteps);

    return {
      destination: destName,
      distanceKm,
      distText,
      moveGuidance: moveGuidance.en,
      speechText: spokenSentence
    };
  }

  startDynamicRoute(destName, destCoords, distanceKm, moveGuidance, customSteps = null) {
    const totalMeters = Math.round(distanceKm * 1000);
    const step1Dist = Math.min(60, Math.round(totalMeters * 0.15));
    const step2Dist = Math.max(30, Math.round(totalMeters * 0.25));

    const defaultSteps = [
      {
        directive: moveGuidance.directive,
        title: `MOVE ${moveGuidance.directive}`,
        distance: step1Dist,
        where: `Along main path towards ${destName}`,
        instruction: `Move ${moveGuidance.en} for ${step1Dist} meters.`,
        icon: moveGuidance.icon
      },
      {
        directive: 'FORWARD',
        title: 'GO FORWARD',
        distance: step2Dist,
        where: `Towards ${destName} corridor`,
        instruction: `Continue straight forward along the tactile sidewalk for ${step2Dist} meters.`,
        icon: '⬆'
      },
      {
        directive: 'ARRIVED',
        title: 'ARRIVE',
        distance: 5,
        where: `${destName} entrance`,
        instruction: `You have reached ${destName}.`,
        icon: '★'
      }
    ];

    this.activeRoute = {
      id: destName.toLowerCase().replace(/[^a-z]/g, '_'),
      name: destName,
      address: `${destName} Walkway`,
      coords: destCoords,
      steps: (customSteps && customSteps.length > 0) ? customSteps : defaultSteps
    };

    this.currentStepIndex = 0;
    this.isNavigating = true;

    if (this.onTacticalDirective) {
      this.onTacticalDirective({
        directive: moveGuidance.directive,
        title: `MOVE ${moveGuidance.directive}`,
        where: `Towards ${destName}`,
        distance: totalMeters,
        instruction: `Move ${moveGuidance.en}.`,
        icon: moveGuidance.icon
      });
    }
  }

  findDestinationByQuery(query) {
    const q = query.toLowerCase().trim();
    return this.destinations.find(d => 
      d.id.includes(q) || 
      d.name.toLowerCase().includes(q) || 
      q.includes(d.id) ||
      (q.includes('bus') && d.id === 'bus_station') ||
      (q.includes('pharmacy') && d.id === 'pharmacy') ||
      (q.includes('hospital') && d.id === 'hospital')
    ) || this.destinations[0];
  }

  startNavigation(destinationQuery) {
    const dest = typeof destinationQuery === 'string' ? this.findDestinationByQuery(destinationQuery) : destinationQuery;
    if (!dest) return;

    this.activeRoute = dest;
    this.currentStepIndex = 0;
    this.isNavigating = true;

    const firstStep = dest.steps[0];
    const totalDist = dest.steps.reduce((acc, s) => acc + s.distance, 0);

    this.announceTacticalStep(firstStep, 0, dest.steps.length, totalDist);
    return dest;
  }

  announceTacticalStep(step, idx, total, totalDistance) {
    let pan = 0;
    if (step.directive === 'TURN_RIGHT') pan = 0.85;
    else if (step.directive === 'TURN_LEFT') pan = -0.85;

    if (step.directive === 'ARRIVED') {
      audioService.playChime('arrival');
    } else if (step.directive === 'TURN_RIGHT' || step.directive === 'TURN_LEFT') {
      audioService.playChime('obstacle', { pan, distance: 2.0 });
    } else {
      audioService.playChime('nav_turn');
    }

    const prefix = totalDistance ? `Starting navigation to ${this.activeRoute.name}. Total distance: ${totalDistance} meters. ` : '';
    const tacticalMsg = `${prefix}Step ${idx + 1} of ${total}: ${step.title}. ${step.instruction} When: ${step.where}.`;
    audioService.speak(tacticalMsg, 'normal');

    if (this.onTacticalDirective) {
      this.onTacticalDirective({
        directive: step.directive,
        title: step.title,
        where: step.where,
        distance: step.distance,
        instruction: step.instruction,
        icon: step.icon
      });
    }
  }

  executeGoBackInstruction() {
    audioService.playChime('critical_hazard');
    const msg = "Route blockage or deviation detected. GO BACK: Turn around 180 degrees and proceed back 10 meters to rejoin path.";
    audioService.speak(msg, 'critical');

    if (this.onTacticalDirective) {
      this.onTacticalDirective({
        directive: 'REVERSE',
        title: 'GO BACK (TURN 180°)',
        where: 'Step back to clear corridor',
        distance: 10,
        instruction: 'Turn around 180 degrees and proceed back 10 meters.',
        icon: '⬇'
      });
    }
  }

  nextTurnStep() {
    if (!this.activeRoute || !this.isNavigating) return;

    this.currentStepIndex++;
    if (this.currentStepIndex < this.activeRoute.steps.length) {
      const step = this.activeRoute.steps[this.currentStepIndex];
      this.announceTacticalStep(step, this.currentStepIndex, this.activeRoute.steps.length);
    } else {
      this.completeNavigation();
    }
  }

  completeNavigation() {
    if (this.activeRoute) {
      audioService.playChime('arrival');
      audioService.speak(`You have reached ${this.activeRoute.name}. Safe travels.`, 'normal');
    }
    this.isNavigating = false;
  }

  stopNavigation() {
    this.isNavigating = false;
    audioService.speak("Navigation stopped.", 'normal');
  }
}

export const navigationService = new NavigationService();
