// Car catalogue. 'concept' is the built-in car; the rest are licensed Sketchfab builds (CC-BY, credited in About).
// tire: material names on the wheel meshes (used to find the 4 road wheels), paint: body-colour materials,
// length: real overall length in metres (models are rescaled to it), front: which local axis the nose points along.
export const MODELS = [
  { id: 'concept', name: 'Halide Concept', file: 'CarConcept.glb', concept: true },
  { id: 'porsche930', name: 'Porsche 911 Turbo (930)', year: 1975, file: 'porsche930.glb', tire: ['930_tire'], paint: ['paint'], hide: [], length: 4.29, front: '+z',
    credit: '"FREE 1975 Porsche 911 (930) Turbo" by Lionsharp Studios, CC-BY-4.0', url: 'https://sketchfab.com/3d-models/free-1975-porsche-911-930-turbo-8568d9d14a994b9cae59499f0dbed21e' },
];
