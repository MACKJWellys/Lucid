# Lucid — Design Brief

## Concept

Lucid is a headphones-first mindfulness app that listens to the user's immediate environment through their phone or earbud microphone and transforms everyday sound into a musical, harmonically coherent experience in real time. It has no content library, no guided sessions, no modes, and no settings. The user puts on headphones, opens the app, and the world becomes quietly musical — a till beep, a fragment of conversation, a footstep, a bird, rain on a window, all become part of a slowly evolving sonic world that responds to what is actually around them.

The goal is not to drown out reality or layer music on top of it, but to make the user hear their environment *more*. Lucid should feel as though the world has always been this musical and the app is only making it audible.

---

## Core Experience

The user hears four layers blended continuously at all times:

**Direct path.** The environment through the mic, lightly enhanced with a small presence-band lift and gentle saturation, always audible at low level. The user is never deafened; the mindfulness contract — "I am still here, in this place" — is never broken.

**Reflective layer.** Every sound in the environment excites a bank of tuned resonators across multiple octaves. Sounds ring out, harmonize, cascade through delays, and decay back into silence. A scanner beep blooms into a pitched chord; keys jangle and shimmer; a voice becomes a pitched formant wash where the shape of speech is audible but the words are not. This is the layer where the world becomes musical.

**Ambient bed.** A slow, quiet harmonic wash running underneath everything, driven by *features* of the environment (spectral centroid, loudness, texture density) rather than its onsets. Brightness, density, and motion track these features. In silence, the bed is still there, evolving; the environment never feels absent.

**Event layer.** Rare, musical motifs triggered by notable moments — a strong transient, an unusually tonal input, a held silence ending. Motifs are short phrased shapes (3–7 notes) drawn from the current palette, fed through the same resonator bank so they emerge from the same sonic world as the environmental response. They are sparse by design.

---

## The Harmonic World

Lucid cycles slowly through a library of six palettes. Each palette carries its own pitch set, tuning, octave distribution, resonator Q, motif library, and ambient bed character. The app lives in one palette at a time and drifts between them every 3–6 minutes via shared pivot tones, so transitions are seamless — the user feels a mood shift without consciously registering a key change.

**Ghibli.** Major scale with a sparing raised fourth as colour tone (e.g. C D E F F♯ G A B, with F♯ weighted less in the resonator bank). Just intonation on the tonic. Medium-long, piano-like decays. Mid-register octave weighting for intimate, piano-room intimacy. Motifs are stepwise shapes with a single leap (the Hisaishi gesture — step, step, leap, step down). The ambient bed always carries a very quiet sustained tonic-plus-fifth pedal drone, breathing slowly. Rare "bright lift" events (minimum 90 seconds apart, only when bed is harmonically stable and a strong trigger fires) momentarily re-tune one or two resonator voices to a IV-of-IV or ♭VII tone for the duration of one environmental ring-out, then return to diatonic. Shorter residency time than other palettes (2–4 minutes): this is an arrival palette, not a resting one.

**Hira.** Hirajoshi scale (1, ♭2, 4, 5, ♭6). Medium-short plucked decays, koto lineage. Reflective and slightly shadowed. Motifs are small cellular gestures — a sighing ♭2→1, an ascending 1-4-5 call.

**Dorian Drift.** Dorian mode (1, 2, ♭3, 4, 5, 6, ♭7). Balanced octave distribution, medium Q. Wistful without being mournful. Walking-friendly. Motifs inherit the Ghibli shape principle — stepwise with a single leap — giving this palette a Hisaishi *contour* without his harmony.

**Harmonic.** Pitches drawn directly from the harmonic series (partials 4, 5, 6, 7, 8, 9, 10 of a fundamental), in pure just intonation. Long bell-like decays (Q ~200). Organic, vocal, slightly bluesy from the harmonic seventh. Carries a sustained pedal drone, borrowed from the Ghibli palette technique.

**Pelog-Inspired.** Five-note set inspired by (not literal) Balinese gamelan tuning. Secondary resonator bank detuned 5–15 cents against primary in alternating directions for bronze, shimmering character. Medium Q.

**Messiaen Mode 3.** Nine-note symmetric scale (1, 2, ♭3, 3, ♯4, 5, ♭6, 6, 7). Very long drone-pad decays (Q 300+). No tonal center — it hovers. Used sparingly as a deep stop in the drift graph.

**Drift mechanics.** Palettes are connected by a graph weighted on pivot-tone overlap. Transitions crossfade over 30–45 seconds, during which shared tones sound in both palettes and non-shared tones fade. After a Ghibli segment, drift biases toward tonally distant palettes (Hira, Messiaen Mode 3) to cleanse the ear before returning. Late in long sessions, drift biases toward the deeper palettes (Harmonic, Messiaen Mode 3). The root note itself rotates slowly across longer sessions (a fifth or minor third every 3–4 palette changes) so the whole harmonic world turns.

