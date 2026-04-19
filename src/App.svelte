<script>
  import { onDestroy } from 'svelte';
  import Orb from './viz/Orb.svelte';
  import { createVizDriver } from './viz/viz-driver.js';
  import { createEngine } from './audio/engine.js';

  const driver = createVizDriver();
  const engine = createEngine();

  let isActive = false;
  let hint = 'tap to begin';

  const offFeatures = engine.onFeatures((f) => driver.updateFeatures(f));

  async function toggle() {
    if (!isActive) {
      try {
        hint = 'tap to begin';
        await engine.start();
        isActive = true;
        driver.setActive(true);
      } catch (err) {
        console.error('engine start failed', err);
        hint = 'Lucid needs to hear the world. Tap to allow microphone.';
      }
    } else {
      await engine.stop();
      isActive = false;
      driver.setActive(false);
      driver.setPhase('idle');
    }
  }

  onDestroy(() => {
    offFeatures();
    engine.stop();
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
    <footer class="hint">{hint}</footer>
  {/if}
</main>

<style>
  main { display: grid; grid-template-rows: 28% 1fr 16%; height: 100%; overflow: hidden; }
  header { display: flex; align-items: center; justify-content: center; }
  h1 { font-weight: 200; letter-spacing: 2px; font-size: 32px; margin: 0; color: #E8E8EC; }
  .orb-wrap { min-height: 0; }
  .hint { display: flex; align-items: center; justify-content: center; font-size: 14px; opacity: 0.6; padding: 0 24px; text-align: center; }
</style>
