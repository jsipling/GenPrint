import type { ManifoldGenerator } from './types'

export const thumbKnobGenerator: ManifoldGenerator = {
  id: 'thumb-knob',
  type: 'manifold',
  builderId: 'thumb_knob',
  name: 'Thumb Knob',
  description: 'A grip handle for standard hex bolts/nuts (e.g., M3). Turns a screw into a thumb-screw.',
  parameters: [
    {
      type: 'select',
      name: 'screw_size',
      label: 'Screw Size',
      options: ['M3', 'M4', 'M5', 'M6', 'M8'],
      default: 'M3'
    },
    {
      type: 'number',
      name: 'knob_diameter',
      label: 'Knob Diameter',
      min: 10,
      max: 50,
      default: 15,
      step: 1,
      unit: 'mm',
      dynamicMin: (params) => {
        // Hex flat-to-flat dimensions by screw size
        const hexFlats: Record<string, number> = {
          'M3': 5.5, 'M4': 7.0, 'M5': 8.0, 'M6': 10.0, 'M8': 13.0
        }
        const size = String(params['screw_size']) || 'M3'
        const tol = Number(params['tolerance']) || 0.15
        const hexFlat = hexFlats[size] || 5.5
        // Hex diameter (corner-to-corner) + wall + ridge depth
        const hexD = (hexFlat + tol * 2) / 0.866025
        return Math.ceil(hexD + 9)
      }
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 4,
      max: 30,
      default: 6,
      step: 1,
      unit: 'mm'
    },
    {
      type: 'select',
      name: 'style',
      label: 'Grip Style',
      options: ['Knurled', 'Lobed', 'Hexagonal'],
      default: 'Knurled'
    },
    {
      type: 'number',
      name: 'tolerance',
      label: 'Fit Tolerance',
      min: 0,
      max: 0.6,
      default: 0.15,
      step: 0.05,
      unit: 'mm',
      description: 'Extra gap for the hex head.'
    }
  ]
}
