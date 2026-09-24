// Car catalogue. 'concept' is the built-in car; the rest are licensed Sketchfab builds (CC-BY, credited in About).
// tire: material names on the wheel meshes (used to find the 4 road wheels), paint: body-colour materials,
// length: real overall length in metres (models are rescaled to it), front: which local axis the nose points along.
export const MODELS = [
  { id: 'concept', name: 'Halide Concept', file: 'CarConcept.glb', concept: true },
  { id: 'porsche930', name: 'Porsche 911 Turbo (930)', year: 1975, file: 'porsche930.glb', tire: ['930_tire'], paint: ['paint'], hide: ['material_0'], glass: { glass: 0.6 }, length: 4.29, front: '+z',
    credit: '"FREE 1975 Porsche 911 (930) Turbo" by Lionsharp Studios, CC-BY-4.0', url: 'https://sketchfab.com/3d-models/free-1975-porsche-911-930-turbo-8568d9d14a994b9cae59499f0dbed21e' },
  { id: 'bmwm3e30', name: 'BMW M3 (E30)', year: 1987, file: 'bmwm3e30.glb', tire: ['BMW_E30_M3_TIRE'], spin: ['BMW_E30_M3_RIM', 'Brake_Disc'], fixed: ['Brembo_Calipers', 'Logo_Plane'],
    paint: ['BMW_E30_M3_PAINT'], hide: [], glass: { BMW_E30_M3_WINDOWS: 0.55 }, length: 4.345, front: '+z',
    credit: '"[FREE] BMW M3 E30" by Martin Trafas, CC-BY-4.0', url: 'https://sketchfab.com/3d-models/free-bmw-m3-e30-ac3c7013434e403e8faff87948caf422' },
  { id: 'nsx90', name: 'Honda NSX', year: 1990, file: 'nsx90.glb', tire: ['Material.011'], paint: ['Material.003'], hide: [], hideNodes: ['Plane_11', 'Plane.001_13'], glass: { 'Material.004': 0.3 }, length: 4.405, front: '+z',
    credit: '"Honda NSX 1990" by Lexyc16, CC-BY-4.0', url: 'https://sketchfab.com/3d-models/honda-nsx-1990-1cc15628a00a4739a6b6c01128927c8d' },
  { id: 'sl300', name: 'Mercedes-Benz 300 SL Gullwing', year: 1954, file: 'sl300.glb', tire: ['tire'], merged: ['chrome', 'mid-chrome', 'black'], paint: ['main_color'], hide: [], glass: { Material: 0.88 }, length: 4.52, front: '+z',
    credit: '"Mercedes-Benz 300 SL Gullwing" by Lexyc16, CC-BY-4.0', url: 'https://sketchfab.com/3d-models/mercedes-benz-300-sl-gullwing-505241c829c540a4921533000736904e' },
  { id: 'c8', name: 'Chevrolet Corvette C8 Stingray', year: 2019, file: 'c8.glb', tire: ['Tire_Treads'], paint: ['Body_Color'], hide: [], glass: { Windshield: 0.82, Other_Glasses_than_Windshield: 0.18, Dark_Engine_View_Glass: 0.12 }, length: 4.63, front: '-z',
    credit: '"2019 Chevrolet Corvette C8 Stingray" by Hari, CC-BY-4.0', url: 'https://sketchfab.com/3d-models/2019-chevrolet-corvette-c8-stingray-790c40ccff6843eab0b7b4bd18421ff8' },
];
