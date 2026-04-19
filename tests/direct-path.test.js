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

  it('produces output around unity in the presence band at low drive', () => {
    const dp = new DirectPath(48000);
    let peakOut = 0;
    for (let i = 0; i < 4800; i++) {
      const s = 0.2 * Math.sin(2 * Math.PI * 3000 * i / 48000);
      if (i > 2400) peakOut = Math.max(peakOut, Math.abs(dp.process(s)));
      else dp.process(s);
    }
    expect(peakOut).toBeGreaterThan(0.02);
    expect(peakOut).toBeLessThan(0.15);
  });
});
