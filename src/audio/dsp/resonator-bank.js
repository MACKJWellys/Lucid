import { Biquad } from './biquad.js';
import { midiToHz } from '../palettes/ghibli.js';

export class ResonatorBank {
  constructor(sampleRate, palette) {
    this.sr = sampleRate;
    this.voices = [];
    this._buildVoices(palette);
    this._limiter = 1.0;
    this.bandRanges = [
      [180, 500], [500, 2000], [2000, 6000], [6000, 20000]
    ];
  }

  _buildVoices(p) {
    this.voices.length = 0;
    const secGain = Math.pow(10, (p.secondaryBankGainDb ?? -6) / 20);
    const detuneRatio = Math.pow(2, (p.detuneCents ?? 7) / 1200);
    for (let o = 0; o < p.octaveOffsets.length; o++) {
      const ow = p.octaveWeights[o] ?? 1;
      for (let s = 0; s < p.scaleSemitones.length; s++) {
        const sw = p.scaleWeights[s] ?? 1;
        const midi = p.rootMidi + p.octaveOffsets[o] + p.scaleSemitones[s];
        const f = midiToHz(midi);
        const primary = new Biquad();
        primary.setBandpass(this.sr, f, p.q);
        const secondary = new Biquad();
        secondary.setBandpass(this.sr, f * detuneRatio, p.q * 0.9);
        this.voices.push({
          f,
          weight: ow * sw,
          primary,
          secondary,
          env: 0,
          excitePending: 0,
          secGain
        });
      }
    }
  }

  excite(voiceIndex, amplitude) {
    const v = this.voices[voiceIndex];
    if (v) v.excitePending += amplitude;
  }

  onOnset(band, intensity) {
    const [lo, hi] = this.bandRanges[band];
    for (const v of this.voices) {
      const inBand = v.f >= lo && v.f < hi;
      if (!inBand) continue;
      const ducking = 1 / (1 + v.env * 6);
      v.excitePending += intensity * v.weight * ducking * 0.6;
    }
  }

  process(inputSample) {
    let out = 0;
    let sumSq = 0;
    for (const v of this.voices) {
      const imp = v.excitePending;
      v.excitePending = 0;
      const xv = imp + inputSample * v.weight * 0.1;
      const yp = v.primary.process(xv);
      const ys = v.secondary.process(xv) * v.secGain;
      const y = yp + ys;
      out += y;
      v.env = v.env * 0.9995 + Math.abs(y) * 0.0005;
      sumSq += y * y;
    }
    const target = sumSq > 0.04 ? Math.sqrt(0.04 / sumSq) : 1;
    this._limiter = this._limiter + (target - this._limiter) * (target < this._limiter ? 0.02 : 0.005);
    return out * this._limiter;
  }
}
