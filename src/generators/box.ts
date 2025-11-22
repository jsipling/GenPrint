import type { Generator, ParameterValues } from './types'

export const boxGenerator: Generator = {
  id: 'parametric-box',
  name: 'Parametric Box',
  description: 'A customizable box with a perfectly fitting lid.',
  parameters: [
    {
      type: 'select',
      name: 'part_type',
      label: 'Part to Generate',
      options: ['Box', 'Lid'],
      default: 'Box'
    },
    {
      type: 'number',
      name: 'width',
      label: 'Width (Outer)',
      min: 20, max: 200, default: 50, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'depth',
      label: 'Depth (Outer)',
      min: 20, max: 200, default: 50, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 5, max: 150, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'wall',
      label: 'Wall Thickness',
      min: 0.8, max: 5, default: 2, step: 0.4, unit: 'mm'
    },
    {
      type: 'number',
      name: 'radius',
      label: 'Corner Radius',
      min: 1, max: 20, default: 3, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'tolerance',
      label: 'Lid Fit Tolerance',
      min: 0.1, max: 1.0, default: 0.3, step: 0.1, unit: 'mm',
      description: 'Gap between box and lid. 0.3mm is usually perfect.'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const isLid = params['part_type'] === 'Lid'
    const width = Number(params['width'])
    const depth = Number(params['depth'])
    const height = Number(params['height'])
    const wall = Number(params['wall'])
    const rad = Number(params['radius'])
    const tol = Number(params['tolerance'])

    return `
// Parameters
width = ${width};
depth = ${depth};
height = ${height};
wall = ${wall};
rad = ${rad};
tol = ${tol};
is_lid = ${isLid};

// Dynamic resolution for smooth corners
$fn = max(32, rad * 4);

// Reusable 2D Profile Module (Robust hull method)
module rounded_rect(x, y, r) {
    // Ensure radius isn't larger than the box
    safe_r = min(r, x/2 - 0.1, y/2 - 0.1);

    hull() {
        translate([safe_r - x/2, safe_r - y/2]) circle(r=safe_r);
        translate([x/2 - safe_r, safe_r - y/2]) circle(r=safe_r);
        translate([x/2 - safe_r, y/2 - safe_r]) circle(r=safe_r);
        translate([safe_r - x/2, y/2 - safe_r]) circle(r=safe_r);
    }
}

if (!is_lid) {
    // --- BOX GENERATION ---
    difference() {
        // 1. Outer Shell
        linear_extrude(height)
            rounded_rect(width, depth, rad);

        // 2. Inner Cavity
        // We lift it by 'wall' and make it taller (+1) to ensure a clean cut top
        translate([0, 0, wall])
            linear_extrude(height + 1)
            rounded_rect(width - wall*2, depth - wall*2, max(0.1, rad - wall));
    }
} else {
    // --- LID GENERATION ---
    lid_h = wall + 2; // Total height of lid plate
    lip_depth = 3;    // How deep the lip goes into the box

    union() {
        // 1. Top Plate (slightly larger than box to cover seams, or exact match)
        linear_extrude(wall)
            rounded_rect(width, depth, rad);

        // 2. The Lip (Fits inside the box)
        translate([0, 0, wall])
            linear_extrude(lip_depth)
            // Subtract tolerance twice (one for each side) to ensure fit
            rounded_rect(
                width - (wall*2) - (tol*2),
                depth - (wall*2) - (tol*2),
                max(0.1, rad - wall - tol)
            );
    }
}
`
  }
}
