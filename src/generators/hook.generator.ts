import type { Generator } from './types'

export default {
  id: 'hook',
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
        const width = Number(params['width']) || 15
        const maxFromTop = 3 * thickness - 2.4
        const maxFromSides = width - 2.4
        return Math.max(0, Math.min(maxFromTop, maxFromSides))
      }
    }
  ],
  builderCode: `
const width = Number(params['width']) || 15
const hookDepth = Number(params['hook_depth']) || 25
const hookHeight = Number(params['hook_height']) || 30
const thickness = Number(params['thickness']) || 5

// Clamp hole diameter for safety
const maxFromTop = 3 * thickness - 2.4
const maxFromSides = width - 2.4
const maxHole = Math.max(0, Math.min(maxFromTop, maxFromSides))
const holeDiameter = Math.min(Number(params['hole_diameter']) || 4, maxHole)

// L-shape profile for extrusion
const profile = [
  [0, 0],
  [hookDepth, 0],
  [hookDepth, thickness],
  [thickness, thickness],
  [thickness, hookHeight],
  [0, hookHeight]
]

let hook = extrude(profile, width)

// Add mounting hole if specified
if (holeDiameter > 0) {
  const holeY = hookHeight - thickness * 1.5
  const holeZ = width / 2
  const mountHole = hole(holeDiameter, thickness * 2)
    .rotate(0, 90, 0)
    .translate(thickness / 2, holeY, holeZ)
  hook = difference(hook, mountHole)
}

return hook
`
} satisfies Generator
