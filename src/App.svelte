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
  .hint { display: flex; align-items: center; justify-content: center; font-size: 14px; opacity: 0.6; padding: 0 24px; text-align: center; }
</style>
