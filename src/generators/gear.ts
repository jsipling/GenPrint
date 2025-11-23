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
      min: 8, max: 60, default: 20, step: 1, unit: '',
      dynamicMax: (params) => {
        const mod = Number(params['module']) || 2
        // Limit by printable outer diameter (~150mm max)
        // Outer diameter = module * (teeth + 2)
        const maxBySize = Math.floor(150 / mod - 2)
        // Limit teeth to keep them visually distinct and printable
        // Higher module = more teeth allowed since teeth are larger
        const maxByVisibility = Math.floor(mod * 15)
        return Math.max(8, Math.min(60, maxBySize, maxByVisibility))
      }
    },
    {
      type: 'number',
      name: 'module',
      label: 'Module (Size)',
      min: 1, max: 5, default: 2, step: 0.5, unit: 'mm',
      description: 'Tooth size. Pitch Diameter = Teeth × Module'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Gear Height',
      min: 2, max: 50, default: 6, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'bore_diameter',
      label: 'Bore Diameter',
      min: 0, max: 50, default: 6, step: 0.5, unit: 'mm',
      description: 'Center hole diameter (0 for solid)',
      dynamicMax: (params) => {
        const teeth = Number(params['teeth']) || 20
        const mod = Number(params['module']) || 2
        // Root diameter = teeth * module - 2.5 * module, need 4mm wall
        const rootDiameter = mod * (teeth - 2.5)
        return Math.max(0, Math.floor(rootDiameter - 4))
      }
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
      min: 0, max: 0.5, default: 0.2, step: 0.05, unit: 'mm',
      description: 'Increases backlash for better printing fit'
    },
    {
      type: 'number',
      name: 'tip_sharpness',
      label: 'Tip Sharpness',
      min: 0, max: 0.3, default: 0, step: 0.1, unit: '',
      description: '0 = flat tip (recommended for FDM), higher values risk fragile tips'
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
