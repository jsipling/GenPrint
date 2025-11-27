import type { Generator } from './types'

export default {
  id: 'gridfinity_bin',
  name: 'Gridfinity Bin',
  description: 'Fast modular storage bin using Manifold geometry',
  parameters: [
    {
      type: 'number',
      name: 'grid_x',
      label: 'Width',
      min: 1, max: 6, default: 2, step: 1, unit: 'units',
      description: 'Width in grid units (42mm each)'
    },
    {
      type: 'number',
      name: 'grid_y',
      label: 'Depth',
      min: 1, max: 6, default: 2, step: 1, unit: 'units',
      description: 'Depth in grid units (42mm each)'
    },
    {
      type: 'number',
      name: 'grid_z',
      label: 'Height',
      min: 1, max: 10, default: 3, step: 1, unit: 'units',
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
      min: 0, max: 10, default: 0, step: 1,
      description: 'Number of dividers along width',
      dynamicMax: (params) => {
        const gridX = Number(params['grid_x']) || 2
        return Math.max(0, gridX * 2 - 1)
      }
    },
    {
      type: 'number',
      name: 'dividers_y',
      label: 'Dividers (Depth)',
      min: 0, max: 10, default: 0, step: 1,
      description: 'Number of dividers along depth',
      dynamicMax: (params) => {
        const gridY = Number(params['grid_y']) || 2
        return Math.max(0, gridY * 2 - 1)
      }
    },
    {
      type: 'boolean',
      name: 'finger_slide',
      label: 'Finger Slide',
      default: false,
      description: 'Scoop cutout for easy access'
    }
  ],
  builderCode: `
// Gridfinity constants
const GRID_PITCH = 42
const Z_PITCH = 7
const WALL_THICKNESS = constants.MIN_WALL_THICKNESS
const BASE_HEIGHT = 5
const LIP_HEIGHT = 4.4
const TOLERANCE = 0.25

const gridX = Number(params['grid_x']) || 2
const gridY = Number(params['grid_y']) || 2
const gridZ = Number(params['grid_z']) || 3
const lipStyle = String(params['lip_style']) || 'normal'
const enableMagnets = Boolean(params['enable_magnets'])
const enableScrews = Boolean(params['enable_screws'])
const dividersX = Math.floor(Number(params['dividers_x']) || 0)
const dividersY = Math.floor(Number(params['dividers_y']) || 0)
const fingerSlide = Boolean(params['finger_slide'])

const totalWidth = gridX * GRID_PITCH
const totalDepth = gridY * GRID_PITCH
const totalHeight = gridZ * Z_PITCH + BASE_HEIGHT

const outerWidth = totalWidth - TOLERANCE * 2
const outerDepth = totalDepth - TOLERANCE * 2
const cornerRadius = 4
const floorThickness = 1.5

// Rounded rect helper
function roundedRectPts(w, h, r) {
  const pts = []
  const safeR = Math.min(r, w / 2, h / 2)
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (Math.PI / 2) * i / 8
    pts.push([-w/2 + safeR + safeR * Math.cos(a), -h/2 + safeR + safeR * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * i / 8
    pts.push([w/2 - safeR + safeR * Math.cos(a), -h/2 + safeR + safeR * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI / 2) * i / 8
    pts.push([w/2 - safeR + safeR * Math.cos(a), h/2 - safeR + safeR * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 2 + (Math.PI / 2) * i / 8
    pts.push([-w/2 + safeR + safeR * Math.cos(a), h/2 - safeR + safeR * Math.sin(a)])
  }
  return pts
}

// Create outer shell
let bin = extrude(roundedRectPts(outerWidth, outerDepth, cornerRadius), totalHeight)

// Create inner cavity
const innerWidth = outerWidth - WALL_THICKNESS * 2
const innerDepth = outerDepth - WALL_THICKNESS * 2
const innerRadius = Math.max(0.5, cornerRadius - WALL_THICKNESS)
const innerCavity = extrude(roundedRectPts(innerWidth, innerDepth, innerRadius), totalHeight)
  .translate(0, 0, floorThickness)
bin = difference(bin, innerCavity)

// Add lip
if (lipStyle !== 'none') {
  const lipInset = lipStyle === 'reduced' ? 0.6 : 0.8
  const lipOuter = extrude(roundedRectPts(outerWidth, outerDepth, cornerRadius), LIP_HEIGHT)
    .translate(0, 0, totalHeight)
  const lipInnerSize = lipStyle === 'minimum' ? 2 : 1.6
  const lipInner = extrude(roundedRectPts(outerWidth - lipInnerSize, outerDepth - lipInnerSize, Math.max(0.5, cornerRadius - lipInset)), LIP_HEIGHT + 1)
    .translate(0, 0, totalHeight - 0.5)
  const lip = difference(lipOuter, lipInner)
  bin = union(bin, lip)
}

// Magnet holes
if (enableMagnets) {
  const magnetRadius = 3.25
  const magnetDepth = 2.4
  const magnetHoles = []
  for (let x = 0; x < gridX; x++) {
    for (let y = 0; y < gridY; y++) {
      const cx = (x + 0.5) * GRID_PITCH - totalWidth / 2
      const cy = (y + 0.5) * GRID_PITCH - totalDepth / 2
      const offsets = [[-13, -13], [13, -13], [-13, 13], [13, 13]]
      for (const [ox, oy] of offsets) {
        magnetHoles.push(cylinder(magnetDepth, magnetRadius).translate(cx + ox, cy + oy, 0))
      }
    }
  }
  bin = difference(bin, union(...magnetHoles))
}

// Screw holes
if (enableScrews) {
  const screwRadius = 1.5
  const screwDepth = 6
  const screwHoles = []
  for (let x = 0; x < gridX; x++) {
    for (let y = 0; y < gridY; y++) {
      const cx = (x + 0.5) * GRID_PITCH - totalWidth / 2
      const cy = (y + 0.5) * GRID_PITCH - totalDepth / 2
      screwHoles.push(cylinder(screwDepth, screwRadius).translate(cx, cy, 0))
    }
  }
  bin = difference(bin, union(...screwHoles))
}

// Dividers
if (dividersX > 0 || dividersY > 0) {
  const dividerThickness = 1.2
  const dividerHeight = totalHeight - floorThickness
  const dividers = []
  for (let i = 1; i <= dividersX; i++) {
    const xPos = (i / (dividersX + 1)) * innerWidth - innerWidth / 2
    dividers.push(box(dividerThickness, innerDepth - 2, dividerHeight, true)
      .translate(xPos, 0, floorThickness + dividerHeight / 2))
  }
  for (let i = 1; i <= dividersY; i++) {
    const yPos = (i / (dividersY + 1)) * innerDepth - innerDepth / 2
    dividers.push(box(innerWidth - 2, dividerThickness, dividerHeight, true)
      .translate(0, yPos, floorThickness + dividerHeight / 2))
  }
  if (dividers.length > 0) {
    bin = union(bin, union(...dividers))
  }
}

// Finger slide
if (fingerSlide) {
  const scoopRadius = totalHeight * 0.6
  const scoopWidth = innerWidth * 0.7
  const scoop = cylinder(scoopWidth, scoopRadius)
    .rotate(0, 90, 0)
    .translate(0, -outerDepth / 2 + scoopRadius * 0.3, totalHeight * 0.7)
  bin = difference(bin, scoop)
}

return bin
`
} satisfies Generator
