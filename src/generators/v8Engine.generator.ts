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
    const lb1 = M.Manifold.cube([blockWidth, blockLength, blockHeight], true)
    const lb2 = lb1.translate(0, 0, blockHeight / 2)
    lb1.delete()
    const lb3 = lb2.rotate([0, -halfBankAngle, 0])
    lb2.delete()
    const leftBank = lb3.translate(-Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)
    lb3.delete()

    // Create right bank
    const rb1 = M.Manifold.cube([blockWidth, blockLength, blockHeight], true)
    const rb2 = rb1.translate(0, 0, blockHeight / 2)
    rb1.delete()
    const rb3 = rb2.rotate([0, halfBankAngle, 0])
    rb2.delete()
    const rightBank = rb3.translate(Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)
    rb3.delete()

    // Crankcase bottom
    const cc1 = M.Manifold.cube([crankcaseWidth, blockLength, crankcaseHeight], true)
    const crankcase = cc1.translate(0, 0, -crankcaseHeight / 2)
    cc1.delete()

    // Build oil pan
    function buildOilPan() {
      const panWidth = crankcaseWidth + wallThickness * 2
      const panLength = blockLength
      const panRailHeight = wallThickness * 2
      const sumpDepth = oilPanDepth
      const sumpLength = blockLength * 0.6

      // Main pan rail (attaches to crankcase) - overlaps crankcase by 2mm
      const pr1 = M.Manifold.cube([panWidth, panLength, panRailHeight + 2], true)
      const panRail = pr1.translate(0, 0, -crankcaseHeight - panRailHeight / 2)
      pr1.delete()

      // Sump (deeper section in rear for oil collection)
      const s1 = M.Manifold.cube([panWidth - wallThickness * 4, sumpLength, sumpDepth], true)
      const sump = s1.translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2)
      s1.delete()

      let pan = panRail.add(sump)
      panRail.delete()
      sump.delete()

      // Hollow out the inside
      const innerWidth = panWidth - wallThickness * 2
      const ir1 = M.Manifold.cube([innerWidth, panLength - wallThickness * 2, panRailHeight + 4], true)
      const innerRail = ir1.translate(0, 0, -crankcaseHeight - panRailHeight / 2 + wallThickness)
      ir1.delete()
      const pan2 = pan.subtract(innerRail)
      pan.delete()
      innerRail.delete()
      pan = pan2

      const is1 = M.Manifold.cube([innerWidth - wallThickness * 2, sumpLength - wallThickness * 2, sumpDepth], true)
      const innerSump = is1.translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2 + wallThickness)
      is1.delete()
      const pan3 = pan.subtract(innerSump)
      pan.delete()
      innerSump.delete()
      pan = pan3

      // Drain plug boss
      const drainBossRadius = bore * 0.15
      const db1 = M.Manifold.cylinder(wallThickness * 2, drainBossRadius, drainBossRadius, 0)
      const drainBoss = db1.translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth)
      db1.delete()
      const pan4 = pan.add(drainBoss)
      pan.delete()
      drainBoss.delete()
      pan = pan4

      // Drain hole
      const dh1 = M.Manifold.cylinder(wallThickness * 3, drainBossRadius * 0.5, drainBossRadius * 0.5, 0)
      const drainHole = dh1.translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth)
      dh1.delete()
      const pan5 = pan.subtract(drainHole)
      pan.delete()
      drainHole.delete()

      return pan5
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
      const cp1 = M.Manifold.cube([topWidth, coverDepth + overlap, coverHeight], true)
      let cover = cp1.translate(0, -blockLength / 2 - coverDepth / 2 + overlap / 2, coverHeight / 2 - crankcaseHeight - panRailHeight)
      cp1.delete()

      // Crank snout seal boss (protrudes forward)
      const sealBossRadius = mainJournalRadius * 1.5
      const sealBossDepth = wallThickness * 2
      const coverFront = -blockLength / 2 - coverDepth + overlap / 2
      const sb1 = M.Manifold.cylinder(sealBossDepth, sealBossRadius, sealBossRadius, 0)
      const sb2 = sb1.rotate([90, 0, 0])
      sb1.delete()
      const sealBoss = sb2.translate(0, coverFront - sealBossDepth / 2, 0)
      sb2.delete()
      const cover2 = cover.add(sealBoss)
      cover.delete()
      sealBoss.delete()
      cover = cover2

      // Crank snout hole (for pulley/damper)
      const snoutHoleRadius = mainJournalRadius * 0.8
      const sh1 = M.Manifold.cylinder(coverDepth + sealBossDepth + overlap + 10, snoutHoleRadius, snoutHoleRadius, 0)
      const sh2 = sh1.rotate([90, 0, 0])
      sh1.delete()
      const snoutHole = sh2.translate(0, coverFront, 0)
      sh2.delete()
      const cover3 = cover.subtract(snoutHole)
      cover.delete()
      snoutHole.delete()
      cover = cover3

      // Water pump mounting boss (upper center)
      const waterPumpBossRadius = bore * 0.3
      const wpb1 = M.Manifold.cylinder(wallThickness * 2, waterPumpBossRadius, waterPumpBossRadius, 0)
      const wpb2 = wpb1.rotate([90, 0, 0])
      wpb1.delete()
      const waterPumpBoss = wpb2.translate(0, coverFront - wallThickness, blockHeight * 0.5)
      wpb2.delete()
      const cover4 = cover.add(waterPumpBoss)
      cover.delete()
      waterPumpBoss.delete()
      cover = cover4

      // Water pump inlet hole
      const wph1 = M.Manifold.cylinder(coverDepth + wallThickness * 3 + overlap, waterPumpBossRadius * 0.6, waterPumpBossRadius * 0.6, 0)
      const wph2 = wph1.rotate([90, 0, 0])
      wph1.delete()
      const waterPumpHole = wph2.translate(0, coverFront, blockHeight * 0.5)
      wph2.delete()
      const cover5 = cover.subtract(waterPumpHole)
      cover.delete()
      waterPumpHole.delete()

      return cover5
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
      const hp1 = M.Manifold.cube([topWidth, housingDepth + overlap, housingHeight], true)
      let housing = hp1.translate(0, blockLength / 2 + housingDepth / 2 - overlap / 2, housingHeight / 2 - crankcaseHeight - panRailHeight)
      hp1.delete()

      // Rear main seal boss (circular boss around crankshaft exit)
      const sealBossRadius = mainJournalRadius * 2
      const sealBossDepth = wallThickness * 2
      const housingRear = blockLength / 2 + housingDepth - overlap / 2
      const sb1 = M.Manifold.cylinder(sealBossDepth, sealBossRadius, sealBossRadius, 0)
      const sb2 = sb1.rotate([90, 0, 0])
      sb1.delete()
      const sealBoss = sb2.translate(0, housingRear + sealBossDepth / 2, 0)
      sb2.delete()
      const housing2 = housing.add(sealBoss)
      housing.delete()
      sealBoss.delete()
      housing = housing2

      // Crankshaft exit hole (rear main seal bore)
      const sealHoleRadius = mainJournalRadius * 1.2
      const sh1 = M.Manifold.cylinder(housingDepth + sealBossDepth + overlap + 10, sealHoleRadius, sealHoleRadius, 0)
      const sh2 = sh1.rotate([90, 0, 0])
      sh1.delete()
      const sealHole = sh2.translate(0, housingRear, 0)
      sh2.delete()
      const housing3 = housing.subtract(sealHole)
      housing.delete()
      sealHole.delete()
      housing = housing3

      // Flywheel bolt pattern boss (ring of bosses around crankshaft)
      const boltPatternRadius = mainJournalRadius * 3
      const boltBossRadius = bore * 0.08
      const numBolts = 6
      for (let i = 0; i < numBolts; i++) {
        const angle = (i / numBolts) * Math.PI * 2
        const bx = Math.cos(angle) * boltPatternRadius
        const bz = Math.sin(angle) * boltPatternRadius
        const bb1 = M.Manifold.cylinder(wallThickness * 1.5, boltBossRadius, boltBossRadius, 0)
        const bb2 = bb1.rotate([90, 0, 0])
        bb1.delete()
        const boltBoss = bb2.translate(bx, housingRear + wallThickness * 0.75, bz)
        bb2.delete()
        const housing4 = housing.add(boltBoss)
        housing.delete()
        boltBoss.delete()
        housing = housing4

        // Bolt hole
        const bh1 = M.Manifold.cylinder(housingDepth + overlap + wallThickness * 2, boltBossRadius * 0.5, boltBossRadius * 0.5, 0)
        const bh2 = bh1.rotate([90, 0, 0])
        bh1.delete()
        const boltHole = bh2.translate(bx, housingRear, bz)
        bh2.delete()
        const housing5 = housing.subtract(boltHole)
        housing.delete()
        boltHole.delete()
        housing = housing5
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
      const v1 = M.Manifold.cube([valleyWidth, valleyLength, valleyDepth], true)
      const valleyBox = v1.translate(0, 0, valleyZ)
      v1.delete()

      // Add camshaft bore (visible opening at front and rear of valley)
      const camBoreRadius = mainJournalRadius * 0.7
      const cb1 = M.Manifold.cylinder(valleyLength + wallThickness * 8, camBoreRadius, camBoreRadius, 0)
      const cb2 = cb1.rotate([90, 0, 0])
      cb1.delete()
      const camBore = cb2.translate(0, 0, wallThickness * 2)
      cb2.delete()
      const valley = valleyBox.add(camBore)
      valleyBox.delete()
      camBore.delete()

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

      const holeList = []

      for (let cylIdx = 0; cylIdx < 4; cylIdx++) {
        const yOffset = -blockLength / 2 + cylinderOuterRadius + cylIdx * cylinderSpacing

        for (let boltIdx = 0; boltIdx < numBolts; boltIdx++) {
          // Position bolts at 45°, 135°, 225°, 315° around cylinder
          const angle = (boltIdx * 90 + 45) * Math.PI / 180
          const localX = Math.cos(angle) * boltPatternRadius

          // Position hole to penetrate through the deck surface
          const holeZ = blockHeight
          const bh1 = M.Manifold.cylinder(boltHoleDepth, boltHoleRadius, boltHoleRadius, 0)
          const bh2 = bh1.translate(localX, yOffset, holeZ)
          bh1.delete()
          const bh3 = bh2.rotate([0, bankRotation, 0])
          bh2.delete()
          const boltHole = bh3.translate(bankXOffset, 0, 0)
          bh3.delete()

          holeList.push(boltHole)
        }
      }

      if (holeList.length === 0) return null
      let result = holeList[0]
      for (let i = 1; i < holeList.length; i++) {
        const temp = result.add(holeList[i])
        result.delete()
        holeList[i].delete()
        result = temp
      }
      return result
    }

    // Build engine block (banks + crankcase with bores)
    const banks = leftBank.add(rightBank)
    leftBank.delete()
    rightBank.delete()
    let block = banks.add(crankcase)
    banks.delete()
    crankcase.delete()

    // Bore cylinders on left bank
    for (let i = 0; i < 4; i++) {
      const yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      const cb1 = M.Manifold.cylinder(blockHeight + 10, boreRadius, boreRadius, 0)
      const cb2 = cb1.rotate([0, -halfBankAngle, 0])
      cb1.delete()
      const cylinderBore = cb2.translate(
        -Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
        yOffset,
        Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2
      )
      cb2.delete()
      const blockTemp = block.subtract(cylinderBore)
      block.delete()
      cylinderBore.delete()
      block = blockTemp
    }

    // Bore cylinders on right bank
    for (let i = 0; i < 4; i++) {
      const yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      const cb1 = M.Manifold.cylinder(blockHeight + 10, boreRadius, boreRadius, 0)
      const cb2 = cb1.rotate([0, halfBankAngle, 0])
      cb1.delete()
      const cylinderBore = cb2.translate(
        Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
        yOffset,
        Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2
      )
      cb2.delete()
      const blockTemp = block.subtract(cylinderBore)
      block.delete()
      cylinderBore.delete()
      block = blockTemp
    }

    // Bore out main bearing saddles (crank tunnel)
    const ck1 = M.Manifold.cylinder(blockLength + 10, mainJournalRadius + 1, mainJournalRadius + 1, 0)
    const ck2 = ck1.rotate([90, 0, 0])
    ck1.delete()
    const block5 = block.subtract(ck2)
    block.delete()
    ck2.delete()
    block = block5

    // Carve out lifter valley between the banks
    const valley = buildLifterValley()
    const block6 = block.subtract(valley)
    block.delete()
    valley.delete()
    block = block6

    // Drill head bolt holes into both banks (visible holes in deck surface)
    const leftHoles = buildHeadBoltHoles(true)
    const block7 = block.subtract(leftHoles)
    block.delete()
    leftHoles.delete()
    block = block7

    const rightHoles = buildHeadBoltHoles(false)
    const block8 = block.subtract(rightHoles)
    block.delete()
    rightHoles.delete()
    block = block8

    // Build accessories as separate parts
    const oilPan = buildOilPan()
    const timingCover = buildTimingCover()
    const rearHousing = buildRearMainSealHousing()

    // Find the lowest Z to center all parts on Z=0
    const blockBbox = block.boundingBox()
    const oilPanBbox = oilPan.boundingBox()
    const timingBbox = timingCover.boundingBox()
    const rearBbox = rearHousing.boundingBox()
    const minZ = Math.min(blockBbox.min[2], oilPanBbox.min[2], timingBbox.min[2], rearBbox.min[2])

    // Translate all parts to sit on Z=0
    const blockFinal = block.translate(0, 0, -minZ)
    block.delete()
    const oilPanFinal = oilPan.translate(0, 0, -minZ)
    oilPan.delete()
    const timingFinal = timingCover.translate(0, 0, -minZ)
    timingCover.delete()
    const rearFinal = rearHousing.translate(0, 0, -minZ)
    rearHousing.delete()

    // Return multi-part result
    return [
      {
        name: 'Engine Block',
        manifold: blockFinal,
        dimensions: [
          { label: 'Bore', param: 'bore', format: '⌀{value}mm' },
          { label: 'Stroke', param: 'stroke', format: '{value}mm' },
          { label: 'Bank Angle', param: 'bankAngle', format: '{value}°' }
        ],
        params: { bore: bore, stroke: stroke, bankAngle: bankAngle }
      },
      {
        name: 'Oil Pan',
        manifold: oilPanFinal,
        dimensions: [
          { label: 'Depth', param: 'depth', format: '{value}mm' }
        ],
        params: { depth: oilPanDepth }
      },
      {
        name: 'Timing Cover',
        manifold: timingFinal
      },
      {
        name: 'Rear Main Seal Housing',
        manifold: rearFinal
      }
    ]
  `
}

export default generator
