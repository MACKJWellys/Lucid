import { Biquad } from './biquad.js';
import { midiToHz } from '../palettes/ghibli.js';

function clamp(x, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

export class ResonatorBank {
  constructor(sampleRate, palette) {
    this.sr = sampleRate;
    this.rootMidi = palette.rootMidi;
    this.rootOctave = -24;
    this.chords = palette.sceneChords ?? [[0, 4, 7, 11]];
    this.secondaryRatio = 2.01;
    this.secondaryGain = Math.pow(10, (palette.secondaryBankGainDb ?? -11) / 20);
    this.voices = [];
    this._buildVoices(palette);
    this._limiter = 1.0;
    this.left = 0;
    this.right = 0;
    this._scatter = 0;
    this.bandTargets = [
      [0, 1],
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5]
    ];
    this.setChordIndex(0);
  }

  _buildVoices(p) {
    this.voices.length = 0;
    const defs = [
      { slot: 0, octave: 0, weight: 0.75, pan: -0.36, inputWeight: 0.06, qMul: 1.08 },
      { slot: 1, octave: 12, weight: 0.54, pan: -0.12, inputWeight: 0.04, qMul: 1.0 },
      { slot: 2, octave: 12, weight: 0.58, pan: 0.1, inputWeight: 0.04, qMul: 1.0 },
      { slot: 3, octave: 12, weight: 0.42, pan: 0.3, inputWeight: 0.03, qMul: 0.96 },
      { slot: 1, octave: 24, weight: 0.16, pan: -0.22, inputWeight: 0.015, qMul: 0.88 },
      { slot: 2, octave: 24, weight: 0.15, pan: 0.22, inputWeight: 0.015, qMul: 0.88 }
    ];
    for (const def of defs) {
      const primary = new Biquad();
      const secondary = new Biquad();
      this.voices.push({
        ...def,
        f: 0,
        primary,
        secondary,
        env: 0,
        excitePending: 0
      });
    }
  }

  setChordIndex(index) {
    const count = this.chords.length;
    this.chordIndex = ((index % count) + count) % count;
    const chord = this.chords[this.chordIndex];
    for (const voice of this.voices) {
      const semi = chord[voice.slot % chord.length];
      const midi = this.rootMidi + this.rootOctave + voice.octave + semi;
      const f = midiToHz(midi);
      voice.f = f;
      voice.primary.setBandpass(this.sr, f, 70 * voice.qMul);
      voice.secondary.setBandpass(this.sr, Math.min(f * this.secondaryRatio, this.sr * 0.45), 58 * voice.qMul);
    }
  }

  excite(voiceIndex, amplitude) {
    const v = this.voices[voiceIndex];
    if (v) v.excitePending += amplitude;
  }

  onOnset(band, intensity, brightness = 0.3) {
    const candidates = this.bandTargets[band] ?? this.bandTargets[1];
    const voiceCount = brightness > 0.8 ? 2 : 1;
    for (let i = 0; i < voiceCount; i++) {
      const voiceIndex = candidates[(this._scatter + i) % candidates.length];
      const v = this.voices[voiceIndex];
      if (!v) continue;
      const ducking = 1 / (1 + v.env * 18);
      v.excitePending += intensity * v.weight * ducking * (0.045 + brightness * 0.04);
    }
    this._scatter = (this._scatter + 1) % 1024;
  }

  process(inputSample, energy = 0, speechiness = 0, brightness = 0.3) {
    let outL = 0;
    let outR = 0;
    let sumSq = 0;
    const liveDrive =
      inputSample *
      (0.003 + 0.01 * clamp(energy)) *
      (1 - 0.9 * clamp(speechiness)) *
      (0.5 + 0.3 * clamp(brightness));

    for (const v of this.voices) {
      const imp = v.excitePending;
      v.excitePending = 0;
      const xv = imp + liveDrive * v.inputWeight;
      const yp = v.primary.process(xv);
      const ys = v.secondary.process(xv) * this.secondaryGain;
      const y = Math.tanh((yp + ys) * 0.92) * 0.48;
      v.env = v.env * 0.99978 + Math.abs(y) * 0.00022;
      outL += y * (0.5 * (1 - v.pan));
      outR += y * (0.5 * (1 + v.pan));
      sumSq += y * y;
    }
    const target = sumSq > 0.025 ? Math.sqrt(0.025 / sumSq) : 1;
    this._limiter = this._limiter + (target - this._limiter) * (target < this._limiter ? 0.02 : 0.005);
    this.left = outL * this._limiter;
    this.right = outR * this._limiter;
    return 0.5 * (this.left + this.right);
  }
}
