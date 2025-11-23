import type { ScadGenerator, ParameterValues, QualityLevel } from './types'
import { getQualityFn } from './types'

export const hookGenerator: ScadGenerator = {
  id: 'hook',
  name: 'Hook',
  description: 'A simple wall hook for hanging items',
  parameters: [
    {
      type: 'number',
      name: 'width',
      label: 'Width',
      min: 10, max: 50, default: 15, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hook_depth',
      label: 'Hook Depth',
      min: 15, max: 60, default: 25, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hook_height',
      label: 'Hook Height',
      min: 20, max: 80, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'thickness',
      label: 'Thickness',
      min: 3, max: 10, default: 5, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hole_diameter',
      label: 'Hole Diameter',
      min: 0, max: 8, default: 4, step: 0.5, unit: 'mm'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const width = Number(params['width'])
    const hookDepth = Number(params['hook_depth'])
    const hookHeight = Number(params['hook_height'])
    const thickness = Number(params['thickness'])
    const holeDiameter = Number(params['hole_diameter'])
    const quality = (params['_quality'] as QualityLevel) || 'normal'

    return `// Parameters
width = ${width};
hook_depth = ${hookDepth};
hook_height = ${hookHeight};
thickness = ${thickness};
hole_d = ${holeDiameter};
${getQualityFn(quality)}

difference() {
    linear_extrude(height=width)
        polygon(points=[
            [0, 0],
            [0, hook_height],
            [thickness, hook_height],
            [thickness, thickness],
            [hook_depth, thickness],
            [hook_depth, 0]
        ]);

    // Mounting hole
    if (hole_d > 0) {
        translate([thickness/2, hook_height - thickness*1.5, width/2])
            rotate([0, 90, 0])
                cylinder(h=thickness*2, d=hole_d, center=true);
    }
}
`
  }
}
