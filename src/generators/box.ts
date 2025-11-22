import type { Generator, ParameterValues } from './types'

export const boxGenerator: Generator = {
  id: 'parametric-box',
  name: 'Parametric Box',
  description: 'A customizable box with optional lid',
  parameters: [
    {
      type: 'number',
      name: 'width',
      label: 'Width',
      min: 20, max: 200, default: 50, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'depth',
      label: 'Depth',
      min: 20, max: 200, default: 50, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 10, max: 100, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'wall_thickness',
      label: 'Wall Thickness',
      min: 1, max: 5, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'corner_radius',
      label: 'Corner Radius',
      min: 0, max: 10, default: 3, step: 1, unit: 'mm'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const width = Number(params['width'])
    const depth = Number(params['depth'])
    const height = Number(params['height'])
    const wallThickness = Number(params['wall_thickness'])
    const cornerRadius = Number(params['corner_radius'])

    return `// Parameters
width = ${width};
depth = ${depth};
height = ${height};
wall_thickness = ${wallThickness};
corner_radius = ${cornerRadius};
$fn = 60;

module rounded_box(w, d, h, r) {
    if (r > 0) {
        hull() {
            translate([r, r, 0]) cylinder(r=r, h=h);
            translate([w-r, r, 0]) cylinder(r=r, h=h);
            translate([w-r, d-r, 0]) cylinder(r=r, h=h);
            translate([r, d-r, 0]) cylinder(r=r, h=h);
        }
    } else {
        cube([w, d, h]);
    }
}

difference() {
    rounded_box(width, depth, height, corner_radius);
    translate([wall_thickness, wall_thickness, wall_thickness])
        rounded_box(width - wall_thickness*2, depth - wall_thickness*2, height, max(0, corner_radius - wall_thickness));
}
`
  }
}
