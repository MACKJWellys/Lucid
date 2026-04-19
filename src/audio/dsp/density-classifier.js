export class DensityClassifier {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.onsetRate = 0;
    this.onsetDecay = Math.exp(-1 / (sampleRate * 2));
    this.flatness = 0.3;
    this.flatnessAlpha = 0.02;
    this.regime = 0.3;
    this.regimeAlpha = 0.02;
  }

  registerOnset() {
    this.onsetRate += 1.0;
  }

  updateSample() {
    this.onsetRate *= this.onsetDecay;
  }

  updateSpectralFlatness(flatness) {
    this.flatness = this.flatness * (1 - this.flatnessAlpha) + flatness * this.flatnessAlpha;
    const onsetNorm = Math.min(1, this.onsetRate / 4);
    const target = 0.5 * onsetNorm + 0.5 * this.flatness;
    this.regime = this.regime * (1 - this.regimeAlpha) + target * this.regimeAlpha;
  }

  get textureRegime() { return this.regime; }
  get loudnessHint() { return Math.min(1, this.onsetRate / 6); }
}
