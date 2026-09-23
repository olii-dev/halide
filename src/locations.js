// CC0 HDRIs from Poly Haven (https://polyhaven.com).
// height: camera height of the original capture (m), projects the ground.
// u: horizontal panorama position (0..1) of a clear, flat spot for the car.
export const LOCATIONS = [
  { id: 'zwartkops_straight_afternoon', name: 'Zwartkops', place: 'Race circuit, Pretoria', height: 1.6, u: 0.31 },
  { id: 'goegap_road', name: 'Goegap', place: 'Desert road, Namaqualand', height: 1.7, u: 0.462 },
  { id: 'wide_street_01', name: 'Boulevard', place: 'Wide street, midday', height: 1.7, u: 0.39 },
  { id: 'modern_evening_street', name: 'Glass District', place: 'City street, evening', height: 1.7, u: 0.54 },
  { id: 'cobblestone_street_night', name: 'Old Town', place: 'Cobblestones, night', height: 1.7, u: 0.46 },
  { id: 'mealie_road', name: 'Mealie Road', place: 'Farm road, golden hour', height: 1.7, u: 0.62 },
];
export function bearingFromU(u) { const t = (u - 0.5) * 2 * Math.PI; return Math.atan2(-Math.cos(t), -Math.sin(t)); }
export const MAX_FOCAL = 135; // mm; past this an 8k panorama backdrop visibly softens
