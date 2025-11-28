import type { Generator } from './types'

const generator: Generator = {
  id: 'v6-engine',
  name: 'V6 Engine Block',
  description: 'V6 engine block with cylinder bores, crankcase, oil pan, timing cover, rear main seal housing, lifter valley, head bolt holes, exhaust ports, and optional intake manifold',
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
    },
    {
      type: 'boolean',
      name: 'showIntakeManifold',
      label: 'Show Intake Manifold',
      default: false,
      description: 'Add intake manifold with plenum and runners on top of the V'
    }
  ],
  builderCode: `
    // Parameters
    var bore = Number(params['bore']) || 30
    var stroke = Number(params['stroke']) || 25
    var bankAngle = 60 // Fixed 60-degree V6
    var wallThickness = Math.max(Number(params['wallThickness']) || 3, MIN_WALL_THICKNESS)
    var cylinderSpacing = Math.max(Number(params['cylinderSpacing']) || 35, bore + 5)
    var oilPanDepth = Number(params['oilPanDepth']) || 25
    var showIntakeManifold = params['showIntakeManifold'] === true

    // Derived dimensions
    var boreRadius = bore / 2
    var cylinderOuterRadius = boreRadius + wallThickness
    var blockLength = cylinderSpacing * 2 + cylinderOuterRadius * 2 // 3 cylinders per bank
    var deckHeight = stroke * 1.5 // Distance from crank centerline to deck
    var mainJournalRadius = bore * 0.25
    var halfBankAngle = bankAngle / 2

    // Block dimensions
    var blockWidth = cylinderOuterRadius * 2 + wallThickness * 2
    var blockHeight = deckHeight + stroke / 2 + mainJournalRadius + wallThickness
    var crankcaseWidth = blockWidth * 1.5
    var crankcaseHeight = mainJournalRadius * 2 + wallThickness * 2

    // Helper to create rounded box (simplified - uses regular box, rounded is negligible for printing)
    function createRoundedBox(w, d, h, r) {
      return geo.shape.box({ width: w, depth: d, height: h })
    }

    // Create left bank
    // geo.shape.box is centered, translate Z up by half height, rotate, then offset X
    var leftBank = geo.shape.box({ width: blockWidth, depth: blockLength, height: blockHeight })
      .translate(0, 0, blockHeight / 2)
      .rotate(0, -halfBankAngle, 0)
      .translate(-Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)

    // Create right bank
    var rightBank = geo.shape.box({ width: blockWidth, depth: blockLength, height: blockHeight })
      .translate(0, 0, blockHeight / 2)
      .rotate(0, halfBankAngle, 0)
      .translate(Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)

    // Crankcase bottom
    var crankcase = geo.shape.box({ width: crankcaseWidth, depth: blockLength, height: crankcaseHeight })
      .translate(0, 0, -crankcaseHeight / 2)

    // Build oil pan
    function buildOilPan() {
      var panWidth = crankcaseWidth + wallThickness * 2
      var panLength = blockLength
      var panRailHeight = wallThickness * 2
      var sumpDepth = oilPanDepth
      var sumpLength = blockLength * 0.6

      // Main pan rail (attaches to crankcase) - overlaps crankcase by 2mm
      var panRail = geo.shape.box({ width: panWidth, depth: panLength, height: panRailHeight + 2 })
        .translate(0, 0, -crankcaseHeight - panRailHeight / 2)

      // Sump (deeper section in rear for oil collection)
      var sump = geo.shape.box({ width: panWidth - wallThickness * 4, depth: sumpLength, height: sumpDepth })
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2)

      var pan = panRail.union(sump)

      // Hollow out the inside
      var innerWidth = panWidth - wallThickness * 2
      var innerRail = geo.shape.box({ width: innerWidth, depth: panLength - wallThickness * 2, height: panRailHeight + 4 })
        .translate(0, 0, -crankcaseHeight - panRailHeight / 2 + wallThickness)
      pan = pan.subtract(innerRail)

      var innerSump = geo.shape.box({ width: innerWidth - wallThickness * 2, depth: sumpLength - wallThickness * 2, height: sumpDepth })
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2 + wallThickness)
      pan = pan.subtract(innerSump)

      // Drain plug boss - geo cylinder is centered, so translate Z to position base
      var drainBossRadius = bore * 0.15
      var drainBossHeight = wallThickness * 2
      var drainBoss = geo.shape.cylinder({ diameter: drainBossRadius * 2, height: drainBossHeight })
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth + drainBossHeight / 2)
      pan = pan.union(drainBoss)

      // Drain hole
      var drainHoleHeight = wallThickness * 3
      var drainHole = geo.shape.cylinder({ diameter: drainBossRadius, height: drainHoleHeight })
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth + drainHoleHeight / 2)
      pan = pan.subtract(drainHole)

      return pan
    }

    // Build timing cover (front of engine)
    function buildTimingCover() {
      var coverDepth = wallThickness * 3
      var panRailHeight = wallThickness * 2
      var overlap = cylinderOuterRadius // overlap into block to ensure connectivity with V-banks

      // Calculate the front face width based on bank angle
      var rad = halfBankAngle * Math.PI / 180
      var topWidth = Math.sin(rad) * blockWidth * 2 + blockWidth * Math.cos(rad)
      var coverHeight = blockHeight + crankcaseHeight + panRailHeight

      // Main cover plate - positioned at front of block with overlap into block
      var cover = geo.shape.box({ width: topWidth, depth: coverDepth + overlap, height: coverHeight })
        .translate(0, -blockLength / 2 - coverDepth / 2 + overlap / 2, coverHeight / 2 - crankcaseHeight - panRailHeight)

      // Crank snout seal boss (protrudes forward) - cylinder oriented along Y axis
      var sealBossRadius = mainJournalRadius * 1.5
      var sealBossDepth = wallThickness * 2
      var coverFront = -blockLength / 2 - coverDepth + overlap / 2
      var sealBoss = geo.shape.cylinder({ diameter: sealBossRadius * 2, height: sealBossDepth })
        .rotate(90, 0, 0)
        .translate(0, coverFront - sealBossDepth / 2, 0)
      cover = cover.union(sealBoss)

      // Crank snout hole (for pulley/damper)
      var snoutHoleRadius = mainJournalRadius * 0.8
      var snoutHoleDepth = coverDepth + sealBossDepth + overlap + 10
      var snoutHole = geo.shape.cylinder({ diameter: snoutHoleRadius * 2, height: snoutHoleDepth })
        .rotate(90, 0, 0)
        .translate(0, coverFront, 0)
      cover = cover.subtract(snoutHole)

      // Water pump mounting boss (upper center)
      var waterPumpBossRadius = bore * 0.3
      var waterPumpBossDepth = wallThickness * 2
      var waterPumpBoss = geo.shape.cylinder({ diameter: waterPumpBossRadius * 2, height: waterPumpBossDepth })
        .rotate(90, 0, 0)
        .translate(0, coverFront - wallThickness, blockHeight * 0.5)
      cover = cover.union(waterPumpBoss)

      // Water pump inlet hole
      var waterPumpHoleDepth = coverDepth + wallThickness * 3 + overlap
      var waterPumpHole = geo.shape.cylinder({ diameter: waterPumpBossRadius * 1.2, height: waterPumpHoleDepth })
        .rotate(90, 0, 0)
        .translate(0, coverFront, blockHeight * 0.5)
      cover = cover.subtract(waterPumpHole)

      return cover
    }

    // Build rear main seal housing (back of engine)
    function buildRearMainSealHousing() {
      var housingDepth = wallThickness * 3
      var panRailHeight = wallThickness * 2
      var overlap = cylinderOuterRadius // overlap into block to ensure connectivity with V-banks

      // Calculate the rear face width based on bank angle
      var rad = halfBankAngle * Math.PI / 180
      var topWidth = Math.sin(rad) * blockWidth * 2 + blockWidth * Math.cos(rad)
      var housingHeight = blockHeight + crankcaseHeight + panRailHeight

      // Main housing plate - positioned at rear of block with overlap into block
      var housing = geo.shape.box({ width: topWidth, depth: housingDepth + overlap, height: housingHeight })
        .translate(0, blockLength / 2 + housingDepth / 2 - overlap / 2, housingHeight / 2 - crankcaseHeight - panRailHeight)

      // Rear main seal boss (circular boss around crankshaft exit)
      var sealBossRadius = mainJournalRadius * 2
      var sealBossDepth = wallThickness * 2
      var housingRear = blockLength / 2 + housingDepth - overlap / 2
      var sealBoss = geo.shape.cylinder({ diameter: sealBossRadius * 2, height: sealBossDepth })
        .rotate(90, 0, 0)
        .translate(0, housingRear + sealBossDepth / 2, 0)
      housing = housing.union(sealBoss)

      // Crankshaft exit hole (rear main seal bore)
      var sealHoleRadius = mainJournalRadius * 1.2
      var sealHoleDepth = housingDepth + sealBossDepth + overlap + 10
      var sealHole = geo.shape.cylinder({ diameter: sealHoleRadius * 2, height: sealHoleDepth })
        .rotate(90, 0, 0)
        .translate(0, housingRear, 0)
      housing = housing.subtract(sealHole)

      // Flywheel bolt pattern boss (ring of bosses around crankshaft)
      var boltPatternRadius = mainJournalRadius * 3
      var boltBossRadius = bore * 0.08
      var numBolts = 6
      var boltBossDepth = wallThickness * 1.5
      var boltHoleDepth = housingDepth + overlap + wallThickness * 2

      for (var i = 0; i < numBolts; i++) {
        var angle = (i / numBolts) * Math.PI * 2
        var bx = Math.cos(angle) * boltPatternRadius
        var bz = Math.sin(angle) * boltPatternRadius

        // Bolt boss
        var boltBoss = geo.shape.cylinder({ diameter: boltBossRadius * 2, height: boltBossDepth })
          .rotate(90, 0, 0)
          .translate(bx, housingRear + boltBossDepth / 2, bz)
        housing = housing.union(boltBoss)

        // Bolt hole
        var boltHole = geo.shape.cylinder({ diameter: boltBossRadius, height: boltHoleDepth })
          .rotate(90, 0, 0)
          .translate(bx, housingRear, bz)
        housing = housing.subtract(boltHole)
      }

      return housing
    }

    // Build lifter valley (visible carved-out channel between the V-banks)
    function buildLifterValley() {
      // The lifter valley runs the length of the block between the two cylinder banks
      // It's where the camshaft and lifters would be located in a pushrod V6
      var rad = halfBankAngle * Math.PI / 180

      // Valley width depends on bank angle - narrower for smaller angles
      var valleyWidth = Math.sin(rad) * blockWidth * 0.8
      var valleyLength = blockLength - wallThickness * 4  // Slightly shorter than block
      var valleyDepth = blockHeight * 0.4  // Carved into top of crankcase area

      // The valley sits at the top of the V, above the crankcase
      var valleyZ = valleyDepth / 2 + wallThickness * 2

      // Create the main valley cutout
      var valleyBox = geo.shape.box({ width: valleyWidth, depth: valleyLength, height: valleyDepth })
        .translate(0, 0, valleyZ)

      // Add camshaft bore (visible opening at front and rear of valley)
      var camBoreRadius = mainJournalRadius * 0.7
      var camBoreLength = valleyLength + wallThickness * 8
      var camBore = geo.shape.cylinder({ diameter: camBoreRadius * 2, height: camBoreLength })
        .rotate(90, 0, 0)
        .translate(0, 0, wallThickness * 2)

      var valley = valleyBox.union(camBore)

      return valley
    }

    // Build head bolt holes for a cylinder bank (visible holes in the deck surface)
    function buildHeadBoltHoles(isLeftBank) {
      var boltHoleRadius = bore * 0.05  // Small bolt holes
      var boltHoleDepth = wallThickness * 3  // Deep enough to penetrate deck
      var boltPatternRadius = boreRadius + wallThickness * 0.6
      var numBolts = 4
      var bankRotation = isLeftBank ? -halfBankAngle : halfBankAngle
      var bankXOffset = (isLeftBank ? -1 : 1) * Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2

      var holeList = []

      for (var cylIdx = 0; cylIdx < 3; cylIdx++) {  // 3 cylinders per bank for V6
        var yOffset = -blockLength / 2 + cylinderOuterRadius + cylIdx * cylinderSpacing

        for (var boltIdx = 0; boltIdx < numBolts; boltIdx++) {
          // Position bolts at 45 degrees, 135 degrees, 225 degrees, 315 degrees around cylinder
          var angle = (boltIdx * 90 + 45) * Math.PI / 180
          var localX = Math.cos(angle) * boltPatternRadius

          // Position hole to penetrate through the deck surface
          // geo cylinder is centered, so we position center at blockHeight + boltHoleDepth/2
          var holeZ = blockHeight + boltHoleDepth / 2
          var boltHole = geo.shape.cylinder({ diameter: boltHoleRadius * 2, height: boltHoleDepth })
            .translate(localX, yOffset, holeZ)
            .rotate(0, bankRotation, 0)
            .translate(bankXOffset, 0, 0)

          holeList.push(boltHole)
        }
      }

      if (holeList.length === 0) return null
      var result = holeList[0]
      for (var i = 1; i < holeList.length; i++) {
        result = result.union(holeList[i])
      }
      return result
    }

    // Build intake manifold (plenum + runners sitting on top of the V)
    function buildIntakeManifold() {
      var rad = halfBankAngle * Math.PI / 180

      // Plenum dimensions - sits in the valley between banks
      var plenumLength = blockLength * 0.85
      var plenumWidth = Math.sin(rad) * blockWidth * 1.2
      var plenumHeight = bore * 0.4
      var plenumZ = blockHeight * Math.cos(rad) + plenumHeight / 2 + wallThickness

      // Collect all parts of the manifold to union at the end
      var manifoldParts = []

      // Main plenum body (rounded box shape - using regular box for simplicity)
      var plenumBody = createRoundedBox(plenumWidth, plenumLength, plenumHeight, wallThickness)
        .translate(0, 0, plenumZ)
      manifoldParts.push(plenumBody)

      // Throttle body boss at front of plenum
      var throttleBodyRadius = bore * 0.35
      var throttleBodyLength = wallThickness * 4
      var throttleBody = geo.shape.cylinder({ diameter: throttleBodyRadius * 2, height: throttleBodyLength })
        .rotate(90, 0, 0)
        .translate(0, -plenumLength / 2 - throttleBodyLength / 2 + 2, plenumZ)
      manifoldParts.push(throttleBody)

      // Intake runners - one for each cylinder (3 per bank)
      var runnerRadius = bore * 0.2
      var runnerLength = blockWidth * 0.6

      // Left bank runners
      for (var i = 0; i < 3; i++) {
        var yPos = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
        var runner = geo.shape.cylinder({ diameter: runnerRadius * 2, height: runnerLength })
          .rotate(0, -halfBankAngle - 90, 0)
          .translate(-plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        manifoldParts.push(runner)
      }

      // Right bank runners
      for (var i = 0; i < 3; i++) {
        var yPos = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
        var runner = geo.shape.cylinder({ diameter: runnerRadius * 2, height: runnerLength })
          .rotate(0, halfBankAngle + 90, 0)
          .translate(plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        manifoldParts.push(runner)
      }

      // Union all parts of the manifold
      var plenum = manifoldParts[0]
      for (var i = 1; i < manifoldParts.length; i++) {
        plenum = plenum.union(manifoldParts[i])
      }

      // Throttle bore (hole through throttle body)
      var throttleBoreRadius = throttleBodyRadius * 0.7
      var throttleBoreLength = throttleBodyLength + 10
      var throttleBore = geo.shape.cylinder({ diameter: throttleBoreRadius * 2, height: throttleBoreLength })
        .rotate(90, 0, 0)
        .translate(0, -plenumLength / 2 - throttleBodyLength / 2, plenumZ)
      plenum = plenum.subtract(throttleBore)

      // Hollow out runner ports
      for (var i = 0; i < 3; i++) {
        var yPos = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
        // Left bank runner port
        var leftRunnerPort = geo.shape.cylinder({ diameter: runnerRadius * 1.4, height: runnerLength + 5 })
          .rotate(0, -halfBankAngle - 90, 0)
          .translate(-plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        plenum = plenum.subtract(leftRunnerPort)

        // Right bank runner port
        var rightRunnerPort = geo.shape.cylinder({ diameter: runnerRadius * 1.4, height: runnerLength + 5 })
          .rotate(0, halfBankAngle + 90, 0)
          .translate(plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        plenum = plenum.subtract(rightRunnerPort)
      }

      // Hollow out plenum interior
      var plenumInterior = createRoundedBox(
        plenumWidth - wallThickness * 2,
        plenumLength - wallThickness * 2,
        plenumHeight - wallThickness,
        wallThickness / 2
      ).translate(0, 0, plenumZ + wallThickness / 2)
      plenum = plenum.subtract(plenumInterior)

      return plenum
    }

    // Build exhaust ports (visible openings on outer face of each cylinder bank)
    function buildExhaustPorts(isLeftBank) {
      var portRadius = bore * 0.2  // Exhaust port ~40% of bore diameter
      var portDepth = wallThickness * 3  // Deep enough to be visible
      var bossPadding = wallThickness * 0.5  // Small boss around port
      var bossDepth = wallThickness * 1.5
      var bankRotation = isLeftBank ? -halfBankAngle : halfBankAngle
      var bankXOffset = (isLeftBank ? -1 : 1) * Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2

      var portList = []
      var bossList = []

      for (var cylIdx = 0; cylIdx < 3; cylIdx++) {  // 3 cylinders per bank for V6
        var yOffset = -blockLength / 2 + cylinderOuterRadius + cylIdx * cylinderSpacing

        // Position port on outer face of the bank (opposite the V valley side)
        // Port is at deck height level, offset outward from cylinder centerline
        var portLocalX = (isLeftBank ? -1 : 1) * (blockWidth / 2 - wallThickness)
        var portZ = blockHeight * 0.5

        // Create exhaust port boss (raised gasket surface) - cylinder along Z, positioned with center
        var boss = geo.shape.cylinder({ diameter: (portRadius + bossPadding) * 2, height: bossDepth })
          .translate(portLocalX, yOffset, portZ + bossDepth / 2)
          .rotate(0, bankRotation, 0)
          .translate(bankXOffset, 0, 0)
        bossList.push(boss)

        // Create exhaust port hole
        var port = geo.shape.cylinder({ diameter: portRadius * 2, height: portDepth + bossDepth })
          .translate(portLocalX, yOffset, portZ + (portDepth + bossDepth) / 2)
          .rotate(0, bankRotation, 0)
          .translate(bankXOffset, 0, 0)
        portList.push(port)
      }

      var bossesResult = null
      if (bossList.length > 0) {
        bossesResult = bossList[0]
        for (var i = 1; i < bossList.length; i++) {
          bossesResult = bossesResult.union(bossList[i])
        }
      }

      var portsResult = null
      if (portList.length > 0) {
        portsResult = portList[0]
        for (var i = 1; i < portList.length; i++) {
          portsResult = portsResult.union(portList[i])
        }
      }

      return {
        bosses: bossesResult,
        ports: portsResult
      }
    }

    // Combine into one block
    var block = leftBank.union(rightBank).union(crankcase)

    // Add oil pan
    var oilPan = buildOilPan()
    block = block.union(oilPan)

    // Add timing cover
    var timingCover = buildTimingCover()
    block = block.union(timingCover)

    // Add rear main seal housing
    var rearHousing = buildRearMainSealHousing()
    block = block.union(rearHousing)

    // Bore cylinders on left bank - 3 cylinders for V6
    for (var i = 0; i < 3; i++) {
      var yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      var cylinderBoreHeight = blockHeight + 10
      // geo cylinder is centered, so position center at Z = cos(angle) * blockHeight/2 + cylinderBoreHeight/2
      var cylinderBore = geo.shape.cylinder({ diameter: bore, height: cylinderBoreHeight })
        .rotate(0, -halfBankAngle, 0)
        .translate(
          -Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
          yOffset,
          Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2 + cylinderBoreHeight / 2
        )
      block = block.subtract(cylinderBore)
    }

    // Bore cylinders on right bank - 3 cylinders for V6
    for (var i = 0; i < 3; i++) {
      var yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      var cylinderBoreHeight = blockHeight + 10
      var cylinderBore = geo.shape.cylinder({ diameter: bore, height: cylinderBoreHeight })
        .rotate(0, halfBankAngle, 0)
        .translate(
          Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
          yOffset,
          Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2 + cylinderBoreHeight / 2
        )
      block = block.subtract(cylinderBore)
    }

    // Bore out main bearing saddles (crank tunnel)
    var crankTunnelLength = blockLength + 10
    var crankTunnel = geo.shape.cylinder({ diameter: (mainJournalRadius + 1) * 2, height: crankTunnelLength })
      .rotate(90, 0, 0)
    block = block.subtract(crankTunnel)

    // Carve out lifter valley between the banks
    var valley = buildLifterValley()
    block = block.subtract(valley)

    // Drill head bolt holes into both banks (visible holes in deck surface)
    var leftHoles = buildHeadBoltHoles(true)
    block = block.subtract(leftHoles)

    var rightHoles = buildHeadBoltHoles(false)
    block = block.subtract(rightHoles)

    // Add exhaust port bosses and drill exhaust ports on both banks
    var leftExhaust = buildExhaustPorts(true)
    var rightExhaust = buildExhaustPorts(false)
    block = block.union(leftExhaust.bosses).union(rightExhaust.bosses)
    block = block.subtract(leftExhaust.ports).subtract(rightExhaust.ports)

    // Add optional intake manifold
    if (showIntakeManifold) {
      var manifold = buildIntakeManifold()
      block = block.union(manifold)
    }

    return block
  `,
  displayDimensions: [
    { label: 'Bore', param: 'bore', format: '⌀{value}mm' },
    { label: 'Stroke', param: 'stroke', format: '{value}mm' },
    { label: 'Bank Angle', param: 'bankAngle', format: '60°' },
    { label: 'Oil Pan', param: 'oilPanDepth', format: '{value}mm' }
  ]
}

export default generator
