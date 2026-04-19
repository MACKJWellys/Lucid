import { describe, it, expect } from 'vitest';
import { OnsetDetector } from '../src/audio/dsp/onset-detector.js';

describe('OnsetDetector', () => {
  it('detects a loud impulse after a quiet period', () => {
    const sr = 48000;
    const det = new OnsetDetector(sr);
    const fired = [];
    det.onOnset = (band, intensity) => fired.push({ band, intensity });

    for (let i = 0; i < sr / 2; i++) det.process(0.0005 * (Math.random() * 2 - 1));

    for (let i = 0; i < sr * 0.02; i++) {
      det.process(0.6 * Math.sin(2 * Math.PI * 2000 * i / sr));
    }
    for (let i = 0; i < sr * 0.1; i++) det.process(0);

    expect(fired.length).toBeGreaterThan(0);
    expect(fired.some(f => f.band === 2 || f.band === 3)).toBe(true);
  });

  it('does not fire on steady sine', () => {
    const sr = 48000;
    const det = new OnsetDetector(sr);
    let count = 0;
    det.onOnset = () => count++;
    for (let i = 0; i < sr; i++) det.process(0.2 * Math.sin(2 * Math.PI * 1000 * i / sr));
    expect(count).toBeLessThan(3);
  });
});
