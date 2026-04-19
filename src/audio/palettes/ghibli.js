export const ghibli = {
  id: 'ghibli',
  rootMidi: 60,
  scaleSemitones: [0, 2, 4, 5, 6, 7, 9, 11],
  scaleWeights:   [1.0, 0.9, 1.0, 0.9, 0.3, 1.0, 0.9, 0.95],
  octaveOffsets:  [-12, 0, 12],
  octaveWeights:  [0.6, 1.0, 0.8],
  q: 80,
  detuneCents: 7,
  secondaryBankGainDb: -15,
  sceneChords: [
    [0, 4, 7, 11],
    [5, 9, 12, 16],
    [9, 12, 16, 19],
    [2, 7, 9, 12]
  ],
  sceneChordCycle: [0, 1, 2, 3],
  bedPartials: [0, 7],
  bedRootOctaveOffset: -24,
  bedGainDb: -31
};

export function midiToHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
