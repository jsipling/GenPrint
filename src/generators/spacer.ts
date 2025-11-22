import type { Generator, ParameterValues } from './types'

export const spacerGenerator: Generator = {
  id: 'cylindrical-spacer',
  name: 'Cylindrical Spacer',
  description: 'A robust spacer with chamfered edges to prevent elephant\'s foot.',
  parameters: [
    {
      type: 'number',
      name: 'outer_diameter',
      label: 'Outer Diameter',
      min: 5, max: 100, default: 20, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'inner_hole',
      label: 'Inner Hole',
      min: 2, max: 90, default: 5, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 1, max: 100, default: 10, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'chamfer',
      label: 'Chamfer Size',
      min: 0, max: 5, default: 0.5, step: 0.1, unit: 'mm',
      description: 'Beveled edges ease assembly and fix printing flare.'
    }
  ],
  scadTemplate: (params: ParameterValues) => {
    const od = Number(params['outer_diameter'])
    const id = Number(params['inner_hole'])
    const h = Number(params['height'])
    let chamfer = Number(params['chamfer'])

    // --- Safety Checks (JS Logic) ---

    // 1. Ensure wall thickness is at least 0.8mm (common nozzle width x2)
    const maxId = od - 1.6;
    const safeId = Math.min(id, maxId);

    // 2. Ensure chamfer isn't too big for the wall thickness
    // (Wall thickness / 2) - 0.1 safety margin
    const wallThickness = (od - safeId) / 2;
    const maxChamferWall = wallThickness / 2 - 0.1;

    // 3. Ensure chamfer isn't too big for the height
    const maxChamferHeight = h / 2 - 0.1;

    // Apply safest chamfer limit
    const safeChamfer = Math.max(0, Math.min(chamfer, maxChamferWall, maxChamferHeight));

    return `
// Dimensions
od = ${od};
id = ${safeId};
height = ${h};
c = ${safeChamfer};

// Dynamic resolution based on size
$fn = max(32, od * 3);

// Use Rotate Extrude of a 2D profile
// This is much faster and cleaner than 3D boolean operations
rotate_extrude() {
    // Define the cross-section points (Clockwise)
    polygon(points=[
        [id/2, c],              // Inner bottom start
        [id/2 + c, 0],          // Inner bottom chamfer
        [od/2 - c, 0],          // Outer bottom chamfer
        [od/2, c],              // Outer bottom start
        [od/2, height - c],     // Outer top start
        [od/2 - c, height],     // Outer top chamfer
        [id/2 + c, height],     // Inner top chamfer
        [id/2, height - c]      // Inner top start
    ]);
}
`
  }
}
