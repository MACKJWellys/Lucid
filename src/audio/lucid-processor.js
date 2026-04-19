import { DirectPath } from './dsp/direct-path.js';
import { OnsetDetector } from './dsp/onset-detector.js';

class LucidProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._sr = sampleRate;
    this._direct = new DirectPath(this._sr);
    this._onset = new OnsetDetector(this._sr);
    this._lastPostTime = 0;
    this._rmsAccum = 0;
    this._rmsCount = 0;
    this._lastOnsetTime = 0;
    this._lastOnsetIntensity = 0;

    this._onset.onOnset = (band, intensity) => {
      this._lastOnsetTime = currentTime;
      this._lastOnsetIntensity = intensity;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;
    const inCh = input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const len = outL.length;

    for (let i = 0; i < len; i++) {
      const x = inCh ? inCh[i] : 0;
      this._onset.process(x);
      const y = this._direct.process(x);
      outL[i] = y;
      outR[i] = y;
      this._rmsAccum += x * x;
      this._rmsCount++;
    }

    const now = currentTime;
    if (now - this._lastPostTime > 1 / 30) {
      const rms = Math.sqrt(this._rmsAccum / Math.max(1, this._rmsCount));
      this.port.postMessage({
        type: 'features',
        loudness: Math.min(1, rms * 6),
        lastOnsetTime: this._lastOnsetTime,
        lastOnsetIntensity: this._lastOnsetIntensity
      });
      this._rmsAccum = 0;
      this._rmsCount = 0;
      this._lastPostTime = now;
    }
    return true;
  }
}

registerProcessor('lucid-processor', LucidProcessor);
