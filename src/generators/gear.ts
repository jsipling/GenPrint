import type { Generator, ParameterValues } from './types'

export const gearGenerator: Generator = {
  id: 'spur-gear',
  name: 'Spur Gear',
  description: 'A robust, 3D printable spur gear.',
  parameters: [
    {
      type: 'number',
      name: 'teeth',
      label: 'Number of Teeth',
      min: 8, max: 60, default: 20, step: 1
    },
    {
      type: 'number',
      name: 'module_size',
      label: 'Module (Size)',
      min: 0.5, max: 5, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'thickness',
      label: 'Thickness',
      min: 2, max: 20, default: 5, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hole_diameter',
      label: 'Hole Diameter',
      min: 0, max: 20, default: 5, step: 0.5, unit: 'mm'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const teeth = Number(params['teeth'])
    const mod = Number(params['module_size'])
    const h = Number(params['thickness'])
    const hole = Number(params['hole_diameter'])

    return `
// Inputs
teeth = ${teeth};
mm_per_tooth = ${mod} * PI;
thickness = ${h};
hole_d = ${hole};

$fn = 60; // Resolution

// Geometric Calculations
pitch_r = (teeth * mm_per_tooth) / (2 * PI);
outer_r = pitch_r + ${mod};
root_r  = pitch_r - (${mod} * 1.25);

// 3D Generation
difference() {
    union() {
        // 1. Central Core (slightly larger to ensure overlap)
        cylinder(r = root_r + 0.1, h = thickness);

        // 2. Teeth
        for (i = [0:teeth-1]) {
            rotate([0, 0, i * (360/teeth)])
                linear_extrude(height = thickness)
                polygon(points = tooth_points());
        }
    }

    // 3. Center Hole
    if (hole_d > 0) {
        translate([0, 0, -1])
        cylinder(h = thickness + 2, d = hole_d);
    }
}

// Trapezoidal approximation (Simple & 3D Printable)
// Much more robust than manual involute math for generic printing
function tooth_points() = [
    [-${mod} * 0.6, root_r],           // Bottom Left
    [-${mod} * 0.3, outer_r],          // Top Left
    [ ${mod} * 0.3, outer_r],          // Top Right
    [ ${mod} * 0.6, root_r],           // Bottom Right
    [ 0, root_r - ${mod}]              // Anchor (Buried in core)
];
`
  }
}
