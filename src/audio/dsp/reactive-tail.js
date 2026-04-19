import { midiToHz } from '../palettes/ghibli.js';

function clamp(x, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

function softClip(x) {
  return Math.tanh(x);
}

export class ReactiveTail {
  constructor(sampleRate, palette) {
    this.sr = sampleRate;
    this.rootMidi = palette.rootMidi;
    this.chords = palette.sceneChords ?? [[0, 4, 7, 11]];
    this.chordIndex = 0;

    this.delayA = new Float32Array(Math.round(sampleRate * 0.31));
    this.delayB = new Float32Array(Math.round(sampleRate * 0.43));
    this.delayC = new Float32Array(Math.round(sampleRate * 0.57));
    this.delayD = new Float32Array(Math.round(sampleRate * 0.71));
    this.idxA = 0;
    this.idxB = 0;
    this.idxC = 0;
    this.idxD = 0;

    this.filtA = 0;
    this.filtB = 0;
    this.filtC = 0;
    this.filtD = 0;

    this.energy = 0;
    this.brightness = 0.3;
    this.speechiness = 0;
    this.quietness = 0.3;
    this.left = 0;
    this.right = 0;
    this.scatter = 0;

    this.sparkles = Array.from({ length: 6 }, (_, index) => ({
      env: 0,
      phase: 0,
      freq: 220,
      decay: 0.99995,
      pan: index % 2 === 0 ? -0.4 : 0.4,
      drift: 0
    }));
  }

  setChordIndex(index) {
    const count = this.chords.length;
    this.chordIndex = ((index % count) + count) % count;
  }

  onOnset(band, intensity, brightness = 0.3) {
    let best = this.sparkles[0];
    for (const sparkle of this.sparkles) {
      if (sparkle.env < best.env) best = sparkle;
    }

    const chord = this.chords[this.chordIndex];
    const octaveOffsets = [12, 19, 24, 31];
    const semi = chord[(this.scatter + band) % chord.length] + octaveOffsets[Math.min(band, octaveOffsets.length - 1)];
    best.freq = midiToHz(this.rootMidi + semi);
    best.phase = 0;
    best.env = 0.012 + 0.045 * intensity;
    const tailSeconds = 0.45 + (1 - brightness) * 0.75;
    best.decay = Math.exp(-1 / (this.sr * tailSeconds));
    best.pan = clamp((band - 1.5) * 0.28 + (this.scatter % 2 === 0 ? -0.12 : 0.12), -0.8, 0.8);
    best.drift = 0.014 + 0.003 * this.scatter;
    this.scatter = (this.scatter + 1) % 1024;
  }

  process(inputL = 0, inputR = 0, energy = 0, brightness = 0.3, speechiness = 0, quietness = 0.3) {
    this.energy += (energy - this.energy) * 0.001;
    this.brightness += (brightness - this.brightness) * 0.0012;
    this.speechiness += (speechiness - this.speechiness) * 0.0012;
    this.quietness += (quietness - this.quietness) * 0.001;

    let sparkleL = 0;
    let sparkleR = 0;
    for (const sparkle of this.sparkles) {
      if (sparkle.env < 1e-5) continue;
      sparkle.phase += 2 * Math.PI * sparkle.freq / this.sr;
      if (sparkle.phase > Math.PI * 2) sparkle.phase -= Math.PI * 2;
      const harmonic = Math.sin(sparkle.phase * 2 + sparkle.drift);
      const sample = (Math.sin(sparkle.phase) + 0.12 * harmonic) * sparkle.env;
      sparkle.env *= sparkle.decay;
      sparkleL += sample * (0.5 * (1 - sparkle.pan));
      sparkleR += sample * (0.5 * (1 + sparkle.pan));
    }

    const tapA = this.delayA[this.idxA];
    const tapB = this.delayB[this.idxB];
    const tapC = this.delayC[this.idxC];
    const tapD = this.delayD[this.idxD];

    const damp = 0.04 + 0.05 * (1 - this.brightness) + 0.02 * this.speechiness;
    this.filtA += (tapA - this.filtA) * damp;
    this.filtB += (tapB - this.filtB) * damp;
    this.filtC += (tapC - this.filtC) * damp;
    this.filtD += (tapD - this.filtD) * damp;

    const wet = clamp(0.08 + 0.08 * this.quietness + 0.03 * this.brightness, 0.06, 0.2);
    const feedback = clamp(0.62 - 0.16 * this.speechiness + 0.04 * this.quietness, 0.42, 0.7);
    const inputDuck = 1 - 0.8 * this.speechiness;
    const feedGain = 0.12 + 0.04 * this.brightness;

    const feedL = inputL * feedGain * inputDuck + sparkleL * (0.3 + 0.1 * this.brightness);
    const feedR = inputR * feedGain * inputDuck + sparkleR * (0.3 + 0.1 * this.brightness);

    this.delayA[this.idxA] = softClip(feedL + feedback * (0.54 * this.filtC + 0.16 * this.filtD));
    this.delayB[this.idxB] = softClip(feedR + feedback * (0.52 * this.filtA + 0.16 * this.filtC));
    this.delayC[this.idxC] = softClip(feedL * 0.35 + feedback * (0.48 * this.filtB));
    this.delayD[this.idxD] = softClip(feedR * 0.35 + feedback * (0.44 * this.filtA));

    this.idxA = (this.idxA + 1) % this.delayA.length;
    this.idxB = (this.idxB + 1) % this.delayB.length;
    this.idxC = (this.idxC + 1) % this.delayC.length;
    this.idxD = (this.idxD + 1) % this.delayD.length;

    const tailL = tapA * 0.54 + tapC * 0.28 + tapD * 0.16;
    const tailR = tapB * 0.54 + tapD * 0.28 + tapC * 0.16;
    this.left = sparkleL * 0.08 + tailL * wet;
    this.right = sparkleR * 0.08 + tailR * wet;
    return 0.5 * (this.left + this.right);
  }
}
