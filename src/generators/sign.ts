import type { Generator } from './types'

// Stroke-based vector font - each letter is defined as polylines that get extruded
// Format: array of paths, each path is array of [x, y] coordinates (0-4 width, 0-6 height)
const STROKE_FONT_MODULE = `
// Stroke-based vector font - smooth text without requiring system fonts
module stroke_char(char, size=10, thickness=2) {
    scale_factor = size / 6;
    stroke_width = size * 0.12;

    // Character paths: list of polylines for each character
    // Coordinates are 0-4 width, 0-6 height, origin at bottom-left

    module draw_path(points) {
        for (i = [0 : len(points) - 2]) {
            hull() {
                translate([points[i][0] * scale_factor, points[i][1] * scale_factor, 0])
                    cylinder(h=thickness, r=stroke_width/2, $fn=12);
                translate([points[i+1][0] * scale_factor, points[i+1][1] * scale_factor, 0])
                    cylinder(h=thickness, r=stroke_width/2, $fn=12);
            }
        }
    }

    if (char == "A") {
        draw_path([[0,0], [2,6], [4,0]]);
        draw_path([[0.8,2], [3.2,2]]);
    } else if (char == "B") {
        draw_path([[0,0], [0,6], [3,6], [4,5], [3,3], [0,3]]);
        draw_path([[3,3], [4,2], [4,1], [3,0], [0,0]]);
    } else if (char == "C") {
        draw_path([[4,5], [3,6], [1,6], [0,5], [0,1], [1,0], [3,0], [4,1]]);
    } else if (char == "D") {
        draw_path([[0,0], [0,6], [2,6], [4,4], [4,2], [2,0], [0,0]]);
    } else if (char == "E") {
        draw_path([[4,6], [0,6], [0,0], [4,0]]);
        draw_path([[0,3], [3,3]]);
    } else if (char == "F") {
        draw_path([[4,6], [0,6], [0,0]]);
        draw_path([[0,3], [3,3]]);
    } else if (char == "G") {
        draw_path([[4,5], [3,6], [1,6], [0,5], [0,1], [1,0], [3,0], [4,1], [4,3], [2,3]]);
    } else if (char == "H") {
        draw_path([[0,0], [0,6]]);
        draw_path([[4,0], [4,6]]);
        draw_path([[0,3], [4,3]]);
    } else if (char == "I") {
        draw_path([[1,0], [3,0]]);
        draw_path([[1,6], [3,6]]);
        draw_path([[2,0], [2,6]]);
    } else if (char == "J") {
        draw_path([[1,6], [3,6]]);
        draw_path([[2,6], [2,1], [1,0], [0,1]]);
    } else if (char == "K") {
        draw_path([[0,0], [0,6]]);
        draw_path([[4,6], [0,3], [4,0]]);
    } else if (char == "L") {
        draw_path([[0,6], [0,0], [4,0]]);
    } else if (char == "M") {
        draw_path([[0,0], [0,6], [2,3], [4,6], [4,0]]);
    } else if (char == "N") {
        draw_path([[0,0], [0,6], [4,0], [4,6]]);
    } else if (char == "O") {
        draw_path([[1,0], [3,0], [4,1], [4,5], [3,6], [1,6], [0,5], [0,1], [1,0]]);
    } else if (char == "P") {
        draw_path([[0,0], [0,6], [3,6], [4,5], [4,4], [3,3], [0,3]]);
    } else if (char == "Q") {
        draw_path([[1,0], [3,0], [4,1], [4,5], [3,6], [1,6], [0,5], [0,1], [1,0]]);
        draw_path([[2.5,1.5], [4,0]]);
    } else if (char == "R") {
        draw_path([[0,0], [0,6], [3,6], [4,5], [4,4], [3,3], [0,3]]);
        draw_path([[2,3], [4,0]]);
    } else if (char == "S") {
        draw_path([[4,5], [3,6], [1,6], [0,5], [0,4], [1,3], [3,3], [4,2], [4,1], [3,0], [1,0], [0,1]]);
    } else if (char == "T") {
        draw_path([[0,6], [4,6]]);
        draw_path([[2,6], [2,0]]);
    } else if (char == "U") {
        draw_path([[0,6], [0,1], [1,0], [3,0], [4,1], [4,6]]);
    } else if (char == "V") {
        draw_path([[0,6], [2,0], [4,6]]);
    } else if (char == "W") {
        draw_path([[0,6], [1,0], [2,3], [3,0], [4,6]]);
    } else if (char == "X") {
        draw_path([[0,0], [4,6]]);
        draw_path([[0,6], [4,0]]);
    } else if (char == "Y") {
        draw_path([[0,6], [2,3], [4,6]]);
        draw_path([[2,3], [2,0]]);
    } else if (char == "Z") {
        draw_path([[0,6], [4,6], [0,0], [4,0]]);
    } else if (char == "0") {
        draw_path([[1,0], [3,0], [4,1], [4,5], [3,6], [1,6], [0,5], [0,1], [1,0]]);
        draw_path([[0.5,1], [3.5,5]]);
    } else if (char == "1") {
        draw_path([[1,5], [2,6], [2,0]]);
        draw_path([[1,0], [3,0]]);
    } else if (char == "2") {
        draw_path([[0,5], [1,6], [3,6], [4,5], [4,4], [0,0], [4,0]]);
    } else if (char == "3") {
        draw_path([[0,5], [1,6], [3,6], [4,5], [4,4], [3,3]]);
        draw_path([[1.5,3], [3,3], [4,2], [4,1], [3,0], [1,0], [0,1]]);
    } else if (char == "4") {
        draw_path([[3,0], [3,6], [0,2], [4,2]]);
    } else if (char == "5") {
        draw_path([[4,6], [0,6], [0,3.5], [3,3.5], [4,2.5], [4,1], [3,0], [1,0], [0,1]]);
    } else if (char == "6") {
        draw_path([[3,6], [1,6], [0,5], [0,1], [1,0], [3,0], [4,1], [4,2.5], [3,3.5], [0,3.5]]);
    } else if (char == "7") {
        draw_path([[0,6], [4,6], [1.5,0]]);
    } else if (char == "8") {
        draw_path([[1,3], [0,4], [0,5], [1,6], [3,6], [4,5], [4,4], [3,3], [1,3], [0,2], [0,1], [1,0], [3,0], [4,1], [4,2], [3,3]]);
    } else if (char == "9") {
        draw_path([[1,0], [3,0], [4,1], [4,5], [3,6], [1,6], [0,5], [0,3.5], [1,2.5], [4,2.5]]);
    } else if (char == " ") {
        // Space - no geometry
    } else if (char == "!") {
        draw_path([[2,2.5], [2,6]]);
        translate([2 * scale_factor, 0.5 * scale_factor, 0])
            cylinder(h=thickness, r=stroke_width/2, $fn=12);
    } else if (char == "-") {
        draw_path([[0.5,3], [3.5,3]]);
    } else if (char == ".") {
        translate([2 * scale_factor, 0.5 * scale_factor, 0])
            cylinder(h=thickness, r=stroke_width/2, $fn=12);
    } else if (char == "#") {
        draw_path([[1,0], [1.5,6]]);
        draw_path([[3,0], [2.5,6]]);
        draw_path([[0,2], [4,2]]);
        draw_path([[0,4], [4,4]]);
    } else {
        // Unknown character - draw a box
        draw_path([[0,0], [4,0], [4,6], [0,6], [0,0]]);
    }
}

module stroke_text(string, size=10, thickness=2) {
    char_width = size * 0.75;
    for (i = [0 : len(string) - 1]) {
        translate([i * char_width, 0, 0])
            stroke_char(string[i], size, thickness);
    }
}
`

