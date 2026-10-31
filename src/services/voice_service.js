/**
 * Mushir Voice Recognition & Command Intent Engine
 * Parses exact obstacle behavior queries and navigation directives:
 * - "What obstacles are around me and what are they doing?"
 * - "Where do I go forward", "Where do I turn right", "Where do I turn left", "Go back"
 */

import { audioService } from './audio_service.js';

class VoiceService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.continuousMode = false;
    this.onCommandRecognized = null;
    this.onListeningChange = null;
    this.onTranscriptUpdate = null;
    this.currentLang = 'en-US';

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn("SpeechRecognition not supported in this browser.");
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLang;

      this.recognition.onstart = () => {
        this.isListening = true;
        if (this.onListeningChange) this.onListeningChange(true);
        audioService.playChime('wake');
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const activeText = (finalTranscript || interimTranscript).trim();
        if (this.onTranscriptUpdate) {
          this.onTranscriptUpdate(activeText, !!finalTranscript);
        }

        if (finalTranscript) {
          this.parseAndExecute(finalTranscript);
        }
      };

      this.recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          this.isListening = false;
          if (this.onListeningChange) this.onListeningChange(false);
        }
      };

      this.recognition.onend = () => {
        if (this.continuousMode && this.isListening) {
          try {
            this.recognition.start();
          } catch (e) {
            this.isListening = false;
            if (this.onListeningChange) this.onListeningChange(false);
          }
        } else {
          this.isListening = false;
          if (this.onListeningChange) this.onListeningChange(false);
        }
      };
    } catch (e) {
      console.error("Speech recognition initialization error:", e);
    }
  }

  setLanguage(langCode) {
    this.currentLang = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
  }

  startListening(continuous = false) {
    this.continuousMode = continuous;
    if (!this.recognition) this.initRecognition();
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        console.warn("Recognition start notice:", e);
      }
    } else if (!this.recognition) {
      if (this.onListeningChange) this.onListeningChange(true);
    }
  }

  stopListening() {
    this.continuousMode = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn("Recognition stop notice:", e);
      }
    }
    this.isListening = false;
    if (this.onListeningChange) this.onListeningChange(false);
  }

  toggleListening() {
    if (this.isListening) this.stopListening();
    else this.startListening(true);
  }

  parseAndExecute(rawText) {
    const text = rawText.toLowerCase().replace(/[.,!?;:]/g, '').trim();
    if (!text) return;

    let clean = text;
    if (clean.startsWith('hey mushir')) clean = clean.replace('hey mushir', '').trim();
    else if (clean.startsWith('mushir')) clean = clean.replace('mushir', '').trim();

    let command = null;

    // 1. Obstacle Behavior Queries ("What obstacle is around me and what is it doing?")
    if (clean.includes('what is it doing') || clean.includes('what are they doing') || clean.includes('obstacle doing') || clean.includes('doing around me')) {
      command = { type: 'DESCRIBE_OBSTACLES_AND_ACTIONS', raw: rawText };
    } else if (clean.includes('what obstacle is around me') || clean.includes('obstacles around me') || clean.includes('what is around me')) {
      command = { type: 'DESCRIBE_OBSTACLES_AND_ACTIONS', raw: rawText };
    }
    // 2. Tactical Navigation Directives ("Where do I turn right", "Where do I turn left", "Go back", "Go forward")
    else if (clean.includes('go back') || clean.includes('turn back') || clean.includes('reverse') || clean.includes('wrong way')) {
      command = { type: 'GO_BACK_REVERSE', raw: rawText };
    } else if (clean.includes('where to turn right') || clean.includes('when to turn right') || clean.includes('turn right')) {
      command = { type: 'QUERY_TACTICAL_DIRECTION', direction: 'RIGHT', raw: rawText };
    } else if (clean.includes('where to turn left') || clean.includes('when to turn left') || clean.includes('turn left')) {
      command = { type: 'QUERY_TACTICAL_DIRECTION', direction: 'LEFT', raw: rawText };
    } else if (clean.includes('where to go forward') || clean.includes('when to go forward') || clean.includes('go forward')) {
      command = { type: 'QUERY_TACTICAL_DIRECTION', direction: 'FORWARD', raw: rawText };
    }
    // 3. Language & Speed
    else if (clean.includes('switch to hindi') || clean.includes('hindi')) {
      command = { type: 'SWITCH_TO_HINDI', raw: rawText };
    } else if (clean.includes('switch to english') || clean.includes('english')) {
      command = { type: 'SWITCH_TO_ENGLISH', raw: rawText };
    } else if (clean.includes('speak slower') || clean.includes('slower')) {
      command = { type: 'SPEAK_SLOWER', raw: rawText };
    } else if (clean.includes('speak faster') || clean.includes('faster')) {
      command = { type: 'SPEAK_FASTER', raw: rawText };
    }
    // 4. Assistance Lifecycle & Obstacle Checks
    else if (clean.includes('is there an obstacle ahead') || clean.includes('obstacle ahead')) {
      command = { type: 'CHECK_OBSTACLE_AHEAD', raw: rawText };
    } else if (clean.includes('what is in front of me') || clean.includes('in front')) {
      command = { type: 'WHAT_IS_IN_FRONT', raw: rawText };
    } else if (clean.includes('describe the surroundings') || clean.includes('describe surroundings')) {
      command = { type: 'DESCRIBE_SURROUNDINGS', raw: rawText };
    } else if (clean.includes('locate camera') || clean.includes('where is my camera')) {
      command = { type: 'LOCATE_CAMERA', raw: rawText };
    } else if (clean.includes('start assistance') || clean === 'start') {
      command = { type: 'START_ASSISTANCE', raw: rawText };
    } else if (clean.includes('stop assistance') || clean === 'stop' || clean.includes('pause')) {
      command = { type: 'STOP_ASSISTANCE', raw: rawText };
    } else if (clean.includes('cancel navigation')) {
      command = { type: 'CANCEL_NAVIGATION', raw: rawText };
    } else if (
      clean.includes('locate me where i am') ||
      clean.includes('locate me') ||
      clean.includes('locate where i am') ||
      clean.includes('locate where i m') ||
      clean.includes('locate my position') ||
      clean.includes('locate my location') ||
      clean.includes('locate position') ||
      clean.includes('locate location') ||
      clean.includes('where am i standing') ||
      clean.includes('where i am standing') ||
      clean.includes('where am i') ||
      clean.includes('where i am') ||
      clean.includes('where i m') ||
      clean.includes('my position') ||
      clean.includes('my location') ||
      clean.includes('current position') ||
      clean.includes('current location') ||
      clean.includes('what is my position') ||
      clean.includes('what is my location') ||
      clean.includes('whats my position') ||
      clean.includes('whats my location') ||
      clean.includes('tell me where i am') ||
      clean.includes('tell me my position') ||
      clean.includes('tell me my location') ||
      clean.includes('identify my location') ||
      clean.includes('identify location') ||
      clean.includes('identify where i am') ||
      clean.includes('position where i am') ||
      clean.includes('position where i m') ||
      clean.includes('kahan hoon') ||
      clean.includes('kahan khada hoon') ||
      clean.includes('meri location') ||
      clean.includes('meri position') ||
      clean === 'locate' ||
      clean === 'locate me' ||
      clean === 'where am i' ||
      clean === 'where i am'
    ) {
      command = { type: 'WHERE_AM_I_STANDING', raw: rawText };
    } else if (
      clean.includes('if i want to go') ||
      clean.includes('i want to go') ||
      clean.includes('want to go') ||
      clean.includes('how far is') ||
      clean.includes('where is') ||
      clean.includes('take me to') ||
      clean.includes('navigate to') ||
      clean.includes('directions to') ||
      clean.includes('go to') ||
      clean.includes('jana hai')
    ) {
      let dest = '';
      const destPatterns = [
        'if i want to go to',
        'if i want to go',
        'i want to go to',
        'i want to go',
        'want to go to',
        'want to go',
        'how far is',
        'where is',
        'take me to',
        'navigate to',
        'directions to',
        'go to'
      ];
      for (const p of destPatterns) {
        if (clean.includes(p)) {
          dest = clean.substring(clean.indexOf(p) + p.length);
          break;
        }
      }
      dest = dest
        .replace(/\b(from me|from here|from u|from you|right now|please)\b/gi, '')
        .replace(/the/g, '')
        .trim();

      if (!dest && clean.includes('jana hai')) {
        dest = clean.replace('jana hai', '').replace('mujhe', '').trim();
      }

      command = {
        type: 'QUERY_DESTINATION_GUIDANCE',
        destination: dest || 'Premnagar',
        raw: rawText
      };
    } else if (clean.includes('repeat that') || clean.includes('repeat')) {
      command = { type: 'REPEAT_LAST', raw: rawText };
    } else if (
      clean === 'hi' ||
      clean === 'hii' ||
      clean === 'hello' ||
      clean === 'hey' ||
      clean === 'namaste' ||
      clean === 'hi mushir' ||
      clean === 'hello mushir' ||
      clean === 'hey mushir' ||
      clean.includes('who are you') ||
      clean.includes('who r u')
    ) {
      command = { type: 'GREETING', raw: rawText };
    } else if (clean.includes('help')) {
      command = { type: 'HELP', raw: rawText };
    } else {
      command = { type: 'CONVERSATIONAL_AI', raw: rawText, question: clean };
    }

    if (command) {
      audioService.playChime('command_ok');
      if (this.onCommandRecognized) {
        this.onCommandRecognized(command);
      }
    }
  }

  simulateVoiceInput(spokenText) {
    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate(spokenText, true);
    }
    this.parseAndExecute(spokenText);
  }
}

export const voiceService = new VoiceService();
