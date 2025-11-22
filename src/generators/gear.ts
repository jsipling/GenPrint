import type { Generator, ParameterValues } from './types'

export const gearGenerator: Generator = {
  id: 'spur-gear',
  name: 'Spur Gear',
  description: 'A customizable spur gear with center hole',
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
      label: 'Module Size',
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
    },
    {
      type: 'number',
      name: 'pressure_angle',
      label: 'Pressure Angle',
      min: 14.5, max: 25, default: 20, step: 0.5, unit: '°'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const teeth = Number(params['teeth'])
    const moduleSize = Number(params['module_size'])
    const thickness = Number(params['thickness'])
    const holeDiameter = Number(params['hole_diameter'])
    const pressureAngle = Number(params['pressure_angle'])

    return `// Parameters
teeth = ${teeth};
module_size = ${moduleSize};
thickness = ${thickness};
hole_diameter = ${holeDiameter};
pressure_angle = ${pressureAngle};
$fn = 60;

// Calculated values
pitch_radius = (teeth * module_size) / 2;
addendum = module_size;
dedendum = module_size * 1.25;
base_radius = pitch_radius * cos(pressure_angle);

// Involute function
function involute(base_r, angle) = [
    base_r * (cos(angle) + angle * PI / 180 * sin(angle)),
    base_r * (sin(angle) - angle * PI / 180 * cos(angle))
];

// Generate gear
difference() {
    linear_extrude(height=thickness) {
        difference() {
            circle(r=pitch_radius + addendum);
            for (i = [0:teeth-1]) {
                rotate([0, 0, i * 360/teeth])
                    polygon(points=[
                        [0, 0],
                        involute(base_radius, 0),
                        involute(base_radius, 20),
                        involute(base_radius, 40)
                    ]);
            }
        }
    }

    // Center hole
    if (hole_diameter > 0) {
        translate([0, 0, -1])
            cylinder(h=thickness+2, d=hole_diameter);
    }
}
`
  }
}
