import type { Generator, ParameterValues } from './types'

// Optimized Vector Font: Generates 2D shapes first (much faster rendering)
const STROKE_FONT_MODULE = `
module stroke_char_2d(char, size, thickness) {
    w = size / 6;         // coordinate scaler
    sw = size * 0.12;     // stroke width

    module path(pts) {
        for (i = [0 : len(pts) - 2]) {
            hull() {
                translate([pts[i][0]*w, pts[i][1]*w]) circle(d=sw);
                translate([pts[i+1][0]*w, pts[i+1][1]*w]) circle(d=sw);
            }
        }
    }

    // Dot helper
    module dot(pt) {
        translate([pt[0]*w, pt[1]*w]) circle(d=sw);
    }

    if (char == "A") { path([[0,0], [2,6], [4,0]]); path([[0.8,2], [3.2,2]]); }
    else if (char == "B") { path([[0,0],[0,6],[3,6],[4,5],[3,3],[0,3]]); path([[3,3],[4,2],[4,1],[3,0],[0,0]]); }
    else if (char == "C") { path([[4,5],[3,6],[1,6],[0,5],[0,1],[1,0],[3,0],[4,1]]); }
    else if (char == "D") { path([[0,0],[0,6],[2,6],[4,4],[4,2],[2,0],[0,0]]); }
    else if (char == "E") { path([[4,6],[0,6],[0,0],[4,0]]); path([[0,3],[3,3]]); }
    else if (char == "F") { path([[4,6],[0,6],[0,0]]); path([[0,3],[3,3]]); }
    else if (char == "G") { path([[4,5],[3,6],[1,6],[0,5],[0,1],[1,0],[3,0],[4,1],[4,3],[2,3]]); }
    else if (char == "H") { path([[0,0],[0,6]]); path([[4,0],[4,6]]); path([[0,3],[4,3]]); }
    else if (char == "I") { path([[1,0],[3,0]]); path([[1,6],[3,6]]); path([[2,0],[2,6]]); }
    else if (char == "J") { path([[1,6],[3,6]]); path([[2,6],[2,1],[1,0],[0,1]]); }
    else if (char == "K") { path([[0,0],[0,6]]); path([[4,6],[0,3],[4,0]]); }
    else if (char == "L") { path([[0,6],[0,0],[4,0]]); }
    else if (char == "M") { path([[0,0],[0,6],[2,3],[4,6],[4,0]]); }
    else if (char == "N") { path([[0,0],[0,6],[4,0],[4,6]]); }
    else if (char == "O") { path([[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,1],[1,0]]); }
    else if (char == "P") { path([[0,0],[0,6],[3,6],[4,5],[4,4],[3,3],[0,3]]); }
    else if (char == "Q") { path([[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,1],[1,0]]); path([[2.5,1.5],[4,0]]); }
    else if (char == "R") { path([[0,0],[0,6],[3,6],[4,5],[4,4],[3,3],[0,3]]); path([[2,3],[4,0]]); }
    else if (char == "S") { path([[4,5],[3,6],[1,6],[0,5],[0,4],[1,3],[3,3],[4,2],[4,1],[3,0],[1,0],[0,1]]); }
    else if (char == "T") { path([[0,6],[4,6]]); path([[2,6],[2,0]]); }
    else if (char == "U") { path([[0,6],[0,1],[1,0],[3,0],[4,1],[4,6]]); }
    else if (char == "V") { path([[0,6],[2,0],[4,6]]); }
    else if (char == "W") { path([[0,6],[1,0],[2,3],[3,0],[4,6]]); }
    else if (char == "X") { path([[0,0],[4,6]]); path([[0,6],[4,0]]); }
    else if (char == "Y") { path([[0,6],[2,3],[4,6]]); path([[2,3],[2,0]]); }
    else if (char == "Z") { path([[0,6],[4,6],[0,0],[4,0]]); }
    else if (char == "0") { path([[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,1],[1,0]]); path([[0.5,1],[3.5,5]]); }
    else if (char == "1") { path([[1,5],[2,6],[2,0]]); path([[1,0],[3,0]]); }
    else if (char == "2") { path([[0,5],[1,6],[3,6],[4,5],[4,4],[0,0],[4,0]]); }
    else if (char == "3") { path([[0,5],[1,6],[3,6],[4,5],[4,4],[3,3]]); path([[1.5,3],[3,3],[4,2],[4,1],[3,0],[1,0],[0,1]]); }
    else if (char == "4") { path([[3,0],[3,6],[0,2],[4,2]]); }
    else if (char == "5") { path([[4,6],[0,6],[0,3.5],[3,3.5],[4,2.5],[4,1],[3,0],[1,0],[0,1]]); }
    else if (char == "6") { path([[3,6],[1,6],[0,5],[0,1],[1,0],[3,0],[4,1],[4,2.5],[3,3.5],[0,3.5]]); }
    else if (char == "7") { path([[0,6],[4,6],[1.5,0]]); }
    else if (char == "8") { path([[1,3],[0,4],[0,5],[1,6],[3,6],[4,5],[4,4],[3,3],[1,3],[0,2],[0,1],[1,0],[3,0],[4,1],[4,2],[3,3]]); }
    else if (char == "9") { path([[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,3.5],[1,2.5],[4,2.5]]); }
    else if (char == "!") { path([[2,2.5],[2,6]]); dot([2, 0.5]); }
    else if (char == "-") { path([[0.5,3],[3.5,3]]); }
    else if (char == ".") { dot([2, 0.5]); }
    else if (char == "#") { path([[1,0],[1.5,6]]); path([[3,0],[2.5,6]]); path([[0,2],[4,2]]); path([[0,4],[4,4]]); }
    else { path([[0,0],[4,0],[4,6],[0,6],[0,0]]); } // Box for unknown
}
`

