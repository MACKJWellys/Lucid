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
    this.shimmerBoost = 0;
    this.motifGlow = 0;

    this.sparkles = Array.from({ length: 6 }, (_, index) => ({
      env: 0,
      phase: 0,
      freq: 220,
      decay: 0.99995,
      pan: index % 2 === 0 ? -0.4 : 0.4,
      drift: 0
    }));
    this.motifVoices = Array.from({ length: 4 }, () => ({
      env: 0,
      targetEnv: 0,
      phase: 0,
      freq: 220,
      pan: 0,
      decay: 0.99996,
      tone: 0
    }));
    this.motifQueue = [];
  }

  setChordIndex(index) {
    const count = this.chords.length;
    this.chordIndex = ((index % count) + count) % count;
  }

  triggerMotif(strength = 0.5, brightness = 0.3) {
    const chord = this.chords[this.chordIndex];
    const order = [0, 2, 1, 3];
    const octaveOffsets = [12, 24, 19, 31];
    const baseDelay = 0.075 + (1 - brightness) * 0.03;
    const spread = 0.09 + 0.05 * (1 - brightness);
    const amp = 0.03 + 0.05 * strength;
    const tailSeconds = 1.5 + (1 - brightness) * 1.6;
    for (let i = 0; i < order.length; i++) {
      const chordSlot = order[i] % chord.length;
      const semi = chord[chordSlot] + octaveOffsets[i];
      this.motifQueue.push({
        delay: Math.round(this.sr * (baseDelay + spread * i)),
        freq: midiToHz(this.rootMidi + semi),
        amp: amp * (1 - i * 0.12),
        pan: clamp(-0.24 + i * 0.18, -0.55, 0.55),
        decay: Math.exp(-1 / (this.sr * (tailSeconds - i * 0.18))),
        tone: 0.12 + i * 0.06
      });
    }
    this.motifGlow = Math.max(this.motifGlow, 0.4 + strength * 0.45);
  }

  _startMotifVoice(event) {
    let best = this.motifVoices[0];
    for (const voice of this.motifVoices) {
      if (voice.env < best.env) best = voice;
    }
    best.freq = event.freq;
    best.phase = 0;
    best.env = 0;
    best.targetEnv = event.amp;
    best.pan = event.pan;
    best.decay = event.decay;
    best.tone = event.tone;
  }

  onOnset(band, intensity, brightness = 0.3) {
    this.shimmerBoost = Math.max(
      this.shimmerBoost,
      intensity * (0.2 + band * 0.12 + brightness * 0.15)
    );
    if (band < 2 && intensity < 0.7) return;

    let best = this.sparkles[0];
    for (const sparkle of this.sparkles) {
      if (sparkle.env < best.env) best = sparkle;
    }

    const chord = this.chords[this.chordIndex];
    const octaveOffsets = [12, 19, 24, 31];
    const semi = chord[(this.scatter + band) % chord.length] + octaveOffsets[Math.min(band, octaveOffsets.length - 1)];
    best.freq = midiToHz(this.rootMidi + semi);
    best.phase = 0;
    best.env = (0.004 + 0.015 * intensity) * (0.7 + band * 0.18);
    const tailSeconds = 0.65 + (1 - brightness) * 1.2 + band * 0.18;
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
    this.shimmerBoost *= 0.99988;
    this.motifGlow *= 0.99995;

    for (let i = this.motifQueue.length - 1; i >= 0; i--) {
      const event = this.motifQueue[i];
      event.delay -= 1;
      if (event.delay <= 0) {
        this._startMotifVoice(event);
        this.motifQueue.splice(i, 1);
      }
    }

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

    let motifL = 0;
    let motifR = 0;
    for (const voice of this.motifVoices) {
      if (voice.targetEnv > 0) {
        voice.env += (voice.targetEnv - voice.env) * 0.0036;
        voice.targetEnv *= 0.9995;
      }
      if (voice.env < 1e-6) continue;
      voice.phase += 2 * Math.PI * voice.freq / this.sr;
      if (voice.phase > Math.PI * 2) voice.phase -= Math.PI * 2;
      const harmonic = Math.sin(voice.phase * 2 + voice.tone);
      const air = Math.sin(voice.phase * 3 + voice.tone * 0.7);
      const sample = (0.78 * Math.sin(voice.phase) + 0.16 * harmonic + 0.06 * air) * voice.env;
      voice.env *= voice.decay;
      motifL += sample * (0.5 * (1 - voice.pan));
      motifR += sample * (0.5 * (1 + voice.pan));
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

    const wet = clamp(0.1 + 0.08 * this.quietness + 0.03 * this.brightness + 0.08 * this.shimmerBoost, 0.07, 0.3);
    const feedback = clamp(0.66 - 0.14 * this.speechiness + 0.05 * this.quietness + 0.1 * this.shimmerBoost, 0.48, 0.82);
    const inputDuck = 1 - 0.8 * this.speechiness;
    const feedGain = 0.14 + 0.05 * this.brightness + 0.06 * this.shimmerBoost;

    const feedL =
      inputL * feedGain * inputDuck +
      sparkleL * (0.22 + 0.12 * this.brightness) +
      motifL * (0.35 + 0.18 * this.motifGlow);
    const feedR =
      inputR * feedGain * inputDuck +
      sparkleR * (0.22 + 0.12 * this.brightness) +
      motifR * (0.35 + 0.18 * this.motifGlow);

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
    this.left = sparkleL * 0.05 + motifL * 0.9 + tailL * wet;
    this.right = sparkleR * 0.05 + motifR * 0.9 + tailR * wet;
    return 0.5 * (this.left + this.right);
  }
}
