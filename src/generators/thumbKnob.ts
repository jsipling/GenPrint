import type { Generator, ParameterValues } from './types'

export const thumbKnobGenerator: Generator = {
  id: 'thumb-knob',
  name: 'Thumb Knob',
  description: 'A grip handle for standard hex bolts/nuts (e.g., M3). Turns a screw into a thumb-screw.',
  parameters: [
    {
      type: 'select',
      name: 'screw_size', // Renamed from 'size' to avoid collision with Sign Generator
      label: 'Screw Size',
      options: ['M3', 'M4', 'M5', 'M6', 'M8'],
      default: 'M3'
    },
    {
      type: 'number',
      name: 'knob_diameter',
      label: 'Knob Diameter',
      min: 10,
      max: 50,
      default: 15,
      step: 1,
      unit: 'mm'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 4,
      max: 30,
      default: 6,
      step: 1,
      unit: 'mm'
    },
    {
      type: 'select',
      name: 'style',
      label: 'Grip Style',
      options: ['Knurled', 'Lobed', 'Hexagonal'],
      default: 'Knurled'
    },
    {
      type: 'number',
      name: 'tolerance',
      label: 'Fit Tolerance',
      min: 0,
      max: 0.6,
      default: 0.15,
      step: 0.05,
      unit: 'mm',
      description: 'Extra gap for the hex head.'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    // Updated to match the new parameter name
    const size = params['screw_size'] as string
    const knobD = Number(params['knob_diameter'])
    const h = Number(params['height'])
    const style = params['style']
    const tol = Number(params['tolerance'])

    // Standard Metric Hex Dimensions (ISO 4014 / DIN 931)
    // Format: [Thread Diameter, Hex Width (Flat-to-Flat), Head Height (Standard)]
    const specs: Record<string, number[]> = {
      'M3': [3.2, 5.5, 3.0],
      'M4': [4.2, 7.0, 4.0],
      'M5': [5.2, 8.0, 5.0],
      'M6': [6.2, 10.0, 6.0],
      'M8': [8.2, 13.0, 8.0]
    }

    // Fallback to M3 if something goes wrong with the lookup
    const specValues = specs[size] ?? specs['M3'] ?? [3.2, 5.5, 3.0]
    const [holeD, hexFlat, hexDepth] = specValues

    // Calculate hex corner-to-corner diameter
    const hexD = (hexFlat + tol * 2) / 0.866025

    // Ensure knob is large enough: hex diameter + wall (3mm) + ridge depth (1.5mm) on each side
    const minKnobD = hexD + 9
    const safeKnobD = Math.max(knobD, minKnobD)

    return `
// --- Parameters ---
knob_d = ${safeKnobD};
height = ${h};
style = "${style}";
tol = ${tol};

// Screw Specs (${size})
screw_hole_d = ${holeD} + 0.2; // Clearance
hex_flat = ${hexFlat} + (tol * 2);
hex_depth = ${hexDepth};

// Convert Flat-to-Flat to Corner-to-Corner
// Diameter = Flat / cos(30) ~= Flat / 0.866025
hex_d = hex_flat / 0.866025;

$fn = 60;

// --- Geometry ---

difference() {
    // 1. Outer Knob Shape
    if (style == "Lobed") {
        linear_extrude(height)
        lobed_shape(knob_d);
    } else if (style == "Hexagonal") {
        linear_extrude(height)
        rotate([0,0,30]) circle(d=knob_d, $fn=6);
    } else {
        // Knurled (Default)
        linear_extrude(height)
        knurled_shape(knob_d);
    }

    // 2. The Hex Socket (Bottom)
    translate([0, 0, -0.1])
        cylinder(d=hex_d, h=hex_depth + 0.1, $fn=6);

    // 3. Through Hole (For the screw shaft to pass through)
    translate([0, 0, hex_depth - 0.1])
        cylinder(d=screw_hole_d, h=height + 1);

    // 4. Chamfer the top edge
    difference() {
        translate([0, 0, height])
        rotate_extrude()
            translate([knob_d/2, 0])
            circle(r=1);
    }
}

// --- Modules ---

module knurled_shape(d) {
    difference() {
        circle(d=d);
        count = round(d * 1.5);
        for(i=[0:count-1]) {
            rotate([0, 0, i * (360/count)])
            translate([d/2, 0, 0])
            circle(d=1.5, $fn=12);
        }
    }
}

module lobed_shape(d) {
    hull() {
        for(i=[0:2]) {
            rotate([0, 0, i * 120])
            translate([d/4, 0, 0])
            circle(d=d/1.8);
        }
    }
}
`
  }
}
