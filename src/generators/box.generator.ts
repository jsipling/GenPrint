import type { Generator } from './types'

export default {
  id: 'box',
  name: 'Box',
  description: 'A customizable box with optional lid',
  parameters: [
    {
      type: 'number',
      name: 'width',
      label: 'Width',
      min: 20, max: 200, default: 50, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'depth',
      label: 'Depth',
      min: 20, max: 200, default: 50, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 10, max: 100, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'wall_thickness',
      label: 'Wall Thickness',
      min: 1.2, max: 5, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'corner_radius',
      label: 'Corner Radius',
      min: 0, max: 10, default: 3, step: 1, unit: 'mm',
      dynamicMax: (params) => {
        const width = Number(params['width']) || 50
        const depth = Number(params['depth']) || 50
        const wall = Number(params['wall_thickness']) || 2
        return Math.floor(Math.min(width, depth) / 2 - wall)
      }
    },
    {
      type: 'boolean',
      name: 'include_lid',
      label: 'Include Lid',
      default: true,
      children: [
        {
          type: 'number',
          name: 'lid_height',
          label: 'Lid Height',
          min: 4, max: 40, default: 8, step: 0.5, unit: 'mm'
        },
        {
          type: 'number',
          name: 'lid_clearance',
          label: 'Lid Clearance',
          min: 0, max: 1, default: 0.2, step: 0.05, unit: 'mm',
          description: 'Gap between lid lip and box walls for easy fit'
        },
        {
          type: 'number',
          name: 'lid_lip_height',
          label: 'Lid Lip Height',
          min: 2, max: 30, default: 5, step: 0.5, unit: 'mm',
          description: 'How far the lid lip extends into the box'
        }
      ]
    },
    {
      type: 'number',
      name: 'bottom_thickness',
      label: 'Bottom Thickness',
      min: 1.2, max: 10, default: 2, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'dividers_x',
      label: 'Dividers (Width)',
      min: 0, max: 10, default: 0, step: 1, unit: '',
      description: 'Number of dividers along width'
    },
    {
      type: 'number',
      name: 'dividers_y',
      label: 'Dividers (Depth)',
      min: 0, max: 10, default: 0, step: 1, unit: '',
      description: 'Number of dividers along depth'
    },
    {
      type: 'boolean',
      name: 'finger_grip',
      label: 'Finger Grip',
      default: false
    },
    {
      type: 'boolean',
      name: 'stackable',
      label: 'Stackable',
      default: false
    }
  ],
  builderCode: `
const width = Number(params['width']) || 50
const depth = Number(params['depth']) || 50
const height = Number(params['height']) || 30
const wallThickness = Math.max(Number(params['wall_thickness']) || 2, constants.MIN_WALL_THICKNESS)
const cornerRadius = Number(params['corner_radius']) || 3
const includeLid = Boolean(params['include_lid'])
const lidHeight = Number(params['lid_height']) || 8
const lidClearance = Math.min(Math.max(Number(params['lid_clearance']) || 0.2, 0), 1)
const lidLipHeight = Number(params['lid_lip_height']) || 5
const bottomThickness = Math.max(Number(params['bottom_thickness']) || 2, constants.MIN_WALL_THICKNESS)
const dividersX = Math.floor(Number(params['dividers_x']) || 0)
const dividersY = Math.floor(Number(params['dividers_y']) || 0)
const fingerGrip = Boolean(params['finger_grip'])
const stackable = Boolean(params['stackable'])

// Safe values
const maxCorner = Math.max(0, Math.min(width, depth) / 2 - wallThickness)
const safeCorner = Math.max(0, Math.min(cornerRadius, maxCorner))
const safeLidHeight = Math.max(lidHeight, wallThickness + 1)
const safeLipHeight = Math.max(1, Math.min(lidLipHeight, height - wallThickness))

const innerWidth = Math.max(1, width - wallThickness * 2)
const innerDepth = Math.max(1, depth - wallThickness * 2)
const innerHeight = Math.max(1, height - bottomThickness)

// Rounded rect helper
function roundedRectPts(w, d, r) {
  if (r <= 0) return [[-w/2, -d/2], [w/2, -d/2], [w/2, d/2], [-w/2, d/2]]
  const pts = []
  const safeR = Math.min(r, w / 2, d / 2)
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (Math.PI / 2) * i / 8
    pts.push([-w/2 + safeR + safeR * Math.cos(a), -d/2 + safeR + safeR * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * i / 8
    pts.push([w/2 - safeR + safeR * Math.cos(a), -d/2 + safeR + safeR * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI / 2) * i / 8
    pts.push([w/2 - safeR + safeR * Math.cos(a), d/2 - safeR + safeR * Math.sin(a)])
  }
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 2 + (Math.PI / 2) * i / 8
    pts.push([-w/2 + safeR + safeR * Math.cos(a), d/2 - safeR + safeR * Math.sin(a)])
  }
  return pts
}

// Create box body
const outerBox = extrude(roundedRectPts(width, depth, safeCorner), height)
const innerCavity = extrude(roundedRectPts(innerWidth, innerDepth, Math.max(0, safeCorner - wallThickness)), height)
  .translate(0, 0, bottomThickness)
let boxBody = difference(outerBox, innerCavity)

// Add dividers
if (dividersX > 0) {
  const cellWidth = innerWidth / (dividersX + 1)
  for (let i = 1; i <= dividersX; i++) {
    const xPos = i * cellWidth - innerWidth / 2
    const divider = box(wallThickness, innerDepth, innerHeight, true)
      .translate(xPos, 0, bottomThickness + innerHeight / 2)
    boxBody = union(boxBody, divider)
  }
}
if (dividersY > 0) {
  const cellDepth = innerDepth / (dividersY + 1)
  for (let i = 1; i <= dividersY; i++) {
    const yPos = i * cellDepth - innerDepth / 2
    const divider = box(innerWidth, wallThickness, innerHeight, true)
      .translate(0, yPos, bottomThickness + innerHeight / 2)
    boxBody = union(boxBody, divider)
  }
}

// Stackable lip
if (stackable) {
  const lipH = Math.min(5, height * 0.15)
  const lip = extrude(roundedRectPts(innerWidth - 2 * lidClearance, innerDepth - 2 * lidClearance, Math.max(0, safeCorner - wallThickness - lidClearance)), lipH + 0.01)
    .translate(0, 0, -lipH)
  boxBody = union(boxBody, lip)
}

// Finger grip
if (fingerGrip) {
  const gripWidth = Math.min(width * 0.4, 30)
  const gripDepth = wallThickness + 1
  const gripHeight = Math.min(height * 0.3, 15)
  // Elliptical cutout via scaled cylinder
  const cutoutPts = []
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI * i / 32
    cutoutPts.push([gripWidth / 2 * Math.cos(a), gripHeight * Math.sin(a)])
  }
  cutoutPts.push([gripWidth / 2, 0])
  const cutout = extrude(cutoutPts, gripDepth)
    .rotate(90, 0, 0)
    .translate(0, -depth / 2 - gripDepth / 2 + gripDepth, height - gripHeight)
  boxBody = difference(boxBody, cutout)
}

// Create lid if included
if (includeLid) {
  // Lid outer shell
  const lidOuter = extrude(roundedRectPts(width, depth, safeCorner), safeLidHeight)
  const lidInner = extrude(roundedRectPts(width - wallThickness * 2, depth - wallThickness * 2, Math.max(0, safeCorner - wallThickness)), safeLidHeight - wallThickness)
  let lid = difference(lidOuter, lidInner)

  // Inner lip
  const lipOuter = extrude(roundedRectPts(innerWidth - 2 * lidClearance, innerDepth - 2 * lidClearance, Math.max(0, safeCorner - wallThickness - lidClearance)), safeLipHeight)
  lid = union(lid, lipOuter)

  // Finger grip on lid
  if (fingerGrip) {
    const gripWidth = Math.min(width * 0.4, 30)
    const gripDepth = wallThickness + 1
    const gripHeight = Math.min(safeLidHeight * 0.3, 15)
    const cutoutPts = []
    for (let i = 0; i <= 32; i++) {
      const a = Math.PI * i / 32
      cutoutPts.push([gripWidth / 2 * Math.cos(a), gripHeight * Math.sin(a)])
    }
    cutoutPts.push([gripWidth / 2, 0])
    const cutout = extrude(cutoutPts, gripDepth)
      .rotate(90, 0, 0)
      .translate(0, -depth / 2 - gripDepth / 2 + gripDepth, safeLidHeight - gripHeight)
    lid = difference(lid, cutout)
  }

  // Position lid next to box
  lid = lid.translate(width + 5, 0, 0)
  boxBody = union(boxBody, lid)
}

return boxBody
`
} satisfies Generator
