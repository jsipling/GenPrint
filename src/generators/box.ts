import type { ManifoldGenerator } from './types'

export const boxGenerator: ManifoldGenerator = {
  id: 'box',
  type: 'manifold',
  builderId: 'box',
  name: 'Box',
  description: 'A customizable box with optional lid',
  parameters: [
    {
      type: 'number',
      name: 'width',
      label: 'Width',
      min: 20, max: 200, default: 50, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'depth',
      label: 'Depth',
      min: 20, max: 200, default: 50, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 10, max: 100, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'wall_thickness',
      label: 'Wall Thickness',
      min: 1.2, max: 5, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'corner_radius',
      label: 'Corner Radius',
      min: 0, max: 10, default: 3, step: 1, unit: 'mm',
      dynamicMax: (params) => {
        const width = Number(params['width']) || 50
        const depth = Number(params['depth']) || 50
        const wall = Number(params['wall_thickness']) || 2
        // Corner radius limited by smaller dimension minus wall
        return Math.floor(Math.min(width, depth) / 2 - wall)
      }
    },
    {
      type: 'boolean',
      name: 'include_lid',
      label: 'Include Lid',
      default: true,
      children: [
        {
          type: 'number',
          name: 'lid_height',
          label: 'Lid Height',
          min: 4, max: 40, default: 8, step: 0.5, unit: 'mm'
        },
        {
          type: 'number',
          name: 'lid_clearance',
          label: 'Lid Clearance',
          min: 0, max: 1, default: 0.2, step: 0.05, unit: 'mm',
          description: 'Gap between lid lip and box walls for easy fit'
        },
        {
          type: 'number',
          name: 'lid_lip_height',
          label: 'Lid Lip Height',
          min: 2, max: 30, default: 5, step: 0.5, unit: 'mm',
          description: 'How far the lid lip extends into the box'
        }
      ]
    },
    {
      type: 'number',
      name: 'bottom_thickness',
      label: 'Bottom Thickness',
      min: 1.2, max: 10, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'dividers_x',
      label: 'Dividers (Width)',
      min: 0, max: 10, default: 0, step: 1, unit: '',
      description: 'Number of dividers along width'
    },
    {
      type: 'number',
      name: 'dividers_y',
      label: 'Dividers (Depth)',
      min: 0, max: 10, default: 0, step: 1, unit: '',
      description: 'Number of dividers along depth'
    },
    {
      type: 'boolean',
      name: 'finger_grip',
      label: 'Finger Grip',
      default: false
    },
    {
      type: 'boolean',
      name: 'stackable',
      label: 'Stackable',
      default: false
    }
  ]
}
