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
    },
    {
      type: 'number',
      name: 'hole_count_arm_1',
      label: 'Hole Count Arm 1',
      min: 0, max: 10, default: 1, step: 1
    },
    {
      type: 'number',
      name: 'hole_count_arm_2',
      label: 'Hole Count Arm 2',
      min: 0, max: 10, default: 1, step: 1
    },
    {
      type: 'boolean',
      name: 'add_rib',
      label: 'Add Rib',
      default: true
    },
    {
      type: 'number',
      name: 'rib_thickness',
      label: 'Rib Thickness',
      min: 1, max: 10, default: 4, step: 0.5, unit: 'mm'
    },
  ],
  scadTemplate: (params: ParameterValues) => {
    const width = Number(params['width'])
    const armLength = Number(params['arm_length'])
    const thickness = Number(params['thickness'])
    const holeD = Number(params['hole_diameter'])
    const fillet = Number(params['fillet_radius'])
    const holeCountArm1 = Number(params['hole_count_arm_1'])
    const holeCountArm2 = Number(params['hole_count_arm_2'])
    const addRib = Boolean(params['add_rib'])
    const ribThickness = Number(params['rib_thickness'])

    return `
// Dimensions
width = ${width};
arm_length = ${armLength};
thickness = ${thickness};
hole_d = ${holeD};
fillet_r = ${fillet};
hole_count_arm_1 = ${holeCountArm1};
hole_count_arm_2 = ${holeCountArm2};
add_rib = ${addRib};
rib_thickness = ${ribThickness};

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
        
        if(add_rib) {
            // Rib for strength
            rib_profile = [
                [thickness, 0],
                [thickness, fillet_r],
                [fillet_r, 0]
            ];
            
            translate([0, (width-rib_thickness)/2, 0])
            linear_extrude(height=rib_thickness)
            polygon(points=rib_profile);
        }
    }

    // Holes in horizontal arm
    if(hole_count_arm_1 > 0) {
        hole_offset_start = (arm_length - thickness) / (hole_count_arm_1 + 1) + thickness;
        hole_spacing = (arm_length - thickness) / (hole_count_arm_1 + 1);
        for (i = [0:hole_count_arm_1-1]) {
            translate([hole_offset_start + i * hole_spacing, width / 2, -0.1])
                cylinder(h = thickness + 0.2, d = hole_d);
        }
    }


    // Holes in vertical arm
    if(hole_count_arm_2 > 0) {
        hole_offset_start = (arm_length - thickness) / (hole_count_arm_2 + 1) + thickness;
        hole_spacing = (arm_length - thickness) / (hole_count_arm_2 + 1);
        for (i = [0:hole_count_arm_2-1]) {
            translate([-0.1, width / 2, hole_offset_start + i * hole_spacing])
                rotate([0, 90, 0])
                cylinder(h = thickness + 0.2, d = hole_d);
        }
    }
}
`
  }
}