export const signGenerator: Generator = {
  id: 'custom-sign',
  name: 'Custom Sign',
  description: 'A customizable text sign with raised vector lettering',
  parameters: [
    {
      type: 'string',
      name: 'text',
      label: 'Text',
      default: 'HELLO',
      maxLength: 20
    },
    {
      type: 'number',
      name: 'text_size',
      label: 'Text Size',
      min: 5,
      max: 30,
      default: 12,
      step: 1,
      unit: 'mm'
    },
    {
      type: 'number',
      name: 'text_depth',
      label: 'Text Height',
      min: 1,
      max: 5,
      default: 2,
      step: 0.5,
      unit: 'mm'
    },
    {
      type: 'number',
      name: 'padding',
      label: 'Padding',
      min: 2,
      max: 15,
      default: 5,
      step: 1,
      unit: 'mm'
    },
    {
      type: 'number',
      name: 'base_depth',
      label: 'Base Thickness',
      min: 1,
      max: 8,
      default: 3,
      step: 0.5,
      unit: 'mm'
    },
    {
      type: 'number',
      name: 'corner_radius',
      label: 'Corner Radius',
      min: 0,
      max: 10,
      default: 2,
      step: 1,
      unit: 'mm'
    }
  ],
  scadTemplate: (params) => {
    const text = String(params['text']).toUpperCase().replace(/[^A-Z0-9 !.\-#]/g, '')
    const textSize = params['text_size']
    const textDepth = params['text_depth']
    const padding = params['padding']
    const baseDepth = params['base_depth']
    const cornerRadius = params['corner_radius']

    // Calculate sign dimensions based on text
    const charWidth = Number(textSize) * 0.75
    const textWidth = text.length * charWidth
    const signWidth = textWidth + Number(padding) * 2
    const signHeight = Number(textSize) + Number(padding) * 2

    return `
${STROKE_FONT_MODULE}

// Custom Sign with stroke-based vector text
sign_width = ${signWidth};
sign_height = ${signHeight};
base_depth = ${baseDepth};
text_size = ${textSize};
text_depth = ${textDepth};
padding = ${padding};
corner_radius = ${cornerRadius};
sign_text = "${text}";
$fn = 32;

module rounded_rect(w, h, d, r) {
    if (r > 0 && r < min(w,h)/2) {
        linear_extrude(d)
        offset(r)
        offset(-r)
        square([w, h], center=true);
    } else {
        cube([w, h, d], center=true);
    }
}

// Base plate
translate([0, 0, base_depth/2])
rounded_rect(sign_width, sign_height, base_depth, corner_radius);

// Raised text (centered)
text_width = len(sign_text) * text_size * 0.75;
translate([-text_width/2, -text_size/2, base_depth])
stroke_text(sign_text, size=text_size, thickness=text_depth);
`
  }
}
