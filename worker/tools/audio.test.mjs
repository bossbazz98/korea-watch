import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AlertAudio, SOUND_PRESETS } from '../../public/audio.js';
function fakeContext() {
  const calls = { oscillators: [], gains: [] };
  const parameter = () => ({ values: [], setValueAtTime(v) { this.values.push(v); }, linearRampToValueAtTime(v) { this.values.push(v); }, cancelScheduledValues() {}, setTargetAtTime(v) { this.values.push(v); }, exponentialRampToValueAtTime(v) { this.values.push(v); } });
  const context = { state: 'running', currentTime: 10, destination: {},
    createGain() { const node = { gain: parameter(), connect() {}, disconnect() { this.disconnected = true; } }; calls.gains.push(node); return node; },
    createOscillator() { const node = { frequency: parameter(), connect() {}, disconnect() { this.disconnected = true; }, start() { this.started = true; }, stop() { this.stops = (this.stops || 0) + 1; } }; calls.oscillators.push(node); return node; },
    async resume() { this.state = 'running'; }
  };
  return { context, calls };
}
test('all five presets produce different bounded foreground sounds', async () => {
  const signatures = new Set();
  for (const preset of SOUND_PRESETS) {
    const { context, calls } = fakeContext(), audio = new AlertAudio({ createContext: () => context });
    try {
      assert.equal(await audio.play({ preset, duration: 1.8, volume: 0.5 }), true);
      assert(audio.playing);
      signatures.add(JSON.stringify(calls.oscillators.map(o => [o.type, o.frequency.values])));
      assert.equal(calls.gains[0].gain.values[0], 0.22 * 0.5 * 0.5);
      assert(calls.oscillators.length <= 16);
      audio.setVolume(0.1); assert.equal(calls.gains[0].gain.values.at(-1), 0.22 * 0.1 * 0.1);
      assert(audio.playing, 'volume change does not interrupt preview');
    } finally { audio.stop(); }
    assert(calls.oscillators.every(o => o.disconnected));
  }
  assert.equal(signatures.size, 5);
});
test('repeated preview stops previous oscillators and mute creates no new sound', async () => {
  const { context, calls } = fakeContext(), audio = new AlertAudio({ createContext: () => context });
  try {
    await audio.play({ preset: 'bell' });
    const first = [...calls.oscillators];
    await audio.play({ preset: 'pulse', volume: 0.2 });
    assert(first.every(node => node.disconnected && node.stops === 2));
    const count = calls.oscillators.length;
    assert.equal(await audio.play({ volume: 0 }), false);
    assert.equal(calls.oscillators.length, count);
    assert.equal(audio.playing, false);
  } finally { audio.stop(); }
});
test('closing while audio unlocks prevents a delayed preview from starting', async () => {
  const { context, calls } = fakeContext();
  context.state = 'suspended'; let resume;
  context.resume = () => new Promise(resolve => { resume = () => { context.state = 'running'; resolve(); }; });
  const audio = new AlertAudio({ createContext: () => context });
  const pending = audio.play({ preset: 'siren' });
  audio.stop(); resume();
  assert.equal(await pending, false);
  assert.equal(calls.oscillators.length, 0);
});
