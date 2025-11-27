import type { Generator } from './types'

export default {
  id: 'v8_engine',
  name: 'V8 Engine',
  description: 'A simplified V8 engine model for desktop display',
  parameters: [
    {
      type: 'number',
      name: 'scale',
      label: 'Scale',
      min: 0.5, max: 2, default: 1, step: 0.1, unit: '',
      description: 'Overall scale factor (1.0 = ~80mm length)'
    },
    {
      type: 'number',
      name: 'v_angle',
      label: 'V Angle',
      min: 60, max: 90, default: 90, step: 5, unit: 'deg',
      description: 'Angle between cylinder banks'
    },
    {
      type: 'select',
      name: 'valve_cover_style',
      label: 'Valve Cover Style',
      options: ['flat', 'finned'],
      default: 'finned',
      description: 'Style of valve covers'
    },
    {
      type: 'boolean',
      name: 'include_intake',
      label: 'Include Intake Manifold',
      default: true
    },
    {
      type: 'boolean',
      name: 'include_exhaust',
      label: 'Include Exhaust Manifolds',
      default: true
    },
    {
      type: 'boolean',
      name: 'include_accessories',
      label: 'Include Front Accessories',
      default: true
    }
  ],
  builderCode: `
const scale = Math.max(0.5, Math.min(2, Number(params['scale']) || 1))
const vAngle = Math.max(60, Math.min(90, Number(params['v_angle']) || 90))
const valveCoverStyle = String(params['valve_cover_style'] || 'finned')
const includeIntake = Boolean(params['include_intake'])
const includeExhaust = Boolean(params['include_exhaust'])
const includeAccessories = Boolean(params['include_accessories'])

// Calculate bank angle factor (affects width)
const halfAngle = vAngle / 2
const halfAngleRad = (halfAngle * Math.PI) / 180
const angleFactor = Math.sin(halfAngleRad)

// Base dimensions (at scale 1.0, targets ~80mm length)
const blockLength = 50 * scale
const blockBaseWidth = 25 * scale
const headWidth = 14 * scale
const bankSpread = 10 * scale * angleFactor
const blockWidth = blockBaseWidth + bankSpread * 2 + headWidth
const blockHeight = 20 * scale
const oilPanDepth = 8 * scale

// Head dimensions
const headHeight = 10 * scale
const headDepth = blockLength - 2 * scale

// Valve cover dimensions
const vcWidth = headWidth - 2 * scale
const vcHeight = 4 * scale
const vcLength = headDepth - 4 * scale
const finHeight = 2 * scale
const finCount = 5

// Cylinder bore dimensions
const boreSpacing = blockLength / 5

// Collect all parts for single union at the end
const parts = []

// ============================================
// Build Engine Block with Detail
// ============================================

// Main block body with chamfered top edges (using rounded box)
const blockCornerRadius = 2 * scale
parts.push(roundedBox(blockWidth, blockLength, blockHeight, blockCornerRadius)
  .translate(0, 0, blockHeight / 2))

// Head offset calculation
const headOffsetX = blockWidth / 2 - headWidth / 2

// ============================================
// Build Oil Pan with Detail
// ============================================

// Main pan with rounded edges
const panWidth = blockWidth * 0.5
const panLength = blockLength - 6 * scale
parts.push(roundedBox(panWidth, panLength, oilPanDepth, 1.5 * scale)
  .translate(0, 0, -oilPanDepth / 2))

// Deeper sump area at rear
const sumpDepth = 4 * scale
parts.push(roundedBox(panWidth * 0.6, panLength * 0.4, sumpDepth, 1 * scale)
  .translate(0, panLength * 0.25, -oilPanDepth - sumpDepth / 2 + 1 * scale))

// Drain plug boss
parts.push(cylinder(2 * scale, 3 * scale)
  .translate(0, panLength * 0.25, -oilPanDepth - sumpDepth + 2 * scale))

// ============================================
// Build Cylinder Heads - using mirrorUnion for symmetry
// ============================================

const headZ = blockHeight + headHeight / 2

// Build left head assembly and use mirrorUnion for right
const leftHeadParts = []

// Left head - main body with rounded edges
leftHeadParts.push(roundedBox(headWidth, headDepth, headHeight, 1.5 * scale)
  .translate(-headOffsetX, 0, headZ))

// Add spark plug bosses (4 per head)
const sparkPlugRadius = 1.5 * scale
const sparkPlugHeight = 3 * scale
for (let i = 0; i < 4; i++) {
  const plugY = (i - 1.5) * boreSpacing
  leftHeadParts.push(cylinder(sparkPlugHeight, sparkPlugRadius)
    .translate(-headOffsetX, plugY, headZ + headHeight / 2 + sparkPlugHeight / 2 - 1 * scale))
}

// Add exhaust port bumps on outer side of head
const portRadius = 2 * scale
const portProtrusion = 1.5 * scale
for (let i = 0; i < 4; i++) {
  const portY = (i - 1.5) * boreSpacing
  leftHeadParts.push(cylinder(portProtrusion, portRadius)
    .rotate(0, 90, 0)
    .translate(-headOffsetX - headWidth / 2 - portProtrusion / 2 + 1 * scale, portY, headZ - 2 * scale))
}

// Union left head parts and mirror for symmetry
parts.push(union(...leftHeadParts).mirrorUnion('x'))

// ============================================
// Build Valve Covers - using mirrorUnion for symmetry
// ============================================

const vcZ = headZ + headHeight / 2 + vcHeight / 2
const vcCornerRadius = 1 * scale

// Build left valve cover assembly
const leftVCParts = []

if (valveCoverStyle === 'finned') {
  // Left valve cover base with rounded edges
  leftVCParts.push(roundedBox(vcWidth, vcLength, vcHeight, vcCornerRadius)
    .translate(-headOffsetX, 0, vcZ))

  // Left fins with tapered profile
  const finSpacing = vcLength / (finCount + 1)
  for (let i = 1; i <= finCount; i++) {
    const finY = i * finSpacing - vcLength / 2
    leftVCParts.push(
      roundedBox(vcWidth - 1 * scale, 1.5 * scale, finHeight, 0.5 * scale)
        .translate(-headOffsetX, finY, vcZ + vcHeight / 2 + finHeight / 2)
    )
  }

  // Left oil filler cap
  leftVCParts.push(cylinder(3 * scale, 2.5 * scale)
    .translate(-headOffsetX, -vcLength / 3, vcZ + vcHeight / 2 + 1.5 * scale))
} else {
  // Flat valve covers with rounded edges
  leftVCParts.push(roundedBox(vcWidth, vcLength, vcHeight, vcCornerRadius)
    .translate(-headOffsetX, 0, vcZ))

  // Oil filler cap on flat cover
  leftVCParts.push(cylinder(3 * scale, 2.5 * scale)
    .translate(-headOffsetX, -vcLength / 3, vcZ + vcHeight / 2 + 1.5 * scale))
}

// Union left valve cover parts and mirror for symmetry
parts.push(union(...leftVCParts).mirrorUnion('x'))

// ============================================
// Build Intake Manifold with Detail
// ============================================

if (includeIntake) {
  const intakeHeight = 8 * scale
  const intakeLength = blockLength - 10 * scale

  // Main plenum - rounded box (overlaps into block top)
  parts.push(roundedBox(10 * scale, intakeLength, intakeHeight + 2 * scale, 2 * scale)
    .translate(0, 0, blockHeight + intakeHeight / 2 - 1 * scale))

  // Intake runners (4 per side) - build left side and mirror
  const runnerRadius = 2 * scale
  const runnerLength = 6 * scale
  const leftRunners = []
  for (let i = 0; i < 4; i++) {
    const runnerY = (i - 1.5) * boreSpacing
    // Left runners (overlap with plenum center)
    leftRunners.push(cylinder(runnerLength, runnerRadius)
      .rotate(0, 90, 0)
      .translate(-runnerLength / 2 - 3 * scale, runnerY, blockHeight + intakeHeight / 2 - 1 * scale))
  }
  parts.push(union(...leftRunners).mirrorUnion('x'))

  // Throttle body - cylindrical (overlaps with plenum)
  const tbRadius = 3.5 * scale
  const tbLength = 6 * scale
  parts.push(cylinder(tbLength, tbRadius)
    .rotate(90, 0, 0)
    .translate(0, -intakeLength / 2 - tbLength / 2 + 2 * scale, blockHeight + intakeHeight / 2))

  // Throttle body inlet flange (overlaps with throttle body)
  parts.push(cylinder(1.5 * scale, tbRadius + 1 * scale)
    .rotate(90, 0, 0)
    .translate(0, -intakeLength / 2 - tbLength + 2 * scale, blockHeight + intakeHeight / 2))
}

// ============================================
// Build Exhaust Manifolds - using mirrorUnion for symmetry
// ============================================

if (includeExhaust) {
  const exhaustRadius = 1.5 * scale
  const exhaustLength = 8 * scale
  // Start INSIDE the block for proper overlap
  const exhaustOffsetX = blockWidth / 2 - 2 * scale
  const exhaustZ = blockHeight * 0.4

  // Build left side exhaust and mirror
  const leftExhaustParts = []

  // Exhaust pipes (4 on left side, cylindrical)
  for (let i = 0; i < 4; i++) {
    const pipeY = (i - 1.5) * boreSpacing
    // Left exhaust pipe - horizontal cylinder (starts inside block)
    leftExhaustParts.push(cylinder(exhaustLength, exhaustRadius)
      .rotate(0, 90, 0)
      .translate(-exhaustOffsetX - exhaustLength / 2, pipeY, exhaustZ))
  }

  // Left collector - horizontal cylinder along Y axis that spans all 4 pipes
  const collectorRadius = 2.5 * scale
  // Collector length spans from first to last pipe plus overlap
  const firstPipeY = -1.5 * boreSpacing
  const lastPipeY = 1.5 * boreSpacing
  const collectorLength = lastPipeY - firstPipeY + 4 * collectorRadius
  const collectorX = exhaustOffsetX + exhaustLength - 2 * scale
  leftExhaustParts.push(cylinder(collectorLength, collectorRadius)
    .rotate(90, 0, 0)  // Rotate to align along Y axis
    .translate(-collectorX, 0, exhaustZ))

  // Collector outlet pipe - overlap with collector center
  const outletRadius = 2 * scale
  const outletLength = 6 * scale
  leftExhaustParts.push(cylinder(outletLength, outletRadius)
    .rotate(45, 0, 0)
    .translate(-collectorX, 0, exhaustZ - collectorRadius))

  parts.push(union(...leftExhaustParts).mirrorUnion('x'))
}

// ============================================
// Build Front Accessories with Detail
// ============================================

if (includeAccessories) {
  // frontY overlaps INTO the block for connection
  const frontY = -blockLength / 2 + 2 * scale  // Moved 2*scale into block for better overlap

  // Timing cover - shaped to follow block (overlaps with block)
  const timingCoverDepth = 4 * scale
  parts.push(roundedBox(blockWidth * 0.75, timingCoverDepth, blockHeight * 0.7, 1 * scale)
    .translate(0, frontY - timingCoverDepth / 2 + 1 * scale, blockHeight * 0.35))

  // Crank pulley hub - extends from timing cover (must connect first)
  const crankPulleyRadius = 6 * scale
  parts.push(cylinder(5 * scale, 2.5 * scale)
    .rotate(90, 0, 0)
    .translate(0, frontY - timingCoverDepth / 2, 5 * scale))
  // Crank pulley - cylindrical disk attached to hub
  parts.push(cylinder(2 * scale, crankPulleyRadius)
    .rotate(90, 0, 0)
    .translate(0, frontY - timingCoverDepth / 2 - 3 * scale, 5 * scale))

  // Water pump - cylindrical housing (overlaps with timing cover)
  const wpRadius = 4 * scale
  parts.push(cylinder(6 * scale, wpRadius)
    .rotate(90, 0, 0)
    .translate(0, frontY - timingCoverDepth / 2, blockHeight * 0.55))
  // Water pump pulley (overlaps with housing)
  parts.push(cylinder(1.5 * scale, wpRadius + 1 * scale)
    .rotate(90, 0, 0)
    .translate(0, frontY - timingCoverDepth / 2 - 4 * scale, blockHeight * 0.55))

  // Alternator assembly - all parts connected as one group
  const altRadius = 4 * scale
  const altLength = 6 * scale
  const altX = blockWidth / 3
  // Mount bracket overlapping with timing cover (not block)
  const altBracketY = frontY - timingCoverDepth / 2 + 1 * scale
  parts.push(box(3 * scale, 5 * scale, 6 * scale)
    .translate(altX, altBracketY, blockHeight * 0.5))
  // Alternator body - overlaps bracket
  parts.push(cylinder(altLength, altRadius)
    .rotate(90, 0, 0)
    .translate(altX, altBracketY - 4 * scale, blockHeight * 0.5))
  // Alternator pulley - overlaps body
  parts.push(cylinder(2 * scale, altRadius - 0.5 * scale)
    .rotate(90, 0, 0)
    .translate(altX, altBracketY - 7 * scale, blockHeight * 0.5))

  // Power steering pump (opposite side) - mount bracket overlaps timing cover
  const psRadius = 3 * scale
  parts.push(box(3 * scale, 5 * scale, 5 * scale)
    .translate(-altX, altBracketY, blockHeight * 0.55))
  // PS pump body - overlaps bracket
  parts.push(cylinder(5 * scale, psRadius)
    .rotate(90, 0, 0)
    .translate(-altX, altBracketY - 4 * scale, blockHeight * 0.55))

  // Serpentine belt tensioner (overlaps with timing cover)
  parts.push(cylinder(4 * scale, 2 * scale)
    .rotate(90, 0, 0)
    .translate(altX * 0.5, frontY - timingCoverDepth / 2, blockHeight * 0.3))

  // Distributor cap (rear, overlapping with block top)
  parts.push(cylinder(4 * scale, 3 * scale)
    .translate(0, blockLength * 0.3, blockHeight + 2 * scale))
}

// ============================================
// Union all parts at once
// ============================================
let engine = union(...parts)

// Center the engine
const bbox = engine.getBoundingBox()
const centerX = (bbox.min[0] + bbox.max[0]) / 2
const centerY = (bbox.min[1] + bbox.max[1]) / 2
engine = engine.translate(-centerX, -centerY, -bbox.min[2])

return engine
`
} satisfies Generator
