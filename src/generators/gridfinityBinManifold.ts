import type { ManifoldGenerator } from './types'

/**
 * Gridfinity Extended Bin - Manifold version
 *
 * Uses manifold-3d for 10-50x faster generation compared to OpenSCAD.
 * Same parameters as the SCAD version for compatibility.
 */
export const gridfinityBinManifoldGenerator: ManifoldGenerator = {
  id: 'gridfinity_bin_manifold',
  type: 'manifold',
  builderId: 'gridfinity_bin',
  name: 'Gridfinity Bin (Fast)',
  description: 'Fast modular storage bin using Manifold geometry',
  parameters: [
    {
      type: 'number',
      name: 'grid_x',
      label: 'Width',
      min: 1,
      max: 6,
      default: 2,
      step: 1,
      unit: 'units',
      description: 'Width in grid units (42mm each)'
    },
    {
      type: 'number',
      name: 'grid_y',
      label: 'Depth',
      min: 1,
      max: 6,
      default: 2,
      step: 1,
      unit: 'units',
      description: 'Depth in grid units (42mm each)'
    },
    {
      type: 'number',
      name: 'grid_z',
      label: 'Height',
      min: 1,
      max: 10,
      default: 3,
      step: 1,
      unit: 'units',
      description: 'Height in grid units (7mm each)'
    },
    {
      type: 'select',
      name: 'lip_style',
      label: 'Lip Style',
      options: ['normal', 'reduced', 'minimum', 'none'],
      default: 'normal',
      description: 'Stacking lip profile'
    },
    {
      type: 'boolean',
      name: 'enable_magnets',
      label: 'Magnet Holes',
      default: false,
      description: '6.5mm x 2.4mm magnet pockets'
    },
    {
      type: 'boolean',
      name: 'enable_screws',
      label: 'Screw Holes',
      default: false,
      description: '3mm x 6mm screw holes'
    },
    {
      type: 'number',
      name: 'dividers_x',
      label: 'Dividers (Width)',
      min: 0,
      max: 10,
      default: 0,
      step: 1,
      description: 'Number of dividers along width'
    },
    {
      type: 'number',
      name: 'dividers_y',
      label: 'Dividers (Depth)',
      min: 0,
      max: 10,
      default: 0,
      step: 1,
      description: 'Number of dividers along depth'
    },
    {
      type: 'boolean',
      name: 'finger_slide',
      label: 'Finger Slide',
      default: false,
      description: 'Scoop cutout for easy access'
    }
  ]
}
