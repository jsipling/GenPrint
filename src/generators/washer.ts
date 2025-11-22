import type { Generator, ParameterValues } from './types'

export const washerGenerator: Generator = {
  id: 'washer',
  name: 'Washer',
  description: 'A flat ring washer with configurable dimensions.',
  parameters: [
    {
      type: 'number',
      name: 'outer_diameter',
      label: 'Outer Diameter',
      min: 4, max: 100, default: 12, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'inner_diameter',
      label: 'Inner Diameter',
      min: 1, max: 90, default: 6, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'thickness',
      label: 'Thickness',
      min: 0.4, max: 10, default: 1.5, step: 0.1, unit: 'mm'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const outerD = Number(params['outer_diameter'])
    const innerD = Number(params['inner_diameter'])
    const thickness = Number(params['thickness'])

    // Ensure inner diameter leaves at least 1mm wall
    const maxInner = outerD - 2
    const safeInnerD = Math.min(innerD, maxInner)

    return `
// Dimensions
outer_d = ${outerD};
inner_d = ${safeInnerD};
thickness = ${thickness};

$fn = max(32, outer_d * 3);

difference() {
    cylinder(h = thickness, d = outer_d);
    translate([0, 0, -0.1])
        cylinder(h = thickness + 0.2, d = inner_d);
}
`
  }
}
