import type { ManifoldGenerator } from './types'

export const gearGenerator: ManifoldGenerator = {
  id: 'spur_gear',
  type: 'manifold',
  builderId: 'spur_gear',
  name: 'Spur Gear',
  description: 'A parametric spur gear with optional hub',
  parameters: [
    {
      type: 'number',
      name: 'teeth',
      label: 'Number of Teeth',
      min: 8, max: 100, default: 20, step: 1, unit: '',
      dynamicMax: (params) => {
        const mod = Number(params['module']) || 2
        // Limit to mod * 15 to ensure robust tooth geometry
        // Ensure we never return less than param.min (8)
        return Math.max(8, Math.floor(mod * 15))
      }
    },
    {
      type: 'number',
      name: 'module',
      label: 'Module (Size)',
      min: 0.5, max: 10, default: 2, step: 0.1, unit: 'mm',
      description: 'Determines overall size. Pitch Diameter = Teeth * Module'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Gear Height',
      min: 2, max: 50, default: 5, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'bore_diameter',
      label: 'Bore Diameter',
      min: 0, max: 50, default: 5, step: 0.5, unit: 'mm',
      description: 'Center hole diameter (0 for solid)'
    },
    {
      type: 'number',
      name: 'pressure_angle',
      label: 'Pressure Angle',
      min: 14.5, max: 30, default: 20, step: 0.5, unit: 'deg',
      description: 'Standard is 20 degrees'
    },
    {
      type: 'number',
      name: 'tolerance',
      label: 'Fit Tolerance',
      min: 0, max: 0.5, default: 0, step: 0.05, unit: 'mm',
      description: 'Increases backlash for better printing fit'
    },
    {
      type: 'number',
      name: 'tip_sharpness',
      label: 'Tip Sharpness',
      min: 0, max: 1, default: 0, step: 0.1, unit: '',
      description: '0 = flat tip (standard), 1 = pointed tip'
    },
    {
      type: 'boolean',
      name: 'include_hub',
      label: 'Include Hub',
      default: true,
      children: [
        {
          type: 'number',
          name: 'hub_diameter',
          label: 'Hub Diameter',
          min: 5, max: 100, default: 15, step: 1, unit: 'mm',
          dynamicMin: (params) => {
            const boreDiameter = Number(params['bore_diameter']) || 5
            // Hub must be at least bore + 4mm wall
            return boreDiameter + 4
          },
          dynamicMax: (params) => {
            const teeth = Number(params['teeth']) || 20
            const mod = Number(params['module']) || 2
            // Root diameter = pitch diameter - 2.5 * module
            const rootDiameter = mod * (teeth - 2.5)
            return Math.floor(rootDiameter)
          }
        },
        {
          type: 'number',
          name: 'hub_height',
          label: 'Hub Height',
          min: 0, max: 50, default: 5, step: 1, unit: 'mm',
          description: 'Extension height above the gear face'
        }
      ]
    }
  ]
}
