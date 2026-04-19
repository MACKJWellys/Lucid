import { describe, it, expect } from 'vitest';
import { AmbientBed } from '../src/audio/dsp/ambient-bed.js';
import { ghibli } from '../src/audio/palettes/ghibli.js';

describe('AmbientBed', () => {
  it('stays quietly alive even at low energy', () => {
    const bed = new AmbientBed(48000, ghibli);
    let peak = 0;
    for (let i = 0; i < 48000; i++) {
      bed.process(0.02, 0.2, 0.1, 0.2, 0.9);
      peak = Math.max(peak, Math.abs(bed.left), Math.abs(bed.right));
    }
    expect(peak).toBeGreaterThan(1e-4);
  });

  it('grows with sustained energy and remains finite after a chord shift', () => {
    const bed = new AmbientBed(48000, ghibli);
    let quietEnergy = 0;
    for (let i = 0; i < 24000; i++) {
      bed.process(0.02, 0.2, 0.1, 0.2, 0.8);
      quietEnergy += Math.abs(bed.left) + Math.abs(bed.right);
    }

    bed.setChordIndex(2);
    let loudEnergy = 0;
    for (let i = 0; i < 24000; i++) {
      bed.process(0.6, 0.45, 0.05, 0.35, 0.2);
      loudEnergy += Math.abs(bed.left) + Math.abs(bed.right);
    }

    expect(loudEnergy).toBeGreaterThan(quietEnergy * 2);
    expect(Number.isFinite(loudEnergy)).toBe(true);
  });
});
