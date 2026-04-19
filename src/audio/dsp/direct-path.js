import { Biquad } from './biquad.js';

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export class DirectPath {
  constructor(sampleRate) {
    this.hp = new Biquad();
    this.hp.setHighpass(sampleRate, 140, 0.707);
    this.lp = new Biquad();
    this.lp.setLowpass(sampleRate, 6200, 0.707);
    this.midDip = new Biquad();
    this.midDip.setPeakingEq(sampleRate, 2800, 0.9, -2.0);
    this.bodyDip = new Biquad();
    this.bodyDip.setPeakingEq(sampleRate, 680, 0.8, -1.0);
    this.trim = Math.pow(10, -12.5 / 20);
    this.drive = 0.92;
    this.mix = 0.38;
    this.mixAlpha = 0.0022;
    this.level = 0;
    this.lift = 1.18;
  }

  process(x, energy = 0, speechiness = 0, brightness = 0.3) {
    const targetMix = clamp(
      0.34 + speechiness * 0.1 + (1 - energy) * 0.08 - brightness * 0.02,
      0.28,
      0.52
    );
    this.mix += (targetMix - this.mix) * this.mixAlpha;

    let y = this.hp.process(x);
    y = this.lp.process(y);
    y = this.midDip.process(y);
    y = this.bodyDip.process(y);
    this.level += (Math.abs(y) - this.level) * 0.01;
    const quietBoost = clamp((0.05 - this.level) / 0.05, 0, 1);
    const targetLift = clamp(
      1.04 + (1 - energy) * 0.42 + quietBoost * 0.32 - speechiness * 0.08,
      1.0,
      1.72
    );
    this.lift += (targetLift - this.lift) * this.mixAlpha;
    y = this.trim * Math.tanh(this.drive * y * this.lift) + y * 0.1 * this.lift;
    return y * this.mix;
  }
}
