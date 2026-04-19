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
    this.motifShapes = palette.motifVoicings ?? null;
    this.chordIndex = 0;

    this.delayA = new Float32Array(Math.round(sampleRate * 0.31));
    this.delayB = new Float32Array(Math.round(sampleRate * 0.43));
    this.delayC = new Float32Array(Math.round(sampleRate * 0.57));
    this.delayD = new Float32Array(Math.round(sampleRate * 0.71));
    this.delayE = new Float32Array(Math.round(sampleRate * 1.47));
    this.delayF = new Float32Array(Math.round(sampleRate * 2.21));
    this.idxA = 0;
    this.idxB = 0;
    this.idxC = 0;
    this.idxD = 0;
    this.idxE = 0;
    this.idxF = 0;

    this.filtA = 0;
    this.filtB = 0;
    this.filtC = 0;
    this.filtD = 0;
    this.filtE = 0;
    this.filtF = 0;

    this.energy = 0;
    this.brightness = 0.3;
    this.speechiness = 0;
    this.quietness = 0.3;
    this.left = 0;
    this.right = 0;
    this.scatter = 0;
    this.shimmerBoost = 0;
    this.motifGlow = 0;
    this.motionA = 0;
    this.motionB = 0;
    this.washL = 0;
    this.washR = 0;
    this.washFilterL = 0;
    this.washFilterR = 0;

    this.sparkles = Array.from({ length: 6 }, (_, index) => ({
      env: 0,
      phase: 0,
      freq: 220,
      decay: 0.99995,
      pan: index % 2 === 0 ? -0.4 : 0.4,
      drift: 0
    }));
    this.motifVoices = Array.from({ length: 8 }, () => ({
      env: 0,
      targetEnv: 0,
      phase: 0,
      freq: 220,
      pan: 0,
      decay: 0.99996,
      tone: 0,
      bloom: 0,
      hammer: 0,
      attack: 0
    }));
    this.motifQueue = [];
  }

  setChordIndex(index) {
    const count = this.chords.length;
    this.chordIndex = ((index % count) + count) % count;
  }

  triggerMotif(strength = 0.5, brightness = 0.3) {
    const chord = this.chords[this.chordIndex];
    const shape = this.motifShapes?.[this.chordIndex] ?? [0, 4, 7, 12, 14, 19, 24];
    const baseRoot = chord[0] ?? 0;
    const pans = [0, -0.14, 0.12, -0.08, 0.08, -0.22, 0.22];
    const baseDelay = 0.08 + (1 - brightness) * 0.05;
    const spread = 0.11 + 0.065 * (1 - brightness);
    const amp = 0.018 + 0.03 * strength;
    const tailSeconds = 3.4 + (1 - brightness) * 2.8;
    for (let i = 0; i < shape.length; i++) {
      const semi = baseRoot + shape[i];
      this.motifQueue.push({
        delay: Math.round(this.sr * (baseDelay + spread * i)),
        freq: midiToHz(this.rootMidi + semi),
        amp: amp * (i === 0 ? 1.26 : 1 - i * 0.07),
        pan: pans[i] ?? 0,
        decay: Math.exp(-1 / (this.sr * (tailSeconds - i * 0.16))),
        tone: 0.06 + i * 0.035
      });
    }
    this.motifGlow = Math.max(this.motifGlow, 0.55 + strength * 0.4);
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
    best.bloom = 0;
    best.hammer = 0.42;
    best.attack = 0;
  }

  onOnset(band, intensity, brightness = 0.3) {
    this.shimmerBoost = Math.max(
      this.shimmerBoost,
      intensity * (0.2 + band * 0.12 + brightness * 0.15)
    );
    if (band < 3 || intensity < 0.86) return;

    let best = this.sparkles[0];
    for (const sparkle of this.sparkles) {
      if (sparkle.env < best.env) best = sparkle;
    }

    const chord = this.chords[this.chordIndex];
    const octaveOffsets = [-12, 0, 7, 12];
    const semi = chord[(this.scatter + band) % chord.length] + octaveOffsets[Math.min(band, octaveOffsets.length - 1)];
    best.freq = midiToHz(this.rootMidi + semi);
    best.phase = 0;
    best.env = (0.0015 + 0.005 * intensity) * (0.56 + band * 0.12);
    const tailSeconds = 1.4 + (1 - brightness) * 2.1 + band * 0.32;
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
    this.motionA += 2 * Math.PI * 0.017 / this.sr;
    this.motionB += 2 * Math.PI * 0.011 / this.sr;
    if (this.motionA > Math.PI * 2) this.motionA -= Math.PI * 2;
    if (this.motionB > Math.PI * 2) this.motionB -= Math.PI * 2;

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
        voice.env += (voice.targetEnv - voice.env) * 0.0013;
        voice.targetEnv *= 0.99978;
      }
      if (voice.env < 1e-6) continue;
      voice.bloom += (1 - voice.bloom) * 0.0016;
      voice.attack += (1 - voice.attack) * 0.00085;
      voice.phase += 2 * Math.PI * voice.freq / this.sr;
      if (voice.phase > Math.PI * 2) voice.phase -= Math.PI * 2;
      const pair = Math.sin(voice.phase * 0.998 + voice.tone * 0.3);
      const harmonic = Math.sin(voice.phase * 2 + voice.tone);
      const air = Math.sin(voice.phase * 3 + voice.tone * 0.6);
      const shimmer = Math.sin(voice.phase * 4 + voice.tone * 0.4);
      const bloomMix = 0.46 + 0.54 * voice.bloom;
      const hammer = voice.hammer * (0.18 + 0.18 * harmonic + 0.12 * air);
      const sample =
        (
          0.44 * Math.sin(voice.phase) +
          0.18 * pair +
          0.14 * harmonic +
          0.06 * air +
          0.04 * shimmer +
          hammer
        ) *
        voice.env *
        voice.attack *
        bloomMix;
      voice.env *= voice.decay;
      voice.hammer *= 0.985;
      motifL += sample * (0.5 * (1 - voice.pan));
      motifR += sample * (0.5 * (1 + voice.pan));
    }

    const tapA = this.delayA[this.idxA];
    const tapB = this.delayB[this.idxB];
    const tapC = this.delayC[this.idxC];
    const tapD = this.delayD[this.idxD];
    const tapE = this.delayE[this.idxE];
    const tapF = this.delayF[this.idxF];

    const damp = 0.04 + 0.05 * (1 - this.brightness) + 0.02 * this.speechiness;
    this.filtA += (tapA - this.filtA) * damp;
    this.filtB += (tapB - this.filtB) * damp;
    this.filtC += (tapC - this.filtC) * damp;
    this.filtD += (tapD - this.filtD) * damp;
    this.filtE += (tapE - this.filtE) * (damp * 0.8);
    this.filtF += (tapF - this.filtF) * (damp * 0.76);

    const wet = clamp(0.22 + 0.14 * this.quietness + 0.06 * this.brightness + 0.14 * this.shimmerBoost, 0.16, 0.62);
    const feedback = clamp(0.84 - 0.1 * this.speechiness + 0.08 * this.quietness + 0.12 * this.shimmerBoost, 0.72, 0.96);
    const inputDuck = 1 - 0.8 * this.speechiness;
    const feedGain = 0.28 + 0.08 * this.brightness + 0.12 * this.shimmerBoost;
    const motionMixA = 0.5 + 0.5 * Math.sin(this.motionA);
    const motionMixB = 0.5 + 0.5 * Math.sin(this.motionB);

    const feedL =
      inputL * feedGain * inputDuck +
      sparkleL * (0.22 + 0.12 * this.brightness) +
      motifL * (0.35 + 0.18 * this.motifGlow);
    const feedR =
      inputR * feedGain * inputDuck +
      sparkleR * (0.22 + 0.12 * this.brightness) +
      motifR * (0.35 + 0.18 * this.motifGlow);

    this.delayA[this.idxA] = softClip(feedL + feedback * ((0.34 + 0.12 * motionMixA) * this.filtC + 0.14 * this.filtD + (0.08 + 0.08 * motionMixB) * this.filtF));
    this.delayB[this.idxB] = softClip(feedR + feedback * ((0.32 + 0.12 * motionMixB) * this.filtA + 0.14 * this.filtC + (0.08 + 0.08 * motionMixA) * this.filtE));
    this.delayC[this.idxC] = softClip(feedL * 0.46 + feedback * ((0.28 + 0.1 * (1 - motionMixA)) * this.filtB + 0.18 * this.filtE));
    this.delayD[this.idxD] = softClip(feedR * 0.46 + feedback * ((0.26 + 0.1 * (1 - motionMixB)) * this.filtA + 0.18 * this.filtF));
    this.delayE[this.idxE] = softClip(feedL * 0.3 + feedback * (0.24 * this.filtD + (0.14 + 0.08 * motionMixB) * this.filtB));
    this.delayF[this.idxF] = softClip(feedR * 0.3 + feedback * (0.24 * this.filtC + (0.14 + 0.08 * motionMixA) * this.filtA));

    this.idxA = (this.idxA + 1) % this.delayA.length;
    this.idxB = (this.idxB + 1) % this.delayB.length;
    this.idxC = (this.idxC + 1) % this.delayC.length;
    this.idxD = (this.idxD + 1) % this.delayD.length;
    this.idxE = (this.idxE + 1) % this.delayE.length;
    this.idxF = (this.idxF + 1) % this.delayF.length;

    const cloudL =
      tapA * (0.24 + 0.08 * motionMixA) +
      tapC * 0.14 +
      tapD * 0.1 +
      tapE * (0.12 + 0.08 * motionMixB) +
      tapF * 0.08;
    const cloudR =
      tapB * (0.24 + 0.08 * motionMixB) +
      tapD * 0.14 +
      tapC * 0.1 +
      tapF * (0.12 + 0.08 * motionMixA) +
      tapE * 0.08;
    const washDecay = clamp(0.9988 + this.quietness * 0.0007 + this.shimmerBoost * 0.0003, 0.9987, 0.99972);
    this.washL = this.washL * washDecay + (cloudL + motifL * 0.45 + inputL * 0.12) * 0.026;
    this.washR = this.washR * washDecay + (cloudR + motifR * 0.45 + inputR * 0.12) * 0.026;
    this.washFilterL += (this.washL - this.washFilterL) * (0.008 + this.brightness * 0.01);
    this.washFilterR += (this.washR - this.washFilterR) * (0.008 + this.brightness * 0.01);

    const tailL = cloudL + (this.filtC + this.filtE) * 0.14 + this.washFilterL * 0.85;
    const tailR = cloudR + (this.filtD + this.filtF) * 0.14 + this.washFilterR * 0.85;
    this.left = sparkleL * 0.035 + motifL * 0.9 + tailL * wet;
    this.right = sparkleR * 0.035 + motifR * 0.9 + tailR * wet;
    return 0.5 * (this.left + this.right);
  }
}
