import type { ManifoldGenerator } from './types'

export const bracketGenerator: ManifoldGenerator = {
  id: 'bracket',
  type: 'manifold',
  builderId: 'bracket',
  name: 'Bracket',
  description: 'An L-bracket with mounting holes for corner reinforcement.',
  parameters: [
    {
      type: 'number',
      name: 'width',
      label: 'Width',
      min: 10, max: 100, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'arm_length',
      label: 'Arm Length',
      min: 15, max: 150, default: 40, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'thickness',
      label: 'Thickness',
      min: 3, max: 15, default: 4, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hole_diameter',
      label: 'Hole Diameter',
      min: 2, max: 12, default: 5, step: 0.5, unit: 'mm',
      dynamicMax: (params) => {
        const width = Number(params['width']) || 30
        // Leave at least 4mm wall around hole
        return width - 4
      }
    },
    {
      type: 'number',
      name: 'fillet_radius',
      label: 'Fillet Radius',
      min: 0, max: 20, default: 5, step: 1, unit: 'mm',
      dynamicMax: (params) => {
        const armLength = Number(params['arm_length']) || 40
        const thickness = Number(params['thickness']) || 4
        // Fillet can't exceed arm length minus thickness
        return armLength - thickness
      }
    },
    {
      type: 'number',
      name: 'hole_count_arm_1',
      label: 'Hole Count Arm 1',
      min: 0, max: 10, default: 1, step: 1
    },
    {
      type: 'number',
      name: 'hole_count_arm_2',
      label: 'Hole Count Arm 2',
      min: 0, max: 10, default: 1, step: 1
    },
    {
      type: 'boolean',
      name: 'add_rib',
      label: 'Add Rib',
      default: true,
      children: [
        {
          type: 'number',
          name: 'rib_thickness',
          label: 'Rib Thickness',
          min: 1, max: 10, default: 4, step: 0.5, unit: 'mm'
        }
      ]
    }
  ]
}
