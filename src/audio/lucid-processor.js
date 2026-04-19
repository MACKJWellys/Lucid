import { DirectPath } from './dsp/direct-path.js';
import { OnsetDetector } from './dsp/onset-detector.js';
import { ResonatorBank } from './dsp/resonator-bank.js';
import { AmbientBed } from './dsp/ambient-bed.js';
import { DensityClassifier } from './dsp/density-classifier.js';
import { ghibli } from './palettes/ghibli.js';
import { Biquad } from './dsp/biquad.js';
import { ReactiveTail } from './dsp/reactive-tail.js';

function clamp(x, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

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
    this._tail = new ReactiveTail(this._sr, ghibli);
    this._density = new DensityClassifier(this._sr);

    this._lastPostTime = 0;
    this._rmsAccum = 0; this._rmsCount = 0;
    this._lastOnsetTime = 0; this._lastOnsetIntensity = 0;
    this._envFast = 0;
    this._envSlow = 0;
    this._brightness = 0.24;
    this._speechiness = 0.12;
    this._sceneEnergy = 0;
    this._accentCooldownUntil = 0;

    this._onset.onOnset = (band, intensity) => {
      this._density.registerOnset();

      const speechGate = clamp(1 - this._speechiness * 1.35, 0, 1);
      const energyGate = clamp(0.3 + this._sceneEnergy * 0.9, 0, 1);
      const transientIntent = intensity * speechGate * energyGate;
      const now = currentTime;
      const canAccent = now >= this._accentCooldownUntil;

      if (canAccent && transientIntent > 0.16) {
        const accentAmount = clamp((transientIntent - 0.16) / 0.84, 0, 1);
        this._bank.onOnset(band, accentAmount, this._brightness);
        this._tail.onOnset(band, accentAmount, this._brightness);
        this._lastOnsetTime = now;
        this._lastOnsetIntensity = accentAmount;

        const cooldown =
          1.4 +
          (1 - accentAmount) * 1.2 +
          clamp(this._speechiness) * 0.9;
        this._accentCooldownUntil = now + cooldown;
      }
    };

    this._phaseStartTime = currentTime;
    this._phase = 'calibrating';
    this._chordCycle = ghibli.sceneChordCycle ?? [0];
    this._cycleStep = 0;
    this._chordIndex = this._chordCycle[0];
    this._bed.setChordIndex(this._chordIndex);
    this._bank.setChordIndex(this._chordIndex);
    this._tail.setChordIndex(this._chordIndex);
    this._nextChordShiftTime = currentTime + 12;
  }

  process(inputs, outputs) {
    const input = inputs[0]; const output = outputs[0];
    if (!input || input.length === 0) return true;
    const inCh = input[0];
    const outL = output[0]; const outR = output[1] || output[0];
    const len = outL.length;

    const phaseAge = currentTime - this._phaseStartTime;
    let newPhase = 'active';
    if (phaseAge < 4) newPhase = 'calibrating';
    else if (phaseAge < 30) newPhase = 'listening';
    this._phase = newPhase;

    const sceneGain = this._phase === 'calibrating' ? 0 : (this._phase === 'listening' ? 0.82 : 1);

    for (let i = 0; i < len; i++) {
      const x = inCh ? inCh[i] : 0;
      this._onset.process(x);
      this._density.updateSample();
      const absX = Math.abs(x);
      this._envFast += (absX - this._envFast) * 0.08;
      this._envSlow += (absX - this._envSlow) * 0.0024;
      this._brightness += (this._onset.lastCentroid - this._brightness) * 0.002;
      this._speechiness += (this._onset.lastSpeechiness - this._speechiness) * 0.002;

      const energy = clamp(this._envSlow * 7.5);
      this._sceneEnergy += (energy - this._sceneEnergy) * 0.004;
      const quietness = clamp(1 - energy * 1.7);
      const xr = this._reflectHP.process(x);
      const direct = sceneGain ? this._direct.process(x, energy, this._speechiness, this._brightness) : 0;
      this._bank.process(xr, energy, this._speechiness, this._brightness);
      this._bed.process(energy, this._brightness, this._speechiness, this._density.textureRegime, quietness);
      this._tail.process(
        this._bank.left * 0.9 + this._bed.left * 0.04,
        this._bank.right * 0.9 + this._bed.right * 0.04,
        energy,
        this._brightness,
        this._speechiness,
        quietness
      );

      const yL =
        direct +
        sceneGain * (
          this._bank.left * 0.4 +
          this._bed.left * 0.78 +
          this._tail.left * 0.72
        );
      const yR =
        direct +
        sceneGain * (
          this._bank.right * 0.4 +
          this._bed.right * 0.78 +
          this._tail.right * 0.72
        );
      outL[i] = Math.tanh(yL * 0.78);
      outR[i] = Math.tanh(yR * 0.78);
      this._rmsAccum += x * x; this._rmsCount++;
    }

    this._density.updateSpectralFlatness(this._onset.lastFlatness || 0.3);
    const regime = this._density.textureRegime;
    const now = currentTime;
    if (this._phase !== 'calibrating' && now >= this._nextChordShiftTime) {
      this._cycleStep = (this._cycleStep + 1) % this._chordCycle.length;
      this._chordIndex = this._chordCycle[this._cycleStep];
      this._bed.setChordIndex(this._chordIndex);
      this._bank.setChordIndex(this._chordIndex);
      this._tail.setChordIndex(this._chordIndex);
      const hold =
        12 +
        (1 - clamp(this._envSlow * 6)) * 7 +
        clamp(this._speechiness) * 4;
      this._nextChordShiftTime = now + hold;
    }

    if (now - this._lastPostTime > 1 / 30) {
      const rms = Math.sqrt(this._rmsAccum / Math.max(1, this._rmsCount));
      this.port.postMessage({
        type: 'features',
        loudness: Math.min(1, rms * 6),
        lastOnsetTime: this._lastOnsetTime,
        lastOnsetIntensity: this._lastOnsetIntensity,
        textureRegime: regime,
        spectralCentroid: this._brightness,
        speechiness: this._speechiness,
        phase: this._phase
      });
      this._rmsAccum = 0; this._rmsCount = 0; this._lastPostTime = now;
    }
    return true;
  }
}

registerProcessor('lucid-processor', LucidProcessor);
