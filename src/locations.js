// CC0 HDRIs from Poly Haven (https://polyhaven.com).
// height: camera height of the original capture (m), projects the ground.
// sun: false when the brightest spot is not a real sun (dusk glow); soft: shadow blur multiplier for a near light (street lamp).
// u: horizontal panorama position (0..1) of a clear, flat spot for the car.
export const LOCATIONS = [
  { id: 'zwartkops_straight_afternoon', dust: '#8f8578', name: 'Zwartkops', place: 'Race circuit, Pretoria', height: 1.6, u: 0.31 },
  { id: 'goegap_road', dust: '#a57a5c', name: 'Goegap', place: 'Desert road, Namaqualand', height: 1.7, u: 0.462 },
  { id: 'wide_street_01', name: 'Boulevard', place: 'Wide street, midday', height: 1.7, u: 0.39 },
  { id: 'modern_evening_street', name: 'Glass District', place: 'City street, evening', height: 1.7, u: 0.595, sun: false },
  { id: 'cobblestone_street_night', name: 'Old Town', place: 'Cobblestones, night', height: 1.7, u: 0.46, soft: 3.5 },
  { id: 'mealie_road', dust: '#a88f6e', name: 'Mealie Road', place: 'Farm road, golden hour', height: 1.7, u: 0.62 },
  { id: 'lonely_road_afternoon', dust: '#a88f6e', name: 'Lonely Road', place: 'Farm road, late sun', height: 1.7, u: 0.0 },
  { id: 'german_town_street', name: 'Stadtrand', place: 'Town edge, midday', height: 1.7, u: 0.12 },
  { id: 'derelict_highway_noon', dust: '#9a9086', name: 'Old Highway', place: 'Cracked concrete, noon', height: 1.7, u: 0.58 },
  { id: 'rural_asphalt_road', name: 'Country Lane', place: 'Asphalt bend, summer', height: 1.7, u: 0.0 },
  { id: 'simons_town_harbour', name: "Simon's Town", place: 'Harbour quay, morning', height: 1.7, u: 0.97 },
  { id: 'horn-koppe_snow', name: 'Horn-Koppe', place: 'Snowfield, clear sky', height: 1.7, u: 0.2 },
  { id: 'shanghai_bund', name: 'The Bund', place: 'Riverside promenade, Shanghai, night', height: 1.7, u: 0.56, sun: false, iconic: true },
  { id: 'neuer_zollhof', name: 'Medienhafen', place: 'Gehry towers, Düsseldorf, dusk', height: 1.7, u: 0.2, iconic: true },
  { id: 'potsdamer_platz', name: 'Potsdamer Platz', place: 'City crossing, Berlin', height: 1.7, u: 0.6, iconic: true },
  { id: 'quattro_canti', name: 'Quattro Canti', place: 'Baroque crossroads, Palermo', height: 1.7, u: 0.4, iconic: true },
  { id: 'venice_sunset', name: 'Venice', place: 'Waterfront, sunset', height: 1.7, u: 0.85, iconic: true },
  { id: 'zwartkops_start_sunset', dust: '#8f8578', name: 'Zwartkops Grid', place: 'Start/finish straight, sunset', height: 1.7, u: 0.4, track: true },
  { id: 'zwartkops_curve_sunset', dust: '#8f8578', name: 'Zwartkops Hairpin', place: 'Track curve, sunset', height: 1.7, u: 0.88, track: true },
  { id: 'zwartkops_pit', name: 'Zwartkops Pit Lane', place: 'Covered pits, trackside', height: 1.7, u: 0.42, track: true },
  { id: 'skidpan', name: 'Skidpan', place: 'Test pad, stormy sky', height: 1.7, u: 0.3, track: true },
  { id: 'kart_club', name: 'Kart Club', place: 'Indoor kart track', height: 1.7, u: 0.52, track: true, sun: false },
  { id: 'piazza_san_marco', name: 'Piazza San Marco', place: 'Venice, morning', height: 1.7, u: 0.5, iconic: true },
  { id: 'st_peters_square_night', name: "St Peter's Square", place: 'Vatican City, night', height: 1.7, u: 0.27, sun: false, iconic: true },
  { id: 'colosseum', name: 'Colosseum', place: 'Rome, afternoon', height: 1.7, u: 0.85, iconic: true },
  { id: 'vatican_road', name: 'Vatican Road', place: 'Rome street, day', height: 1.7, u: 0.21, iconic: true },
  { id: 'signal_hill_sunrise', name: 'Signal Hill', place: 'Mountain road, Cape Town, sunrise', height: 1.7, u: 0.995, iconic: true },
  { id: 'shanghai_riverside', name: 'Pudong', place: 'Riverside, Shanghai, day', height: 1.7, u: 0.1, iconic: true },
];
export function bearingFromU(u) { const t = (u - 0.5) * 2 * Math.PI; return Math.atan2(-Math.cos(t), -Math.sin(t)); }
export const MAX_FOCAL = 135; // mm; past this an 8k panorama backdrop visibly softens
