import { Biquad } from './biquad.js';

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export class DirectPath {
  constructor(sampleRate) {
    this.hp = new Biquad();
    this.hp.setHighpass(sampleRate, 160, 0.707);
    this.lp = new Biquad();
    this.lp.setLowpass(sampleRate, 4600, 0.707);
    this.midDip = new Biquad();
    this.midDip.setPeakingEq(sampleRate, 2600, 0.9, -3.0);
    this.bodyDip = new Biquad();
    this.bodyDip.setPeakingEq(sampleRate, 620, 0.8, -1.5);
    this.trim = Math.pow(10, -15 / 20);
    this.drive = 1.05;
    this.mix = 0.28;
    this.mixAlpha = 0.003;
  }

  process(x, energy = 0, speechiness = 0, brightness = 0.3) {
    const targetMix = clamp(
      0.2 + speechiness * 0.16 + (1 - energy) * 0.06 - brightness * 0.03,
      0.16,
      0.38
    );
    this.mix += (targetMix - this.mix) * this.mixAlpha;

    let y = this.hp.process(x);
    y = this.lp.process(y);
    y = this.midDip.process(y);
    y = this.bodyDip.process(y);
    y = this.trim * Math.tanh(this.drive * y);
    return y * this.mix;
  }
}
