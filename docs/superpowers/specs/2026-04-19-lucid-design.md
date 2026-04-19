# Lucid — Design Spec

**Status:** Approved 2026-04-19
**Target platform:** Progressive Web App, installed on Android (Pixel 8 primary device)
**Hosting:** GitHub Pages (static files only, no backend)

---

## 1. Concept

Lucid is a headphones-first mindfulness app that listens to the user's immediate environment through the phone microphone and transforms everyday sound into a musical, harmonically coherent experience in real time. It has no content library, no guided sessions, no modes, and almost no settings — a title, an orb that is also the on/off control, and the world heard more musically.

Four layers blend continuously:

- **Direct path.** Environment through the mic, lightly enhanced, always audible at low level. The mindfulness contract — "I am still here, in this place" — is never broken.
- **Reflective layer.** Every sound excites a bank of tuned resonators. Sounds ring, harmonize, cascade, decay. A till beep blooms into a chord; keys shimmer; a voice becomes a pitched formant wash where shape is audible but words are not.
- **Ambient bed.** A slow, quiet harmonic wash, driven by *features* of the environment (spectral centroid, loudness, texture density) rather than onsets. Always present, even in silence.
- **Event layer.** Rare musical motifs triggered by notable moments, fed through the same resonator bank so they emerge from the same sonic world as the environmental response.

Intelligence is musical, not analytical — the app does not classify sounds, it transforms them. Rarity and restraint are the active ingredients of wonder.

---

## 2. Platform & distribution

**Progressive Web App** on GitHub Pages, installed to Pixel 8 via Chrome's "Add to Home Screen" (WebAPK).

- Push to `main` → GitHub Actions deploys to Pages → next app open auto-fetches latest version.
- Service worker precaches app shell + WASM bundle for offline use.
- One URL is the install source, the update source, and the share source.

**Tech stack:**
- Svelte + Vite for the app shell and UI
- AudioWorklet for real-time DSP (runs on audio thread)
- Rust compiled to WebAssembly (via wasm-pack) for the DSP hot loops
- Canvas 2D for visualisation (WebGL is overkill here)
- Service Worker for offline
- GitHub Actions deploying to GitHub Pages

### Latency expectations

Pixel 8 + Chrome + AudioWorklet with `latencyHint: 'interactive'` gives ~20–30ms round-trip. Fine for environmental sounds; perceptible as a slight slapback for the user's own voice and footsteps.

**Mitigation:** high-pass the direct path above ~180Hz so voice fundamentals bleed through headphones naturally rather than through the DSP. If latency ever becomes a deal-breaker we can port the WASM core into a Kotlin + Oboe wrapper, but this is not in scope for v1.

### Mic input

`getUserMedia` is requested with:
- `echoCancellation: false`
- `noiseSuppression: false`
- `autoGainControl: false`

All three **must** be off or Chrome will remove the exact sounds we are trying to hear.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Thread (UI)                       │
│   Svelte app, Canvas 2D visualisation, service worker       │
└────────────────┬────────────────────────────────────────────┘
                 │ MessagePort (feature updates @ 30 Hz)
┌────────────────▼────────────────────────────────────────────┐
│              AudioWorklet Thread (DSP)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Rust → WASM core                                    │   │
│  │                                                      │   │
│  │  Mic ──┬─▶ Direct path (EQ + saturation) ──┐         │   │
│  │        ├─▶ Onset detector (multi-band) ─┐  │         │   │
│  │        ├─▶ Density/texture classifier   │  │         │   │
│  │        ▼       ▼                        ▼  │         │   │
│  │    Feature extractor ──▶ Ambient bed ──▶ Mix ──▶ Out │   │
│  │                                         ▲  │         │   │
│  │    Palette state ──▶ Resonator bank ────┘  │         │   │
│  │           └──────────▶ Motif engine ───────┘         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Module boundaries

- `audio-io` (JS) — mic capture via `AudioWorkletNode`, output to destination, permission flow.
- `dsp-core` (Rust/WASM) — direct path, onset detector, density classifier, feature extractor, resonator bank, bed synth, motif voice excitation, mixer. Pure and deterministic: no timers, no I/O, no heap allocations in the audio callback.
- `palette-engine` (JS in the worklet processor) — holds current palette, runs drift crossfade, selects motifs, rotates root. Sends small parameter updates into the Rust core (retune voice N to pitch P with Q q; excite voice N with amplitude a).
- `app-shell` (Svelte) — title, orb, ripple canvas, on/off state, service worker registration, mic permission flow.
- `viz-driver` (JS, main thread) — subscribes to feature stream, drives orb radius/colour and ripple emission.

