# Mushir — AI-Powered Mobility Assistant

> **See Beyond Sight. Move with Confidence.**

Mushir is a voice-first AI mobility assistant designed to help people who are blind or visually impaired understand their surroundings and navigate using spoken instructions.

The project combines computer vision, smartphone sensors, speech recognition, GPS-based pedestrian navigation, and Bluetooth audio to explore a more accessible way to move through everyday environments.

Our long-term vision is **continuous 360-degree environmental awareness**. The initial prototype uses only a smartphone and focuses on real-time perception, directional awareness, voice interaction, and navigation while explicitly accounting for the limitations of a single camera.

**Project status:** Prototype development  
**Initial platform:** Android  
**Hardware requirement:** Smartphone only  
**Primary interaction:** Voice commands and audio feedback  
**Long-term goal:** 360° environmental awareness and accessible navigation

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [The Problem](#2-the-problem)
3. [Our Approach](#3-our-approach)
4. [Key Features](#4-key-features)
5. [Technology Stack](#5-technology-stack)
6. [360° Awareness: What Is Possible](#6-360-awareness-what-is-possible)
7. [System Architecture](#7-system-architecture)
8. [Navigation and Spatial Awareness](#8-navigation-and-spatial-awareness)
9. [User Workflow](#9-user-workflow)
10. [Project Structure](#10-project-structure)
11. [Development Roadmap](#11-development-roadmap)
12. [Installation and Setup](#12-installation-and-setup)
13. [Testing and Evaluation](#13-testing-and-evaluation)
14. [Safety and Privacy](#14-safety-and-privacy)
15. [Future Scope](#15-future-scope)
16. [Contributing](#16-contributing)
17. [License](#17-license)

---

## 1. Project Vision

Mushir aims to make environmental information more accessible to people with visual impairments through AI-powered perception and natural voice interaction.

Instead of relying on a visual interface, users will be able to ask questions, receive spoken descriptions of supported objects, request directions, and hear relevant alerts.

The long-term objective is to develop a mobility assistant that combines:

- Environmental perception.
- Relative obstacle positioning.
- Motion and spatial awareness.
- Voice-controlled pedestrian navigation.
- Concise, context-aware audio feedback.

Mushir is designed to complement established mobility aids and professional orientation-and-mobility training, not replace them.

## 2. The Problem

People with visual impairments can encounter challenges when navigating unfamiliar or crowded environments.

Examples include:

- Understanding what is happening in the surrounding environment.
- Identifying relevant obstacles and changes in the walking path.
- Receiving useful information without looking at a screen.
- Navigating to destinations using spoken instructions.
- Understanding whether information from a navigation system is incomplete or uncertain.

Conventional GPS navigation describes a route but does not independently detect every nearby obstacle.

Similarly, object-detection systems can identify objects in camera images without necessarily determining their exact distance, motion, or effect on the user's walking path.

Mushir explores how these capabilities can be combined into a single accessibility-focused mobile application.

## 3. Our Approach

Mushir follows a staged development approach.

**Stage 1 — Phone-only prototype**

Use the smartphone's camera, available orientation sensors, microphone, GPS, processing hardware, and audio output to implement continuous analysis of the camera's current view, voice commands, basic obstacle announcements, and pedestrian navigation.

**Stage 2 — Directional awareness**

Represent detected objects relative to the camera's viewing direction. Use orientation information to track changes in the phone's direction, with appropriate calibration and limitations.

**Stage 3 — Local spatial awareness**

Evaluate depth estimation, motion tracking, walking-path analysis, and conservative obstacle alerts.

**Stage 4 — Broader environmental coverage**

Investigate methods for achieving more complete 360-degree coverage. A single fixed smartphone camera cannot continuously observe every direction around a person; genuine all-around coverage would require a change in sensing configuration or a different sensing method.

The project will distinguish implemented features from experimental capabilities and future goals.

## 4. Key Features

### 4.1 Real-Time Object Detection

- Process supported camera frames.
- Identify supported classes of objects using a pretrained model.
- Provide concise spoken descriptions.
- Filter redundant detections.
- Communicate uncertainty when perception is unreliable.

Potential object categories include pedestrians, vehicles, bicycles, poles, and barriers, subject to model capability.

### 4.2 Directional Awareness

- Estimate an object's location within the current camera image.
- Divide the observed image into left, centre, and right regions.
- Use phone orientation measurements to track camera direction.
- Investigate relative-position tracking across consecutive frames.
- Avoid interpreting unobserved directions as clear.

Directional labels are relative to the camera unless the system has a validated way to determine the user's body orientation.

### 4.3 Voice-Controlled Assistant

Example planned commands:

- "Mushir, start assistance."
- "Describe my surroundings."
- "What is in front of me?"
- "Take me to the nearest pharmacy."
- "Repeat the last instruction."
- "Stop assistance."

The initial version will use a defined command set before expanding to more natural conversations.

### 4.4 Pedestrian Navigation

- Accept destination requests by voice.
- Retrieve pedestrian routes from a mapping provider.
- Deliver spoken turn-by-turn directions.
- Track location and route progress.
- Detect route deviations when location data is sufficient.
- Announce when location or routing is unavailable.

Route navigation and local obstacle perception will be separate modules.

### 4.5 Bluetooth Audio

- Deliver spoken responses through compatible Bluetooth earphones or headphones.
- Prioritize relevant alerts over routine descriptions.
- Reduce repeated announcements.
- Provide audio feedback for important application states.

Bluetooth output does not provide additional environmental sensing.

### 4.6 Accessibility-First Interface

- Minimal visual interaction.
- Screen-reader-compatible controls.
- Large, clearly labelled buttons.
- Accessible onboarding and permissions.
- Voice feedback for connection and processing errors.

### 4.7 Privacy-Conscious Design

- Prefer on-device image processing when practical.
- Request permissions only when needed.
- Avoid retaining unnecessary camera images and audio.
- Minimize collection of location history.
- Explain any external service processing.

---

## 5. Technology Stack

The following is the proposed stack. Package versions and model compatibility must be validated during implementation.

| Layer | Technology | Responsibility |
|---|---|---|
| Mobile framework | Flutter | Application interface and cross-platform foundation |
| Programming language | Dart | Mobile application logic |
| Native Android integration | Kotlin | Platform-specific capabilities when required |
| Camera | Flutter `camera` package | Camera preview and frame streaming |
| Object detection | Lightweight YOLO-family model | Supported object recognition |
| On-device inference | LiteRT or ONNX Runtime Mobile | Run compatible models on mobile hardware |
| Image processing | OpenCV, if required | Image transformations and vision utilities |
| Speech recognition | Android speech recognition APIs or compatible SDK | Convert voice commands to text |
| Text-to-speech | Android TextToSpeech or compatible Flutter plugin | Produce spoken feedback |
| Location | Geolocator or equivalent plugin | Obtain location updates |
| Mapping and routing | Google Maps Platform or another suitable provider | Destination search and pedestrian directions |
| Device orientation | Android sensor APIs via Flutter-compatible integration | Read available motion and orientation data |
| State management | Riverpod or Bloc | Coordinate application state |
| HTTP client | Dio or Dart HTTP client | Communicate with external services |
| Local preferences | SharedPreferences | Store non-sensitive preferences |
| Backend | Python and FastAPI, optional | Future server-side features |
| Backend validation | Pydantic, if using FastAPI | Validate API data |
| Testing | Flutter test and integration_test | Mobile application testing |
| Backend testing | pytest, if a backend exists | API testing |
| Version control | Git and GitHub | Source control and collaboration |
| Development tools | Flutter SDK, Android Studio, VS Code | Build and debug the application |

### Recommended initial stack

Start with the smallest practical set:

- Flutter and Dart.
- Camera streaming.
- One compatible pretrained object-detection model.
- On-device inference.
- Voice recognition and text-to-speech.
- Device orientation sensors.
- GPS and pedestrian routing.
- Bluetooth-compatible audio output.

A backend is not required for the first prototype unless a selected feature genuinely needs server-side processing.

### Hardware configuration

The initial prototype uses only:

- A smartphone with a rear camera.
- The phone's available orientation and motion sensors.
- The built-in microphone or a compatible headset microphone.
- Bluetooth earphones or headphones.
- GPS/location services.

A stable phone mount may improve camera consistency during supervised testing, but it does not expand the camera's field of view.

Sensor availability varies by device, so Mushir should check supported capabilities at runtime.

---

## 6. 360° Awareness: What Is Possible?

**A critical design constraint:** A single fixed smartphone camera cannot continuously see the full 360-degree environment around a person.

Mushir must not claim full 360-degree visual coverage in its phone-only prototype.

### What the phone-only version can do

- Continuously process the currently visible camera scene while assistance is active.
- Identify supported objects within that scene.
- Estimate left, centre, and right image regions.
- Track phone orientation where the required sensors are available.
- Provide spoken descriptions of detected objects.
- Combine perception with route guidance.

### What the phone-only version cannot guarantee

- Seeing objects directly behind the user.
- Detecting objects hidden by other objects.
- Identifying every curb, pothole, stair, or low-level hazard.
- Accurately estimating distance from ordinary camera images in every condition.
- Determining whether an apparently empty direction is safe.
- Knowing the user's body orientation from phone orientation alone.

### The distinction between three types of awareness

**Camera-view awareness:** Information about the current image.

**Directional awareness:** Information associated with a measured camera direction, with uncertainty accounted for.

**Continuous 360-degree awareness:** Environmental information covering all directions around the person without requiring them to turn the camera or body.

The first two can be investigated with the initial hardware. The third remains a research goal that a single fixed camera cannot fully achieve.

This distinction is central to Mushir's technical design and safety claims.

---

## 7. System Architecture

```text
                    MUSHIR MOBILE APP
                            |
             +--------------+--------------+
             |              |              |
         Camera Input   Voice Input    GPS / Location
             |              |              |
             v              v              v
       Vision Engine   Speech Engine   Route Service
             |              |              |
             v              v              v
       Object Results   User Intent    Route Guidance
             |              |              |
             +--------------+--------------+
                            |
                    Context Coordinator
                            |
             +--------------+--------------+
             |                             |
             v                             v
      Direction Estimation         Alert Prioritization
             |                             |
             +--------------+--------------+
                            |
                            v
                    Audio Feedback
                            |
                            v
                  Phone / Bluetooth Audio
```

### Module responsibilities

**Camera Module**

Manages camera initialization, permissions, frame streaming, lifecycle, and camera failures.

**Vision Module**

Runs the object-detection model and returns supported labels, confidence scores, and image coordinates.

**Orientation Module**

Reads available device sensors and estimates changes in camera orientation. It must report unavailable or unreliable sensor data rather than assume a valid heading.

**Voice Module**

Recognizes supported commands and converts responses into speech.

**Navigation Module**

Handles destination selection, pedestrian routes, location updates, and turn-by-turn instructions.

**Context Coordinator**

Combines the latest detections, orientation estimates, and route information. It tracks data freshness and prevents missing information from being interpreted as evidence of a clear path.

**Alert Prioritization Module**

Reduces repetitive announcements and determines which messages should be delivered first.

**Audio Module**

Manages speech output, interruption handling, and Bluetooth audio compatibility.

**Optional Backend**

Supports future features only when necessary. The core phone-only prototype should not depend on a cloud server for every camera frame.

---

## 8. Navigation and Spatial Awareness

Mushir should treat navigation as two related but distinct problems.

### Global navigation

Global navigation answers:

"How do I travel towards my destination?"

It uses location services, destination search, and pedestrian routing.

### Local environmental perception

Local perception answers:

"What can the camera currently observe, and where are detected objects within that view?"

It uses object detection, image coordinates, and potentially depth or motion estimation.

### Combining the two

The application can use both sources to provide context-aware audio information. However, a route direction must never override a detected hazard, and an unobserved direction must never be treated as a verified safe alternative.

For the first prototype, use descriptive object alerts and standard spoken route instructions. Do not implement autonomous left/right obstacle avoidance as though it were safety-certified.

### Example interaction

**User:** "Mushir, describe my surroundings."

**Mushir:** "A person is visible towards the left side of the camera view."

**User:** "Take me to the nearest pharmacy."

**Mushir:** "Searching for a nearby pharmacy."

**Mushir:** "A pedestrian route is available. Follow the spoken route instructions."

These examples illustrate intended interactions; actual behaviour depends on implemented features and test results.

---

## 9. User Workflow

1. The user activates Mushir.
2. The app checks permissions and sensor availability.
3. The user selects or activates voice interaction.
4. The camera begins processing frames while assistance is active.
5. The vision module identifies supported objects in the current view.
6. The orientation module estimates changes in camera direction.
7. The user can request a destination through voice input.
8. The navigation module retrieves pedestrian directions.
9. The context coordinator prioritizes relevant spoken messages.
10. The app communicates failures, missing data, or uncertainty when necessary.

The initial version should not encourage a user to rely on unvalidated directional instructions while walking independently.

---

## 10. Project Structure

Suggested project layout:

```text
mushir/
├── android/
├── assets/
│   ├── models/
│   ├── audio/
│   └── images/
├── lib/
│   ├── main.dart
│   ├── app/
│   │   └── app.dart
│   ├── core/
│   │   ├── config/
│   │   ├── errors/
│   │   └── utilities/
│   ├── features/
│   │   ├── camera/
│   │   ├── vision/
│   │   ├── orientation/
│   │   ├── voice/
│   │   ├── navigation/
│   │   ├── audio/
│   │   └── accessibility/
│   ├── services/
│   │   ├── camera_service.dart
│   │   ├── vision_service.dart
│   │   ├── orientation_service.dart
│   │   ├── speech_service.dart
│   │   ├── location_service.dart
│   │   └── audio_service.dart
│   └── state/
├── test/
├── integration_test/
├── docs/
│   ├── architecture.md
│   ├── limitations.md
│   └── safety_testing.md
├── pubspec.yaml
├── analysis_options.yaml
├── .gitignore
└── README.md
```

An optional `backend/` directory can be added later if the project introduces features that require a server.

---

## 11. Development Roadmap

### Phase 1 — Application foundation

- Create the Flutter application.
- Implement accessible controls.
- Configure permissions and error states.
- Add text-to-speech.
- Verify Bluetooth audio output.

**Deliverable:** A working voice-feedback foundation.

### Phase 2 — Camera and object detection

- Stream camera frames.
- Integrate a compatible pretrained model.
- Display or log detections during development.
- Measure inference latency.
- Add basic filtering to reduce repeated detections.

**Deliverable:** A supervised object-detection prototype.

### Phase 3 — Directional awareness

- Obtain available orientation sensor data.
- Estimate left, centre, and right image regions.
- Associate detections with the camera's current direction.
- Test phone movement and sensor calibration.
- Document the difference between camera direction and body direction.

**Deliverable:** Direction-labelled descriptions for observed objects.

### Phase 4 — Voice interaction

- Implement a small command vocabulary.
- Connect speech recognition to application actions.
- Add spoken descriptions and navigation requests.
- Handle recognition failures and noisy environments.

**Deliverable:** Hands-free interaction for supported commands.

### Phase 5 — Pedestrian navigation

- Integrate a mapping provider.
- Add destination search.
- Obtain pedestrian routes.
- Implement spoken turn instructions.
- Handle location errors and route interruptions.

**Deliverable:** Voice-based pedestrian navigation in supervised testing.

### Phase 6 — Context coordination

- Combine vision results and navigation information.
- Add alert prioritization.
- Suppress stale and repetitive messages.
- Communicate uncertainty.
- Ensure that missing observations are not interpreted as a clear path.

**Deliverable:** A coordinated perception and audio-feedback prototype.

### Phase 7 — Evaluation and future research

- Measure detection performance across controlled conditions.
- Investigate depth estimation and motion tracking.
- Evaluate the limits of phone-only directional awareness.
- Gather accessibility feedback.
- Determine what additional sensing would be required for continuous 360-degree coverage.

**Deliverable:** An evaluated prototype and a documented plan for further research.

---

## 12. Installation and Setup

### Prerequisites

Install:

- Flutter SDK.
- Android Studio and Android SDK.
- Visual Studio Code or Android Studio.
- Git.
- A compatible Android phone for hardware testing.

### Create the project

```bash
flutter doctor
flutter create mushir
cd mushir
```

Resolve the relevant Android toolchain issues reported by Flutter before proceeding.

### Run the starter app

Connect an Android device or launch an emulator.

```bash
flutter devices
flutter run
```

### Add dependencies

Add compatible packages as each feature is implemented. For example:

- `camera` for camera access and frame streaming.
- A location plugin for GPS.
- A speech-recognition package or native Android integration.
- A text-to-speech package.
- A compatible on-device inference runtime.
- A state-management library if required.

Follow each package's current documentation for setup and permissions.

### Configure external services

If using a mapping provider:

1. Create the required provider account.
2. Enable the necessary APIs.
3. Configure platform restrictions and usage limits.
4. Protect API credentials.
5. Review provider pricing, privacy terms, and usage restrictions.

The starter project does not automatically include a trained model, API credentials, or an external mapping account.

---

## 13. Testing and Evaluation

Testing must be staged and supervised.

### Technical measurements

- Object-detection precision and recall.
- False-positive and missed-detection rates.
- Camera-to-audio latency.
- Model inference time.
- Battery and thermal performance.
- Speech recognition accuracy.
- GPS and route-update reliability.
- Behaviour when permissions or sensors are unavailable.

### Scenario-based testing

Evaluate performance under controlled conditions involving:

- Different lighting levels.
- Moving and stationary objects.
- Crowded and uncluttered scenes.
- Camera movement.
- Background noise.
- Bluetooth disconnection.
- Location loss.
- Model or application failure.

### Accessibility evaluation

Seek feedback from people with visual impairments and accessibility specialists using safe, consent-based testing procedures.

Begin with stationary observations and supervised walking tests in controlled environments. Do not ask participants to rely on an unvalidated prototype near traffic, stairs, or other hazards.

Document limitations and unresolved failures before expanding the testing scope.

---

## 14. Safety and Privacy

Mushir is an assistive technology prototype, not a certified mobility or collision-avoidance system.

### Safety commitments

- Mushir complements, rather than replaces, a white cane, guide dog, or professional mobility training.
- The app must not claim that all obstacles are detected.
- It must not treat a single empty camera frame as proof of a safe path.
- It must not provide unsupported confidence about obstacle distance or direction.
- It must communicate camera, location, sensor, and model failures.
- Early walking tests must be supervised and controlled.
- Wider use must depend on evidence-based evaluation, not successful demonstrations alone.

### Privacy commitments

- Request camera, microphone, and location permissions only as required.
- Prefer on-device inference where feasible.
- Avoid storing unnecessary camera footage, audio, or location histories.
- Protect network communication.
- Explain external data processing.
- Obtain appropriate consent for research and user testing.

---

## 15. Future Scope

Potential future research includes:

- Improved depth estimation.
- Motion tracking for moving obstacles.
- Ground-plane and walking-path analysis.
- Better low-light perception.
- Offline voice and vision processing.
- Hindi and other Indian-language support.
- More accessible indoor navigation.
- Improved camera-orientation calibration.
- Evaluation of panoramic or multiple-camera sensing for continuous 360-degree coverage.
- Integration with suitable wearable sensing hardware if future project requirements allow it.

These are future goals and should not be presented as existing features until implemented and tested.

---

## 16. Contributing

Contributions are welcome from developers, accessibility researchers, designers, testers, and people with lived experience of visual impairment.

To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Implement and test your changes.
4. Document limitations and accessibility implications.
5. Submit a pull request describing the change and its validation.

Useful contribution areas include Flutter development, computer vision, voice interaction, navigation, mobile optimization, accessibility design, and safety testing.

---

## 17. License

Select an open-source license before distributing the project.

The MIT License is one possible option if it suits the project's goals and all included code, model weights, and assets can legally be distributed under its terms.

Add a `LICENSE` file containing the selected license text.

---

## Final Note

Mushir is an exploration of how AI and mobile technology can make environmental information more accessible.

Our initial focus is a phone-only prototype with real-time visual perception, directional awareness, voice interaction, and pedestrian navigation.

Our long-term ambition is more comprehensive environmental awareness, including 360-degree sensing. We will approach that goal through measured development, transparent limitations, and accessibility-focused testing.

**Mushir — See Beyond Sight. Move with Confidence.**
