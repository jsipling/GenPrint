import type { Generator } from './types'

// Pixel font data: 3x5 grid, each row is 3 bits (4=left, 2=middle, 1=right)
const PIXEL_FONT_MODULE = `
// Pixel font module - draws text using 3x5 cube grid
module pixel_text(string, size=10, thickness=2) {
    pixel_size = size / 5;
    char_width = size * 0.8;

    // 3x5 pixel font data: 5 rows, each value is 3 bits (4=left, 2=mid, 1=right)
    font_data = [
        ["A", [2, 5, 7, 5, 5]],
        ["B", [6, 5, 6, 5, 6]],
        ["C", [3, 4, 4, 4, 3]],
        ["D", [6, 5, 5, 5, 6]],
        ["E", [7, 4, 6, 4, 7]],
        ["F", [7, 4, 6, 4, 4]],
        ["G", [3, 4, 5, 5, 3]],
        ["H", [5, 5, 7, 5, 5]],
        ["I", [7, 2, 2, 2, 7]],
        ["J", [7, 1, 1, 5, 2]],
        ["K", [5, 5, 6, 5, 5]],
        ["L", [4, 4, 4, 4, 7]],
        ["M", [5, 7, 5, 5, 5]],
        ["N", [5, 7, 7, 5, 5]],
        ["O", [2, 5, 5, 5, 2]],
        ["P", [6, 5, 6, 4, 4]],
        ["Q", [2, 5, 5, 7, 3]],
        ["R", [6, 5, 6, 5, 5]],
        ["S", [3, 4, 2, 1, 6]],
        ["T", [7, 2, 2, 2, 2]],
        ["U", [5, 5, 5, 5, 7]],
        ["V", [5, 5, 5, 5, 2]],
        ["W", [5, 5, 5, 7, 5]],
        ["X", [5, 5, 2, 5, 5]],
        ["Y", [5, 5, 2, 2, 2]],
        ["Z", [7, 1, 2, 4, 7]],
        ["0", [2, 5, 5, 5, 2]],
        ["1", [2, 6, 2, 2, 7]],
        ["2", [6, 1, 2, 4, 7]],
        ["3", [7, 1, 2, 1, 7]],
        ["4", [5, 5, 7, 1, 1]],
        ["5", [7, 4, 6, 1, 6]],
        ["6", [3, 4, 6, 5, 2]],
        ["7", [7, 1, 2, 2, 2]],
        ["8", [2, 5, 2, 5, 2]],
        ["9", [2, 5, 3, 1, 6]],
        [" ", [0, 0, 0, 0, 0]],
        ["!", [2, 2, 2, 0, 2]],
        ["-", [0, 0, 7, 0, 0]],
        [".", [0, 0, 0, 0, 2]],
        ["#", [5, 7, 5, 7, 5]]
    ];

    function get_char_map(c) =
        let(match = [for(i=font_data) if(i[0]==c) i[1]])
        len(match) > 0 ? match[0] : [7,0,7,0,7];

    union() {
        for (i = [0 : len(string) - 1]) {
            translate([i * char_width, 0, 0]) {
                map = get_char_map(string[i]);
                for (row = [0 : 4]) {
                    for (col = [0 : 2]) {
                        if (floor(map[row] / pow(2, 2-col)) % 2 == 1) {
                            translate([col * pixel_size, (4-row) * pixel_size, 0])
                                cube([pixel_size * 0.9, pixel_size * 0.9, thickness]);
                        }
                    }
                }
            }
        }
    }
}
`

export const signGenerator: Generator = {
  id: 'custom-sign',
  name: 'Custom Sign',
  description: 'A customizable text sign with raised pixel-font lettering',
  parameters: [
    {
      type: 'string',
      name: 'text',
      label: 'Text (A-Z, 0-9)',
      default: 'HELLO',
      maxLength: 12
    },
    {
      type: 'number',
      name: 'text_size',
      label: 'Text Size',
      min: 5,
      max: 25,
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
    const charWidth = Number(textSize) * 0.8
    const textWidth = text.length * charWidth
    const signWidth = textWidth + Number(padding) * 2
    const signHeight = Number(textSize) + Number(padding) * 2

    return `
${PIXEL_FONT_MODULE}

sign_width = ${signWidth};
sign_height = ${signHeight};
base_depth = ${baseDepth};
text_size = ${textSize};
text_depth = ${textDepth};
padding = ${padding};
corner_radius = ${cornerRadius};
sign_text = "${text}";
$fn = 20;

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
text_width = len(sign_text) * text_size * 0.8;
translate([-text_width/2 + text_size*0.4, -text_size/2, base_depth])
pixel_text(sign_text, size=text_size, thickness=text_depth);
`
  }
}
