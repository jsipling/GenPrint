import type { ManifoldGenerator } from './types'

export const signGenerator: ManifoldGenerator = {
  id: 'custom-sign',
  type: 'manifold',
  builderId: 'sign',
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
  ]
}
