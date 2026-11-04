// Locally generated foreground alerts. Background push audio belongs to the OS.
export const SOUND_PRESETS = ['siren', 'airraid', 'emergency', 'pulse', 'bell', 'chime', 'radar'];
export class AlertAudio {
  constructor({ createContext = () => new (window.AudioContext || window.webkitAudioContext)() } = {}) {
    this.createContext = createContext;
    this.context = null;
    this.nodes = new Set();
    this.master = null;
    this.generation = 0;
    this.timer = null;
    this.onStateChange = () => {};
  }
  get playing() { return this.nodes.size > 0; }
  async unlock() {
    this.context ||= this.createContext();
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Audio is unavailable');
    return this.context;
  }
  stop() {
    this.generation++;
    clearTimeout(this.timer);
    for (const { oscillator, gain } of this.nodes) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch {}
      oscillator.disconnect(); gain.disconnect();
    }
    this.nodes.clear();
    this.master?.disconnect(); this.master = null;
    this.onStateChange(false);
  }
  setVolume(volume) {
    if (!Number.isFinite(volume) || !this.master) return;
    const level = Math.max(0, Math.min(1, volume)), now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.22 * level * level, now, 0.015);
  }
  async play({ preset = 'siren', volume = 0.45, duration = 3 } = {}) {
    this.stop();
    if (!SOUND_PRESETS.includes(preset)) throw new Error('Unknown sound preset');
    const level = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.45;
    if (!level) return false;
    const generation = this.generation;
    const context = await this.unlock();
    if (generation !== this.generation) return false;
    const length = Math.max(0.3, Math.min(5, duration)), start = context.currentTime + 0.02;
    const master = context.createGain(); this.master = master;
    master.gain.setValueAtTime(0.22 * level * level, start);
    master.connect(context.destination);
    const note = (offset, seconds, frequency, wave = 'sine', end = frequency, strength = 0.7, sustain = false) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const at = start + offset, until = at + Math.min(seconds, length - offset);
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.linearRampToValueAtTime(end, until);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(strength, at + Math.min(0.025, (until - at) / 3));
      if (sustain) gain.gain.setValueAtTime(strength, Math.max(at + 0.03, until - 0.06));
      gain.gain.exponentialRampToValueAtTime(0.0001, until);
      oscillator.connect(gain); gain.connect(master);
      const voice = { oscillator, gain }; this.nodes.add(voice);
      oscillator.onended = () => {
        if (generation !== this.generation) return;
        this.nodes.delete(voice); oscillator.disconnect(); gain.disconnect();
        if (!this.nodes.size) { clearTimeout(this.timer); master.disconnect(); this.master = null; this.onStateChange(false); }
      };
      oscillator.start(at); oscillator.stop(until + 0.01);
    };
    if (preset === 'siren') {
      for (let at = 0, i = 0; at < length; at += 0.5, i++) note(at, 0.5, i % 2 ? 880 : 600, 'triangle', i % 2 ? 600 : 880);
    } else if (preset === 'airraid') {
      // Civil-defence style wail: long continuous rise and fall, with a low harmonic.
      for (let at = 0, i = 0; at < length; at += 1.35, i++) {
        const low = i % 2 ? 930 : 260, high = i % 2 ? 260 : 930;
        note(at, 1.4, low, 'sawtooth', high, 0.55, true);
        note(at, 1.4, low / 2, 'triangle', high / 2, 0.3, true);
      }
    } else if (preset === 'emergency') {
      for (let at = 0, i = 0; at < length; at += 0.18, i++) note(at, 0.2, i % 2 ? 980 : 620, 'square', i % 2 ? 620 : 980, 0.38);
    } else if (preset === 'pulse') {
      for (let at = 0; at < length; at += 0.8) { note(at, 0.14, 740); if (at + 0.22 < length) note(at + 0.22, 0.14, 740); }
    } else if (preset === 'bell') {
      for (let at = 0; at < length; at += 1.2) { note(at, 1, 784); note(at, 0.65, 1568, 'sine', 1568, 0.2); }
    } else if (preset === 'chime') {
      for (let at = 0, i = 0; at < length; at += 0.32, i++) note(at, 0.48, [523.25, 659.25, 783.99][i % 3]);
    } else {
      for (let at = 0; at < length; at += 0.65) note(at, 0.48, 1100, 'sine', 420);
    }
    this.onStateChange(true);
    this.timer = setTimeout(() => { if (generation === this.generation) this.stop(); }, (length + 0.15) * 1000);
    return true;
  }
}
