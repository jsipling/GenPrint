import type { Generator } from './types'

const generator: Generator = {
  id: 'v8-engine',
  name: 'V8 Engine Block',
  description: 'V8 engine block with cylinder bores, crankcase, oil pan, timing cover, rear main seal housing, lifter valley, and head bolt holes',
  parameters: [
    {
      type: 'number',
      name: 'bore',
      label: 'Cylinder Bore',
      min: 15,
      max: 60,
      default: 30,
      step: 1,
      unit: 'mm',
      description: 'Diameter of each cylinder bore'
    },
    {
      type: 'number',
      name: 'stroke',
      label: 'Stroke',
      min: 15,
      max: 50,
      default: 25,
      step: 1,
      unit: 'mm',
      description: 'Piston stroke (determines block height)'
    },
    {
      type: 'number',
      name: 'bankAngle',
      label: 'Bank Angle',
      min: 45,
      max: 120,
      default: 90,
      step: 5,
      unit: '°',
      description: 'Angle between cylinder banks'
    },
    {
      type: 'number',
      name: 'wallThickness',
      label: 'Wall Thickness',
      min: 1.5,
      max: 8,
      default: 3,
      step: 0.5,
      unit: 'mm',
      description: 'Block wall thickness'
    },
    {
      type: 'number',
      name: 'cylinderSpacing',
      label: 'Cylinder Spacing',
      min: 25,
      max: 60,
      default: 35,
      step: 1,
      unit: 'mm',
      description: 'Distance between cylinder centers',
      dynamicMin: (params) => Number(params['bore']) + 5
    },
    {
      type: 'number',
      name: 'oilPanDepth',
      label: 'Oil Pan Depth',
      min: 10,
      max: 60,
      default: 25,
      step: 1,
      unit: 'mm',
      description: 'Depth of the oil pan sump'
    }
  ],
  builderCode: `
    // Note: box, cylinder, tube, union, difference, etc. are already destructured by the worker
    const { MIN_WALL_THICKNESS } = ctx.constants

    // Parameters
    const bore = Number(params['bore']) || 30
    const stroke = Number(params['stroke']) || 25
    const bankAngle = Number(params['bankAngle']) || 90
    const wallThickness = Math.max(Number(params['wallThickness']) || 3, MIN_WALL_THICKNESS)
    const cylinderSpacing = Math.max(Number(params['cylinderSpacing']) || 35, bore + 5)
    const oilPanDepth = Number(params['oilPanDepth']) || 25

    // Derived dimensions
    const boreRadius = bore / 2
    const cylinderOuterRadius = boreRadius + wallThickness
    const blockLength = cylinderSpacing * 3 + cylinderOuterRadius * 2 // 4 cylinders per bank
    const deckHeight = stroke * 1.5 // Distance from crank centerline to deck
    const mainJournalRadius = bore * 0.25
    const halfBankAngle = bankAngle / 2

    // Block dimensions
    const blockWidth = cylinderOuterRadius * 2 + wallThickness * 2
    const blockHeight = deckHeight + stroke / 2 + mainJournalRadius + wallThickness
    const crankcaseWidth = blockWidth * 1.5
    const crankcaseHeight = mainJournalRadius * 2 + wallThickness * 2

    // Create left bank
    const leftBank = box(blockWidth, blockLength, blockHeight)
      .translate(0, 0, blockHeight / 2)
      .rotate(0, -halfBankAngle, 0)
      .translate(-Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)

    // Create right bank
    const rightBank = box(blockWidth, blockLength, blockHeight)
      .translate(0, 0, blockHeight / 2)
      .rotate(0, halfBankAngle, 0)
      .translate(Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)

    // Crankcase bottom
    const crankcase = box(crankcaseWidth, blockLength, crankcaseHeight)
      .translate(0, 0, -crankcaseHeight / 2)

    // Build oil pan
    function buildOilPan() {
      const panWidth = crankcaseWidth + wallThickness * 2
      const panLength = blockLength
      const panRailHeight = wallThickness * 2
      const sumpDepth = oilPanDepth
      const sumpLength = blockLength * 0.6

      // Main pan rail (attaches to crankcase) - overlaps crankcase by 2mm
      let pan = box(panWidth, panLength, panRailHeight + 2)
        .translate(0, 0, -crankcaseHeight - panRailHeight / 2)

      // Sump (deeper section in rear for oil collection)
      const sump = box(panWidth - wallThickness * 4, sumpLength, sumpDepth)
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2)
      pan = pan.add(sump)

      // Hollow out the inside
      const innerWidth = panWidth - wallThickness * 2
      const innerRail = box(innerWidth, panLength - wallThickness * 2, panRailHeight + 4)
        .translate(0, 0, -crankcaseHeight - panRailHeight / 2 + wallThickness)
      pan = pan.subtract(innerRail)

      const innerSump = box(innerWidth - wallThickness * 2, sumpLength - wallThickness * 2, sumpDepth)
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2 + wallThickness)
      pan = pan.subtract(innerSump)

      // Drain plug boss
      const drainBossRadius = bore * 0.15
      const drainBoss = cylinder(wallThickness * 2, drainBossRadius)
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth)
      pan = pan.add(drainBoss)

      // Drain hole
      const drainHole = cylinder(wallThickness * 3, drainBossRadius * 0.5)
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth)
      pan = pan.subtract(drainHole)

      return pan
    }

    // Build timing cover (front of engine)
    function buildTimingCover() {
      const coverDepth = wallThickness * 3
      const panRailHeight = wallThickness * 2
      const overlap = cylinderOuterRadius // overlap into block to ensure connectivity with V-banks

      // Calculate the front face width based on bank angle
      const rad = halfBankAngle * Math.PI / 180
      const topWidth = Math.sin(rad) * blockWidth * 2 + blockWidth * Math.cos(rad)
      const coverHeight = blockHeight + crankcaseHeight + panRailHeight

      // Main cover plate - positioned at front of block with overlap into block
      let cover = box(topWidth, coverDepth + overlap, coverHeight)
        .translate(0, -blockLength / 2 - coverDepth / 2 + overlap / 2, coverHeight / 2 - crankcaseHeight - panRailHeight)

      // Crank snout seal boss (protrudes forward)
      const sealBossRadius = mainJournalRadius * 1.5
      const sealBossDepth = wallThickness * 2
      const coverFront = -blockLength / 2 - coverDepth + overlap / 2
      const sealBoss = cylinder(sealBossDepth, sealBossRadius)
        .rotate(90, 0, 0)
        .translate(0, coverFront - sealBossDepth / 2, 0)
      cover = cover.add(sealBoss)

      // Crank snout hole (for pulley/damper)
      const snoutHoleRadius = mainJournalRadius * 0.8
      const snoutHole = cylinder(coverDepth + sealBossDepth + overlap + 10, snoutHoleRadius)
        .rotate(90, 0, 0)
        .translate(0, coverFront, 0)
      cover = cover.subtract(snoutHole)

      // Water pump mounting boss (upper center)
      const waterPumpBossRadius = bore * 0.3
      const waterPumpBoss = cylinder(wallThickness * 2, waterPumpBossRadius)
        .rotate(90, 0, 0)
        .translate(0, coverFront - wallThickness, blockHeight * 0.5)
      cover = cover.add(waterPumpBoss)

      // Water pump inlet hole
      const waterPumpHole = cylinder(coverDepth + wallThickness * 3 + overlap, waterPumpBossRadius * 0.6)
        .rotate(90, 0, 0)
        .translate(0, coverFront, blockHeight * 0.5)
      cover = cover.subtract(waterPumpHole)

      return cover
    }

    // Build rear main seal housing (back of engine)
    function buildRearMainSealHousing() {
      const housingDepth = wallThickness * 3
      const panRailHeight = wallThickness * 2
      const overlap = cylinderOuterRadius // overlap into block to ensure connectivity with V-banks

      // Calculate the rear face width based on bank angle
      const rad = halfBankAngle * Math.PI / 180
      const topWidth = Math.sin(rad) * blockWidth * 2 + blockWidth * Math.cos(rad)
      const housingHeight = blockHeight + crankcaseHeight + panRailHeight

      // Main housing plate - positioned at rear of block with overlap into block
      let housing = box(topWidth, housingDepth + overlap, housingHeight)
        .translate(0, blockLength / 2 + housingDepth / 2 - overlap / 2, housingHeight / 2 - crankcaseHeight - panRailHeight)

      // Rear main seal boss (circular boss around crankshaft exit)
      const sealBossRadius = mainJournalRadius * 2
      const sealBossDepth = wallThickness * 2
      const housingRear = blockLength / 2 + housingDepth - overlap / 2
      const sealBoss = cylinder(sealBossDepth, sealBossRadius)
        .rotate(90, 0, 0)
        .translate(0, housingRear + sealBossDepth / 2, 0)
      housing = housing.add(sealBoss)

      // Crankshaft exit hole (rear main seal bore)
      const sealHoleRadius = mainJournalRadius * 1.2
      const sealHole = cylinder(housingDepth + sealBossDepth + overlap + 10, sealHoleRadius)
        .rotate(90, 0, 0)
        .translate(0, housingRear, 0)
      housing = housing.subtract(sealHole)

      // Flywheel bolt pattern boss (ring of bosses around crankshaft)
      const boltPatternRadius = mainJournalRadius * 3
      const boltBossRadius = bore * 0.08
      const numBolts = 6
      for (let i = 0; i < numBolts; i++) {
        const angle = (i / numBolts) * Math.PI * 2
        const bx = Math.cos(angle) * boltPatternRadius
        const bz = Math.sin(angle) * boltPatternRadius
        const boltBoss = cylinder(wallThickness * 1.5, boltBossRadius)
          .rotate(90, 0, 0)
          .translate(bx, housingRear + wallThickness * 0.75, bz)
        housing = housing.add(boltBoss)

        // Bolt hole
        const boltHole = cylinder(housingDepth + overlap + wallThickness * 2, boltBossRadius * 0.5)
          .rotate(90, 0, 0)
          .translate(bx, housingRear, bz)
        housing = housing.subtract(boltHole)
      }

      return housing
    }

    // Build lifter valley (visible carved-out channel between the V-banks)
    function buildLifterValley() {
      // The lifter valley runs the length of the block between the two cylinder banks
      // It's where the camshaft and lifters would be located in a pushrod V8
      const rad = halfBankAngle * Math.PI / 180

      // Valley width depends on bank angle - narrower for smaller angles
      const valleyWidth = Math.sin(rad) * blockWidth * 0.8
      const valleyLength = blockLength - wallThickness * 4  // Slightly shorter than block
      const valleyDepth = blockHeight * 0.4  // Carved into top of crankcase area

      // The valley sits at the top of the V, above the crankcase
      const valleyZ = valleyDepth / 2 + wallThickness * 2

      // Create the main valley cutout
      let valley = box(valleyWidth, valleyLength, valleyDepth)
        .translate(0, 0, valleyZ)

      // Add camshaft bore (visible opening at front and rear of valley)
      const camBoreRadius = mainJournalRadius * 0.7
      const camBore = cylinder(valleyLength + wallThickness * 8, camBoreRadius)
        .rotate(90, 0, 0)
        .translate(0, 0, wallThickness * 2)
      valley = valley.add(camBore)

      return valley
    }

    // Build head bolt holes for a cylinder bank (visible holes in the deck surface)
    function buildHeadBoltHoles(isLeftBank) {
      const boltHoleRadius = bore * 0.05  // Small bolt holes
      const boltHoleDepth = wallThickness * 3  // Deep enough to penetrate deck
      const boltPatternRadius = boreRadius + wallThickness * 0.6
      const numBolts = 4
      const bankRotation = isLeftBank ? -halfBankAngle : halfBankAngle
      const bankXOffset = (isLeftBank ? -1 : 1) * Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2

      let holes = null

      for (let cylIdx = 0; cylIdx < 4; cylIdx++) {
        const yOffset = -blockLength / 2 + cylinderOuterRadius + cylIdx * cylinderSpacing

        for (let boltIdx = 0; boltIdx < numBolts; boltIdx++) {
          // Position bolts at 45°, 135°, 225°, 315° around cylinder
          const angle = (boltIdx * 90 + 45) * Math.PI / 180
          const localX = Math.cos(angle) * boltPatternRadius

          // Position hole to penetrate through the deck surface
          const holeZ = blockHeight
          const boltHole = cylinder(boltHoleDepth, boltHoleRadius)
            .translate(localX, yOffset, holeZ)
            .rotate(0, bankRotation, 0)
            .translate(bankXOffset, 0, 0)

          if (holes === null) {
            holes = boltHole
          } else {
            // Bolt holes don't touch each other - skip connection check since they're all subtracted together
            holes = holes.add(boltHole, { skipConnectionCheck: true })
          }
        }
      }

      return holes
    }

    // Combine into one block
    let block = union(leftBank, rightBank).add(crankcase)

    // Add oil pan
    block = block.add(buildOilPan())

    // Add timing cover
    block = block.add(buildTimingCover())

    // Add rear main seal housing
    block = block.add(buildRearMainSealHousing())

    // Bore cylinders on left bank
    for (let i = 0; i < 4; i++) {
      const yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      const cylinderBore = cylinder(blockHeight + 10, boreRadius)
        .rotate(0, -halfBankAngle, 0)
        .translate(
          -Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
          yOffset,
          Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2
        )
      block = block.subtract(cylinderBore)
    }

    // Bore cylinders on right bank
    for (let i = 0; i < 4; i++) {
      const yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      const cylinderBore = cylinder(blockHeight + 10, boreRadius)
        .rotate(0, halfBankAngle, 0)
        .translate(
          Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
          yOffset,
          Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2
        )
      block = block.subtract(cylinderBore)
    }

    // Bore out main bearing saddles (crank tunnel)
    const crankBore = cylinder(blockLength + 10, mainJournalRadius + 1)
      .rotate(90, 0, 0)
    block = block.subtract(crankBore)

    // Carve out lifter valley between the banks
    block = block.subtract(buildLifterValley())

    // Drill head bolt holes into both banks (visible holes in deck surface)
    block = block.subtract(buildHeadBoltHoles(true))   // Left bank
    block = block.subtract(buildHeadBoltHoles(false))  // Right bank

    // Center the model on Z=0 for printing
    const bbox = block.getBoundingBox()
    block = block.translate(0, 0, -bbox.min[2])

    return block
  `,
  displayDimensions: [
    { label: 'Bore', param: 'bore', format: '⌀{value}mm' },
    { label: 'Stroke', param: 'stroke', format: '{value}mm' },
    { label: 'Bank Angle', param: 'bankAngle', format: '{value}°' },
    { label: 'Oil Pan', param: 'oilPanDepth', format: '{value}mm' }
  ]
}

export default generator
