import type { ManifoldGenerator } from './types'

export const washerGenerator: ManifoldGenerator = {
  id: 'washer',
  type: 'manifold',
  builderId: 'washer',
  name: 'Washer',
  description: 'A flat ring washer with configurable dimensions.',
  displayDimensions: [
    { label: 'OD', param: 'outer_diameter', format: '⌀{value}mm' },
    { label: 'ID', param: 'inner_diameter', format: '⌀{value}mm' },
    { label: 'Thick', param: 'thickness' }
  ],
  parameters: [
    {
      type: 'number',
      name: 'outer_diameter',
      label: 'Outer Diameter',
      min: 4, max: 100, default: 12, step: 0.5, unit: 'mm',
      dynamicMin: (params) => {
        const innerD = Number(params['inner_diameter']) || 6
        // Outer must be at least inner + 2.4mm wall (1.2mm per side per AGENTS.md)
        return innerD + 2.4
      }
    },
    {
      type: 'number',
      name: 'inner_diameter',
      label: 'Inner Diameter',
      min: 2, max: 90, default: 6, step: 0.5, unit: 'mm',
      dynamicMax: (params) => {
        const outerD = Number(params['outer_diameter']) || 12
        // Leave at least 2.4mm wall thickness (1.2mm per side per AGENTS.md)
        return outerD - 2.4
      }
    },
    {
      type: 'number',
      name: 'thickness',
      label: 'Thickness',
      min: 1.2, max: 10, default: 1.5, step: 0.1, unit: 'mm'
    }
  ]
}
