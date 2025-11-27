import type { Generator } from './types'

export default {
  id: 'spur_gear',
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
        const maxBySize = Math.floor(150 / mod - 2)
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
      description: '0 = flat tip (recommended for FDM)'
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
            return boreDiameter + 4
          },
          dynamicMax: (params) => {
            const teeth = Number(params['teeth']) || 20
            const mod = Number(params['module']) || 2
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
  ],
  builderCode: `
const teeth = Math.max(8, Math.floor(Number(params['teeth']) || 20))
const mod = Math.max(1, Number(params['module']) || 2)
const height = Number(params['height']) || 5
const boreDiameter = Number(params['bore_diameter']) || 5
const includeHub = Boolean(params['include_hub'])
const hubDiameter = Number(params['hub_diameter']) || 15
const hubHeight = Number(params['hub_height']) || 5
const pressureAngle = Number(params['pressure_angle']) || 20
const tolerance = Number(params['tolerance']) || 0
const tipSharpness = Number(params['tip_sharpness']) || 0

// Gear geometry calculations
const pitchRadius = (teeth * mod) / 2
const baseRadius = pitchRadius * Math.cos((pressureAngle * Math.PI) / 180)
const outerRadius = pitchRadius + mod
const rootRadius = pitchRadius - 1.25 * mod
const pitchDiameter = teeth * mod
const rootDiameter = pitchDiameter - 2.5 * mod

// Safe values
const maxBore = Math.max(0, rootDiameter - 4)
const safeBore = Math.min(boreDiameter, maxBore)
const safeHubDiameter = Math.min(Math.max(hubDiameter, safeBore + 4), rootDiameter)

// Involute helper functions
function involutePoint(br, rollAngle) {
  const rollRad = (rollAngle * Math.PI) / 180
  return [
    br * (Math.cos(rollRad) + rollRad * Math.sin(rollRad)),
    br * (Math.sin(rollRad) - rollRad * Math.cos(rollRad))
  ]
}

function involuteIntersectAngle(br, radius) {
  if (radius <= br) return 0
  const cosA = br / radius
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)))
  const invA = Math.tan(a) - a
  return (invA * 180) / Math.PI
}

// Generate tooth profile
const pitchThick = (Math.PI * mod) / 2 - tolerance
const halfPitchAngle = ((pitchThick / 2) / pitchRadius) * (180 / Math.PI)
const pitchInv = involuteIntersectAngle(baseRadius, pitchRadius)
const tipInv = involuteIntersectAngle(baseRadius, outerRadius)
const offsetAngle = halfPitchAngle - pitchInv
const rootHalfAngle = halfPitchAngle + 2
const steps = 20

// Create root circle
const rootPoints = []
const rootSegments = teeth * 4
for (let i = 0; i < rootSegments; i++) {
  const angle = (2 * Math.PI * i) / rootSegments
  rootPoints.push([rootRadius * Math.cos(angle), rootRadius * Math.sin(angle)])
}

// Generate single tooth profile
const rightPts = []
const leftPts = []
for (let i = 0; i <= steps; i++) {
  const roll = (tipInv * i) / steps
  const pt = involutePoint(baseRadius, roll)
  const r = Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1])
  const theta = Math.atan2(pt[1], pt[0]) * (180 / Math.PI)

  const rightAngle = (-theta - offsetAngle) * (Math.PI / 180)
  rightPts.push([r * Math.cos(rightAngle), r * Math.sin(rightAngle)])

  const leftAngle = (theta + offsetAngle) * (Math.PI / 180)
  leftPts.push([r * Math.cos(leftAngle), r * Math.sin(leftAngle)])
}

// Build tooth polygon
const toothPoints = []
const rootRightAngle = (-rootHalfAngle * Math.PI) / 180
toothPoints.push([rootRadius * Math.cos(rootRightAngle), rootRadius * Math.sin(rootRightAngle)])
toothPoints.push(...rightPts)
if (tipSharpness > 0) {
  const rightTip = rightPts[rightPts.length - 1]
  const leftTip = leftPts[leftPts.length - 1]
  const midTip = [(rightTip[0] + leftTip[0]) / 2, (rightTip[1] + leftTip[1]) / 2]
  const pointTip = [outerRadius, 0]
  toothPoints.push([
    midTip[0] + tipSharpness * (pointTip[0] - midTip[0]),
    midTip[1] + tipSharpness * (pointTip[1] - midTip[1])
  ])
}
for (let i = steps; i >= 0; i--) {
  toothPoints.push(leftPts[i])
}
const rootLeftAngle = (rootHalfAngle * Math.PI) / 180
toothPoints.push([rootRadius * Math.cos(rootLeftAngle), rootRadius * Math.sin(rootLeftAngle)])

// Create gear by extruding root circle and adding rotated teeth
let gear = extrude(rootPoints, height)

// Add each tooth
for (let i = 0; i < teeth; i++) {
  const angle = (360 * i) / teeth
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const rotatedPoints = toothPoints.map(([x, y]) => [
    x * cos - y * sin,
    x * sin + y * cos
  ])

  const tooth = extrude(rotatedPoints, height)
  gear = union(gear, tooth)
}

// Add hub
if (includeHub && hubHeight > 0) {
  const hub = cylinder(hubHeight, safeHubDiameter / 2).translate(0, 0, height)
  gear = union(gear, hub)
}

// Add bore hole
if (safeBore > 0) {
  const bore = hole(safeBore, height + hubHeight + 2).translate(0, 0, -1)
  gear = difference(gear, bore)
}

return gear
`
} satisfies Generator
