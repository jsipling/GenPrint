import type { Generator, ParameterValues } from './types'

export const signGenerator: Generator = {
  id: 'custom-sign',
  name: 'Sign',
  description: 'A customizable sign with raised text',
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
      min: 8, max: 30, default: 12, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'text_depth',
      label: 'Text Depth',
      min: 1, max: 5, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'padding',
      label: 'Padding',
      min: 2, max: 20, default: 5, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'base_depth',
      label: 'Base Depth',
      min: 1, max: 10, default: 3, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'corner_radius',
      label: 'Corner Radius',
      min: 0, max: 10, default: 2, step: 1, unit: 'mm'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    // Sanitize text: uppercase, only allow A-Z, 0-9, space, and some punctuation
    const rawText = String(params['text']).toUpperCase().replace(/[^A-Z0-9 !.\-]/g, '').trim()
    const text = rawText.length > 0 ? rawText : 'TEXT'

    const textSize = Number(params['text_size'])
    const textDepth = Number(params['text_depth'])
    const padding = Number(params['padding'])
    const baseDepth = Number(params['base_depth'])
    const cornerRadius = Number(params['corner_radius'])

    return `// Parameters
sign_text = "${text}";
text_size = ${textSize};
text_depth = ${textDepth};
padding = ${padding};
base_depth = ${baseDepth};
corner_radius = ${cornerRadius};
$fn = 60;

// Stroke-based font module
module draw_path(points, stroke_width) {
    for (i = [0:len(points)-2]) {
        hull() {
            translate(points[i]) cylinder(h=text_depth, d=stroke_width);
            translate(points[i+1]) cylinder(h=text_depth, d=stroke_width);
        }
    }
}

module stroke_char(char, size) {
    sw = size * 0.15;
    s = size / 6;

    if (char == "A") { draw_path([[0,0,0],[s*2,s*6,0],[s*4,0,0]], sw); draw_path([[s*0.8,s*2,0],[s*3.2,s*2,0]], sw); }
    else if (char == "B") { draw_path([[0,0,0],[0,s*6,0],[s*3,s*6,0],[s*4,s*5,0],[s*3,s*3,0],[0,s*3,0]], sw); draw_path([[s*3,s*3,0],[s*4,s*2,0],[s*4,s*1,0],[s*3,0,0],[0,0,0]], sw); }
    else if (char == "C") { draw_path([[s*4,s*5,0],[s*3,s*6,0],[s*1,s*6,0],[0,s*5,0],[0,s*1,0],[s*1,0,0],[s*3,0,0],[s*4,s*1,0]], sw); }
    else if (char == "D") { draw_path([[0,0,0],[0,s*6,0],[s*2,s*6,0],[s*4,s*4,0],[s*4,s*2,0],[s*2,0,0],[0,0,0]], sw); }
    else if (char == "E") { draw_path([[s*4,s*6,0],[0,s*6,0],[0,0,0],[s*4,0,0]], sw); draw_path([[0,s*3,0],[s*3,s*3,0]], sw); }
    else if (char == "F") { draw_path([[s*4,s*6,0],[0,s*6,0],[0,0,0]], sw); draw_path([[0,s*3,0],[s*3,s*3,0]], sw); }
    else if (char == "G") { draw_path([[s*4,s*5,0],[s*3,s*6,0],[s*1,s*6,0],[0,s*5,0],[0,s*1,0],[s*1,0,0],[s*3,0,0],[s*4,s*1,0],[s*4,s*3,0],[s*2,s*3,0]], sw); }
    else if (char == "H") { draw_path([[0,0,0],[0,s*6,0]], sw); draw_path([[s*4,0,0],[s*4,s*6,0]], sw); draw_path([[0,s*3,0],[s*4,s*3,0]], sw); }
    else if (char == "I") { draw_path([[s*1,0,0],[s*3,0,0]], sw); draw_path([[s*1,s*6,0],[s*3,s*6,0]], sw); draw_path([[s*2,0,0],[s*2,s*6,0]], sw); }
    else if (char == "J") { draw_path([[s*1,s*6,0],[s*3,s*6,0]], sw); draw_path([[s*2,s*6,0],[s*2,s*1,0],[s*1,0,0],[0,s*1,0]], sw); }
    else if (char == "K") { draw_path([[0,0,0],[0,s*6,0]], sw); draw_path([[s*4,s*6,0],[0,s*3,0],[s*4,0,0]], sw); }
    else if (char == "L") { draw_path([[0,s*6,0],[0,0,0],[s*4,0,0]], sw); }
    else if (char == "M") { draw_path([[0,0,0],[0,s*6,0],[s*2,s*3,0],[s*4,s*6,0],[s*4,0,0]], sw); }
    else if (char == "N") { draw_path([[0,0,0],[0,s*6,0],[s*4,0,0],[s*4,s*6,0]], sw); }
    else if (char == "O") { draw_path([[s*1,0,0],[s*3,0,0],[s*4,s*1,0],[s*4,s*5,0],[s*3,s*6,0],[s*1,s*6,0],[0,s*5,0],[0,s*1,0],[s*1,0,0]], sw); }
    else if (char == "P") { draw_path([[0,0,0],[0,s*6,0],[s*3,s*6,0],[s*4,s*5,0],[s*4,s*4,0],[s*3,s*3,0],[0,s*3,0]], sw); }
    else if (char == "Q") { draw_path([[s*1,0,0],[s*3,0,0],[s*4,s*1,0],[s*4,s*5,0],[s*3,s*6,0],[s*1,s*6,0],[0,s*5,0],[0,s*1,0],[s*1,0,0]], sw); draw_path([[s*2.5,s*1.5,0],[s*4,0,0]], sw); }
    else if (char == "R") { draw_path([[0,0,0],[0,s*6,0],[s*3,s*6,0],[s*4,s*5,0],[s*4,s*4,0],[s*3,s*3,0],[0,s*3,0]], sw); draw_path([[s*2,s*3,0],[s*4,0,0]], sw); }
    else if (char == "S") { draw_path([[s*4,s*5,0],[s*3,s*6,0],[s*1,s*6,0],[0,s*5,0],[0,s*4,0],[s*1,s*3,0],[s*3,s*3,0],[s*4,s*2,0],[s*4,s*1,0],[s*3,0,0],[s*1,0,0],[0,s*1,0]], sw); }
    else if (char == "T") { draw_path([[0,s*6,0],[s*4,s*6,0]], sw); draw_path([[s*2,s*6,0],[s*2,0,0]], sw); }
    else if (char == "U") { draw_path([[0,s*6,0],[0,s*1,0],[s*1,0,0],[s*3,0,0],[s*4,s*1,0],[s*4,s*6,0]], sw); }
    else if (char == "V") { draw_path([[0,s*6,0],[s*2,0,0],[s*4,s*6,0]], sw); }
    else if (char == "W") { draw_path([[0,s*6,0],[s*1,0,0],[s*2,s*3,0],[s*3,0,0],[s*4,s*6,0]], sw); }
    else if (char == "X") { draw_path([[0,0,0],[s*4,s*6,0]], sw); draw_path([[0,s*6,0],[s*4,0,0]], sw); }
    else if (char == "Y") { draw_path([[0,s*6,0],[s*2,s*3,0],[s*4,s*6,0]], sw); draw_path([[s*2,s*3,0],[s*2,0,0]], sw); }
    else if (char == "Z") { draw_path([[0,s*6,0],[s*4,s*6,0],[0,0,0],[s*4,0,0]], sw); }
    else if (char == "0") { draw_path([[s*1,0,0],[s*3,0,0],[s*4,s*1,0],[s*4,s*5,0],[s*3,s*6,0],[s*1,s*6,0],[0,s*5,0],[0,s*1,0],[s*1,0,0]], sw); }
    else if (char == "1") { draw_path([[s*1,s*5,0],[s*2,s*6,0],[s*2,0,0]], sw); draw_path([[s*1,0,0],[s*3,0,0]], sw); }
    else if (char == "2") { draw_path([[0,s*5,0],[s*1,s*6,0],[s*3,s*6,0],[s*4,s*5,0],[s*4,s*4,0],[0,0,0],[s*4,0,0]], sw); }
    else if (char == "3") { draw_path([[0,s*5,0],[s*1,s*6,0],[s*3,s*6,0],[s*4,s*5,0],[s*4,s*4,0],[s*3,s*3,0]], sw); draw_path([[s*1.5,s*3,0],[s*3,s*3,0],[s*4,s*2,0],[s*4,s*1,0],[s*3,0,0],[s*1,0,0],[0,s*1,0]], sw); }
    else if (char == "4") { draw_path([[s*3,0,0],[s*3,s*6,0],[0,s*2,0],[s*4,s*2,0]], sw); }
    else if (char == "5") { draw_path([[s*4,s*6,0],[0,s*6,0],[0,s*3.5,0],[s*3,s*3.5,0],[s*4,s*2.5,0],[s*4,s*1,0],[s*3,0,0],[s*1,0,0],[0,s*1,0]], sw); }
    else if (char == "6") { draw_path([[s*3,s*6,0],[s*1,s*6,0],[0,s*5,0],[0,s*1,0],[s*1,0,0],[s*3,0,0],[s*4,s*1,0],[s*4,s*2.5,0],[s*3,s*3.5,0],[0,s*3.5,0]], sw); }
    else if (char == "7") { draw_path([[0,s*6,0],[s*4,s*6,0],[s*1.5,0,0]], sw); }
    else if (char == "8") { draw_path([[s*1,s*3,0],[0,s*4,0],[0,s*5,0],[s*1,s*6,0],[s*3,s*6,0],[s*4,s*5,0],[s*4,s*4,0],[s*3,s*3,0],[s*1,s*3,0],[0,s*2,0],[0,s*1,0],[s*1,0,0],[s*3,0,0],[s*4,s*1,0],[s*4,s*2,0],[s*3,s*3,0]], sw); }
    else if (char == "9") { draw_path([[s*1,0,0],[s*3,0,0],[s*4,s*1,0],[s*4,s*5,0],[s*3,s*6,0],[s*1,s*6,0],[0,s*5,0],[0,s*3.5,0],[s*1,s*2.5,0],[s*4,s*2.5,0]], sw); }
    else if (char == " ") { }
    else if (char == "!") { draw_path([[s*2,s*2.5,0],[s*2,s*6,0]], sw); translate([s*2,s*0.5,0]) cylinder(h=text_depth, d=sw); }
    else if (char == ".") { translate([s*2,s*0.5,0]) cylinder(h=text_depth, d=sw); }
    else if (char == "-") { draw_path([[s*0.5,s*3,0],[s*3.5,s*3,0]], sw); }
    else { draw_path([[0,0,0],[s*4,0,0],[s*4,s*6,0],[0,s*6,0],[0,0,0]], sw); }
}

module stroke_text(str, size, spacing) {
    for (i = [0:len(str)-1]) {
        translate([i * spacing, 0, 0])
            stroke_char(str[i], size);
    }
}

// Rounded rectangle module
module rounded_rect(w, h, r) {
    if (r > 0) {
        hull() {
            translate([r, r, 0]) cylinder(r=r, h=base_depth);
            translate([w-r, r, 0]) cylinder(r=r, h=base_depth);
            translate([w-r, h-r, 0]) cylinder(r=r, h=base_depth);
            translate([r, h-r, 0]) cylinder(r=r, h=base_depth);
        }
    } else {
        cube([w, h, base_depth]);
    }
}

// Calculate dimensions
char_spacing = text_size * 0.7;
text_width = len(sign_text) * char_spacing;
base_width = text_width + padding * 2;
base_height = text_size + padding * 2;

// Base plate
rounded_rect(base_width, base_height, corner_radius);

// Text
translate([padding, padding, base_depth])
    stroke_text(sign_text, text_size, char_spacing);
`
  }
}
