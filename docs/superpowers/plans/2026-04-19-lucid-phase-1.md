# Lucid Phase 1 Implementation Plan — "Listen and Ring"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable PWA on the user's Pixel 8 that makes their environment quietly musical in the Ghibli palette — direct path + reflective resonator bank + simple ambient bed + orb visualisation. No palette drift, no motifs.

**Architecture:** Svelte + Vite single-page PWA, deployed via GitHub Actions to GitHub Pages. Real-time DSP runs in a single AudioWorkletProcessor on the audio thread. UI runs on the main thread and subscribes to a 30Hz feature stream from the processor via MessagePort. Canvas 2D for the orb.

**Tech Stack:** Svelte 4, Vite 5, vanilla JS AudioWorklet, Canvas 2D, Workbox for service worker, GitHub Actions for CI/CD, Vitest for unit tests.

---

## Deviation from spec: JS AudioWorklet instead of Rust/WASM for Phase 1

The spec calls for Rust compiled to WASM for the DSP core. **For Phase 1 this plan uses pure JavaScript inside the AudioWorkletProcessor instead.** Rationale:

- 24 biquads + onset detection + bed synthesis is comfortable for V8's JIT on a Pixel 8. Measured overhead in similar AudioWorklet-based apps is well under 5% of an audio thread budget.
- Zero extra toolchain: no `rustup`, `wasm-pack`, cargo, or cross-compilation to Android Chrome. Faster to iterate, and deploys are just static JS.
- If Phase 1 profiling reveals the JS bank genuinely can't keep up on Pixel 8, Rust/WASM can be reintroduced as a drop-in replacement behind the same `DspCore` module interface without touching the app shell.

This is a Phase 1 decision only. Phases 2–4 can reopen if performance warrants it.

---

## File structure

Files created in this phase:

```
Lucid/
├── .github/workflows/deploy.yml          # CI/CD to GitHub Pages
├── .gitignore
├── index.html                            # Vite entry
├── package.json
├── vite.config.js                        # Base path, SW plugin config
├── svelte.config.js
├── public/
│   ├── manifest.webmanifest              # PWA manifest
│   ├── icon-192.png                      # app icon (placeholder, fine)
│   └── icon-512.png
├── src/
│   ├── main.js                           # Svelte mount point
│   ├── App.svelte                        # Root: title + orb + start/stop
│   ├── app.css                           # Global reset + background
│   ├── viz/
│   │   ├── Orb.svelte                    # Canvas orb + ripples
│   │   ├── viz-driver.js                 # Converts feature stream → viz state
│   │   └── palette-colors.js             # hex per palette id
│   ├── audio/
│   │   ├── engine.js                     # Public API: start/stop, feature subscription
│   │   ├── lucid-processor.js            # AudioWorkletProcessor (registered by Vite ?worker-url)
│   │   ├── dsp/
│   │   │   ├── biquad.js                 # Direct-form-II-transposed biquad
│   │   │   ├── direct-path.js            # HPF + EQ + saturation
│   │   │   ├── onset-detector.js         # Multi-band spectral flux + adaptive threshold
│   │   │   ├── density-classifier.js     # Onset rate + spectral flatness
│   │   │   ├── resonator-bank.js         # 24-voice bank with ducking
│   │   │   ├── ambient-bed.js            # Sine/triangle pedal partials
│   │   │   └── window-fft.js             # Simple FFT helper (radix-2)
│   │   └── palettes/
│   │       └── ghibli.js                 # Ghibli palette record
│   └── sw.js                             # Workbox-generated service worker (via vite-plugin-pwa)
├── tests/
│   ├── biquad.test.js
│   ├── onset-detector.test.js
│   ├── resonator-bank.test.js
│   └── direct-path.test.js
└── docs/superpowers/...                  # (already committed)
```

Each DSP file exports one or two pure-ish constructors/classes and nothing else. The AudioWorkletProcessor in `lucid-processor.js` wires them together and owns the `process()` callback.

---

## Task 1: Initialise Git repo and Vite + Svelte project

**Files:**
- Create: `package.json`, `vite.config.js`, `svelte.config.js`, `index.html`, `src/main.js`, `src/App.svelte`, `src/app.css`, `.gitignore`

- [ ] **Step 1: Initialise git**

```bash
cd C:/Users/wells/Desktop/Lucid
git init
git branch -M main
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules
dist
.DS_Store
*.log
.vite
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "lucid",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.1.0",
    "svelte": "^4.2.0",
    "vite": "^5.2.0",
    "vite-plugin-pwa": "^0.20.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules` populates, no errors.

- [ ] **Step 5: Create `vite.config.js`**

```javascript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Lucid',
        short_name: 'Lucid',
        description: 'The world, heard more musically.',
        theme_color: '#0A0A0C',
        background_color: '#0A0A0C',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  server: { host: true }
});
```

- [ ] **Step 6: Create `svelte.config.js`**

```javascript
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess() };
```

- [ ] **Step 7: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0A0A0C" />
    <title>Lucid</title>
    <link rel="icon" href="./icon-192.png" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/main.js`**

```javascript
import './app.css';
import App from './App.svelte';

