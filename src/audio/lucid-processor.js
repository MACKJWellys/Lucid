class LucidProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._lastPostTime = 0;
    this._rmsAccum = 0;
    this._rmsCount = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const inCh = input[0];
    const outL = output[0];
    const outR = output[1] || output[0];
    const len = outL.length;

    for (let i = 0; i < len; i++) {
      const x = inCh ? inCh[i] : 0;
      const y = x * 0.25;
      outL[i] = y;
      outR[i] = y;
      this._rmsAccum += x * x;
      this._rmsCount++;
    }

    const now = currentTime;
    if (now - this._lastPostTime > 1 / 30) {
      const rms = Math.sqrt(this._rmsAccum / Math.max(1, this._rmsCount));
      this.port.postMessage({ type: 'features', loudness: Math.min(1, rms * 6) });
      this._rmsAccum = 0;
      this._rmsCount = 0;
      this._lastPostTime = now;
    }
    return true;
  }
}

registerProcessor('lucid-processor', LucidProcessor);
