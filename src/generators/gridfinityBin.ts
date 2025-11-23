import type { ScadGenerator, ParameterValues, QualityLevel } from './types'
import { getQualityFn } from './types'

/**
 * Gridfinity Extended Bin Generator
 *
 * A simplified implementation inspired by Gridfinity Extended OpenSCAD.
 * https://github.com/ostat/gridfinity_extended_openscad
 *
 * Based on the Gridfinity modular storage system specification.
 * https://gridfinity.xyz/specification/
 *
 * ## Upstream Sync
 * Reference commit: ostat/gridfinity_extended_openscad @ 2024-02-17 (v2024-02-17)
 * Last reviewed: 2025-11-22
 *
 * ## Feature Parity with gridfinity_extended_openscad
 *
 * Implemented:
 * - [x] Grid-based dimensions (42mm pitch, 7mm z-pitch)
 * - [x] Proper base profile (lower taper → riser → upper taper)
 * - [x] Magnet holes (6.5mm × 2.4mm)
 * - [x] Screw holes (3mm × 6mm)
 * - [x] Lip styles (normal, reduced, minimum, none)
 * - [x] Label slots (gflabel, pred styles)
 * - [x] Interior dividers (X and Y)
 * - [x] Finger slide cutout
 * - [x] Configurable wall/floor thickness
 *
 * Not implemented (potential future additions):
 * - [ ] Engraved text labels (requires textmetrics - not supported in WASM)
 * - [ ] Sliding lid system
 * - [ ] Wall patterns (grid, hexgrid, voronoi, brick)
 * - [ ] Efficient floor (material-saving option)
 * - [ ] Tapered corners
 * - [ ] Wall cutouts (custom positions)
 * - [ ] Half-pitch offset support
 * - [ ] Irregular subdivisions
 * - [ ] Bent separators
 *
 * ## Key Dimensions
 * - Grid pitch: 42mm x 42mm
 * - Height unit: 7mm
 * - Base height: 5mm (0.8 + 1.8 + 2.15 + 0.25)
 * - Lip height: ~4.4mm
 * - Corner radius: 3.75mm
 * - Magnet: 6.5mm diameter x 2.4mm thick
 * - Screw: 3mm diameter x 6mm deep
 */

function getBinParams(params: ParameterValues) {
  const gridX = Math.max(1, Math.floor(Number(params['grid_x'])))
  const gridY = Math.max(1, Math.floor(Number(params['grid_y'])))
  const gridZ = Math.max(1, Math.floor(Number(params['grid_z'])))
  const enableMagnets = Boolean(params['enable_magnets'])
  const enableScrews = Boolean(params['enable_screws'])
  const lipStyle = String(params['lip_style'] || 'normal')
  const labelStyle = String(params['label_style'] || 'none')
  const labelPosition = String(params['label_position'] || 'front')
  const dividersX = Math.max(0, Math.floor(Number(params['dividers_x'] || 0)))
  const dividersY = Math.max(0, Math.floor(Number(params['dividers_y'] || 0)))
  const fingerSlide = Boolean(params['finger_slide'])
  const wallThickness = Math.max(0.8, Math.min(Number(params['wall_thickness'] || 1.2), 3))
  const floorThickness = Math.max(0.7, Math.min(Number(params['floor_thickness'] || 0.7), 3))
  const quality = (params['_quality'] as QualityLevel) || 'normal'

  return {
    gridX,
    gridY,
    gridZ,
    enableMagnets,
    enableScrews,
    lipStyle,
    labelStyle,
    labelPosition,
    dividersX,
    dividersY,
    fingerSlide,
    wallThickness,
    floorThickness,
    quality
  }
}