export const signGenerator: Generator = {
  id: 'custom-sign',
  name: 'Sign',
  description: 'A nameplate with raised vector text and optional mounting holes.',
  parameters: [
    {
      type: 'string',
      name: 'text',
      label: 'Text Content',
      default: 'HELLO',
      maxLength: 20
    },
    {
      type: 'number',
      name: 'size',
      label: 'Text Size',
      min: 10, max: 50, default: 20, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'text_height',
      label: 'Text Relief Height',
      min: 0.6, max: 5, default: 1.0, step: 0.2, unit: 'mm'
    },
    {
      type: 'number',
      name: 'base_thick',
      label: 'Base Thickness',
      min: 1, max: 5, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'margin',
      label: 'Margin / Padding',
      min: 2, max: 20, default: 5, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'radius',
      label: 'Corner Radius',
      min: 1, max: 20, default: 3, step: 1, unit: 'mm'
    },
    {
      type: 'boolean',
      name: 'holes',
      label: 'Add Mounting Holes',
      default: false
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const rawText = String(params['text']).toUpperCase().replace(/[^A-Z0-9 !.\-#]/g, '')
    const text = rawText.length > 0 ? rawText : 'EMPTY'

    const size = Number(params['size'])
    const textH = Number(params['text_height'])
    const baseH = Number(params['base_thick'])
    const margin = Number(params['margin'])
    const rad = Number(params['radius'])
    const hasHoles = params['holes']

    // Calculate exact layout in JS to keep SCAD simple
    const charSpacing = size * 0.75;
    const textWidth = text.length * charSpacing;
    const totalW = textWidth + (margin * 2);
    const totalH = size + (margin * 2);

    return `
${STROKE_FONT_MODULE}

// --- Parameters ---
text_str = "${text}";
font_size = ${size};
text_relief = ${textH};
base_h = ${baseH};
width = ${totalW};
height = ${totalH};
rad = ${rad};
hole_d = 4; // 4mm screw holes

$fn = 60;

// --- Main Geometry ---

difference() {
    // 1. Base Plate (Hull method for perfect dimensions)
    hull() {
        translate([-width/2 + rad, -height/2 + rad, 0]) cylinder(r=rad, h=base_h);
        translate([ width/2 - rad, -height/2 + rad, 0]) cylinder(r=rad, h=base_h);
        translate([ width/2 - rad,  height/2 - rad, 0]) cylinder(r=rad, h=base_h);
        translate([-width/2 + rad,  height/2 - rad, 0]) cylinder(r=rad, h=base_h);
    }

    // 2. Mounting Holes (Optional)
    if (${hasHoles}) {
        // Calculate hole position based on margin
        offset_x = width/2 - max(rad, 6);
        offset_y = height/2 - max(rad, 6);

        translate([ offset_x,  offset_y, -1]) cylinder(h=base_h+2, d=hole_d);
        translate([-offset_x,  offset_y, -1]) cylinder(h=base_h+2, d=hole_d);
        // Only 4 holes if the sign is tall enough, otherwise just 2
        if (height > 40) {
            translate([ offset_x, -offset_y, -1]) cylinder(h=base_h+2, d=hole_d);
            translate([-offset_x, -offset_y, -1]) cylinder(h=base_h+2, d=hole_d);
        }
    }
}

// 3. Text Generation
// We position this *exactly* on top of the base.
// Slicers will see this as a separate mesh, making color changes easy.
translate([-(len(text_str) * font_size * 0.75) / 2, -font_size/2, base_h]) {
    linear_extrude(height = text_relief) {
        for (i = [0 : len(text_str) - 1]) {
            translate([i * font_size * 0.75, 0, 0])
                stroke_char_2d(text_str[i], font_size, 1);
        }
    }
}
`
  }
}
