import { describe, it, expect } from 'vitest';
import { ReactiveTail } from '../src/audio/dsp/reactive-tail.js';
import { ghibli } from '../src/audio/palettes/ghibli.js';

describe('ReactiveTail', () => {
  it('is effectively silent without input or transients', () => {
    const tail = new ReactiveTail(48000, ghibli);
    let peak = 0;
    for (let i = 0; i < 12000; i++) {
      tail.process(0, 0, 0, 0.2, 0.1, 0.8);
      peak = Math.max(peak, Math.abs(tail.left), Math.abs(tail.right));
    }
    expect(peak).toBeLessThan(1e-4);
  });

  it('blooms after an onset and then decays', () => {
    const tail = new ReactiveTail(48000, ghibli);
    tail.onOnset(2, 0.9, 0.5);

    let earlyPeak = 0;
    for (let i = 0; i < 24000; i++) {
      tail.process(0, 0, 0.25, 0.4, 0.1, 0.7);
      earlyPeak = Math.max(earlyPeak, Math.abs(tail.left), Math.abs(tail.right));
    }

    let latePeak = 0;
    for (let i = 0; i < 96000; i++) {
      tail.process(0, 0, 0.05, 0.3, 0.1, 0.9);
      latePeak = Math.max(latePeak, Math.abs(tail.left), Math.abs(tail.right));
    }

    expect(earlyPeak).toBeGreaterThan(1e-4);
    expect(latePeak).toBeLessThan(earlyPeak);
  });
});
