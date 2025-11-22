import type { Generator, ParameterValues } from './types'

export const gearGenerator: Generator = {
  id: 'spur_gear',
  name: 'Spur Gear',
  description: 'A parametric spur gear with optional hub',
  parameters: [
    {
      type: 'number',
      name: 'teeth',
      label: 'Number of Teeth',
      min: 8, max: 100, default: 20, step: 1, unit: '',
      dynamicMax: (params) => {
        const mod = Number(params['module']) || 2
        return Math.floor(mod * 50)
      }
    },
    {
      type: 'number',
      name: 'module',
      label: 'Module (Size)',
      min: 0.5, max: 10, default: 2, step: 0.1, unit: 'mm',
      description: 'Determines overall size. Pitch Diameter = Teeth * Module'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Gear Height',
      min: 2, max: 50, default: 5, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'bore_diameter',
      label: 'Bore Diameter',
      min: 0, max: 50, default: 5, step: 0.5, unit: 'mm',
      description: 'Center hole diameter (0 for solid)'
    },
    {
      type: 'number',
      name: 'pressure_angle',
      label: 'Pressure Angle',
      min: 14.5, max: 30, default: 20, step: 0.5, unit: 'deg',
      description: 'Standard is 20 degrees'
    },
    {
      type: 'number',
      name: 'tolerance',
      label: 'Fit Tolerance',
      min: 0, max: 0.5, default: 0, step: 0.05, unit: 'mm',
      description: 'Increases backlash for better printing fit'
    },
    {
      type: 'number',
      name: 'tip_sharpness',
      label: 'Tip Sharpness',
      min: 0, max: 1, default: 0, step: 0.1, unit: '',
      description: '0 = flat tip (standard), 1 = pointed tip'
    },
    {
      type: 'boolean',
      name: 'include_hub',
      label: 'Include Hub',
      default: true,
      children: [
        {
          type: 'number',
          name: 'hub_diameter',
          label: 'Hub Diameter',
          min: 5, max: 100, default: 15, step: 1, unit: 'mm'
        },
        {
          type: 'number',
          name: 'hub_height',
          label: 'Hub Height',
          min: 0, max: 50, default: 5, step: 1, unit: 'mm',
          description: 'Extension height above the gear face'
        }
      ]
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const teethInput = Math.floor(Number(params['teeth']))
    const mod = Number(params['module'])
    const height = Number(params['height'])
    const boreDiameter = Number(params['bore_diameter'])
    const includeHub = Boolean(params['include_hub'])
    const hubDiameter = Number(params['hub_diameter'])
    const hubHeight = Number(params['hub_height'])
    const pressureAngle = Number(params['pressure_angle'])
    const tolerance = Number(params['tolerance'])
    const tipSharpness = Number(params['tip_sharpness'])

    // Limit teeth based on module to ensure visible tooth geometry
    // At high tooth counts with small modules, teeth become too small to render/print
    const maxTeethForModule = Math.floor(mod * 50)
    const teeth = Math.min(teethInput, Math.max(8, maxTeethForModule))

    // Calculations for safety and geometry
    const pitchDiameter = teeth * mod
    const rootDiameter = pitchDiameter - (2.5 * mod)

    // Ensure bore doesn't cut into the teeth root
    const maxBore = Math.max(0, rootDiameter - 4) // Leave at least 2mm wall
    const safeBore = Math.min(boreDiameter, maxBore)

    // Ensure hub is at least as big as the bore + wall
    const safeHubDiameter = Math.max(hubDiameter, safeBore + 4)

    return `// Parameters
teeth = ${teeth};
m = ${mod};
h = ${height};
bore_d = ${safeBore};
include_hub = ${includeHub ? 'true' : 'false'};
hub_d = ${safeHubDiameter};
hub_h = ${hubHeight};
pressure_angle = ${pressureAngle};
clearance = ${tolerance};
tip_sharpness = ${tipSharpness};
$fn = 64;

// Derived Dimensions
pitch_r = teeth * m / 2;
base_r = pitch_r * cos(pressure_angle);
outer_r = pitch_r + m;
root_r = pitch_r - 1.25 * m;

// Involute function: attempt to go to a given radius
// Returns the angle from center and the point
function involute_intersect_angle(base_r, r) =
    let(
        cos_a = base_r / r,
        a = acos(min(1, max(-1, cos_a))),
        inv_a = tan(a) - a * PI / 180
    )
    inv_a * 180 / PI;

function inv_angle(r) =
    (r <= base_r) ? 0 : involute_intersect_angle(base_r, r);

// Involute point at roll angle (degrees)
function involute_point(base_r, roll) =
    let(r_angle = roll * PI / 180)
    [
        base_r * (cos(roll) + r_angle * sin(roll)),
        base_r * (sin(roll) - r_angle * cos(roll))
    ];

// Generate points along involute from base to tip
function gen_involute(base_r, start_roll, end_roll, steps) = [
    for (i = [0 : steps])
        involute_point(base_r, start_roll + (end_roll - start_roll) * i / steps)
];

module one_tooth() {
    // Tooth thickness at pitch circle
    pitch_thick = PI * m / 2 - clearance;
    // Angle subtended by half tooth at pitch
    half_pitch_angle = (pitch_thick / 2) / pitch_r * 180 / PI;

    // Involute roll angle at pitch circle
    pitch_inv = inv_angle(pitch_r);
    // Involute roll angle at tip
    tip_inv = inv_angle(outer_r);
    // Start involute at base circle (roll = 0)
    base_inv = 0;

    // Angular offset so tooth is centered on X-axis
    // At pitch circle, involute point should be at half_pitch_angle
    offset_angle = half_pitch_angle - pitch_inv;

    // Generate right side involute (will be mirrored for left)
    steps = 15;
    right_pts = [
        for (i = [0 : steps])
            let(
                roll = base_inv + (tip_inv - base_inv) * i / steps,
                pt = involute_point(base_r, roll),
                r = norm(pt),
                theta = atan2(pt[1], pt[0])
            )
            // Rotate to center tooth and flip for right side
            [r * cos(-theta - offset_angle), r * sin(-theta - offset_angle)]
    ];

    left_pts = [
        for (i = [0 : steps])
            let(
                roll = base_inv + (tip_inv - base_inv) * i / steps,
                pt = involute_point(base_r, roll),
                r = norm(pt),
                theta = atan2(pt[1], pt[0])
            )
            [r * cos(theta + offset_angle), r * sin(theta + offset_angle)]
    ];

    // Build closed polygon: root-arc, right flank, tip, left flank (reversed)
    root_half_angle = half_pitch_angle + 2; // slightly wider at root

    // Calculate tip point for pointed teeth
    // When tip_sharpness = 0: flat tip (no extra point)
    // When tip_sharpness = 1: pointed tip at outer_r on centerline
    right_tip = right_pts[steps];
    left_tip = left_pts[steps];
    // Midpoint between the two flank tips
    mid_tip = [(right_tip[0] + left_tip[0]) / 2, (right_tip[1] + left_tip[1]) / 2];
    // Full point at outer radius on x-axis
    point_tip = [outer_r, 0];
    // Interpolate based on tip_sharpness
    tip_point = [
        mid_tip[0] + tip_sharpness * (point_tip[0] - mid_tip[0]),
        mid_tip[1] + tip_sharpness * (point_tip[1] - mid_tip[1])
    ];

    polygon(concat(
        // Start at root on right side
        [[root_r * cos(-root_half_angle), root_r * sin(-root_half_angle)]],
        // Right involute flank
        right_pts,
        // Tip point (interpolated between flat and pointed)
        tip_sharpness > 0 ? [tip_point] : [],
        // Left involute flank (reversed, tip to base)
        [for (i = [steps : -1 : 0]) left_pts[i]],
        // End at root on left side
        [[root_r * cos(root_half_angle), root_r * sin(root_half_angle)]]
    ));
}

module gear_shape_2d() {
    union() {
        // Root circle
        circle(r = root_r);
        // Teeth
        for (i = [0 : teeth - 1]) {
            rotate([0, 0, i * 360 / teeth])
                one_tooth();
        }
    }
}

module full_gear() {
    difference() {
        union() {
            // Main Gear Body
            linear_extrude(h)
                gear_shape_2d();

            // Hub
            if (include_hub && hub_h > 0) {
                translate([0, 0, h])
                    cylinder(d=hub_d, h=hub_h);
            }
        }

        // Bore
        if (bore_d > 0) {
            translate([0, 0, -1])
                cylinder(d=bore_d, h=h + hub_h + 2);
        }
    }
}

full_gear();
`
  }
}
