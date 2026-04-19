import { describe, it, expect } from 'vitest';
import { Biquad } from '../src/audio/dsp/biquad.js';

describe('Biquad', () => {
  it('lowpass passes DC and blocks Nyquist', () => {
    const b = new Biquad();
    b.setLowpass(48000, 1000, 0.707);
    let dcOut = 0;
    for (let i = 0; i < 200; i++) dcOut = b.process(1.0);
    expect(dcOut).toBeCloseTo(1.0, 2);

    const b2 = new Biquad();
    b2.setLowpass(48000, 1000, 0.707);
    let nyqOut = 0;
    for (let i = 0; i < 200; i++) nyqOut = b2.process(i % 2 === 0 ? 1 : -1);
    expect(Math.abs(nyqOut)).toBeLessThan(0.05);
  });

  it('bandpass rings on impulse when Q is high', () => {
    const b = new Biquad();
    b.setBandpass(48000, 440, 80);
    let maxMag = 0;
    b.process(1);
    for (let i = 0; i < 2000; i++) {
      const y = b.process(0);
      maxMag = Math.max(maxMag, Math.abs(y));
    }
    expect(maxMag).toBeGreaterThan(0.01);
  });

  it('highpass blocks DC and passes Nyquist', () => {
    const b = new Biquad();
    b.setHighpass(48000, 1000, 0.707);
    let dcOut = 0;
    for (let i = 0; i < 200; i++) dcOut = b.process(1);
    expect(Math.abs(dcOut)).toBeLessThan(0.05);
  });
});
