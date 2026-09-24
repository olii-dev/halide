// period factory colours per model. Names and codes from published paint lists (Porsche 911 1978-83 colour
// charts, BMW E30 M3 paint code tables, Acura NSX code lists, the 2020 Corvette brochure, Mercedes DB codes
// for the 300 SL; C8 names from the 2020 Corvette brochure, codes left out). Hex values are visual approximations of each colour, not measured paint data.
// type: solid | metallic | pearl | tintcoat, which sets the material (see paint.js)
const P = (model, list) => list.map(([name, code, color, type]) => ({ id: `${model}:${code || name.toLowerCase().replace(/[^a-z]+/g, '-')}`, name, code, color, type, model }));
export const FACTORY_PAINTS = {
  porsche930: P('porsche930', [
    ['Guards Red', 'L027', '#b3121b', 'solid'], ['Grand Prix White', 'L908', '#ecebe4', 'solid'], ['Black', 'L700', '#0a0a0b', 'solid'],
    ['Continental Orange', 'L107', '#e0591c', 'solid'], ['Minerva Blue Metallic', 'L304', '#1d2b4f', 'metallic'], ['Petrol Blue Metallic', 'L376', '#1f4a55', 'metallic'],
    ['Oak Green Metallic', 'L265', '#2c3a2a', 'metallic'], ['Silver Metallic', 'L936', '#a7aaad', 'metallic'],
  ]),
  bmwm3e30: P('bmwm3e30', [
    ['Alpine White', '146', '#eeede6', 'solid'], ['Henna Red', '052', '#a3161c', 'solid'], ['Cinnabar Red', '138', '#b01d1c', 'solid'],
    ['Brilliant Red', '308', '#bc1b1f', 'solid'], ['Misano Red', '236', '#c8191e', 'pearl'], ['Diamond Black Metallic', '181', '#15161a', 'metallic'],
    ['Salmon Silver Metallic', '203', '#b4aca4', 'metallic'], ['Sterling Silver Metallic', '244', '#a9adb0', 'metallic'],
    ['Nogaro Silver Metallic', '243', '#9ea2a6', 'metallic'], ['Sebring Grey Metallic', '229', '#5d6166', 'metallic'],
  ]),
  nsx90: P('nsx90', [
    ['Formula Red', 'R77', '#c2141b', 'solid'], ['Berlina Black', 'NH547', '#0b0b0c', 'solid'],
    ['Sebring Silver Metallic', 'NH552M', '#aeb1b3', 'metallic'], ['Grand Prix White', 'NH565', '#efeee8', 'solid'],
  ]),
  sl300: P('sl300', [
    ['Silver Grey Metallic', 'DB180', '#b3b6b6', 'metallic'], ['White', 'DB050', '#e9e7df', 'solid'], ['Fire Engine Red', 'DB534', '#ad1a1c', 'solid'],
    ['Black', 'DB040', '#0b0b0c', 'solid'], ['Graphite Grey', 'DB190', '#44474a', 'metallic'], ['Ivory', 'DB608', '#e6dcc2', 'solid'],
    ['White Grey', 'DB158', '#cfccc2', 'solid'], ['Light Blue', 'DB334', '#9bb3c7', 'solid'], ['Strawberry Red', 'DB543', '#b8262c', 'solid'],
    ['Blue Grey', 'DB166', '#6d7c88', 'solid'], ['Blue Metallic', 'DB396', '#2a3d63', 'metallic'], ['Anthracite Metallic', 'DB172', '#35383b', 'metallic'],
  ]),
  c8: P('c8', [
    ['Torch Red', null, '#c8102e', 'solid'], ['Arctic White', null, '#f0f0ee', 'solid'], ['Black', null, '#0a0a0b', 'solid'],
    ['Rapid Blue', null, '#1463b8', 'solid'], ['Accelerate Yellow Metallic', null, '#f2c300', 'metallic'], ['Sebring Orange Tintcoat', null, '#d2530f', 'tintcoat'],
    ['Long Beach Red Metallic Tintcoat', null, '#8e1017', 'tintcoat'], ['Elkhart Lake Blue Metallic', null, '#1b3f86', 'metallic'],
    ['Zeus Bronze Metallic', null, '#5c4632', 'metallic'], ['Shadow Gray Metallic', null, '#4b4e52', 'metallic'],
    ['Ceramic Matrix Gray Metallic', null, '#8e9296', 'metallic'], ['Blade Silver Metallic', null, '#b7babd', 'metallic'],
  ]),
};
export const ALL_FACTORY = Object.values(FACTORY_PAINTS).flat();
