import type { ManifoldGenerator } from './types'

export const hookGenerator: ManifoldGenerator = {
  id: 'hook',
  type: 'manifold',
  builderId: 'hook',
  name: 'Hook',
  description: 'A simple wall hook for hanging items',
  parameters: [
    {
      type: 'number',
      name: 'width',
      label: 'Width',
      min: 10, max: 50, default: 15, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hook_depth',
      label: 'Hook Depth',
      min: 15, max: 60, default: 25, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hook_height',
      label: 'Hook Height',
      min: 20, max: 80, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'thickness',
      label: 'Thickness',
      min: 4, max: 10, default: 5, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hole_diameter',
      label: 'Hole Diameter',
      min: 0, max: 8, default: 4, step: 0.5, unit: 'mm',
      dynamicMax: (params) => {
        const thickness = Number(params['thickness']) || 5
        // Leave at least 1.2mm material around hole (AGENTS.md minimum)
        return Math.max(0, thickness - 1.2)
      }
    }
  ]
}
