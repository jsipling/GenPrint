import type { Generator } from './types'

export default {
  id: 'cable_clip',
  name: 'Cable Clip',
  description: 'A C-shaped clip for organizing and securing cables',
  parameters: [
    {
      type: 'number',
      name: 'cable_diameter',
      label: 'Cable Diameter',
      min: 2, max: 25, default: 6, step: 0.5, unit: 'mm',
      description: 'Diameter of the cable to hold'
    },
    {
      type: 'number',
      name: 'wall_thickness',
      label: 'Wall Thickness',
      min: 1.2, max: 5, default: 2, step: 0.2, unit: 'mm'
    },
    {
      type: 'number',
      name: 'width',
      label: 'Clip Width',
      min: 5, max: 30, default: 10, step: 1, unit: 'mm',
      description: 'Width along the cable axis'
    },
    {
      type: 'number',
      name: 'gap_width',
      label: 'Gap Width',
      min: 1, max: 10, default: 2, step: 0.5, unit: 'mm',
      description: 'Opening size for cable snap-in',
      dynamicMax: (params) => {
        const cableDia = Number(params['cable_diameter']) || 6
        return cableDia * 0.8
      }
    },
    {
      type: 'boolean',
      name: 'has_base',
      label: 'Add Mounting Base',
      default: true,
      children: [
        {
          type: 'boolean',
          name: 'has_hole',
          label: 'Add Mounting Hole',
          default: true,
          children: [
            {
              type: 'number',
              name: 'hole_diameter',
              label: 'Hole Diameter',
              min: 2, max: 8, default: 4, step: 0.5, unit: 'mm',
              dynamicMax: (params) => {
                const wallThickness = Number(params['wall_thickness']) || 2
                const cableDia = Number(params['cable_diameter']) || 6
                const outerRadius = cableDia / 2 + wallThickness
                const baseDepth = outerRadius + wallThickness
                return Math.max(2, baseDepth - 2.4)
              }
            }
          ]
        }
      ]
    }
  ],
  displayDimensions: [
    { label: 'Cable', param: 'cable_diameter', format: '⌀{value}mm' },
    { label: 'Width', param: 'width' },
    { label: 'Gap', param: 'gap_width' }
  ],
  builderCode: `
const cableDiameter = Number(params['cable_diameter']) || 6
const wallThickness = Math.max(Number(params['wall_thickness']) || 2, constants.MIN_WALL_THICKNESS)
const width = Number(params['width']) || 10
const gapWidth = Number(params['gap_width']) || 2
const hasBase = Boolean(params['has_base'])
const hasHole = Boolean(params['has_hole'])
const holeDiameter = Number(params['hole_diameter']) || 4

const innerRadius = cableDiameter / 2
const outerRadius = innerRadius + wallThickness
const outerDiameter = outerRadius * 2

// Create main tube (C-shaped when we cut the gap)
const mainTube = tube(width, outerRadius, innerRadius)

// Create gap cutting block at top of clip
const gapHeight = outerRadius + 1
const gapBlock = box(gapWidth, gapHeight, width + 2, false)
  .translate(-gapWidth / 2, 0, -1)

// Cut gap to create C-shape
let clip = difference(mainTube, gapBlock)

// Add mounting base if requested
if (hasBase) {
  const baseThickness = wallThickness
  const baseWidth = outerDiameter + 6
  const baseDepth = outerRadius + baseThickness

  const basePlate = box(baseWidth, baseDepth, width, false)
    .translate(-baseWidth / 2, -outerRadius - baseThickness, 0)

  clip = union(clip, basePlate)

  // Add mounting hole in base if requested
  if (hasHole && holeDiameter > 0) {
    const safeHoleDia = Math.min(holeDiameter, baseDepth - constants.MIN_WALL_THICKNESS * 2)
    const holeY = -outerRadius - baseThickness / 2
    const holeZ = width / 2

    const mountHole = hole(safeHoleDia, baseWidth + 2)
      .rotate(0, 90, 0)
      .translate(-baseWidth / 2 - 1, holeY, holeZ)

    clip = difference(clip, mountHole)
  }
}

return clip
`
} satisfies Generator
