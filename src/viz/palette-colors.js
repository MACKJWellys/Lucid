export const PALETTE_COLORS = {
  ghibli:   { h: 34,  s: 60, l: 70 },
  hira:     { h: 210, s: 25, l: 55 },
  dorian:   { h: 140, s: 15, l: 55 },
  harmonic: { h: 210, s: 5,  l: 85 },
  pelog:    { h: 30,  s: 45, l: 55 },
  messiaen: { h: 265, s: 30, l: 40 }
};

export function lerpHsl(a, b, t) {
  return {
    h: a.h + (b.h - a.h) * t,
    s: a.s + (b.s - a.s) * t,
    l: a.l + (b.l - a.l) * t
  };
}

export function hslString({ h, s, l }, alpha = 1) {
  return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${alpha})`;
}
