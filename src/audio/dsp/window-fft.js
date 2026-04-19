export class FFT {
  constructor(n) {
    this.n = n;
    this.log2n = Math.log2(n);
    if (!Number.isInteger(this.log2n)) throw new Error('n must be a power of two');
    this.cosT = new Float32Array(n / 2);
    this.sinT = new Float32Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cosT[i] = Math.cos(2 * Math.PI * i / n);
      this.sinT[i] = -Math.sin(2 * Math.PI * i / n);
    }
  }

  forward(input, re, im) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      let j = 0; let x = i;
      for (let b = 0; b < this.log2n; b++) { j = (j << 1) | (x & 1); x >>= 1; }
      re[j] = input[i];
      im[j] = 0;
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let k = 0; k < half; k++) {
          const cos = this.cosT[k * step];
          const sin = this.sinT[k * step];
          const a = i + k;
          const b = a + half;
          const tRe = cos * re[b] - sin * im[b];
          const tIm = cos * im[b] + sin * re[b];
          re[b] = re[a] - tRe; im[b] = im[a] - tIm;
          re[a] = re[a] + tRe; im[a] = im[a] + tIm;
        }
      }
    }
  }
}

export function hannWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
  return w;
}