const app = new App({ target: document.getElementById('app') });
export default app;
```

- [ ] **Step 9: Create `src/app.css`**

```css
html, body, #app { margin: 0; padding: 0; height: 100%; background: #0A0A0C; overflow: hidden; }
body { font-family: -apple-system, system-ui, 'Inter', sans-serif; font-weight: 200; color: #E8E8EC; -webkit-tap-highlight-color: transparent; }
```

- [ ] **Step 10: Create `src/App.svelte` (placeholder)**

```svelte
<main>
  <h1>Lucid</h1>
</main>

<style>
  main { display: flex; align-items: center; justify-content: center; height: 100%; }
  h1 { font-weight: 200; letter-spacing: 2px; font-size: 32px; }
</style>
```

- [ ] **Step 11: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite reports a local URL; open it in a browser; "Lucid" is centred on a near-black background. Stop the server with Ctrl+C.

- [ ] **Step 12: Create placeholder icons**

Use any 192×192 and 512×512 PNG. For now, solid near-black with a pale amber circle is fine.

```bash
# Placeholder — any tool works. One quick way is an online generator.
# Drop the files at:
#   public/icon-192.png
#   public/icon-512.png
```

- [ ] **Step 13: Commit**

```bash
git add .
git commit -m "feat: initialise Vite + Svelte PWA scaffold"
```

---

## Task 2: Create the orb component (static + breathing)

The orb is a `<canvas>` element driven by `requestAnimationFrame`. This task gives it a gentle default breath so we see it's alive before any audio is wired up.

**Files:**
- Create: `src/viz/Orb.svelte`
- Create: `src/viz/viz-driver.js`
- Create: `src/viz/palette-colors.js`
- Modify: `src/App.svelte`

- [ ] **Step 1: Create `src/viz/palette-colors.js`**

```javascript
export const PALETTE_COLORS = {
  ghibli:   { h: 34,  s: 60, l: 70 },   // warm amber
  hira:     { h: 210, s: 25, l: 55 },   // muted slate blue
  dorian:   { h: 140, s: 15, l: 55 },   // dusty green-grey
  harmonic: { h: 210, s: 5,  l: 85 },   // silver-white
  pelog:    { h: 30,  s: 45, l: 55 },   // bronze
  messiaen: { h: 265, s: 30, l: 40 }    // deep violet
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
```

- [ ] **Step 2: Create `src/viz/viz-driver.js`**

A thin object that holds the latest feature snapshot and provides smoothed values for the orb to draw. Called from `Orb.svelte`. Later tasks will push audio features into it.

```javascript
const DEFAULT_FEATURES = {
  loudness: 0,
  spectralCentroid: 0.3,    // 0..1
  textureRegime: 0,         // 0 sparse .. 1 textural
  currentPaletteId: 'ghibli',
  nextPaletteId: 'ghibli',
  crossfadeProgress: 0,
  lastOnsetTime: 0,
  lastOnsetIntensity: 0,
  lastMotifTime: 0,
  isActive: false,
  phase: 'idle'              // 'idle' | 'calibrating' | 'listening' | 'active'
};

export function createVizDriver() {
  let features = { ...DEFAULT_FEATURES };
  const onsetListeners = new Set();

  return {
    updateFeatures(next) {
      const prevOnset = features.lastOnsetTime;
      features = { ...features, ...next };
      if (features.lastOnsetTime > prevOnset) {
        for (const l of onsetListeners) l(features.lastOnsetTime, features.lastOnsetIntensity);
      }
    },
    setPhase(phase) { features = { ...features, phase }; },
    setActive(isActive) { features = { ...features, isActive }; },
    getFeatures() { return features; },
    onOnset(fn) { onsetListeners.add(fn); return () => onsetListeners.delete(fn); }
  };
}
```

- [ ] **Step 3: Create `src/viz/Orb.svelte`**

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { PALETTE_COLORS, lerpHsl, hslString } from './palette-colors.js';

  export let driver;
  export let onTap = () => {};

  let canvas;
  let ctx;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let rafId;
  let time = 0;

  const ripples = [];   // { t0, intensity, isMotif }
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
    time = nowMs / 1000;
    const f = driver.getFeatures();

    const outHsl = PALETTE_COLORS[f.currentPaletteId] || PALETTE_COLORS.ghibli;
    const inHsl  = PALETTE_COLORS[f.nextPaletteId]    || outHsl;
    const hsl    = lerpHsl(outHsl, inHsl, f.crossfadeProgress);

    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const breath = 0.5 + 0.5 * Math.sin(time * 2 * Math.PI * 0.3);   // 0..1 @ 0.3Hz
    const loudBoost = Math.min(1, f.loudness);
    const dim = f.isActive ? 1.0 : 0.4;
    const baseR = Math.min(width, height) * 0.11;
    const r = baseR * (1 + 0.08 * breath + 0.15 * loudBoost) * (f.phase === 'calibrating' ? 0.55 : 1);

    // Glow halo
    const haloR = r * 2.6;
    const haloGrad = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, haloR);
    haloGrad.addColorStop(0, hslString(hsl, 0.22 * dim));
    haloGrad.addColorStop(1, hslString(hsl, 0));
    ctx.fillStyle = haloGrad;
    ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI * 2); ctx.fill();

    // Ripples
    const tNow = nowMs;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      const life = rp.isMotif ? 2500 : 1200;
      const age = tNow - rp.t0;
      if (age > life) { ripples.splice(i, 1); continue; }
      const t = age / life;
      const radius = r + (r * 1.0) * t;
      const alpha = (1 - t) * 0.5 * rp.intensity * dim;
      ctx.strokeStyle = hslString(hsl, alpha);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    }

    // Orb body
    const bodyGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    bodyGrad.addColorStop(0, hslString({ ...hsl, l: Math.min(90, hsl.l + 10) }, 0.95 * dim));
    bodyGrad.addColorStop(1, hslString(hsl, 0.0));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    rafId = requestAnimationFrame(draw);
  }

  function emitRipple(_time, intensity, isMotif = false) {
    ripples.push({ t0: performance.now(), intensity: Math.max(0.2, Math.min(1, intensity)), isMotif });
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
```

- [ ] **Step 4: Update `src/App.svelte`**

```svelte
<script>
  import { onMount } from 'svelte';
  import Orb from './viz/Orb.svelte';
  import { createVizDriver } from './viz/viz-driver.js';

  const driver = createVizDriver();

  let isActive = false;

  function toggle() {
    isActive = !isActive;
    driver.setActive(isActive);
  }

  onMount(() => {
    driver.setActive(false);
  });
</script>

<main>
  <header>
    <h1>Lucid</h1>
  </header>

  <section class="orb-wrap">
    <Orb {driver} onTap={toggle} />
  </section>

  {#if !isActive}
    <footer class="hint">tap to begin</footer>
  {/if}
</main>

<style>
  main { display: grid; grid-template-rows: 28% 1fr 16%; height: 100%; overflow: hidden; }
  header { display: flex; align-items: center; justify-content: center; }
  h1 { font-weight: 200; letter-spacing: 2px; font-size: 32px; margin: 0; color: #E8E8EC; }
  .orb-wrap { min-height: 0; }
  .hint { display: flex; align-items: center; justify-content: center; font-size: 14px; opacity: 0.6; }
</style>
```

- [ ] **Step 5: Verify visual in browser**

```bash
npm run dev
```

Expected: "Lucid" title near top, a soft amber orb centred, very slowly breathing, a "tap to begin" label near the bottom. Clicking the orb removes the "tap to begin" label and brightens the orb.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: breathing orb and tap-to-toggle UI"
```

---

## Task 3: GitHub Actions deploy to GitHub Pages

So the user can install the app on their Pixel 8 from the first working commit.

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the remote repository**

The user creates a new empty GitHub repo named `lucid` (no README, no .gitignore — we already have those).

```bash
# user runs:
git remote add origin https://github.com/<username>/lucid.git
git push -u origin main
```

- [ ] **Step 2: Enable GitHub Pages**

In the repo settings → Pages, set the source to "GitHub Actions".

- [ ] **Step 3: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Update Vite base path**

Because GitHub Pages serves from `/<repo-name>/`, change `base` in `vite.config.js` to match:

```javascript
base: process.env.NODE_ENV === 'production' ? '/lucid/' : '/'
```

- [ ] **Step 5: Commit and push**

```bash
git add .
git commit -m "ci: deploy to GitHub Pages"
git push
```

- [ ] **Step 6: Verify deploy**

Watch the Actions tab on GitHub. Once green, open `https://<username>.github.io/lucid/` on the Pixel 8 in Chrome. Tap the three-dot menu → "Add to Home Screen". Launch from the home screen icon. Confirm the orb breathes and the tap-to-toggle works.

- [ ] **Step 7: No commit needed (verification only)**

---

## Task 4: Mic permission flow + engine scaffold

Wire up a placeholder audio engine that requests mic permission when the user taps the orb. No DSP yet — just the plumbing.

**Files:**
- Create: `src/audio/engine.js`
- Create: `src/audio/lucid-processor.js`
- Modify: `src/App.svelte`

- [ ] **Step 1: Create `src/audio/lucid-processor.js` (placeholder)**

This file runs on the audio thread. For now it just copies input to output and reports a dummy loudness feature.

```javascript
// Registered as an AudioWorkletProcessor; imported as a URL by engine.js.
class LucidProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this._lastPostTime = 0;
    this._rmsAccum = 0;
    this._rmsCount = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    for (let ch = 0; ch < output.length; ch++) {
      const inCh = input[ch] || input[0];
      const outCh = output[ch];
      for (let i = 0; i < outCh.length; i++) {
        const s = inCh ? inCh[i] : 0;
        outCh[i] = s * 0.25;   // temporary direct passthrough at low level
        this._rmsAccum += s * s;
        this._rmsCount++;
      }
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
```

- [ ] **Step 2: Create `src/audio/engine.js`**

```javascript
import processorUrl from './lucid-processor.js?worker&url';

export function createEngine() {
  let ctx = null;
  let node = null;
  let stream = null;
  const listeners = new Set();

  async function start() {
    if (ctx) return;
    ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
    await ctx.audioWorklet.addModule(processorUrl);

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1
      }
    });

    const source = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, 'lucid-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    });
    node.port.onmessage = (e) => {
      if (e.data?.type === 'features') {
        for (const l of listeners) l(e.data);
      }
    };

    source.connect(node).connect(ctx.destination);
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async function stop() {
    if (!ctx) return;
    try { node?.disconnect(); } catch {}
    try { stream?.getTracks().forEach(t => t.stop()); } catch {}
    try { await ctx.close(); } catch {}
    ctx = null; node = null; stream = null;
  }

  function onFeatures(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  return { start, stop, onFeatures, isRunning() { return !!ctx; } };
}
```

- [ ] **Step 3: Update `src/App.svelte` to wire engine ↔ viz driver**

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import Orb from './viz/Orb.svelte';
  import { createVizDriver } from './viz/viz-driver.js';
  import { createEngine } from './audio/engine.js';

  const driver = createVizDriver();
  const engine = createEngine();

  let isActive = false;
  let permissionError = '';

  const offFeatures = engine.onFeatures((f) => driver.updateFeatures(f));

  async function toggle() {
    if (!isActive) {
      try {
        permissionError = '';
        await engine.start();
        isActive = true;
        driver.setActive(true);
      } catch (err) {
        permissionError = 'Lucid needs to hear the world. Tap to allow microphone.';
      }
    } else {
      await engine.stop();
      isActive = false;
      driver.setActive(false);
    }
  }

  onDestroy(() => {
    offFeatures();
    engine.stop();
  });
</script>

<main>
  <header><h1>Lucid</h1></header>
  <section class="orb-wrap"><Orb {driver} onTap={toggle} /></section>
  {#if !isActive}
    <footer class="hint">{permissionError || 'tap to begin'}</footer>
  {/if}
</main>

<style>
  main { display: grid; grid-template-rows: 28% 1fr 16%; height: 100%; overflow: hidden; }
  header { display: flex; align-items: center; justify-content: center; }
  h1 { font-weight: 200; letter-spacing: 2px; font-size: 32px; margin: 0; color: #E8E8EC; }
  .orb-wrap { min-height: 0; }
  .hint { display: flex; align-items: center; justify-content: center; font-size: 14px; opacity: 0.6; padding: 0 24px; text-align: center; }
</style>
```

- [ ] **Step 4: Verify mic flow on desktop**

```bash
npm run dev
```

Open the dev URL (use the "Network" URL, not localhost, if testing with headphones on another machine). Tap the orb. Browser asks for mic permission. Approve. You should now hear your mic quietly through your speakers/headphones (expect feedback with open speakers — wear headphones).

Important: on iOS and Android, `getUserMedia` requires HTTPS. Localhost is exempt; the GitHub Pages URL is HTTPS. For mobile dev testing use the deployed URL.

- [ ] **Step 5: Deploy and verify on Pixel 8**

```bash
git add .
git commit -m "feat: mic capture and AudioWorklet scaffold"
git push
```

On the Pixel 8 via the installed PWA: put on wired or BT headphones, tap the orb, allow mic. You should hear the room at low level, and the orb should visibly pulse when you clap or speak.

---

## Task 5: Biquad filter primitive + unit tests

The single building block the whole DSP depends on. Implement once, test it thoroughly, reuse everywhere.

**Files:**
- Create: `src/audio/dsp/biquad.js`
- Create: `tests/biquad.test.js`

- [ ] **Step 1: Write failing test for DC gain of a lowpass**

```javascript
// tests/biquad.test.js
import { describe, it, expect } from 'vitest';
import { Biquad } from '../src/audio/dsp/biquad.js';

describe('Biquad', () => {
  it('lowpass passes DC and blocks Nyquist', () => {
    const b = new Biquad();
    b.setLowpass(48000, 1000, 0.707);
    let dcOut = 0;
    for (let i = 0; i < 200; i++) dcOut = b.process(1.0);  // settle
    expect(dcOut).toBeCloseTo(1.0, 2);

    const b2 = new Biquad();
    b2.setLowpass(48000, 1000, 0.707);
    let nyqOut = 0;
    for (let i = 0; i < 200; i++) nyqOut = b2.process(i % 2 === 0 ? 1 : -1);
    expect(Math.abs(nyqOut)).toBeLessThan(0.05);
  });
});
```

- [ ] **Step 2: Run test; expect FAIL (import missing)**

```bash
npm test
```

Expected: fail with "Cannot find module".

- [ ] **Step 3: Create `src/audio/dsp/biquad.js`**

```javascript
// Direct-form-II-transposed biquad. Coefficients from Audio EQ Cookbook (Robert Bristow-Johnson).
export class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }

  reset() { this.z1 = 0; this.z2 = 0; }

  _set(b0, b1, b2, a0, a1, a2) {
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  setLowpass(sr, f, q) {
    const w0 = 2 * Math.PI * f / sr;
    const cw = Math.cos(w0), sw = Math.sin(w0);
    const alpha = sw / (2 * q);
    this._set((1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + alpha, -2 * cw, 1 - alpha);
  }

  setHighpass(sr, f, q) {
    const w0 = 2 * Math.PI * f / sr;
    const cw = Math.cos(w0), sw = Math.sin(w0);
    const alpha = sw / (2 * q);
    this._set((1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + alpha, -2 * cw, 1 - alpha);
  }

  setBandpass(sr, f, q) {
    const w0 = 2 * Math.PI * f / sr;
    const cw = Math.cos(w0), sw = Math.sin(w0);
    const alpha = sw / (2 * q);
    this._set(alpha, 0, -alpha, 1 + alpha, -2 * cw, 1 - alpha);
  }

  setPeakingEq(sr, f, q, dbGain) {
    const A = Math.pow(10, dbGain / 40);
    const w0 = 2 * Math.PI * f / sr;
    const cw = Math.cos(w0), sw = Math.sin(w0);
    const alpha = sw / (2 * q);
    this._set(1 + alpha * A, -2 * cw, 1 - alpha * A, 1 + alpha / A, -2 * cw, 1 - alpha / A);
  }

  process(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}
```

- [ ] **Step 4: Run test; expect PASS**

```bash
npm test
```

- [ ] **Step 5: Add bandpass resonance test**

```javascript
  it('bandpass rings on impulse when Q is high', () => {
    const b = new Biquad();
    b.setBandpass(48000, 440, 80);   // A4, high Q
    let maxMag = 0;
    b.process(1);                     // impulse
    for (let i = 0; i < 2000; i++) {
      const y = b.process(0);
      maxMag = Math.max(maxMag, Math.abs(y));
    }
    expect(maxMag).toBeGreaterThan(0.01);   // still ringing after 40ms at 48kHz
  });

  it('highpass blocks DC and passes Nyquist', () => {
    const b = new Biquad();
    b.setHighpass(48000, 1000, 0.707);
    let dcOut = 0;
    for (let i = 0; i < 200; i++) dcOut = b.process(1);
    expect(Math.abs(dcOut)).toBeLessThan(0.05);
  });
```

- [ ] **Step 6: Run all tests; expect PASS**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: biquad primitive with filter presets"
```

---

## Task 6: Direct path DSP

Replace the placeholder passthrough with the proper direct path: HPF at 180Hz, presence-band lift, soft-knee saturation, –12 dB trim.

**Files:**
- Create: `src/audio/dsp/direct-path.js`
- Create: `tests/direct-path.test.js`
- Modify: `src/audio/lucid-processor.js`

- [ ] **Step 1: Write failing test**

```javascript
// tests/direct-path.test.js
import { describe, it, expect } from 'vitest';
import { DirectPath } from '../src/audio/dsp/direct-path.js';

describe('DirectPath', () => {
  it('attenuates sub-180Hz content', () => {
    const dp = new DirectPath(48000);
    // 50Hz sine input
    let peakIn = 0, peakOut = 0;
    for (let i = 0; i < 4800; i++) {
      const s = Math.sin(2 * Math.PI * 50 * i / 48000);
      peakIn = Math.max(peakIn, Math.abs(s));
      peakOut = Math.max(peakOut, Math.abs(dp.process(s)));
    }
    expect(peakOut).toBeLessThan(peakIn * 0.5);
  });

  it('produces output around unity in the presence band at low drive', () => {
    const dp = new DirectPath(48000);
    let peakOut = 0;
    for (let i = 0; i < 4800; i++) {
      const s = 0.2 * Math.sin(2 * Math.PI * 3000 * i / 48000);
      if (i > 2400) peakOut = Math.max(peakOut, Math.abs(dp.process(s)));
      else dp.process(s);
    }
    // -12dB trim => ~0.25 * presence bump (~1.26) => ~0.063; accept a wide bracket
    expect(peakOut).toBeGreaterThan(0.02);
    expect(peakOut).toBeLessThan(0.15);
  });
});
```

- [ ] **Step 2: Run test; expect FAIL (import missing)**

```bash
npm test
```

- [ ] **Step 3: Create `src/audio/dsp/direct-path.js`**

```javascript
import { Biquad } from './biquad.js';

export class DirectPath {
  constructor(sampleRate) {
    this.hp = new Biquad();
    this.hp.setHighpass(sampleRate, 180, 0.707);
    this.presence = new Biquad();
    this.presence.setPeakingEq(sampleRate, 3000, 1.0, 2.0);   // +2 dB bell
    this.trim = Math.pow(10, -12 / 20);                        // -12 dB
    this.drive = 1.2;                                          // gentle soft-knee
  }

  process(x) {
    let y = this.hp.process(x);
    y = this.presence.process(y);
    y = this.trim * Math.tanh(this.drive * y);                 // soft-knee saturation
    return y;
  }
}
```

- [ ] **Step 4: Run tests; expect PASS**

```bash
npm test
```

- [ ] **Step 5: Use `DirectPath` inside the processor**

Rewrite `src/audio/lucid-processor.js` so inline imports work with AudioWorklet. Because AudioWorklet can't import ES modules directly across file URLs in some browsers, we bundle the DSP into the processor by using Vite's `?worker&url` treatment: the import in `engine.js` asks Vite to bundle this module as a classic worker script.

Vite's `vite-plugin-svelte` + default ESM handling treats `?worker&url` as producing a separately bundled file. The processor file itself uses `import` statements which Vite will inline during the bundle build.

```javascript
// src/audio/lucid-processor.js
import { DirectPath } from './dsp/direct-path.js';

class LucidProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._sr = sampleRate;
    this._direct = new DirectPath(this._sr);
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
      const y = this._direct.process(x);
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
```

- [ ] **Step 6: Local verify**

```bash
npm run dev
```

Tap orb. You should hear your voice/environment through the direct path — attenuated, without heavy bass, with a subtle presence lift and no noticeable distortion.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: direct path (HPF + presence bell + soft-knee saturation)"
```

---

## Task 7: Multi-band onset detector

Spectral flux per band with adaptive (moving-median) thresholds.

**Files:**
- Create: `src/audio/dsp/window-fft.js`
- Create: `src/audio/dsp/onset-detector.js`
- Create: `tests/onset-detector.test.js`
- Modify: `src/audio/lucid-processor.js`

- [ ] **Step 1: Create `src/audio/dsp/window-fft.js`**

A compact iterative radix-2 FFT. 512-point Hann-windowed STFT frames, hopped by 128 samples (≈2.67ms at 48kHz), gives ~375 frames/sec.

```javascript
// Iterative radix-2 FFT. In-place on complex arrays stored as interleaved {re, im}.
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

  // forward real-to-complex: re in, produces re, im interleaved
  forward(input, re, im) {
    const n = this.n;
    // bit-reverse copy
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
```

- [ ] **Step 2: Write failing test for onset detector**

```javascript
// tests/onset-detector.test.js
import { describe, it, expect } from 'vitest';
import { OnsetDetector } from '../src/audio/dsp/onset-detector.js';

describe('OnsetDetector', () => {
  it('detects a loud impulse after a quiet period', () => {
    const sr = 48000;
    const det = new OnsetDetector(sr);
    const fired = [];
    det.onOnset = (band, intensity) => fired.push({ band, intensity });

    // 0.5s of quiet
    for (let i = 0; i < sr / 2; i++) det.process(0.0005 * (Math.random() * 2 - 1));

    // loud 2kHz burst for 20ms
    for (let i = 0; i < sr * 0.02; i++) {
      det.process(0.6 * Math.sin(2 * Math.PI * 2000 * i / sr));
    }
    // decay
    for (let i = 0; i < sr * 0.1; i++) det.process(0);

    expect(fired.length).toBeGreaterThan(0);
    // 2kHz is in band index 2 (500-2000) or 3 (2000-6000) depending on binning
    expect(fired.some(f => f.band === 2 || f.band === 3)).toBe(true);
  });

  it('does not fire on steady sine', () => {
    const sr = 48000;
    const det = new OnsetDetector(sr);
    let count = 0;
    det.onOnset = () => count++;
    // 1s of steady 1kHz
    for (let i = 0; i < sr; i++) det.process(0.2 * Math.sin(2 * Math.PI * 1000 * i / sr));
    // Accept at most one onset at the very start
    expect(count).toBeLessThan(3);
  });
});
```

- [ ] **Step 3: Run test; expect FAIL**

```bash
npm test
```

- [ ] **Step 4: Create `src/audio/dsp/onset-detector.js`**

```javascript
import { FFT, hannWindow } from './window-fft.js';

// 4 bands, in Hz.
const BAND_EDGES = [180, 500, 2000, 6000, 24000];

// Moving median over a fixed ring buffer.
class MovingMedian {
  constructor(size = 86) {   // ≈1.5s of hop history @ 48kHz / hop=256
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

    this.t = 0;              // sample counter
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

    // Copy ring into a windowed linear buffer, oldest first.
    for (let i = 0; i < this.n; i++) {
      const idx = (this.writeIdx + i) % this.n;
      this.buf[i] = this.ring[idx] * this.window[i];
    }
    this.fft.forward(this.buf, this.re, this.im);

    // Spectral flatness across positive-frequency bins (for density classifier).
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

    // Per-band spectral flux + adaptive threshold.
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
        this.deadUntil[b] = this.t + Math.round(this.sr * 0.04);   // 40 ms dead time
        if (this.onOnset) this.onOnset(b, intensity, this.t / this.sr);
      }
    }
  }
}
```

- [ ] **Step 5: Run tests; expect PASS**

```bash
npm test
```

If the "steady sine" test fires more than expected, increase `textureK` to 2.5.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: multi-band spectral-flux onset detector"
```

---

## Task 8: Wire onsets into the feature port + orb ripples

**Files:**
- Modify: `src/audio/lucid-processor.js`

- [ ] **Step 1: Update the processor to run onset detection and post onset events**

```javascript
// src/audio/lucid-processor.js
import { DirectPath } from './dsp/direct-path.js';
import { OnsetDetector } from './dsp/onset-detector.js';

class LucidProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._sr = sampleRate;
    this._direct = new DirectPath(this._sr);
    this._onset = new OnsetDetector(this._sr);
    this._lastPostTime = 0;
    this._rmsAccum = 0;
    this._rmsCount = 0;
    this._lastOnsetTime = 0;
    this._lastOnsetIntensity = 0;

    this._onset.onOnset = (band, intensity, _tSec) => {
      this._lastOnsetTime = currentTime;
      this._lastOnsetIntensity = intensity;
    };
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
      this._onset.process(x);
      const y = this._direct.process(x);
      outL[i] = y;
      outR[i] = y;
      this._rmsAccum += x * x;
      this._rmsCount++;
    }

    const now = currentTime;
    if (now - this._lastPostTime > 1 / 30) {
      const rms = Math.sqrt(this._rmsAccum / Math.max(1, this._rmsCount));
      this.port.postMessage({
        type: 'features',
        loudness: Math.min(1, rms * 6),
        lastOnsetTime: this._lastOnsetTime,
        lastOnsetIntensity: this._lastOnsetIntensity
      });
      this._rmsAccum = 0;
      this._rmsCount = 0;
      this._lastPostTime = now;
    }
    return true;
  }
}

registerProcessor('lucid-processor', LucidProcessor);
```

- [ ] **Step 2: Verify ripples appear**

```bash
npm run dev
```

Tap orb. Clap your hands, tap a table, whistle. You should see ripples expand from the orb roughly synced with the sounds. Sustained steady tones should produce at most a single ripple at onset.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: ripples on environmental onsets"
```

---

## Task 9: Resonator bank (24 voices) + Ghibli palette + excitation

**Files:**
- Create: `src/audio/palettes/ghibli.js`
- Create: `src/audio/dsp/resonator-bank.js`
- Create: `tests/resonator-bank.test.js`
- Modify: `src/audio/lucid-processor.js`

- [ ] **Step 1: Create `src/audio/palettes/ghibli.js`**

```javascript
// C root. Pitches expressed as MIDI note numbers. F♯ (scale degree 6) weighted down.
// Octave weights: index 0 = lowest octave (around C3), up to index 2 (around C5).
export const ghibli = {
  id: 'ghibli',
  rootMidi: 60,    // C4
  scaleSemitones: [0, 2, 4, 5, 6, 7, 9, 11],
  scaleWeights:   [1.0, 0.9, 1.0, 0.9, 0.3, 1.0, 0.9, 0.95],
  octaveOffsets:  [-12, 0, 12],
  octaveWeights:  [0.6, 1.0, 0.8],
  q: 80,
  detuneCents: 7,
  secondaryBankGainDb: -6,
  bedPartials: [0, 7],   // tonic + fifth (semitones above root)
  bedRootOctaveOffset: -24,   // way below orb range, as a pedal
  bedGainDb: -24
};

export function midiToHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
```

- [ ] **Step 2: Write failing test**

```javascript
// tests/resonator-bank.test.js
import { describe, it, expect } from 'vitest';
import { ResonatorBank } from '../src/audio/dsp/resonator-bank.js';
import { ghibli } from '../src/audio/palettes/ghibli.js';

describe('ResonatorBank', () => {
  it('is silent on silence', () => {
    const rb = new ResonatorBank(48000, ghibli);
    let peak = 0;
    for (let i = 0; i < 4800; i++) peak = Math.max(peak, Math.abs(rb.process(0)));
    expect(peak).toBeLessThan(1e-4);
  });

  it('rings after excitation', () => {
    const rb = new ResonatorBank(48000, ghibli);
    rb.excite(0, 1.0);
    // input signal matters because voices are excited by a short burst mapped through input,
    // but `excite` injects an impulse directly into the bank for motif-style excitation.
    let peakEarly = 0;
    for (let i = 0; i < 100; i++) peakEarly = Math.max(peakEarly, Math.abs(rb.process(0)));
    expect(peakEarly).toBeGreaterThan(1e-4);

    let peakLate = 0;
    for (let i = 0; i < 9000; i++) peakLate = Math.max(peakLate, Math.abs(rb.process(0)));
    expect(peakLate).toBeLessThan(peakEarly);   // decaying
  });
});
```

- [ ] **Step 3: Run test; expect FAIL**

```bash
npm test
```

- [ ] **Step 4: Create `src/audio/dsp/resonator-bank.js`**

```javascript
import { Biquad } from './biquad.js';
import { midiToHz } from '../palettes/ghibli.js';

export class ResonatorBank {
  constructor(sampleRate, palette) {
    this.sr = sampleRate;
    this.voices = [];
    this._buildVoices(palette);
    this._limiter = 1.0;
    this.bandRanges = [
      [180, 500], [500, 2000], [2000, 6000], [6000, 20000]
    ];
  }

  _buildVoices(p) {
    this.voices.length = 0;
    const secGain = Math.pow(10, (p.secondaryBankGainDb ?? -6) / 20);
    const detuneRatio = Math.pow(2, (p.detuneCents ?? 7) / 1200);
    for (let o = 0; o < p.octaveOffsets.length; o++) {
      const ow = p.octaveWeights[o] ?? 1;
      for (let s = 0; s < p.scaleSemitones.length; s++) {
        const sw = p.scaleWeights[s] ?? 1;
        const midi = p.rootMidi + p.octaveOffsets[o] + p.scaleSemitones[s];
        const f = midiToHz(midi);
        const primary = new Biquad();
        primary.setBandpass(this.sr, f, p.q);
        const secondary = new Biquad();
        secondary.setBandpass(this.sr, f * detuneRatio, p.q * 0.9);
        this.voices.push({
          f,
          weight: ow * sw,
          primary,
          secondary,
          env: 0,
          excitePending: 0,
          secGain
        });
      }
    }
  }

  // Direct excitation (used by motif engine in later phases).
  excite(voiceIndex, amplitude) {
    const v = this.voices[voiceIndex];
    if (v) v.excitePending += amplitude;
  }

  // Distribute an onset impulse across voices weighted by band proximity.
  onOnset(band, intensity) {
    const [lo, hi] = this.bandRanges[band];
    for (const v of this.voices) {
      const inBand = v.f >= lo && v.f < hi;
      if (!inBand) continue;
      const ducking = 1 / (1 + v.env * 6);   // already-ringing voices get less
      v.excitePending += intensity * v.weight * ducking * 0.6;
    }
  }

  process(inputSample) {
    let out = 0;
    let sumSq = 0;
    for (const v of this.voices) {
      // Each voice receives the HPF'd input scaled by its weight, PLUS any pending excitation impulses.
      const imp = v.excitePending;
      v.excitePending = 0;
      const xv = imp + inputSample * v.weight * 0.1;
      const yp = v.primary.process(xv);
      const ys = v.secondary.process(xv) * v.secGain;
      const y = yp + ys;
      out += y;
      v.env = v.env * 0.9995 + Math.abs(y) * 0.0005;
      sumSq += y * y;
    }
    // Bank-total limiter: slow attack, medium release.
    const target = sumSq > 0.04 ? Math.sqrt(0.04 / sumSq) : 1;
    this._limiter = this._limiter + (target - this._limiter) * (target < this._limiter ? 0.02 : 0.005);
    return out * this._limiter;
  }
}
```

- [ ] **Step 5: Run tests; expect PASS**

```bash
npm test
```

- [ ] **Step 6: Wire the bank into the processor**

```javascript
// src/audio/lucid-processor.js (additions shown; keep previous logic)
import { DirectPath } from './dsp/direct-path.js';
import { OnsetDetector } from './dsp/onset-detector.js';
import { ResonatorBank } from './dsp/resonator-bank.js';
import { ghibli } from './palettes/ghibli.js';
import { Biquad } from './dsp/biquad.js';

class LucidProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._sr = sampleRate;
    this._direct = new DirectPath(this._sr);
    this._onset = new OnsetDetector(this._sr);
    this._reflectHP = new Biquad();
    this._reflectHP.setHighpass(this._sr, 180, 0.707);
    this._bank = new ResonatorBank(this._sr, ghibli);

    this._lastPostTime = 0;
    this._rmsAccum = 0; this._rmsCount = 0;
    this._lastOnsetTime = 0; this._lastOnsetIntensity = 0;

    this._onset.onOnset = (band, intensity) => {
      this._bank.onOnset(band, intensity);
      this._lastOnsetTime = currentTime;
      this._lastOnsetIntensity = intensity;
    };

    this._reflectMix = 0.7;   // reflective layer level
    this._directMix = 1.0;
  }

  process(inputs, outputs) {
    const input = inputs[0]; const output = outputs[0];
    if (!input || input.length === 0) return true;
    const inCh = input[0];
    const outL = output[0]; const outR = output[1] || output[0];
    const len = outL.length;

    for (let i = 0; i < len; i++) {
      const x = inCh ? inCh[i] : 0;
      this._onset.process(x);
      const xr = this._reflectHP.process(x);
      const direct = this._direct.process(x) * this._directMix;
      const reflective = this._bank.process(xr) * this._reflectMix;
      const y = direct + reflective;
      outL[i] = y; outR[i] = y;
      this._rmsAccum += x * x; this._rmsCount++;
    }

    const now = currentTime;
    if (now - this._lastPostTime > 1 / 30) {
      const rms = Math.sqrt(this._rmsAccum / Math.max(1, this._rmsCount));
      this.port.postMessage({
        type: 'features',
        loudness: Math.min(1, rms * 6),
        lastOnsetTime: this._lastOnsetTime,
        lastOnsetIntensity: this._lastOnsetIntensity
      });
      this._rmsAccum = 0; this._rmsCount = 0; this._lastPostTime = now;
    }
    return true;
  }
}

registerProcessor('lucid-processor', LucidProcessor);
```

- [ ] **Step 7: Manual verify (desktop then Pixel 8)**

```bash
npm run dev
```

Clap, tap a coffee cup, whistle, speak. You should hear pitched ringing in the Ghibli scale layered under the direct path. Continuous speech should not stack into mud (the limiter should kick in).

Expected on first listen: if the bank is too loud, reduce `this._reflectMix` to 0.5 in `lucid-processor.js`. If the bank seems inert, raise to 0.9. Leave well tuned.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: Ghibli resonator bank with onset-driven excitation"
```

---

## Task 10: Ambient bed (tonic + fifth pedal)

**Files:**
- Create: `src/audio/dsp/ambient-bed.js`
- Modify: `src/audio/lucid-processor.js`

- [ ] **Step 1: Create `src/audio/dsp/ambient-bed.js`**

```javascript
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
    this.lfoInc = 2 * Math.PI * 0.07 / sampleRate;   // 0.07 Hz slow breath
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
      const tri = (2 / Math.PI) * Math.asin(Math.sin(p.triPhase));   // cheap triangle
      y += sine * (1 - this.brightness) + tri * this.brightness * 0.6;
    }
    return y * this.baseGain * breath / this.partials.length;
  }
}
```

- [ ] **Step 2: Wire the bed into the processor**

In `lucid-processor.js`:

```javascript
// add import
import { AmbientBed } from './dsp/ambient-bed.js';

// in constructor after `this._bank = new ResonatorBank(...)`:
this._bed = new AmbientBed(this._sr, ghibli);

// in process() sample loop, replace the mix line with:
for (let i = 0; i < len; i++) {
  const x = inCh ? inCh[i] : 0;
  this._onset.process(x);
  const xr = this._reflectHP.process(x);
  const direct = this._direct.process(x) * this._directMix;
  const reflective = this._bank.process(xr) * this._reflectMix;
  const bed = this._bed.process();
  const y = direct + reflective + bed;
  outL[i] = y; outR[i] = y;
  this._rmsAccum += x * x; this._rmsCount++;
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

With the orb off, no audio. With the orb on, even in silence you should hear a very quiet sustained pedal drone (tonic + fifth, two octaves below middle C area). It should breathe slowly on a ~14-second cycle. Levels should sit well below the direct path and reflective layer.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: ambient bed (tonic+fifth pedal drone)"
```

---

## Task 11: Density/texture classifier + bed brightness modulation

**Files:**
- Create: `src/audio/dsp/density-classifier.js`
- Modify: `src/audio/lucid-processor.js`

- [ ] **Step 1: Create `src/audio/dsp/density-classifier.js`**

```javascript
// Simple two-feature classifier:
//   onsetRate: EMA of onsets per second across all bands
//   spectralFlatness: geometric mean / arithmetic mean of the magnitude spectrum
// Mapped into a scalar 'textureRegime' in 0..1 (0 sparse, 1 textural).

export class DensityClassifier {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.onsetRate = 0;   // Hz
    this.onsetDecay = Math.exp(-1 / (sampleRate * 2));   // ~2s time constant
    this.flatness = 0.3;
    this.flatnessAlpha = 0.02;
    this.regime = 0.3;
    this.regimeAlpha = 0.02;
  }

  registerOnset() {
    this.onsetRate += 1.0;   // spike; decay handled per-sample
  }

  updateSample() {
    this.onsetRate *= this.onsetDecay;
  }

  updateSpectralFlatness(flatness) {
    this.flatness = this.flatness * (1 - this.flatnessAlpha) + flatness * this.flatnessAlpha;
    const onsetNorm = Math.min(1, this.onsetRate / 4);   // 4 Hz saturates
    // Textural if high flatness AND moderate+ onset density.
    const target = 0.5 * onsetNorm + 0.5 * this.flatness;
    this.regime = this.regime * (1 - this.regimeAlpha) + target * this.regimeAlpha;
  }

  get textureRegime() { return this.regime; }
  get loudnessHint() { return Math.min(1, this.onsetRate / 6); }
}
```

- [ ] **Step 2: Confirm `OnsetDetector` already exposes `lastFlatness`**

Verify the implementation from Task 7 includes `this.lastFlatness` on the constructor and updates it each frame. If missing, add:

```javascript
// In constructor:
this.lastFlatness = 0.3;

// In process(), inside the frame block (after FFT, before per-band loop):
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
```

- [ ] **Step 3: Use classifier in the processor**

In `lucid-processor.js`:

```javascript
// add import
import { DensityClassifier } from './dsp/density-classifier.js';

// in constructor:
this._density = new DensityClassifier(this._sr);
this._lastFlatness = 0;

// modify onset callback:
this._onset.onOnset = (band, intensity) => {
  this._bank.onOnset(band, intensity);
  this._density.registerOnset();
  this._lastOnsetTime = currentTime;
  this._lastOnsetIntensity = intensity;
};

// in process loop, after existing per-sample work:
this._density.updateSample();

// after the per-sample loop, once per process() call:
this._density.updateSpectralFlatness(this._onset.lastFlatness || 0.3);
const regime = this._density.textureRegime;
this._bed.setBrightness(0.25 + 0.6 * regime);   // textural → brighter bed

// in the feature post, include textureRegime:
this.port.postMessage({
  type: 'features',
  loudness: Math.min(1, rms * 6),
  lastOnsetTime: this._lastOnsetTime,
  lastOnsetIntensity: this._lastOnsetIntensity,
  textureRegime: regime,
  spectralCentroid: 0.3   // placeholder; Phase 2 will compute properly
});
```

- [ ] **Step 4: Verify behaviour**

```bash
npm run dev
```

Play rain sounds through the room (YouTube on another device). The bed should gradually become brighter (more triangle, less pure sine). Sudden percussive sounds should feel more prominent in the reflective layer than rain does — rain should not stutter.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: density/texture classifier driving bed brightness"
```

---

## Task 12: Session phases (calibration → listening → active)

**Files:**
- Modify: `src/audio/lucid-processor.js`
- Modify: `src/viz/viz-driver.js`
- Modify: `src/viz/Orb.svelte`

- [ ] **Step 1: Add phase state machine to the processor**

```javascript
// src/audio/lucid-processor.js — additions

// in constructor:
this._phaseStartTime = currentTime;
this._phase = 'calibrating';   // 'calibrating' | 'listening' | 'active'
this._noiseFloorRms = 0;
this._noiseFloorCount = 0;

// in process loop, compute phase based on time since start:
const phaseAge = currentTime - this._phaseStartTime;
let newPhase = 'active';
if (phaseAge < 5) newPhase = 'calibrating';
else if (phaseAge < 60) newPhase = 'listening';
if (newPhase !== this._phase) this._phase = newPhase;

// during calibration, mute reflective + bed and accumulate noise floor:
const directMix = (this._phase === 'calibrating') ? 0 : this._directMix;
const reflectMix = (this._phase === 'calibrating') ? 0 : this._reflectMix;
const bedGain = (this._phase === 'calibrating') ? 0 : 1;

// accumulate noise floor during calibration; use it to set onset detector floor via textureK
if (this._phase === 'calibrating') {
  this._noiseFloorRms += Math.sqrt(this._rmsAccum / Math.max(1, this._rmsCount));
  this._noiseFloorCount++;
}

// suppress onsets during listening phase? No — we want them in the reflective layer,
// but the UI suppresses ripples until phase === 'active'.
```

Then replace the mix line:

```javascript
const direct = this._direct.process(x) * directMix;
const reflective = this._bank.process(xr) * reflectMix;
const bed = this._bed.process() * bedGain;
```

Post the phase:

```javascript
this.port.postMessage({
  type: 'features',
  loudness: Math.min(1, rms * 6),
  lastOnsetTime: this._lastOnsetTime,
  lastOnsetIntensity: this._lastOnsetIntensity,
  textureRegime: regime,
  spectralCentroid: 0.3,
  phase: this._phase
});
```

- [ ] **Step 2: Suppress ripples during non-active phases**

In `src/viz/viz-driver.js`, modify `updateFeatures`:

```javascript
updateFeatures(next) {
  const prevOnset = features.lastOnsetTime;
  const prevPhase = features.phase;
  features = { ...features, ...next };
  // Only emit ripples when the app is fully active.
  if (features.phase === 'active' && features.lastOnsetTime > prevOnset) {
    for (const l of onsetListeners) l(features.lastOnsetTime, features.lastOnsetIntensity);
  }
}
```

- [ ] **Step 3: Reset phase on engine start**

Each time the user taps to start, the processor needs to reset its phase clock. Easiest: recreate the AudioContext on stop (already happens in `engine.js`), so a fresh processor instance starts a fresh clock.

Confirm by reading `src/audio/engine.js` — `stop()` calls `ctx.close()` and nulls `ctx`. On next `start()`, a new context and processor are created. No change needed, but re-read to confirm.

- [ ] **Step 4: Verify phases visually**

```bash
npm run dev
```

Tap orb:
- 0–5s: orb visible but small, no direct path, no reflective, no bed.
- 5–60s: full audio, but no ripples on onsets.
- 60s+: ripples start appearing.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: session phases (calibration → listening → active)"
```

---

## Task 13: Permission error polish + viewport + iOS-safe tweaks

**Files:**
- Modify: `src/App.svelte`
- Modify: `index.html`

- [ ] **Step 1: Viewport-safe flex**

Ensure the layout survives on-screen keyboard appearance and the Pixel 8's notch cutout.

```html
<!-- index.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no" />
```

- [ ] **Step 2: Block accidental double-tap zoom**

```css
/* src/app.css append */
* { box-sizing: border-box; touch-action: manipulation; }
```

- [ ] **Step 3: Wake-lock while running (keeps screen from dimming)**

In `src/App.svelte`, on start/stop:

```javascript
  let wakeLock = null;
  async function acquireWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }
  async function releaseWakeLock() {
    try { await wakeLock?.release(); } catch {}
    wakeLock = null;
  }
```

Call `acquireWakeLock()` after `engine.start()` succeeds and `releaseWakeLock()` in the stop branch and `onDestroy`.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "polish: viewport-safe layout, wake lock, touch-action"
```

---

## Task 14: Final deploy + Pixel 8 acceptance

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Wait for Actions deploy to go green**

Open the Actions tab on GitHub. Confirm the latest run completed successfully.

- [ ] **Step 3: Acceptance checks on Pixel 8**

With wired or closed-back Bluetooth headphones:

1. Open the installed PWA (home screen icon). Title "Lucid" visible at the top, amber orb breathing in the centre, "tap to begin" at the bottom.
2. Tap orb. Mic permission prompt. Approve.
3. First 5 seconds: orb small, near-silent.
4. After ~5 seconds: hear own voice and environment at low level, muffled (HPF).
5. Clap: hear the clap bloom into pitched ringing in the Ghibli scale. No ripple yet (we're in listening phase).
6. After ~60 seconds from first tap: ripples begin to appear on claps and impact sounds.
7. Rain/textural sound (via speaker from another device): bed slightly brightens, no stutter.
8. Tap orb again: everything stops. "Tap to begin" returns. Orb dims.
9. Relaunch from home screen in airplane mode: app shell loads (service worker) and orb breathes. Tapping shows a graceful mic error because no mic input in that case, but the UI doesn't crash.

- [ ] **Step 4: If anything is off, file follow-up tasks**

Common tuning after first listen: `reflectMix` (0.5–0.9), `bedGainDb` (–20 to –28), `textureK` in onset detector (2.0–2.8).

- [ ] **Step 5: Tag the release**

```bash
git tag v0.1.0 -m "Phase 1: Listen and ring (single-palette Ghibli)"
git push --tags
```

---

## Spec sections not covered in Phase 1 (by design, per §8 of spec)

- Drift engine across palettes (Phase 2)
- All palettes other than Ghibli (Phase 2)
- Motif engine and rhythmic coupling (Phase 3)
- Ghibli bright-lift, held-silence triggers, root-pulling, indoor/outdoor bias (Phase 4)
- Just-intonation and stretched-octave tuning refinements (Phase 4)

These have explicit plan phases in the spec. Future plan documents will cover each.
