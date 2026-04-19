import { describe, it, expect } from 'vitest';
import { DirectPath } from '../src/audio/dsp/direct-path.js';

describe('DirectPath', () => {
  it('attenuates sub-180Hz content', () => {
    const dp = new DirectPath(48000);
    let peakIn = 0, peakOut = 0;
    for (let i = 0; i < 4800; i++) {
      const s = Math.sin(2 * Math.PI * 50 * i / 48000);
      peakIn = Math.max(peakIn, Math.abs(s));
      peakOut = Math.max(peakOut, Math.abs(dp.process(s)));
    }
    expect(peakOut).toBeLessThan(peakIn * 0.5);
  });

  it('keeps a gentle presence-band monitor signal at low drive', () => {
    const dp = new DirectPath(48000);
    let peakOut = 0;
    for (let i = 0; i < 4800; i++) {
      const s = 0.2 * Math.sin(2 * Math.PI * 3000 * i / 48000);
      if (i > 2400) peakOut = Math.max(peakOut, Math.abs(dp.process(s, 0.15, 0.2, 0.3)));
      else dp.process(s, 0.15, 0.2, 0.3);
    }
    expect(peakOut).toBeGreaterThan(0.005);
    expect(peakOut).toBeLessThan(0.08);
  });

  it('backs off when the scene is already busy and bright', () => {
    const dp = new DirectPath(48000);
    let quietPeak = 0;
    let busyPeak = 0;
    for (let i = 0; i < 4800; i++) {
      const s = 0.18 * Math.sin(2 * Math.PI * 1500 * i / 48000);
      quietPeak = Math.max(quietPeak, Math.abs(dp.process(s, 0.05, 0.05, 0.15)));
    }
    for (let i = 0; i < 4800; i++) {
      const s = 0.18 * Math.sin(2 * Math.PI * 1500 * i / 48000);
      busyPeak = Math.max(busyPeak, Math.abs(dp.process(s, 0.8, 0.1, 0.8)));
    }
    expect(busyPeak).toBeLessThan(quietPeak);
  });
});
