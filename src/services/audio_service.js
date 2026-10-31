/**
 * Mushir Audio & Speech Service
 * Web Audio API binaural spatial earcons, SpeechSynthesis TTS,
 * alert priority queue, speed control, and Hindi/English language support.
 */

class AudioService {
  constructor() {
    this.audioCtx = null;
    this.speechSynth = window.speechSynthesis;
    this.voices = [];
    this.selectedVoice = null;
    this.speechRate = 1.0;
    this.speechPitch = 1.0;
    this.volume = 1.0;
    this.currentLanguage = 'en-US'; // 'en-US' or 'hi-IN'
    this.lastSpokenText = "Welcome to Mushir. Mobility assistance ready. Say start assistance or ask a question.";
    this.isSpeaking = false;
    this.onSpeakingStateChange = null;
    this.isMuted = false;

    this.initVoices();
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  initVoices() {
    if (!this.speechSynth) return;
    const loadVoices = () => {
      this.voices = this.speechSynth.getVoices();
      this.updateVoiceForLanguage();
    };

    loadVoices();
    if (this.speechSynth.onvoiceschanged !== undefined) {
      this.speechSynth.onvoiceschanged = loadVoices;
    }
  }

  setLanguage(langCode) {
    this.currentLanguage = langCode; // 'en-US' or 'hi-IN'
    this.updateVoiceForLanguage();
    if (langCode.startsWith('hi')) {
      this.speak("भाषा बदलकर हिंदी कर दी गई है।", 'critical');
    } else {
      this.speak("Language switched to English.", 'critical');
    }
  }

  updateVoiceForLanguage() {
    if (!this.voices || this.voices.length === 0) return;
    if (this.currentLanguage.startsWith('hi')) {
      const hiVoice = this.voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('india'));
      if (hiVoice) this.selectedVoice = hiVoice;
    } else {
      const enVoice = this.voices.find(v => (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Zira")) && v.lang.startsWith("en")) || this.voices.find(v => v.lang.startsWith("en"));
      if (enVoice) this.selectedVoice = enVoice;
    }
  }

  decreaseSpeechRate() {
    this.speechRate = Math.max(0.6, Number((this.speechRate - 0.15).toFixed(2)));
    const text = this.currentLanguage.startsWith('hi') ? `आवाज की गति कम कर दी गई है। गति ${this.speechRate}` : `Speech speed reduced to ${this.speechRate}x.`;
    this.speak(text, 'critical');
    return this.speechRate;
  }

  increaseSpeechRate() {
    this.speechRate = Math.min(1.8, Number((this.speechRate + 0.15).toFixed(2)));
    const text = this.currentLanguage.startsWith('hi') ? `आवाज की गति बढ़ा दी गई है। गति ${this.speechRate}` : `Speech speed increased to ${this.speechRate}x.`;
    this.speak(text, 'critical');
    return this.speechRate;
  }

  playChime(type, options = {}) {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const panVal = options.pan !== undefined ? options.pan : 0;

      let panner = null;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panVal)), now);
        panner.connect(ctx.destination);
      }

      const dest = panner || ctx.destination;

      if (type === 'wake') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'command_ok') {
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.18, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.2);
        });
      } else if (type === 'obstacle') {
        const distance = options.distance || 2.5;
        const baseFreq = Math.max(350, Math.min(950, 850 - distance * 90));

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.18);

        if (navigator.vibrate) {
          navigator.vibrate(distance < 2 ? [80, 40, 80] : [40]);
        }
      } else if (type === 'critical_hazard') {
        [0, 0.15].forEach(offset => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, now + offset);
          gain.gain.setValueAtTime(0.3, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.12);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now + offset);
          osc.stop(now + offset + 0.12);
        });
        if (navigator.vibrate) {
          navigator.vibrate([160, 60, 160, 60, 200]);
        }
      } else if (type === 'nav_turn') {
        [440, 554.37, 659.25].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.09);
          gain.gain.setValueAtTime(0.18, now + i * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.3);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now + i * 0.09);
          osc.stop(now + i * 0.09 + 0.3);
        });
      } else if (type === 'arrival') {
        [523.25, 659.25, 783.99, 1046.5].forEach(f => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.7);
        });
      }
    } catch (err) {
      console.warn("Audio chime failed:", err);
    }
  }

  speak(text, priority = 'normal') {
    if (!text || this.isMuted) return;
    if (!this.speechSynth) return;

    if (priority === 'critical') {
      this.speechSynth.cancel();
    }

    this.lastSpokenText = text;

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.lang = this.currentLanguage;
    utterance.rate = this.speechRate;
    utterance.pitch = this.speechPitch;
    utterance.volume = this.volume;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.onSpeakingStateChange) {
        this.onSpeakingStateChange(true, text);
      }
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.onSpeakingStateChange) {
        this.onSpeakingStateChange(false, '');
      }
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (this.onSpeakingStateChange) {
        this.onSpeakingStateChange(false, '');
      }
    };

    this.speechSynth.speak(utterance);
  }

  repeatLastInstruction() {
    if (this.lastSpokenText) {
      this.speak(this.lastSpokenText, 'critical');
    } else {
      this.speak("No recent instruction to repeat.", 'normal');
    }
  }

  stopSpeaking() {
    if (this.speechSynth) {
      this.speechSynth.cancel();
      this.isSpeaking = false;
      if (this.onSpeakingStateChange) {
        this.onSpeakingStateChange(false, '');
      }
    }
  }

  testSpatialAudio(zone = 'center') {
    let pan = 0;
    if (zone === 'left') pan = -0.85;
    if (zone === 'right') pan = 0.85;
    this.playChime('obstacle', { pan, distance: 2.0 });
    this.speak(`Audio alert in your ${zone} ear`, 'normal');
  }
}

export const audioService = new AudioService();
