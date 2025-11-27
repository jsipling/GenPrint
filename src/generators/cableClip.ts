import type { ManifoldGenerator } from './types'

export const cableClipGenerator: ManifoldGenerator = {
  id: 'cable_clip',
  type: 'manifold',
  builderId: 'cable_clip',
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
        // Gap cannot be larger than cable diameter (cable wouldn't be held)
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
                // Leave at least 1.2mm material around hole
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
  ]
}
