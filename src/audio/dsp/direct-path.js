import { Biquad } from './biquad.js';

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function softClip(x) {
  return Math.tanh(x);
}

export class DirectPath {
  constructor(sampleRate) {
    this.sr = sampleRate;
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

    this.delayShortL = new Float32Array(Math.round(sampleRate * 0.013));
    this.delayShortR = new Float32Array(Math.round(sampleRate * 0.017));
    this.delayLongL = new Float32Array(Math.round(sampleRate * 0.031));
    this.delayLongR = new Float32Array(Math.round(sampleRate * 0.041));
    this.idxShortL = 0;
    this.idxShortR = 0;
    this.idxLongL = 0;
    this.idxLongR = 0;

    this.motionA = 0;
    this.motionB = 0;
    this.diffuseL = 0;
    this.diffuseR = 0;
    this.left = 0;
    this.right = 0;
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

    this.motionA += 2 * Math.PI * 0.19 / this.sr;
    this.motionB += 2 * Math.PI * 0.13 / this.sr;
    if (this.motionA > Math.PI * 2) this.motionA -= Math.PI * 2;
    if (this.motionB > Math.PI * 2) this.motionB -= Math.PI * 2;

    const tapShortL = this.delayShortL[this.idxShortL];
    const tapShortR = this.delayShortR[this.idxShortR];
    const tapLongL = this.delayLongL[this.idxLongL];
    const tapLongR = this.delayLongR[this.idxLongR];

    const diffuseMix = clamp(
      0.16 + (1 - energy) * 0.12 + brightness * 0.05 - speechiness * 0.03,
      0.12,
      0.34
    );
    const feedback = clamp(0.34 + quietBoost * 0.18 + brightness * 0.06, 0.26, 0.58);
    const diffuseInput = y * (0.2 + quietBoost * 0.16 + brightness * 0.06);
    const motionMixA = 0.5 + 0.5 * Math.sin(this.motionA);
    const motionMixB = 0.5 + 0.5 * Math.sin(this.motionB);

    this.delayShortL[this.idxShortL] = softClip(diffuseInput + tapLongR * (0.16 + 0.08 * motionMixA));
    this.delayShortR[this.idxShortR] = softClip(diffuseInput + tapLongL * (0.16 + 0.08 * motionMixB));
    this.delayLongL[this.idxLongL] = softClip(diffuseInput * 0.8 + feedback * (tapShortL * 0.46 + tapShortR * 0.14));
    this.delayLongR[this.idxLongR] = softClip(diffuseInput * 0.8 + feedback * (tapShortR * 0.46 + tapShortL * 0.14));

    this.idxShortL = (this.idxShortL + 1) % this.delayShortL.length;
    this.idxShortR = (this.idxShortR + 1) % this.delayShortR.length;
    this.idxLongL = (this.idxLongL + 1) % this.delayLongL.length;
    this.idxLongR = (this.idxLongR + 1) % this.delayLongR.length;

    this.diffuseL += ((tapShortL + tapLongL * 0.82) - this.diffuseL) * (0.08 + brightness * 0.04);
    this.diffuseR += ((tapShortR + tapLongR * 0.82) - this.diffuseR) * (0.08 + brightness * 0.04);

    const dry = y * this.mix * 0.88;
    // A lightly diffused stereo shell keeps the live layer present but less literal.
    this.left = dry + this.diffuseL * diffuseMix;
    this.right = dry + this.diffuseR * diffuseMix;
    return 0.5 * (this.left + this.right);
  }
}
