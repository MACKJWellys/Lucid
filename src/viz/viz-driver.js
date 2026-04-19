const DEFAULT_FEATURES = {
  loudness: 0,
  spectralCentroid: 0.3,
  textureRegime: 0,
  currentPaletteId: 'ghibli',
  nextPaletteId: 'ghibli',
  crossfadeProgress: 0,
  lastOnsetTime: 0,
  lastOnsetIntensity: 0,
  lastMotifTime: 0,
  isActive: false,
  phase: 'idle'
};

export function createVizDriver() {
  let features = { ...DEFAULT_FEATURES };
  const onsetListeners = new Set();

  return {
    updateFeatures(next) {
      const prevOnset = features.lastOnsetTime;
      features = { ...features, ...next };
      if (features.phase === 'active' && features.lastOnsetTime > prevOnset) {
        for (const l of onsetListeners) l(features.lastOnsetTime, features.lastOnsetIntensity);
      }
    },
    setPhase(phase) { features = { ...features, phase }; },
    setActive(isActive) { features = { ...features, isActive }; },
    getFeatures() { return features; },
    onOnset(fn) { onsetListeners.add(fn); return () => onsetListeners.delete(fn); }
  };
}