**Tuning.** Never pure equal temperament. Octaves stretched 4–8 cents wider than 2:1. Just intonation in Harmonic and Ghibli palettes where pitches lock cleanly. Secondary resonator banks detuned 5–12 cents against primary for natural chorusing.

---

## Rhythmic Coupling

When a strong event triggers a motif, subsequent notes of the motif align with the next 2–4 environmental onsets rather than firing on an internal clock, creating brief moments where the environment itself appears to be playing a melody. The coupling window closes after 2–4 notes; irregular onset streams fall back to the motif's natural timing. This effect is rare and high-value — it should land a handful of times per session and feel like a coincidence the user notices. It is especially effective in the Ghibli and Dorian Drift palettes where motifs have directional melodic shape.

---

## Environmental Adaptation

A continuous density/texture classifier (onset rate + spectral flatness, 2–3s windowing) positions the app on a smooth gradient between three regimes, with no mode switching:

- **Sparse** (quiet room, nature between bird calls): bed leads, long tails, motifs more frequent, individual events ring clearly.
- **Eventful** (supermarket, busy birdsong, urban walk): reflective layer leads, tails compress to prevent mud, motifs sparse.
- **Textural** (rain, crowd murmur, cafe): reflective layer dampens, textural features route to bed parameters, onset triggering suppressed so rain does not become stutter.

Multi-band onset detection with adaptive per-band thresholds (moving median) ensures both loud transients and quiet rustles register. A high-pass around 180Hz is applied to the reflective layer's input only (not the direct path), so wind rumble and vehicle drone don't excite resonators without losing the felt presence of the environment. Sustained low-frequency peaks can optionally pull the bed's root toward the environment, letting engine hum or fridge drone become the tonal ground rather than fight it.

Responsiveness biases lower outdoors than indoors by default, detected from the decay character of incoming transients. Nature is already musical and needs space; indoor environments benefit from more transformation.

The density/texture classifier also weights palette drift: textural environments pull gently toward long-decay palettes (Harmonic, Messiaen Mode 3); eventful environments pull toward articulate palettes (Hira, Pelog-Inspired). This is a nudge, not a rule.

---

## Session Shape

The first 3–5 seconds of a session are silent calibration: noise floor and gain are learned. The following 55–85 seconds are a listening phase — direct path and resonator bank only, no motifs, no palette drift. This establishes the contract that the user is listening *with* the app, not being performed to. After this, motifs begin to appear and palette drift activates.

There is no session end defined by the app. The user removes their headphones when ready.

---

## Principles

Stay generous on the input — respond to everything, let the musical layer decide what emerges. Intelligence is musical, not analytical; do not classify sounds, transform them.

Never make the user feel deafened — the direct path is always present, even quietly.

Silence is a feature, not a failure — the bed carries through quiet, and held silences are musical events in themselves.

One responsiveness control, not a volume control — the user shapes how much the world is transformed, never how loud it is.

**The sense of wonder comes from rarity and restraint, not from constant beauty.** When tempted to add more of any high-character element (Ghibli lifts, motifs, chromatic colour), add less. Rarity is the active ingredient.

No settings. No modes. No content library. Just the world, heard more fully.

---

## Non-Goals

Lucid is explicitly not:

- A music generation app or generative ambient composer (the environment is the generative source)
- A soundscape app with pre-recorded content
- A meditation app with guided sessions, timers, or streaks
- A hearing-enhancement or noise-cancellation tool
- A sound-classification or environmental-awareness app
- A configurable instrument (no user-facing scale/tuning/FX controls)

---

## Handoff Notes for Technical Planning

Priority areas where the audio-engineering design will most affect user experience:

1. **Multi-band adaptive onset detection.** The single biggest determinant of whether the app feels alive everywhere. Must register supermarket beeps and quiet rustles alike without false-triggering on rain.
2. **Resonator bank architecture.** Modal filter banks with per-palette Q, octave distribution, secondary-bank detuning, and just-intonation support where required. Must handle live retuning for Ghibli bright-lift events.
3. **Density/texture classifier.** Continuous, low-cost, smooth output — drives the most real-time behavioural modulation in the app.
4. **Motif engine with rhythmic coupling.** State machine for motif selection, scale-degree starting pitch, palette-aware shape library, and the onset-coupling window logic.
5. **Palette drift engine.** Graph of palettes, pivot-tone crossfades, weighting by session time and environmental regime, post-Ghibli cleansing bias.
6. **Latency budget.** Direct path must be minimal-latency; reflective layer can tolerate somewhat more; spectral features (if used for classifier or bed) can be analysis-rate. Overall direct-path latency should stay below the threshold where the user feels disconnected from their own footsteps and voice.
7. **Calibration and startup.** First-5-second noise-floor learning, first-60-to-90-second listening phase, gentle introduction of motifs and drift.