**Why the split:** the Rust core is where CPU goes and where bugs are most expensive, so it must stay pure and allocation-free. The palette engine is intentionally in JS because it is stateful and event-driven, and easier to iterate on than Rust — it talks to the core through a narrow parameter API.

**Cross-thread data flow:** the worklet sends a compact feature struct to the main thread at ~30Hz:

```
{
  loudness, spectralCentroid, textureRegime,
  currentPaletteId, nextPaletteId, crossfadeProgress,
  lastOnsetTime, lastMotifTime, lastOnsetIntensity
}
```

The UI reads from this; it never reads audio buffers.

---

## 4. Audio engine

### Input chain

Mic → DC block → noise gate (threshold learned in first 3–5s) → two parallel taps:

- **Direct path:** gentle HPF at 180Hz, presence-band bell ~3kHz +2dB, soft-knee saturation at low drive, attenuated ~12dB below raw mic level. Always audible.
- **Reflective feed:** HPF at 180Hz, mild compression, feeds the resonator bank and analysis chain.

### Resonator bank

Parallel bank of **~24 voices** per palette (8 scale degrees × 3 octaves, configurable per palette). Each voice is a 2-pole resonant bandpass (biquad, direct-form-II-transposed), f0 at the voice pitch, Q from the palette (80–300 depending on character).

**Excitation:** the onset detector emits per-band impulses. Each impulse is distributed across the bank weighted by:
1. onset band's spectral proximity to voice pitch
2. palette's octave weighting

Soft transients excite fewer voices at lower amplitude than hard ones.

**Mud-prevention:**
1. *Per-voice ducking* — when a voice is already ringing loudly, a new excitation is attenuated in proportion.
2. *Bank-total amplitude limiter* — the sum-squared output of the bank feeds a slow-attack / medium-release gain reduction on the excitation bus. In dense environments new excitations get quieter, keeping the bank clear.

A secondary detuned bank (5–12 cents offset, palette-specific) runs in parallel at ~–6dB for natural chorusing.

### Onset detector

Multi-band, 4 bands (180–500Hz, 500–2kHz, 2–6kHz, 6kHz+). Each band runs spectral flux with adaptive threshold = moving median × k, where k backs off in textural regimes (suppresses rain-stutter) and tightens in sparse regimes. Per-band dead time ~40ms.

### Density/texture classifier

Two features at ~20Hz analysis rate:
- Onset rate (EMA of onsets/sec across all bands)
- Spectral flatness (smoothed geometric-over-arithmetic-mean ratio)

These map to a 2D continuous coordinate, smoothed ~2s. Every downstream parameter reads from the coordinate, not from onset events directly — so there are no mode switches, everything lerps.

### Ambient bed

