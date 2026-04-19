import { Biquad } from './biquad.js';

export class DirectPath {
  constructor(sampleRate) {
    this.hp = new Biquad();
    this.hp.setHighpass(sampleRate, 180, 0.707);
    this.presence = new Biquad();
    this.presence.setPeakingEq(sampleRate, 3000, 1.0, 2.0);
    this.trim = Math.pow(10, -12 / 20);
    this.drive = 1.2;
  }

  process(x) {
    let y = this.hp.process(x);
    y = this.presence.process(y);
    y = this.trim * Math.tanh(this.drive * y);
    return y;
  }
}
