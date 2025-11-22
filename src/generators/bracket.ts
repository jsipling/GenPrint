import type { Generator, ParameterValues } from './types'

export const bracketGenerator: Generator = {
  id: 'bracket',
  name: 'Bracket',
  description: 'An L-bracket with mounting holes for corner reinforcement.',
  parameters: [
    {
      type: 'number',
      name: 'width',
      label: 'Width',
      min: 10, max: 100, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'arm_length',
      label: 'Arm Length',
      min: 15, max: 150, default: 40, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'thickness',
      label: 'Thickness',
      min: 2, max: 15, default: 4, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hole_diameter',
      label: 'Hole Diameter',
      min: 2, max: 12, default: 5, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'fillet_radius',
      label: 'Fillet Radius',
      min: 0, max: 20, default: 5, step: 1, unit: 'mm'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const width = Number(params['width'])
    const armLength = Number(params['arm_length'])
    const thickness = Number(params['thickness'])
    const holeD = Number(params['hole_diameter'])
    const fillet = Number(params['fillet_radius'])

    return `
// Dimensions
width = ${width};
arm_length = ${armLength};
thickness = ${thickness};
hole_d = ${holeD};
fillet_r = ${fillet};

$fn = 32;

difference() {
    union() {
        // Horizontal arm
        cube([arm_length, width, thickness]);

        // Vertical arm
        cube([thickness, width, arm_length]);

        // Fillet for strength
        if (fillet_r > 0) {
            translate([thickness, 0, thickness])
            rotate([-90, 0, 0])
            linear_extrude(width)
            difference() {
                square([fillet_r, fillet_r]);
                translate([fillet_r, fillet_r])
                    circle(r = fillet_r);
            }
        }
    }

    // Holes in horizontal arm
    hole_offset = arm_length / 2;
    translate([hole_offset, width / 2, -0.1])
        cylinder(h = thickness + 0.2, d = hole_d);

    // Holes in vertical arm
    translate([-0.1, width / 2, arm_length / 2])
        rotate([0, 90, 0])
        cylinder(h = thickness + 0.2, d = hole_d);
}
`
  }
}
