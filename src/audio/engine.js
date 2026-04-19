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

  function onFeatures(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { start, stop, onFeatures, isRunning() { return !!ctx; } };
}
