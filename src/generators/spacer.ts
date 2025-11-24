import type { ManifoldGenerator } from './types'

export const spacerGenerator: ManifoldGenerator = {
  id: 'spacer',
  type: 'manifold',
  builderId: 'spacer',
  name: 'Spacer',
  description: 'A simple cylindrical spacer with a center hole',
  parameters: [
    {
      type: 'number',
      name: 'outer_diameter',
      label: 'Outer Diameter',
      min: 10, max: 100, default: 20, step: 1, unit: 'mm',
      dynamicMin: (params) => {
        const innerHole = Number(params['inner_hole']) || 5
        // Outer must be at least inner + 2.4mm wall (1.2mm per side per AGENTS.md)
        return innerHole + 2.4
      }
    },
    {
      type: 'number',
      name: 'inner_hole',
      label: 'Inner Hole',
      min: 2, max: 50, default: 5, step: 0.5, unit: 'mm',
      dynamicMax: (params) => {
        const outerDiameter = Number(params['outer_diameter']) || 20
        // Leave at least 2.4mm wall thickness (1.2mm per side per AGENTS.md)
        return outerDiameter - 2.4
      }
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 1.5, max: 50, default: 5, step: 0.5, unit: 'mm'
    }
  ]
}
