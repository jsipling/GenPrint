import type { Generator } from './types'

export const spacerGenerator: Generator = {
  id: 'cylindrical-spacer',
  name: 'Cylindrical Spacer',
  description: 'A simple cylindrical spacer with a center hole',
  parameters: [
    {
      name: 'outer_diameter',
      label: 'Outer Diameter',
      min: 10,
      max: 100,
      default: 20,
      step: 1,
      unit: 'mm'
    },
    {
      name: 'inner_hole',
      label: 'Inner Hole Diameter',
      min: 2,
      max: 50,
      default: 5,
      step: 0.5,
      unit: 'mm'
    },
    {
      name: 'height',
      label: 'Height',
      min: 1,
      max: 50,
      default: 10,
      step: 1,
      unit: 'mm'
    }
  ],
  scadTemplate: (params) => `
outer_diameter = ${params['outer_diameter']};
inner_hole = ${params['inner_hole']};
height = ${params['height']};
$fn = 60;

difference() {
    cylinder(h=height, d=outer_diameter);
    translate([0,0,-1]) cylinder(h=height+2, d=inner_hole);
}
`
}
