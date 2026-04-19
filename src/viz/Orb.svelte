<script>
  import { onMount } from 'svelte';
  import { PALETTE_COLORS, lerpHsl, hslString } from './palette-colors.js';

  export let driver;
  export let onTap = () => {};

  let canvas;
  let ctx;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let rafId;

  const ripples = [];
  const MAX_RIPPLES = 4;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(nowMs) {
    const time = nowMs / 1000;
    const f = driver.getFeatures();

    const outHsl = PALETTE_COLORS[f.currentPaletteId] || PALETTE_COLORS.ghibli;
    const inHsl  = PALETTE_COLORS[f.nextPaletteId]    || outHsl;
    const hsl    = lerpHsl(outHsl, inHsl, f.crossfadeProgress);

    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const breath = 0.5 + 0.5 * Math.sin(time * 2 * Math.PI * 0.3);
    const loudBoost = Math.min(1, f.loudness);
    const dim = f.isActive ? 1.0 : 0.4;
    const baseR = Math.min(width, height) * 0.11;
    const phaseScale = f.phase === 'calibrating' ? 0.55 : 1;
    const r = baseR * (1 + 0.08 * breath + 0.15 * loudBoost) * phaseScale;

    const haloR = r * 2.6;
    const haloGrad = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, haloR);
    haloGrad.addColorStop(0, hslString(hsl, 0.22 * dim));
    haloGrad.addColorStop(1, hslString(hsl, 0));
    ctx.fillStyle = haloGrad;
    ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI * 2); ctx.fill();

    const tNow = nowMs;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      const life = rp.isMotif ? 2500 : 1200;
      const age = tNow - rp.t0;
      if (age > life) { ripples.splice(i, 1); continue; }
      const t = age / life;
      const radius = r + r * 1.0 * t;
      const alpha = (1 - t) * 0.5 * rp.intensity * dim;
      ctx.strokeStyle = hslString(hsl, alpha);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    }

    const bodyGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    bodyGrad.addColorStop(0, hslString({ ...hsl, l: Math.min(90, hsl.l + 10) }, 0.95 * dim));
    bodyGrad.addColorStop(1, hslString(hsl, 0.0));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    rafId = requestAnimationFrame(draw);
  }

  function emitRipple(_time, intensity, isMotif = false) {
    ripples.push({
      t0: performance.now(),
      intensity: Math.max(0.2, Math.min(1, intensity)),
      isMotif
    });
    if (ripples.length > MAX_RIPPLES) ripples.shift();
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    const off = driver.onOnset(emitRipple);
    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      off();
    };
  });
</script>

<canvas
  bind:this={canvas}
  on:click={onTap}
  on:touchend|preventDefault={onTap}
  aria-label="Lucid on/off"
></canvas>

<style>
  canvas { display: block; width: 100%; height: 100%; touch-action: manipulation; }
</style>
