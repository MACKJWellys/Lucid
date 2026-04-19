import { FFT, hannWindow } from './window-fft.js';

const BAND_EDGES = [180, 500, 2000, 6000, 24000];

class MovingMedian {
  constructor(size = 86) {
    this.size = size;
    this.buf = new Float32Array(size);
    this.i = 0;
    this.filled = 0;
  }
  push(x) {
    this.buf[this.i] = x;
    this.i = (this.i + 1) % this.size;
    if (this.filled < this.size) this.filled++;
  }
  median() {
    if (this.filled === 0) return 0;
    const s = Float32Array.from(this.buf.subarray(0, this.filled)).sort();
    return s[s.length >> 1];
  }
}

export class OnsetDetector {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.n = 512;
    this.hop = 256;
    this.window = hannWindow(this.n);
    this.fft = new FFT(this.n);

    this.ring = new Float32Array(this.n);
    this.writeIdx = 0;
    this.hopCount = 0;

    this.buf = new Float32Array(this.n);
    this.re = new Float32Array(this.n);
    this.im = new Float32Array(this.n);
    this.prevMag = new Float32Array(this.n / 2);

    this.bandRanges = [];
    for (let b = 0; b < BAND_EDGES.length - 1; b++) {
      const lo = Math.floor(BAND_EDGES[b] * this.n / this.sr);
      const hi = Math.ceil(BAND_EDGES[b + 1] * this.n / this.sr);
      this.bandRanges.push([Math.max(1, lo), Math.min(this.n / 2, hi)]);
    }
    this.medians = this.bandRanges.map(() => new MovingMedian(86));
    this.deadUntil = this.bandRanges.map(() => 0);
    this.textureK = 2.2;

    this.t = 0;
    this.onOnset = null;
    this.lastFlatness = 0.3;
  }

  process(x) {
    this.ring[this.writeIdx] = x;
    this.writeIdx = (this.writeIdx + 1) % this.n;
    this.hopCount++;
    this.t++;

    if (this.hopCount < this.hop) return;
    this.hopCount = 0;

    for (let i = 0; i < this.n; i++) {
      const idx = (this.writeIdx + i) % this.n;
      this.buf[i] = this.ring[idx] * this.window[i];
    }
    this.fft.forward(this.buf, this.re, this.im);

    let log = 0, sum = 0, nBins = 0;
    for (let k = 1; k < this.n / 2; k++) {
      const mag = Math.hypot(this.re[k], this.im[k]) + 1e-9;
      log += Math.log(mag);
      sum += mag;
      nBins++;
    }
    const geom = Math.exp(log / nBins);
    const arith = sum / nBins;
    this.lastFlatness = geom / (arith + 1e-9);

    for (let b = 0; b < this.bandRanges.length; b++) {
      const [lo, hi] = this.bandRanges[b];
      let flux = 0;
      for (let k = lo; k < hi; k++) {
        const mag = Math.hypot(this.re[k], this.im[k]);
        const diff = mag - this.prevMag[k];
        if (diff > 0) flux += diff;
        this.prevMag[k] = mag;
      }
      const med = this.medians[b].median();
      this.medians[b].push(flux);

      if (this.t < this.deadUntil[b]) continue;
      const thresh = Math.max(0.02, med * this.textureK);
      if (flux > thresh && med > 0.001) {
        const intensity = Math.min(1, (flux - thresh) / (thresh + 1e-6));
        this.deadUntil[b] = this.t + Math.round(this.sr * 0.04);
        if (this.onOnset) this.onOnset(b, intensity, this.t / this.sr);
      }
    }
  }
}
