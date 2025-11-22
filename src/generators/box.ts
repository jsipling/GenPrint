import type { Generator, ParameterValues } from './types'

export const boxGenerator: Generator = {
  id: 'box',
  name: 'Box',
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
      min: 0, max: 10, default: 3, step: 1, unit: 'mm',
      dynamicMax: (params) => {
        const width = Number(params['width']) || 50
        const depth = Number(params['depth']) || 50
        const wall = Number(params['wall_thickness']) || 2
        // Corner radius limited by smaller dimension minus wall
        return Math.floor(Math.min(width, depth) / 2 - wall)
      }
    },
    {
      type: 'boolean',
      name: 'include_lid',
      label: 'Include Lid',
      default: true,
      children: [
        {
          type: 'number',
          name: 'lid_height',
          label: 'Lid Height',
          min: 4, max: 40, default: 8, step: 0.5, unit: 'mm'
        },
        {
          type: 'number',
          name: 'lid_clearance',
          label: 'Lid Clearance',
          min: 0, max: 1, default: 0.2, step: 0.05, unit: 'mm'
        },
        {
          type: 'number',
          name: 'lid_lip_height',
          label: 'Lid Lip Depth',
          min: 2, max: 30, default: 5, step: 0.5, unit: 'mm'
        }
      ]
    },
    {
      type: 'number',
      name: 'bottom_thickness',
      label: 'Bottom Thickness',
      min: 1, max: 10, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'dividers_x',
      label: 'Dividers (Width)',
      min: 0, max: 10, default: 0, step: 1, unit: '',
      description: 'Number of dividers along width'
    },
    {
      type: 'number',
      name: 'dividers_y',
      label: 'Dividers (Depth)',
      min: 0, max: 10, default: 0, step: 1, unit: '',
      description: 'Number of dividers along depth'
    },
    {
      type: 'boolean',
      name: 'finger_grip',
      label: 'Finger Grip',
      default: false
    },
    {
      type: 'boolean',
      name: 'stackable',
      label: 'Stackable',
      default: false
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const width = Number(params['width'])
    const depth = Number(params['depth'])
    const height = Number(params['height'])
    const wallThickness = Number(params['wall_thickness'])
    const cornerRadius = Number(params['corner_radius'])
    const includeLid = Boolean(params['include_lid'])
    const lidHeight = Number(params['lid_height'])
    const lidClearance = Number(params['lid_clearance'])
    const lidLipHeight = Number(params['lid_lip_height'])
    const bottomThickness = Number(params['bottom_thickness'])
    const dividersX = Math.floor(Number(params['dividers_x']))
    const dividersY = Math.floor(Number(params['dividers_y']))
    const fingerGrip = Boolean(params['finger_grip'])
    const stackable = Boolean(params['stackable'])

    // Keep walls and corners printable even if users input extreme values
    const safeWall = Math.max(0.6, Math.min(
      wallThickness,
      width / 2 - 0.5,
      depth / 2 - 0.5,
      height - 1
    ))
    const safeBottom = Math.max(0.6, Math.min(bottomThickness, height - 1))
    const maxCorner = Math.max(0, Math.min(width, depth) / 2 - safeWall)
    const safeCorner = Math.max(0, Math.min(cornerRadius, maxCorner))
    const safeLidClearance = Math.min(Math.max(lidClearance, 0), 1)
    const safeLidHeight = Math.max(lidHeight, safeWall + 1)
    const safeLipHeight = Math.max(1, Math.min(lidLipHeight, height - safeWall))
    const safeDividersX = Math.max(0, Math.min(dividersX, 10))
    const safeDividersY = Math.max(0, Math.min(dividersY, 10))

    return `// Parameters
width = ${width};
depth = ${depth};
height = ${height};
wall_thickness = ${safeWall};
corner_radius = ${safeCorner};
include_lid = ${includeLid ? 'true' : 'false'};
lid_height = ${safeLidHeight};
lid_clearance = ${safeLidClearance};
lid_lip_height = ${safeLipHeight};
bottom_thickness = ${safeBottom};
dividers_x = ${safeDividersX};
dividers_y = ${safeDividersY};
finger_grip = ${fingerGrip ? 'true' : 'false'};
stackable = ${stackable ? 'true' : 'false'};
$fn = 60;

// Derived dimensions
inner_width = max(1, width - wall_thickness*2);
inner_depth = max(1, depth - wall_thickness*2);
inner_height = max(1, height - bottom_thickness);

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

module finger_cutout() {
    // Semicircular cutout on front wall for easy lid removal
    grip_width = min(width * 0.4, 30);
    grip_depth = wall_thickness + 1;
    grip_height = min(height * 0.3, 15);
    translate([width/2, -0.1, height - grip_height])
        scale([grip_width/grip_height, grip_depth/grip_height, 1])
            rotate([-90, 0, 0])
                cylinder(h=grip_depth, r=grip_height, $fn=32);
}

module stack_lip() {
    // Recessed lip on bottom that fits inside another box's opening
    lip_inset = lid_clearance;
    lip_height = min(5, height * 0.15);
    translate([wall_thickness + lip_inset, wall_thickness + lip_inset, -lip_height])
        rounded_box(
            max(1, inner_width - 2*lip_inset),
            max(1, inner_depth - 2*lip_inset),
            lip_height + 0.01,
            max(0, corner_radius - wall_thickness - lip_inset)
        );
}

module dividers() {
    divider_thickness = wall_thickness;

    // X dividers (running along depth)
    if (dividers_x > 0) {
        cell_width = inner_width / (dividers_x + 1);
        for (i = [1:dividers_x]) {
            translate([wall_thickness + i * cell_width - divider_thickness/2, wall_thickness, bottom_thickness])
                cube([divider_thickness, inner_depth, inner_height]);
        }
    }

    // Y dividers (running along width)
    if (dividers_y > 0) {
        cell_depth = inner_depth / (dividers_y + 1);
        for (i = [1:dividers_y]) {
            translate([wall_thickness, wall_thickness + i * cell_depth - divider_thickness/2, bottom_thickness])
                cube([inner_width, divider_thickness, inner_height]);
        }
    }
}

module box_body() {
    difference() {
        union() {
            difference() {
                rounded_box(width, depth, height, corner_radius);
                translate([wall_thickness, wall_thickness, bottom_thickness])
                    rounded_box(inner_width, inner_depth, height, max(0, corner_radius - wall_thickness));
            }

            // Add dividers
            if (dividers_x > 0 || dividers_y > 0) {
                dividers();
            }

            // Add stackable lip
            if (stackable) {
                stack_lip();
            }
        }

        // Finger grip cutout
        if (finger_grip) {
            finger_cutout();
        }
    }
}

module lid() {
    difference() {
        union() {
            // Hollow shell for the lid
            difference() {
                rounded_box(width, depth, lid_height, corner_radius);
                translate([wall_thickness, wall_thickness, 0])
                    rounded_box(
                        max(1, width - wall_thickness*2),
                        max(1, depth - wall_thickness*2),
                        lid_height - wall_thickness,
                        max(0, corner_radius - wall_thickness)
                    );
            }

            // Inner lip that slides into the box with clearance
            translate([wall_thickness + lid_clearance, wall_thickness + lid_clearance, 0])
                rounded_box(
                    max(1, inner_width - 2*lid_clearance),
                    max(1, inner_depth - 2*lid_clearance),
                    lid_lip_height,
                    max(0, corner_radius - wall_thickness - lid_clearance)
                );
        }

        // Finger grip on lid for easier handling
        if (finger_grip) {
            grip_width = min(width * 0.4, 30);
            grip_depth = wall_thickness + 1;
            grip_height = min(lid_height * 0.5, 10);
            translate([width/2, -0.1, lid_height - grip_height])
                scale([grip_width/grip_height, grip_depth/grip_height, 1])
                    rotate([-90, 0, 0])
                        cylinder(h=grip_depth, r=grip_height, $fn=32);
        }
    }
}

box_body();

if (include_lid) {
    translate([width + 5, 0, 0])
        lid();
}
`
  }
}
