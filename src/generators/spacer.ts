import type { Generator, ParameterValues } from './types'

// Minimum wall thickness (1mm on each side = 2mm total)
const MIN_WALL_THICKNESS = 2

export const spacerGenerator: Generator = {
  id: 'cylindrical-spacer',
  name: 'Cylindrical Spacer',
  description: 'A simple cylindrical spacer with a center hole',
  parameters: [
    {
      type: 'number',
      name: 'outer_diameter',
      label: 'Outer Diameter',
      min: 10,
      max: 100,
      default: 20,
      step: 1,
      unit: 'mm'
    },
    {
      type: 'number',
      name: 'inner_hole',
      label: 'Inner Hole Diameter',
      min: 2,
      max: 50,
      default: 5,
      step: 0.5,
      unit: 'mm'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 1,
      max: 50,
      default: 10,
      step: 1,
      unit: 'mm'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const outerDiameter = Number(params['outer_diameter'])
    const height = Number(params['height'])
    // Clamp inner_hole to ensure minimum wall thickness
    const maxInnerHole = outerDiameter - MIN_WALL_THICKNESS
    const innerHole = Math.min(Number(params['inner_hole']), maxInnerHole)

    return `
outer_diameter = ${outerDiameter};
inner_hole = ${innerHole};
height = ${height};
$fn = 60;

difference() {
    cylinder(h=height, d=outer_diameter);
    translate([0,0,-1]) cylinder(h=height+2, d=inner_hole);
}
`
  }
}
