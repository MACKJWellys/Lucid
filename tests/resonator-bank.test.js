import { describe, it, expect } from 'vitest';
import { ResonatorBank } from '../src/audio/dsp/resonator-bank.js';
import { ghibli } from '../src/audio/palettes/ghibli.js';

describe('ResonatorBank', () => {
  it('is silent on silence', () => {
    const rb = new ResonatorBank(48000, ghibli);
    let peak = 0;
    for (let i = 0; i < 4800; i++) peak = Math.max(peak, Math.abs(rb.process(0)));
    expect(peak).toBeLessThan(1e-4);
  });

  it('rings after excitation', () => {
    const rb = new ResonatorBank(48000, ghibli);
    rb.excite(0, 1.0);
    let peakEarly = 0;
    for (let i = 0; i < 100; i++) peakEarly = Math.max(peakEarly, Math.abs(rb.process(0)));
    expect(peakEarly).toBeGreaterThan(1e-4);

    let peakLate = 0;
    for (let i = 0; i < 9000; i++) peakLate = Math.max(peakLate, Math.abs(rb.process(0)));
    expect(peakLate).toBeLessThan(peakEarly);
  });
});
