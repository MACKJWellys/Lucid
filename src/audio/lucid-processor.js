import { DirectPath } from './dsp/direct-path.js';
import { OnsetDetector } from './dsp/onset-detector.js';
import { ResonatorBank } from './dsp/resonator-bank.js';
import { AmbientBed } from './dsp/ambient-bed.js';
import { DensityClassifier } from './dsp/density-classifier.js';
import { ghibli } from './palettes/ghibli.js';
import { Biquad } from './dsp/biquad.js';

class LucidProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._sr = sampleRate;
    this._direct = new DirectPath(this._sr);
    this._onset = new OnsetDetector(this._sr);
    this._reflectHP = new Biquad();
    this._reflectHP.setHighpass(this._sr, 180, 0.707);
    this._bank = new ResonatorBank(this._sr, ghibli);
    this._bed = new AmbientBed(this._sr, ghibli);
    this._density = new DensityClassifier(this._sr);

    this._lastPostTime = 0;
    this._rmsAccum = 0; this._rmsCount = 0;
    this._lastOnsetTime = 0; this._lastOnsetIntensity = 0;

    this._onset.onOnset = (band, intensity) => {
      this._bank.onOnset(band, intensity);
      this._density.registerOnset();
      this._lastOnsetTime = currentTime;
      this._lastOnsetIntensity = intensity;
    };

    this._reflectMix = 0.7;
    this._directMix = 1.0;

    this._phaseStartTime = currentTime;
    this._phase = 'calibrating';
  }

  process(inputs, outputs) {
    const input = inputs[0]; const output = outputs[0];
    if (!input || input.length === 0) return true;
    const inCh = input[0];
    const outL = output[0]; const outR = output[1] || output[0];
    const len = outL.length;

    const phaseAge = currentTime - this._phaseStartTime;
    let newPhase = 'active';
    if (phaseAge < 5) newPhase = 'calibrating';
    else if (phaseAge < 60) newPhase = 'listening';
    this._phase = newPhase;

    const directMix = (this._phase === 'calibrating') ? 0 : this._directMix;
    const reflectMix = (this._phase === 'calibrating') ? 0 : this._reflectMix;
    const bedGain = (this._phase === 'calibrating') ? 0 : 1;

    for (let i = 0; i < len; i++) {
      const x = inCh ? inCh[i] : 0;
      this._onset.process(x);
      this._density.updateSample();
      const xr = this._reflectHP.process(x);
      const direct = this._direct.process(x) * directMix;
      const reflective = this._bank.process(xr) * reflectMix;
      const bed = this._bed.process() * bedGain;
      const y = direct + reflective + bed;
      outL[i] = y; outR[i] = y;
      this._rmsAccum += x * x; this._rmsCount++;
    }

    this._density.updateSpectralFlatness(this._onset.lastFlatness || 0.3);
    const regime = this._density.textureRegime;
    this._bed.setBrightness(0.25 + 0.6 * regime);

    const now = currentTime;
    if (now - this._lastPostTime > 1 / 30) {
      const rms = Math.sqrt(this._rmsAccum / Math.max(1, this._rmsCount));
      this.port.postMessage({
        type: 'features',
        loudness: Math.min(1, rms * 6),
        lastOnsetTime: this._lastOnsetTime,
        lastOnsetIntensity: this._lastOnsetIntensity,
        textureRegime: regime,
        spectralCentroid: 0.3,
        phase: this._phase
      });
      this._rmsAccum = 0; this._rmsCount = 0; this._lastPostTime = now;
    }
    return true;
  }
}

registerProcessor('lucid-processor', LucidProcessor);
