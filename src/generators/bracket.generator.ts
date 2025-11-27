import type { Generator } from './types'

export default {
  id: 'bracket',
  name: 'Bracket',
  description: 'An L-bracket with mounting holes for corner reinforcement.',
  parameters: [
    {
      type: 'number',
      name: 'width',
      label: 'Width',
      min: 10, max: 100, default: 30, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'arm_length',
      label: 'Arm Length',
      min: 15, max: 150, default: 40, step: 1, unit: 'mm'
    },
    {
      type: 'number',
      name: 'thickness',
      label: 'Thickness',
      min: 3, max: 15, default: 4, step: 0.5, unit: 'mm'
    },
    {
      type: 'number',
      name: 'hole_diameter',
      label: 'Hole Diameter',
      min: 2, max: 12, default: 5, step: 0.5, unit: 'mm',
      dynamicMax: (params) => {
        const width = Number(params['width']) || 30
        return width - 4
      }
    },
    {
      type: 'number',
      name: 'fillet_radius',
      label: 'Fillet Radius',
      min: 0, max: 20, default: 5, step: 1, unit: 'mm',
      dynamicMax: (params) => {
        const armLength = Number(params['arm_length']) || 40
        const thickness = Number(params['thickness']) || 4
        return armLength - thickness
      }
    },
    {
      type: 'number',
      name: 'hole_count_arm_1',
      label: 'Hole Count Arm 1',
      min: 0, max: 10, default: 1, step: 1
    },
    {
      type: 'number',
      name: 'hole_count_arm_2',
      label: 'Hole Count Arm 2',
      min: 0, max: 10, default: 1, step: 1
    },
    {
      type: 'boolean',
      name: 'add_rib',
      label: 'Add Rib',
      default: true,
      children: [
        {
          type: 'number',
          name: 'rib_thickness',
          label: 'Rib Thickness',
          min: 1.2, max: 10, default: 4, step: 0.5, unit: 'mm'
        }
      ]
    }
  ],
  builderCode: `
const width = Number(params['width']) || 30
const armLength = Number(params['arm_length']) || 40
const thickness = Number(params['thickness']) || 4
const holeDiameter = Number(params['hole_diameter']) || 5
const filletRadius = Number(params['fillet_radius']) || 5
const holeCountArm1 = Math.floor(Number(params['hole_count_arm_1']) || 1)
const holeCountArm2 = Math.floor(Number(params['hole_count_arm_2']) || 1)
const addRib = Boolean(params['add_rib'])
const ribThickness = Number(params['rib_thickness']) || 4

// L-shape profile
const profile = [
  [0, 0],
  [armLength, 0],
  [armLength, thickness],
  [thickness, thickness],
  [thickness, armLength],
  [0, armLength]
]

let bracket = extrude(profile, width)

// Add corner fillet
if (filletRadius > 0) {
  // Quarter circle profile for fillet
  const steps = 8
  const filletPts = []
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI / 2) * i / steps
    filletPts.push([
      thickness + filletRadius * Math.sin(angle),
      thickness + filletRadius * Math.cos(angle)
    ])
  }
  filletPts.push([thickness, thickness])
  const fillet = extrude(filletPts, width)
  bracket = union(bracket, fillet)
}

// Add rib
if (addRib) {
  const ribSize = Math.min(Math.max(filletRadius, (armLength - thickness) / 4), armLength - thickness)
  const ribProfile = [
    [thickness, thickness],
    [thickness + ribSize, thickness],
    [thickness, thickness + ribSize]
  ]
  const rib = extrude(ribProfile, ribThickness)
    .translate(0, 0, (width - ribThickness) / 2)
  bracket = union(bracket, rib)
}

// Add holes
const allHoles = []

// Horizontal arm holes
if (holeCountArm1 > 0) {
  const holeOffsetStart = (armLength - thickness) / (holeCountArm1 + 1) + thickness
  const holeSpacing = (armLength - thickness) / (holeCountArm1 + 1)
  for (let i = 0; i < holeCountArm1; i++) {
    allHoles.push(
      hole(holeDiameter, thickness + 0.4)
        .translate(holeOffsetStart + i * holeSpacing, width / 2, -0.2)
    )
  }
}

// Vertical arm holes
if (holeCountArm2 > 0) {
  const holeOffsetStart = (armLength - thickness) / (holeCountArm2 + 1) + thickness
  const holeSpacing = (armLength - thickness) / (holeCountArm2 + 1)
  for (let i = 0; i < holeCountArm2; i++) {
    allHoles.push(
      hole(holeDiameter, thickness + 0.4)
        .rotate(0, 90, 0)
        .translate(-0.2, width / 2, holeOffsetStart + i * holeSpacing)
    )
  }
}

if (allHoles.length > 0) {
  bracket = difference(bracket, union(...allHoles))
}

return bracket
`
} satisfies Generator