function getGridfinityPreamble(p: ReturnType<typeof getBinParams>) {
  return `// Gridfinity Extended Bin Generator
// Inspired by: https://github.com/ostat/gridfinity_extended_openscad
// Specification: https://gridfinity.xyz/specification/

// === GRIDFINITY CONSTANTS ===
gf_pitch = 42;           // Grid pitch (mm)
gf_zpitch = 7;           // Height unit (mm)
gf_clearance = 0.5;      // Clearance from grid edge
gf_corner_radius = 3.75; // Cup corner radius

// Base profile heights
gf_base_lower_taper = 0.8;
gf_base_riser = 1.8;
gf_base_upper_taper = 2.15;
gf_base_height = 5;      // Total base height

// Lip profile heights
gf_lip_lower_taper = 0.7;
gf_lip_riser = 1.8;
gf_lip_upper_taper = 1.9;
gf_lip_height = 4.4;

// Attachment dimensions
gf_magnet_d = 6.5;
gf_magnet_h = 2.4;
gf_screw_d = 3;
gf_screw_h = 6;
gf_attachment_pos = 4.8;  // Distance from corner

// Label slot dimensions (gflabel standard)
gf_label_width = 36.4;   // Label slot width
gf_label_height = 11;    // Label slot height (into lip)
gf_label_depth = 1.2;    // Label slot depth
gf_label_radius = 0.25;  // Corner radius

// Pred label dimensions
gf_pred_label_width = 36;
gf_pred_label_height = 12;
gf_pred_label_depth = 1;
gf_pred_tab_width = 1;
gf_pred_tab_height = 6.7;

// === USER PARAMETERS ===
grid_x = ${p.gridX};
grid_y = ${p.gridY};
grid_z = ${p.gridZ};
enable_magnets = ${p.enableMagnets};
enable_screws = ${p.enableScrews};
lip_style = "${p.lipStyle}";
label_style = "${p.labelStyle}";
label_position = "${p.labelPosition}";
dividers_x = ${p.dividersX};
dividers_y = ${p.dividersY};
finger_slide = ${p.fingerSlide};
wall_thickness = ${p.wallThickness};
floor_thickness = ${p.floorThickness};

${getQualityFn(p.quality)}

// === DERIVED DIMENSIONS ===
bin_width = grid_x * gf_pitch - gf_clearance;
bin_depth = grid_y * gf_pitch - gf_clearance;
bin_height = grid_z * gf_zpitch + gf_base_height;
inner_width = bin_width - wall_thickness * 2;
inner_depth = bin_depth - wall_thickness * 2;
cavity_height = bin_height - gf_base_height - floor_thickness;

// Lip adjustment based on style
lip_h = lip_style == "normal" ? gf_lip_height :
        lip_style == "reduced" ? gf_lip_lower_taper + gf_lip_riser :
        lip_style == "minimum" ? gf_lip_lower_taper : 0;

// === MODULES ===

// Rounded rectangle at origin (optimized: uses offset instead of hull)
module rounded_rect(w, d, h, r) {
    r_safe = min(r, w/2 - 0.01, d/2 - 0.01);
    if (r_safe > 0) {
        linear_extrude(height=h)
            translate([r_safe, r_safe, 0])
                offset(r=r_safe)
                    square([w - 2*r_safe, d - 2*r_safe]);
    } else {
        cube([w, d, h]);
    }
}

// 2D rounded square for base profile (optimized: avoids hull)
module base_profile_2d(size, r) {
    r_safe = min(r, size/2 - 0.01);
    if (r_safe > 0) {
        translate([r_safe, r_safe])
            offset(r=r_safe)
                square([size - 2*r_safe, size - 2*r_safe]);
    } else {
        square([size, size]);
    }
}

// Single base unit profile (the stepped base that sits in baseplate)
// Optimized: uses linear_extrude with scale instead of hull()
module base_unit() {
    base_size_outer = gf_pitch - gf_clearance;
    base_size_inner = gf_pitch - gf_clearance - 1.6;
    scale_factor = base_size_inner / base_size_outer;

    // Lower taper (0.8mm, 45 deg inward) - using linear_extrude with scale
    linear_extrude(height=gf_base_lower_taper, scale=scale_factor)
        base_profile_2d(base_size_outer, gf_corner_radius + 0.8);

    // Riser (1.8mm vertical)
    translate([0.8, 0.8, gf_base_lower_taper])
        linear_extrude(height=gf_base_riser)
            base_profile_2d(base_size_inner, gf_corner_radius);

    // Upper taper (2.15mm, 45 deg outward) - using linear_extrude with scale
    translate([0.8, 0.8, gf_base_lower_taper + gf_base_riser])
        linear_extrude(height=gf_base_upper_taper, scale=1/scale_factor)
            base_profile_2d(base_size_inner, gf_corner_radius);

    // Top flat to reach base_height
    translate([0, 0, gf_base_lower_taper + gf_base_riser + gf_base_upper_taper])
        linear_extrude(height=0.25)
            base_profile_2d(base_size_outer, gf_corner_radius + 0.8);
}

// Magnet hole (low $fn - internal cutout doesn't need high resolution)
module magnet_hole() {
    translate([0, 0, -0.01])
        cylinder(d=gf_magnet_d, h=gf_magnet_h + 0.01, $fn=24);
}

// Screw hole (low $fn - internal cutout doesn't need high resolution)
module screw_hole() {
    translate([0, 0, -0.01])
        cylinder(d=gf_screw_d, h=gf_screw_h + 0.01, $fn=16);
}

// Attachment holes for one grid cell corner
module corner_attachments(cell_x, cell_y) {
    // Position relative to cell origin
    px = cell_x * gf_pitch + gf_attachment_pos;
    py = cell_y * gf_pitch + gf_attachment_pos;

    translate([px, py, 0]) {
        if (enable_magnets) magnet_hole();
        if (enable_screws) screw_hole();
    }
}

// All base units for the bin
module bin_base() {
    difference() {
        // Base units in grid pattern
        for (x = [0:grid_x-1]) {
            for (y = [0:grid_y-1]) {
                translate([x * gf_pitch, y * gf_pitch, 0])
                    base_unit();
            }
        }

        // Attachment holes at corners only (standard Gridfinity)
        if (enable_magnets || enable_screws) {
            // Four corners of the bin
            corner_attachments(0, 0);
            corner_attachments(grid_x - 1, 0);
            corner_attachments(0, grid_y - 1);
            corner_attachments(grid_x - 1, grid_y - 1);

            // Mirror positions for opposite corners of each corner cell
            translate([gf_pitch - 2*gf_attachment_pos, 0, 0]) corner_attachments(0, 0);
            translate([0, gf_pitch - 2*gf_attachment_pos, 0]) corner_attachments(0, 0);
            translate([gf_pitch - 2*gf_attachment_pos, gf_pitch - 2*gf_attachment_pos, 0]) corner_attachments(0, 0);

            translate([gf_pitch - 2*gf_attachment_pos, 0, 0]) corner_attachments(grid_x - 1, 0);
            translate([0, gf_pitch - 2*gf_attachment_pos, 0]) corner_attachments(grid_x - 1, 0);
            translate([gf_pitch - 2*gf_attachment_pos, gf_pitch - 2*gf_attachment_pos, 0]) corner_attachments(grid_x - 1, 0);

            translate([gf_pitch - 2*gf_attachment_pos, 0, 0]) corner_attachments(0, grid_y - 1);
            translate([0, gf_pitch - 2*gf_attachment_pos, 0]) corner_attachments(0, grid_y - 1);
            translate([gf_pitch - 2*gf_attachment_pos, gf_pitch - 2*gf_attachment_pos, 0]) corner_attachments(0, grid_y - 1);

            translate([gf_pitch - 2*gf_attachment_pos, 0, 0]) corner_attachments(grid_x - 1, grid_y - 1);
            translate([0, gf_pitch - 2*gf_attachment_pos, 0]) corner_attachments(grid_x - 1, grid_y - 1);
            translate([gf_pitch - 2*gf_attachment_pos, gf_pitch - 2*gf_attachment_pos, 0]) corner_attachments(grid_x - 1, grid_y - 1);
        }
    }
}

// Main bin body (walls above base)
module bin_body() {
    body_start = gf_base_height;
    body_height = bin_height - body_start;

    translate([0, 0, body_start]) {
        difference() {
            // Outer shell
            rounded_rect(bin_width, bin_depth, body_height, gf_corner_radius);

            // Inner cavity
            translate([wall_thickness, wall_thickness, floor_thickness])
                rounded_rect(inner_width, inner_depth, body_height, max(0, gf_corner_radius - wall_thickness));
        }
    }
}

// 2D lip profile for linear_extrude (optimized: avoids hull)
module lip_profile_2d(w, d, r) {
    r_safe = max(0, min(r, w/2 - 0.01, d/2 - 0.01));
    if (r_safe > 0) {
        translate([r_safe, r_safe])
            offset(r=r_safe)
                square([w - 2*r_safe, d - 2*r_safe]);
    } else {
        square([w, d]);
    }
}

// Stacking lip at top of bin (optimized: uses linear_extrude with scale)
module bin_lip() {
    if (lip_style != "none") {
        lip_start = bin_height;
        lip_w_outer = bin_width;
        lip_d_outer = bin_depth;
        lip_w_inner = bin_width - 2*gf_lip_lower_taper;
        lip_d_inner = bin_depth - 2*gf_lip_lower_taper;
        scale_inward = lip_w_inner / lip_w_outer;

        translate([0, 0, lip_start]) {
            difference() {
                union() {
                    // Lower taper (0.7mm) - angled inward using linear_extrude with scale
                    linear_extrude(height=gf_lip_lower_taper, scale=scale_inward)
                        lip_profile_2d(lip_w_outer, lip_d_outer, gf_corner_radius);

                    if (lip_style == "normal" || lip_style == "reduced") {
                        // Vertical riser (1.8mm)
                        translate([gf_lip_lower_taper, gf_lip_lower_taper, gf_lip_lower_taper])
                            linear_extrude(height=gf_lip_riser)
                                lip_profile_2d(lip_w_inner, lip_d_inner, max(0, gf_corner_radius - gf_lip_lower_taper));
                    }

                    if (lip_style == "normal") {
                        // Upper taper (1.9mm) - angled outward using linear_extrude with scale
                        translate([gf_lip_lower_taper, gf_lip_lower_taper, gf_lip_lower_taper + gf_lip_riser])
                            linear_extrude(height=gf_lip_upper_taper, scale=1/scale_inward)
                                lip_profile_2d(lip_w_inner, lip_d_inner, max(0, gf_corner_radius - gf_lip_lower_taper));
                    }
                }

                // Inner cutout - this is what allows stacking
                translate([wall_thickness, wall_thickness, -0.01])
                    rounded_rect(inner_width, inner_depth, lip_h + 0.02, max(0, gf_corner_radius - wall_thickness));
            }
        }
    }
}

// Interior dividers
module dividers() {
    if (dividers_x > 0 || dividers_y > 0) {
        divider_height = cavity_height;
        divider_base = gf_base_height + floor_thickness;

        // X dividers (running along Y)
        if (dividers_x > 0) {
            cell_width = inner_width / (dividers_x + 1);
            for (i = [1:dividers_x]) {
                translate([wall_thickness + i * cell_width - wall_thickness/2,
                          wall_thickness, divider_base])
                    cube([wall_thickness, inner_depth, divider_height]);
            }
        }

        // Y dividers (running along X)
        if (dividers_y > 0) {
            cell_depth = inner_depth / (dividers_y + 1);
            for (i = [1:dividers_y]) {
                translate([wall_thickness,
                          wall_thickness + i * cell_depth - wall_thickness/2,
                          divider_base])
                    cube([inner_width, wall_thickness, divider_height]);
            }
        }
    }
}

// Finger slide cutout on front wall
module finger_slide() {
    if (finger_slide) {
        slide_width = min(bin_width * 0.6, 60);
        slide_height = min(cavity_height * 0.5, 20);
        slide_depth = wall_thickness + 1;

        translate([bin_width/2, -0.01, bin_height - slide_height/2])
            rotate([-90, 0, 0])
                resize([slide_width, slide_height * 2, slide_depth])
                    cylinder(d=1, h=1, $fn=32);
    }
}

// Label slot - gflabel style (https://github.com/ndevenish/gflabel)
// Oriented for front wall: width=X, depth=Y (into wall), height=Z
// Optimized: uses linear_extrude with offset instead of hull()
module label_slot_gflabel() {
    rotate([90, 0, 0])
        linear_extrude(height=gf_label_depth)
            translate([gf_label_radius, gf_label_radius])
                offset(r=gf_label_radius, $fn=16)
                    square([gf_label_width - 2*gf_label_radius, gf_label_height - 2*gf_label_radius]);
}

// Label slot - pred style (https://www.printables.com/model/592545)
// Oriented for front wall: width=X, depth=Y (into wall), height=Z
module label_slot_pred() {
    // Main slot
    cube([gf_pred_label_width, gf_pred_label_depth, gf_pred_label_height]);
    // Side tabs for grip
    translate([-gf_pred_tab_width, 0, (gf_pred_label_height - gf_pred_tab_height)/2])
        cube([gf_pred_label_width + 2*gf_pred_tab_width, gf_pred_label_depth, gf_pred_tab_height]);
}

// Get label slot based on style
module label_slot() {
    if (label_style == "gflabel") {
        label_slot_gflabel();
    } else if (label_style == "pred") {
        label_slot_pred();
    }
}

// Get label width based on style
function get_label_width() =
    label_style == "gflabel" ? gf_label_width :
    label_style == "pred" ? gf_pred_label_width : 0;

// Position and cut label slots on specified walls
module label_cutouts() {
    if (label_style != "none" && lip_style != "none") {
        label_w = get_label_width();
        label_h = label_style == "gflabel" ? gf_label_height : gf_pred_label_height;

        // Position label in the riser section of the lip
        label_z = bin_height + gf_lip_lower_taper;

        // Front wall (Y=0) - slot extends into +Y direction
        if (label_position == "front" || label_position == "all") {
            translate([(bin_width - label_w)/2, -0.01, label_z])
                label_slot();
        }

        // Back wall (Y=max) - rotate 180° so slot extends into -Y direction
        if (label_position == "back" || label_position == "all") {
            translate([(bin_width + label_w)/2, bin_depth + 0.01, label_z])
                rotate([0, 0, 180])
                    label_slot();
        }

        // Left wall (X=0) - rotate -90° so slot extends into +X direction
        if (label_position == "left" || label_position == "all") {
            if (bin_depth >= label_w + 4) {
                translate([-0.01, (bin_depth + label_w)/2, label_z])
                    rotate([0, 0, -90])
                        label_slot();
            }
        }

        // Right wall (X=max) - rotate 90° so slot extends into -X direction
        if (label_position == "right" || label_position == "all") {
            if (bin_depth >= label_w + 4) {
                translate([bin_width + 0.01, (bin_depth - label_w)/2, label_z])
                    rotate([0, 0, 90])
                        label_slot();
            }
        }
    }
}

// Complete gridfinity bin
module gridfinity_bin() {
    difference() {
        union() {
            bin_base();
            bin_body();
            bin_lip();
            dividers();
        }
        finger_slide();
        label_cutouts();
    }
}
`
}

