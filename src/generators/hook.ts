import type { Generator, ParameterValues } from './types'

export const hookGenerator: Generator = {
  id: 'hook',
  name: 'Hook',
  description: 'A wall-mounted hook for hanging items.',
  parameters: [
    {
      type: 'number',
      name: 'width',
      label: 'Width',
      min: 8, max: 50, default: 15, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hook_depth',
      label: 'Hook Depth',
      min: 10, max: 80, default: 25, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hook_height',
      label: 'Hook Height',
      min: 15, max: 100, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'thickness',
      label: 'Thickness',
      min: 3, max: 15, default: 5, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hole_diameter',
      label: 'Mounting Hole',
      min: 0, max: 8, default: 4, step: 0.5, unit: 'mm'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const width = Number(params['width'])
    const hookDepth = Number(params['hook_depth'])
    const hookHeight = Number(params['hook_height'])
    const thickness = Number(params['thickness'])
    const holeD = Number(params['hole_diameter'])

    // Calculate mounting plate height (taller than hook for screw hole)
    const plateHeight = hookHeight + 15

    return `
// Dimensions
width = ${width};
hook_depth = ${hookDepth};
hook_height = ${hookHeight};
thickness = ${thickness};
hole_d = ${holeD};
plate_height = ${plateHeight};

$fn = 32;

difference() {
    // Main hook shape - extruded J profile
    linear_extrude(width)
    polygon(points=[
        // Back plate
        [0, 0],
        [thickness, 0],
        // Bottom of hook (curves out)
        [thickness, hook_height - thickness],
        [hook_depth, hook_height - thickness],
        // Up the front of hook
        [hook_depth, hook_height],
        // Lip at top of hook
        [hook_depth - thickness * 2, hook_height],
        [hook_depth - thickness * 2, hook_height - thickness + thickness],
        // Inner curve back
        [thickness, hook_height],
        [thickness, plate_height],
        // Top of back plate
        [0, plate_height]
    ]);

    // Mounting hole
    if (hole_d > 0) {
        translate([-0.1, plate_height - 10, width / 2])
            rotate([0, 90, 0])
            cylinder(h = thickness + 0.2, d = hole_d);
    }
}
`
  }
}
