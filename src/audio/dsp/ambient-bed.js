import { midiToHz } from '../palettes/ghibli.js';

function clamp(x, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

export class AmbientBed {
  constructor(sampleRate, palette) {
    this.sr = sampleRate;
    this.rootMidi = palette.rootMidi;
    this.baseOctave = palette.bedRootOctaveOffset ?? -24;
    this.chords = palette.sceneChords ?? [[0, 4, 7, 11]];
    this.baseGain = Math.pow(10, palette.bedGainDb / 20);
    this.voiceDefs = [
      { slot: 0, octave: 0, gain: 1.0, pan: -0.34 },
      { slot: 1, octave: 12, gain: 0.74, pan: -0.14 },
      { slot: 2, octave: 12, gain: 0.67, pan: 0.14 },
      { slot: 3, octave: 12, gain: 0.56, pan: 0.34 },
      { slot: 1, octave: 24, gain: 0.22, pan: -0.46 },
      { slot: 2, octave: 24, gain: 0.2, pan: 0.46 }
    ];
    this.voices = this.voiceDefs.map((def, index) => ({
      ...def,
      freq: 0,
      targetFreq: 0,
      phaseA: Math.random() * Math.PI * 2,
      phaseB: Math.random() * Math.PI * 2,
      driftPhase: Math.random() * Math.PI * 2 + index
    }));

    this.chordIndex = 0;
    this.energy = 0;
    this.brightness = 0.3;
    this.speechiness = 0;
    this.density = 0.25;
    this.quietness = 0.3;
    this.motionPhase = 0;
    this.filterL = 0;
    this.filterR = 0;
    this.left = 0;
    this.right = 0;

    this.setChordIndex(0);
  }

  setChordIndex(index) {
    const count = this.chords.length;
    this.chordIndex = ((index % count) + count) % count;
    const chord = this.chords[this.chordIndex];
    for (const voice of this.voices) {
      const semi = chord[voice.slot % chord.length];
      const midi = this.rootMidi + this.baseOctave + voice.octave + semi;
      voice.targetFreq = midiToHz(midi);
      if (!voice.freq) voice.freq = voice.targetFreq;
    }
  }

  process(energy = 0, brightness = 0.3, speechiness = 0, density = 0.3, quietness = 0.3) {
    this.energy += (energy - this.energy) * 0.001;
    this.brightness += (brightness - this.brightness) * 0.0012;
    this.speechiness += (speechiness - this.speechiness) * 0.0012;
    this.density += (density - this.density) * 0.0008;
    this.quietness += (quietness - this.quietness) * 0.001;

    this.motionPhase += 2 * Math.PI * 0.012 / this.sr;
    if (this.motionPhase > Math.PI * 2) this.motionPhase -= Math.PI * 2;

    const breath =
      0.82 +
      0.14 * Math.sin(this.motionPhase) +
      0.04 * Math.sin(this.motionPhase * 0.37 + 1.2);
    const intensity = 0.05 + 0.46 * Math.pow(clamp(this.energy), 0.68);
    const quietLift = 0.04 + 0.06 * clamp(this.quietness);
    const densityShade = 0.94 - 0.18 * clamp(this.density);
    const sceneGain = (quietLift + intensity) * densityShade * (1 - 0.48 * clamp(this.speechiness));
    const timbre = clamp(0.18 + 0.5 * this.brightness + 0.14 * this.density, 0.08, 0.9);
    const width = clamp(0.5 + 0.45 * this.quietness + 0.12 * this.brightness, 0.35, 0.95);

    let sumL = 0;
    let sumR = 0;
    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      voice.freq += (voice.targetFreq - voice.freq) * 0.00045;
      voice.driftPhase += 2 * Math.PI * (0.013 + i * 0.0027) / this.sr;
      if (voice.driftPhase > Math.PI * 2) voice.driftPhase -= Math.PI * 2;
      const detune = 1 + 0.0024 * Math.sin(voice.driftPhase);

      voice.phaseA += 2 * Math.PI * voice.freq / this.sr;
      voice.phaseB += 2 * Math.PI * voice.freq * detune / this.sr;
      if (voice.phaseA > Math.PI * 2) voice.phaseA -= Math.PI * 2;
      if (voice.phaseB > Math.PI * 2) voice.phaseB -= Math.PI * 2;

      const fundamental = Math.sin(voice.phaseA);
      const companion = Math.sin(voice.phaseB);
      const harmonic = Math.sin(voice.phaseA * 2 + Math.sin(voice.driftPhase) * 0.4);
      const tone =
        (0.72 * fundamental + 0.28 * companion) * (1 - timbre) +
        (0.58 * fundamental + 0.2 * companion + 0.22 * harmonic) * timbre;

      const ampLfo = 0.78 + 0.22 * Math.sin(voice.driftPhase * 0.41 + i * 0.7);
      const sample = tone * voice.gain * ampLfo * breath * sceneGain;
      const pan = clamp(voice.pan * width, -0.95, 0.95);

      sumL += sample * (0.5 * (1 - pan));
      sumR += sample * (0.5 * (1 + pan));
    }

    const filterCoeff = 0.024 + 0.05 * this.brightness;
    this.filterL += (sumL - this.filterL) * filterCoeff;
    this.filterR += (sumR - this.filterR) * filterCoeff;
    this.left = this.filterL * this.baseGain;
    this.right = this.filterR * this.baseGain;
    return 0.5 * (this.left + this.right);
  }
}