export const gridfinityBinGenerator: ScadGenerator = {
  id: 'gridfinity_bin',
  name: 'Gridfinity Extended Bin',
  description: 'Modular storage bin based on Gridfinity Extended',
  parameters: [
    {
      type: 'number',
      name: 'grid_x',
      label: 'Width',
      min: 1,
      max: 6,
      default: 2,
      step: 1,
      unit: 'units',
      description: 'Width in grid units (42mm each)'
    },
    {
      type: 'number',
      name: 'grid_y',
      label: 'Depth',
      min: 1,
      max: 6,
      default: 2,
      step: 1,
      unit: 'units',
      description: 'Depth in grid units (42mm each)'
    },
    {
      type: 'number',
      name: 'grid_z',
      label: 'Height',
      min: 1,
      max: 10,
      default: 3,
      step: 1,
      unit: 'units',
      description: 'Height in grid units (7mm each)'
    },
    {
      type: 'select',
      name: 'lip_style',
      label: 'Lip Style',
      options: ['normal', 'reduced', 'minimum', 'none'],
      default: 'normal',
      description: 'Stacking lip profile (normal=full stackable)'
    },
    {
      type: 'select',
      name: 'label_style',
      label: 'Label Slot',
      options: ['none', 'gflabel', 'pred'],
      default: 'none',
      description: 'Label slot style for printed labels'
    },
    {
      type: 'select',
      name: 'label_position',
      label: 'Label Position',
      options: ['front', 'back', 'left', 'right', 'all'],
      default: 'front',
      description: 'Which wall(s) to add label slots'
    },
    {
      type: 'boolean',
      name: 'enable_magnets',
      label: 'Magnet Holes',
      default: false,
      description: '6.5mm x 2.4mm magnet pockets'
    },
    {
      type: 'boolean',
      name: 'enable_screws',
      label: 'Screw Holes',
      default: false,
      description: '3mm x 6mm screw holes'
    },
    {
      type: 'number',
      name: 'dividers_x',
      label: 'Dividers (Width)',
      min: 0,
      max: 5,
      default: 0,
      step: 1,
      unit: '',
      description: 'Number of dividers along width',
      dynamicMax: (params) => {
        const gridX = Number(params['grid_x']) || 2
        return Math.max(0, gridX * 2 - 1)
      }
    },
    {
      type: 'number',
      name: 'dividers_y',
      label: 'Dividers (Depth)',
      min: 0,
      max: 5,
      default: 0,
      step: 1,
      unit: '',
      description: 'Number of dividers along depth',
      dynamicMax: (params) => {
        const gridY = Number(params['grid_y']) || 2
        return Math.max(0, gridY * 2 - 1)
      }
    },
    {
      type: 'boolean',
      name: 'finger_slide',
      label: 'Finger Slide',
      default: false,
      description: 'Cutout on front wall for easier access'
    },
    {
      type: 'number',
      name: 'wall_thickness',
      label: 'Wall Thickness',
      min: 0.8,
      max: 2.5,
      default: 1.2,
      step: 0.1,
      unit: 'mm'
    },
    {
      type: 'number',
      name: 'floor_thickness',
      label: 'Floor Thickness',
      min: 0.7,
      max: 3,
      default: 0.7,
      step: 0.1,
      unit: 'mm'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const p = getBinParams(params)
    return getGridfinityPreamble(p) + `
// Render the bin
gridfinity_bin();
`
  }
}
