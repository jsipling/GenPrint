import type { Generator } from './types'

export default {
  id: 'thumb-knob',
  name: 'Thumb Knob',
  description: 'A grip handle for standard hex bolts/nuts (e.g., M3). Turns a screw into a thumb-screw.',
  parameters: [
    {
      type: 'select',
      name: 'screw_size',
      label: 'Screw Size',
      options: ['M3', 'M4', 'M5', 'M6', 'M8'],
      default: 'M3'
    },
    {
      type: 'number',
      name: 'knob_diameter',
      label: 'Knob Diameter',
      min: 10,
      max: 50,
      default: 18,
      step: 1,
      unit: 'mm',
      dynamicMin: (params) => {
        const hexFlats: Record<string, number> = {
          'M3': 5.5, 'M4': 7.0, 'M5': 8.0, 'M6': 10.0, 'M8': 13.0
        }
        const size = String(params['screw_size']) || 'M3'
        const tol = Number(params['tolerance']) || 0.15
        const hexFlat = hexFlats[size] || 5.5
        const hexD = (hexFlat + tol * 2) / 0.866025
        return Math.ceil(hexD + 9)
      }
    },
    {
      type: 'number',
      name: 'height',
      label: 'Height',
      min: 6,
      max: 30,
      default: 8,
      step: 1,
      unit: 'mm'
    },
    {
      type: 'select',
      name: 'style',
      label: 'Grip Style',
      options: ['Knurled', 'Lobed', 'Hexagonal'],
      default: 'Knurled'
    },
    {
      type: 'number',
      name: 'tolerance',
      label: 'Fit Tolerance',
      min: 0,
      max: 0.6,
      default: 0.15,
      step: 0.05,
      unit: 'mm',
      description: 'Extra gap for the hex head.'
    }
  ],
  builderCode: `
const HEX_SPECS = {
  'M3': [3.2, 5.5, 3.0],
  'M4': [4.2, 7.0, 4.0],
  'M5': [5.2, 8.0, 5.0],
  'M6': [6.2, 10.0, 6.0],
  'M8': [8.2, 13.0, 8.0]
}

const size = String(params['screw_size']) || 'M3'
const knobD = Number(params['knob_diameter']) || 15
const height = Number(params['height']) || 6
const style = String(params['style']) || 'Knurled'
const tolerance = Number(params['tolerance']) || 0.15

const specs = HEX_SPECS[size] || HEX_SPECS['M3']
const holeD = specs[0] + 0.2
const hexFlat = specs[1] + tolerance * 2
const hexDepth = specs[2]
const hexD = hexFlat / 0.866025
const minKnobD = hexD + 9
const safeKnobD = Math.max(knobD, minKnobD)

// Profile generators
function knurledPoints(diameter) {
  const radius = diameter / 2
  const count = Math.min(Math.round(diameter * 1.5), 24)
  const indentRadius = 1.5
  const segments = Math.max(48, count * 2)
  const pts = []
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    const knurlIndex = Math.round((i / segments) * count) % count
    const knurlAngle = (2 * Math.PI * knurlIndex) / count
    const angleDiff = Math.abs(angle - knurlAngle)
    let r = radius
    if (angleDiff < 0.15 || angleDiff > 2 * Math.PI - 0.15) {
      r = radius - indentRadius * 0.5
    }
    pts.push([r * Math.cos(angle), r * Math.sin(angle)])
  }
  return pts
}

function lobedPoints(diameter) {
  const lobeRadius = diameter / 3.6
  const lobeOffset = diameter / 4
  const pts = []
  const segments = 64
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    let maxR = 0
    for (let lobe = 0; lobe < 3; lobe++) {
      const lobeAngle = (2 * Math.PI * lobe) / 3
      const lx = lobeOffset * Math.cos(lobeAngle)
      const ly = lobeOffset * Math.sin(lobeAngle)
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      const proj = lx * dx + ly * dy
      const perpDist = Math.sqrt(lx * lx + ly * ly - proj * proj)
      if (perpDist < lobeRadius) {
        const r = proj + Math.sqrt(lobeRadius * lobeRadius - perpDist * perpDist)
        maxR = Math.max(maxR, r)
      }
    }
    if (maxR > 0) {
      pts.push([maxR * Math.cos(angle), maxR * Math.sin(angle)])
    }
  }
  return pts
}

function hexPoints(diameter) {
  const radius = diameter / 2
  const pts = []
  for (let i = 0; i < 6; i++) {
    const angle = (2 * Math.PI * i) / 6 + Math.PI / 6
    pts.push([radius * Math.cos(angle), radius * Math.sin(angle)])
  }
  return pts
}

// Create outer profile
let knobProfile
if (style === 'Lobed') {
  knobProfile = lobedPoints(safeKnobD)
} else if (style === 'Hexagonal') {
  knobProfile = hexPoints(safeKnobD)
} else {
  knobProfile = knurledPoints(safeKnobD)
}

let knob = extrude(knobProfile, height)

// Hex socket (bottom)
const hexPts = []
for (let i = 0; i < 6; i++) {
  const angle = (2 * Math.PI * i) / 6
  hexPts.push([(hexD / 2) * Math.cos(angle), (hexD / 2) * Math.sin(angle)])
}
const hexSocket = extrude(hexPts, hexDepth + 0.2).translate(0, 0, -0.1)
knob = difference(knob, hexSocket)

// Through hole
const throughHole = hole(holeD, height + 1).translate(0, 0, hexDepth - 0.1)
knob = difference(knob, throughHole)

// Top chamfer
const chamferSize = 1
const chamferPts = []
const chamferSegments = 16
for (let i = 0; i <= chamferSegments; i++) {
  const angle = (Math.PI / 2) * (i / chamferSegments)
  chamferPts.push([
    safeKnobD / 2 - chamferSize + chamferSize * Math.cos(angle),
    chamferSize * Math.sin(angle)
  ])
}
chamferPts.push([safeKnobD / 2, 0])
chamferPts.push([safeKnobD / 2 + 1, 0])
chamferPts.push([safeKnobD / 2 + 1, chamferSize + 1])
chamferPts.push([0, chamferSize + 1])
chamferPts.push([0, 0])
const chamfer = revolve(chamferPts).translate(0, 0, height - chamferSize)
knob = difference(knob, chamfer)

return knob
`
} satisfies Generator