Small set of sine + triangle partials (3–6, pitches drawn from the palette's pedal tones) summed at ~–24dB. Amplitudes modulated by spectral centroid (brightness), texture (density of partials), and loudness (envelope). Tonic+fifth pedal always present in Ghibli and Harmonic palettes. Never stops.

### Motif engine

Lives in `palette-engine` (JS inside the worklet). Triggers on: strong onset + high tonalness; held-silence ending; sparse regime with no motif fired in 45s+.

On trigger:
1. Pick a motif shape from the palette's library.
2. Choose starting pitch from scale degrees, biased toward the resonator voice currently most excited (so the motif continues the room's gesture).
3. Schedule note events. Notes don't have their own synth — they **excite specific voices in the resonator bank** so they sound like part of the same sonic world as the environment.

**Rhythmic coupling:** after the first motif note, open a 2.5s window. Each environmental onset inside the window advances the next motif note to its time. Up to 4 notes can couple; after that or window expiry, remaining notes fall back to internal timing (~200–400ms spacing, palette-specific distribution).

### Latency budget

- Direct path: AudioWorklet quantum (128 samples @ 48kHz = 2.67ms) + OS buffer. ~20–30ms round-trip on Pixel 8.
- Reflective: same plus resonator ring-up, perceptually instant once excited.
- Analysis / motif: 20Hz rate, 50ms jitter acceptable.

---

## 5. Palette & drift system

### Palette record

```
{
  id, scale, scaleWeights, tuning,
  octaveWeights, resonatorQ, detuneCents,
  decayCharacter, bedPartials, bedCharacter,
  motifLibrary,         // references to shapes
  couplingWindow,       // ms
  residency,            // min/max seconds in this palette
  driftBias,            // e.g. post-Ghibli preferred targets
  brightLift            // palette-specific; only Ghibli has it
}
```

Six palettes per the brief: **Ghibli**, **Hira**, **Dorian Drift**, **Harmonic**, **Pelog-Inspired**, **Messiaen Mode 3**. See brief for musical content; this spec codifies the data shape.

### Motif shape library

Separate from palettes — shapes are expressed in scale degrees + rhythmic ratios, not absolute pitches:

```
'ghibli-A': { degrees: [0, 1, 2, 4, 3], rhythms: [1, 1, 1.5, 1, 2], kind: 'stepwise-with-leap' }
```

Palettes reference which shapes they draw from. This is how "Dorian Drift inherits the Hisaishi contour without his harmony" — both palettes point at the same abstract shapes resolved against different scales.

### Drift engine

Runs on a 1Hz clock. State: `currentPalette`, `timeInPalette`, `sessionTime`, `driftGraph` (adjacency weights from pivot-tone overlap under current root).

Each tick checks whether drift should start:
- `timeInPalette` exceeds palette's residency range, OR
- a strong "interestingness" signal has held for 20s+ and suits a different regime.

Candidate palettes are scored by:
- pivot-tone overlap (main factor)
- post-palette bias (post-Ghibli prefers Hira / Messiaen)
- texture-regime bias (textural → long-decay palettes; eventful → articulate palettes)
- recent-visit penalty

Chosen palette crossfades over 30–45s: both banks are live, non-shared pitches in the outgoing bank ramp to zero, shared pitches sound in both. At end of crossfade the outgoing bank is retuned to the new palette.

**Root rotation:** every 3–4 transitions, the root rotates a fifth or minor third, so the whole harmonic world turns across a long session.

### Ghibli bright-lift

Small sub-state on the palette engine. Conditions: Ghibli active AND bed stable (loudness variance low for 5s+) AND strong trigger fires AND ≥90s since last lift. Action: retune one or two quiet voices to IV-of-IV / ♭VII, excite them with the trigger, retune back after ring-out. Max one lift per Ghibli segment.

---

## 6. UI layer

### Layout

Single full-screen view. Near-black background (~#0A0A0C). Centred, sparse.

```
          ┌─────────────────────────┐
          │                         │
          │         Lucid           │  thin weight, +2px tracking
          │                         │
          │        (   )            │  the orb, centred
          │      (   o   )          │  ripples expand from here
          │        (   )            │
          │                         │
          │      tap to begin       │  idle-only label
          └─────────────────────────┘
```

No menus, no icons, no settings page. Everything the user can do is in the orb.

### Orb

Canvas 2D. Radial gradient fill. Driven by `requestAnimationFrame`, independent of audio thread.

- **Radius** = base × (1 + 0.15 × smoothed_loudness). Breathes at ~0.3Hz even in silence.
- **Hue** = lerp between outgoing and incoming palette hue by `crossfadeProgress`:
  - Ghibli: warm amber (#E8B67A)
  - Hira: muted slate blue (#6B8AA8)
  - Dorian Drift: dusty green-grey (#8AA090)
  - Harmonic: silver-white (#D8DEE2)
  - Pelog: bronze (#B88A56)
  - Messiaen Mode 3: deep violet (#5C4A7A)
- **Saturation/luminance** = modulated by spectral centroid and texture; sparse environments sharpen the gradient, textural ones diffuse it.
- **Glow halo** outside the orb, same hue, softly bloomed.

### Ripples

On worklet onset signal, emit an expanding ring from orb centre, fading from ~50% palette colour to transparent, growing from orb radius to ~2× orb radius over ~1.2s. Motif events emit a brighter ripple with ~2.5s life. Max ~4 concurrent; oldest pruned.

Ripple initial opacity tracks onset intensity — quiet rustles produce faint ripples, strong transients clear ones. Makes the visualisation feel like it is hearing what you are hearing.

### State & controls

- **Tap orb = toggle on/off.** Only interaction.
- *Off:* orb dimmed ~40%, breathing slow, "tap to begin" visible.
- *Starting:* orb brightens over ~1s, label fades.
- *Calibrating (0–5s):* small and dim.
- *Listening phase (5–60s):* normal; ripples suppressed.
- *Fully active (60s+):* ripples enabled; motif engine and drift engine eligible.

### Permissions

First tap-to-begin requests mic with the three flags off. If denied, show "Lucid needs to hear the world. Tap to allow microphone." in place of the label; retry on next tap.

### Typography

Single thin sans (Inter Thin or system safe). "Lucid" ~32pt, letter-spacing +2px. Label ~14pt, 60% opacity.

### Service worker

Workbox-style precache of app shell + WASM bundle. Runtime fetch-while-revalidate on shell so updates arrive silently on second open after a deploy.

---

## 7. Session shape

- **0–5s:** silent calibration. Direct path muted. Noise floor and gain learned. Orb small, slow breath.
- **5–60s:** listening phase. Direct + reflective active. No motifs, no drift. Ripples suppressed. Title faded in.
- **60s+:** motif engine and drift engine eligible. Ripples enabled.

Thresholds live in a single config file, easy to tune once we are hearing it.

No session end is defined — the user removes their headphones when ready.

---

## 8. Build phasing

Each phase is a working, installable app on your phone. Each ends with a deploy to GitHub Pages.

### Phase 1 — "Listen and ring"

Prove the core. One palette (Ghibli), no drift, no motifs.

- PWA scaffold (Svelte + Vite, service worker, GitHub Pages, Actions deploy)
- AudioWorklet + Rust/WASM core: direct path, HPF, onset detector, 24-voice resonator bank, Ghibli palette, simple bed (tonic+fifth pedal)
- Basic density/texture classifier driving bed brightness
- Orb + ripples + title + tap-to-toggle
- Calibration and listening-phase timing

**Definition of done:** installable PWA on Pixel 8 that makes your environment musical in the Ghibli palette.

### Phase 2 — "The world turns"

All six palettes + drift engine.

- Palette records + motif-shape library scaffold (shapes defined, not yet firing)
- Drift engine with pivot-tone graph, crossfade, post-Ghibli cleansing bias, texture-regime weighting
- Root rotation across long sessions
- Orb colour transitions follow palette crossfade

### Phase 3 — "Motifs emerge"

Motif engine and rhythmic coupling.

- Full motif-shape library per palette
- Motif triggers (strong-event, held-silence-ending, sparse-no-motif)
- Scale-degree starting pitch driven by most-excited voice
- Rhythmic coupling window + fallback timing
- Motif notes excite resonator voices (no separate synth)

### Phase 4 — "Rarity and restraint"

High-character, low-frequency polish.

- Ghibli bright-lift events with their own gating
- Held-silence detection feeding motif triggers
- Sustained low-frequency root-pulling (engine hum → tonal ground)
- Indoor/outdoor responsiveness bias from decay-character
- Tuning polish: stretched octaves, per-palette just intonation

---

## 9. Non-goals

Explicitly out of scope, forever:

- Session persistence, streaks, stats, history
- Any server component (the app is static files only)
- Analytics or telemetry
- Content library (no recorded sounds, no generative music without the environment as source)
- User-facing settings for scale, tuning, Q, responsiveness, volume
- Guided sessions, timers, meditation scripts
- Sound classification or environmental awareness
- Noise-cancellation or hearing-enhancement features
- Cross-platform native (iOS, desktop) — the PWA is the target

---

## 10. Open questions (to resolve during Phase 1)

- Exact base radius and breathing amplitude of the orb (tune once we see it on a Pixel 8 at arm's length).
- Final hex values for palette hues (tune once we see them on AMOLED).
- Whether AudioWorklet + WASM on Pixel 8 Chrome can sustain 24 voices × 2 banks (48 biquads) without audible glitches — measure in Phase 1; if not, reduce to 16 voices per bank.
- Whether the Pixel 8's default Chrome echo handling actually respects `echoCancellation: false` (some platforms lie). Verify in Phase 1 with a speaker-to-mic loopback test.
