import { midiToHz } from '../palettes/ghibli.js';

export class AmbientBed {
  constructor(sampleRate, palette) {
    this.sr = sampleRate;
    this.partials = palette.bedPartials.map((semi) => {
      const midi = palette.rootMidi + palette.bedRootOctaveOffset + semi;
      const f = midiToHz(midi);
      return {
        freq: f,
        phase: Math.random() * Math.PI * 2,
        phaseIncSine: 2 * Math.PI * f / sampleRate,
        phaseIncTri: 2 * Math.PI * (f * 2.01) / sampleRate,
        triPhase: 0
      };
    });
    this.baseGain = Math.pow(10, palette.bedGainDb / 20);
    this.lfoPhase = 0;
    this.lfoInc = 2 * Math.PI * 0.07 / sampleRate;
    this.brightness = 0.4;
  }

  setBrightness(b) { this.brightness = Math.max(0, Math.min(1, b)); }

  process() {
    this.lfoPhase += this.lfoInc;
    if (this.lfoPhase > Math.PI * 2) this.lfoPhase -= Math.PI * 2;
    const breath = 0.75 + 0.25 * Math.sin(this.lfoPhase);

    let y = 0;
    for (const p of this.partials) {
      p.phase += p.phaseIncSine;
      if (p.phase > Math.PI * 2) p.phase -= Math.PI * 2;
      p.triPhase += p.phaseIncTri;
      if (p.triPhase > Math.PI * 2) p.triPhase -= Math.PI * 2;
      const sine = Math.sin(p.phase);
      const tri = (2 / Math.PI) * Math.asin(Math.sin(p.triPhase));
      y += sine * (1 - this.brightness) + tri * this.brightness * 0.6;
    }
    return y * this.baseGain * breath / this.partials.length;
  }
}
