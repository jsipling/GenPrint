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
    // Note: box, cylinder, tube, union, difference, etc. are already destructured by the worker
    var MIN_WALL_THICKNESS = ctx.constants.MIN_WALL_THICKNESS

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

    // Create left bank
    var leftBank = box(blockWidth, blockLength, blockHeight)
      .translate(0, 0, blockHeight / 2)
      .rotate(0, -halfBankAngle, 0)
      .translate(-Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)

    // Create right bank
    var rightBank = box(blockWidth, blockLength, blockHeight)
      .translate(0, 0, blockHeight / 2)
      .rotate(0, halfBankAngle, 0)
      .translate(Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)

    // Crankcase bottom
    var crankcase = box(crankcaseWidth, blockLength, crankcaseHeight)
      .translate(0, 0, -crankcaseHeight / 2)

    // Build oil pan
    function buildOilPan() {
      var panWidth = crankcaseWidth + wallThickness * 2
      var panLength = blockLength
      var panRailHeight = wallThickness * 2
      var sumpDepth = oilPanDepth
      var sumpLength = blockLength * 0.6

      // Main pan rail (attaches to crankcase) - overlaps crankcase by 2mm
      var pan = box(panWidth, panLength, panRailHeight + 2)
        .translate(0, 0, -crankcaseHeight - panRailHeight / 2)

      // Sump (deeper section in rear for oil collection)
      var sump = box(panWidth - wallThickness * 4, sumpLength, sumpDepth)
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2)
      pan = pan.add(sump)

      // Hollow out the inside
      var innerWidth = panWidth - wallThickness * 2
      var innerRail = box(innerWidth, panLength - wallThickness * 2, panRailHeight + 4)
        .translate(0, 0, -crankcaseHeight - panRailHeight / 2 + wallThickness)
      pan = pan.subtract(innerRail)

      var innerSump = box(innerWidth - wallThickness * 2, sumpLength - wallThickness * 2, sumpDepth)
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2 + wallThickness)
      pan = pan.subtract(innerSump)

      // Drain plug boss
      var drainBossRadius = bore * 0.15
      var drainBoss = cylinder(wallThickness * 2, drainBossRadius)
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth)
      pan = pan.add(drainBoss)

      // Drain hole
      var drainHole = cylinder(wallThickness * 3, drainBossRadius * 0.5)
        .translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth)
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
      var cover = box(topWidth, coverDepth + overlap, coverHeight)
        .translate(0, -blockLength / 2 - coverDepth / 2 + overlap / 2, coverHeight / 2 - crankcaseHeight - panRailHeight)

      // Crank snout seal boss (protrudes forward)
      var sealBossRadius = mainJournalRadius * 1.5
      var sealBossDepth = wallThickness * 2
      var coverFront = -blockLength / 2 - coverDepth + overlap / 2
      var sealBoss = cylinder(sealBossDepth, sealBossRadius)
        .rotate(90, 0, 0)
        .translate(0, coverFront - sealBossDepth / 2, 0)
      cover = cover.add(sealBoss)

      // Crank snout hole (for pulley/damper)
      var snoutHoleRadius = mainJournalRadius * 0.8
      var snoutHole = cylinder(coverDepth + sealBossDepth + overlap + 10, snoutHoleRadius)
        .rotate(90, 0, 0)
        .translate(0, coverFront, 0)
      cover = cover.subtract(snoutHole)

      // Water pump mounting boss (upper center)
      var waterPumpBossRadius = bore * 0.3
      var waterPumpBoss = cylinder(wallThickness * 2, waterPumpBossRadius)
        .rotate(90, 0, 0)
        .translate(0, coverFront - wallThickness, blockHeight * 0.5)
      cover = cover.add(waterPumpBoss)

      // Water pump inlet hole
      var waterPumpHole = cylinder(coverDepth + wallThickness * 3 + overlap, waterPumpBossRadius * 0.6)
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
      var housing = box(topWidth, housingDepth + overlap, housingHeight)
        .translate(0, blockLength / 2 + housingDepth / 2 - overlap / 2, housingHeight / 2 - crankcaseHeight - panRailHeight)

      // Rear main seal boss (circular boss around crankshaft exit)
      var sealBossRadius = mainJournalRadius * 2
      var sealBossDepth = wallThickness * 2
      var housingRear = blockLength / 2 + housingDepth - overlap / 2
      var sealBoss = cylinder(sealBossDepth, sealBossRadius)
        .rotate(90, 0, 0)
        .translate(0, housingRear + sealBossDepth / 2, 0)
      housing = housing.add(sealBoss)

      // Crankshaft exit hole (rear main seal bore)
      var sealHoleRadius = mainJournalRadius * 1.2
      var sealHole = cylinder(housingDepth + sealBossDepth + overlap + 10, sealHoleRadius)
        .rotate(90, 0, 0)
        .translate(0, housingRear, 0)
      housing = housing.subtract(sealHole)

      // Flywheel bolt pattern boss (ring of bosses around crankshaft)
      var boltPatternRadius = mainJournalRadius * 3
      var boltBossRadius = bore * 0.08
      var numBolts = 6
      for (var i = 0; i < numBolts; i++) {
        var angle = (i / numBolts) * Math.PI * 2
        var bx = Math.cos(angle) * boltPatternRadius
        var bz = Math.sin(angle) * boltPatternRadius
        var boltBoss = cylinder(wallThickness * 1.5, boltBossRadius)
          .rotate(90, 0, 0)
          .translate(bx, housingRear + wallThickness * 0.75, bz)
        housing = housing.add(boltBoss)

        // Bolt hole
        var boltHole = cylinder(housingDepth + overlap + wallThickness * 2, boltBossRadius * 0.5)
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
      var valley = box(valleyWidth, valleyLength, valleyDepth)
        .translate(0, 0, valleyZ)

      // Add camshaft bore (visible opening at front and rear of valley)
      var camBoreRadius = mainJournalRadius * 0.7
      var camBore = cylinder(valleyLength + wallThickness * 8, camBoreRadius)
        .rotate(90, 0, 0)
        .translate(0, 0, wallThickness * 2)
      valley = valley.add(camBore)

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
          // Position bolts at 45°, 135°, 225°, 315° around cylinder
          var angle = (boltIdx * 90 + 45) * Math.PI / 180
          var localX = Math.cos(angle) * boltPatternRadius

          // Position hole to penetrate through the deck surface
          var holeZ = blockHeight
          var boltHole = cylinder(boltHoleDepth, boltHoleRadius)
            .translate(localX, yOffset, holeZ)
            .rotate(0, bankRotation, 0)
            .translate(bankXOffset, 0, 0)

          holeList.push(boltHole)
        }
      }

      return holeList.length > 0 ? group(holeList).unionAll() : null
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

      // Main plenum body (rounded box shape)
      var plenumBody = roundedBox(plenumWidth, plenumLength, plenumHeight, wallThickness)
        .translate(0, 0, plenumZ)
      manifoldParts.push(plenumBody)

      // Throttle body boss at front of plenum
      var throttleBodyRadius = bore * 0.35
      var throttleBodyLength = wallThickness * 4
      var throttleBody = cylinder(throttleBodyLength, throttleBodyRadius)
        .rotate(90, 0, 0)
        .translate(0, -plenumLength / 2 - throttleBodyLength / 2 + 2, plenumZ)
      manifoldParts.push(throttleBody)

      // Intake runners - one for each cylinder (3 per bank)
      var runnerRadius = bore * 0.2
      var runnerLength = blockWidth * 0.6

      // Left bank runners
      for (var i = 0; i < 3; i++) {
        var yPos = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
        var runner = cylinder(runnerLength, runnerRadius)
          .rotate(0, -halfBankAngle - 90, 0)
          .translate(
            -plenumWidth / 4,
            yPos,
            plenumZ - plenumHeight / 4
          )
        manifoldParts.push(runner)
      }

      // Right bank runners
      for (var i = 0; i < 3; i++) {
        var yPos = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
        var runner = cylinder(runnerLength, runnerRadius)
          .rotate(0, halfBankAngle + 90, 0)
          .translate(
            plenumWidth / 4,
            yPos,
            plenumZ - plenumHeight / 4
          )
        manifoldParts.push(runner)
      }

      // Union all parts of the manifold
      var plenum = group(manifoldParts).unionAll()

      // Throttle bore (hole through throttle body)
      var throttleBoreRadius = throttleBodyRadius * 0.7
      var throttleBore = cylinder(throttleBodyLength + 10, throttleBoreRadius)
        .rotate(90, 0, 0)
        .translate(0, -plenumLength / 2 - throttleBodyLength / 2, plenumZ)
      plenum = plenum.subtract(throttleBore)

      // Hollow out runner ports
      for (var i = 0; i < 3; i++) {
        var yPos = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
        // Left bank runner port
        var leftRunnerPort = cylinder(runnerLength + 5, runnerRadius * 0.7)
          .rotate(0, -halfBankAngle - 90, 0)
          .translate(-plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        plenum = plenum.subtract(leftRunnerPort)

        // Right bank runner port
        var rightRunnerPort = cylinder(runnerLength + 5, runnerRadius * 0.7)
          .rotate(0, halfBankAngle + 90, 0)
          .translate(plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        plenum = plenum.subtract(rightRunnerPort)
      }

      // Hollow out plenum interior
      var plenumInterior = roundedBox(
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

        // Create exhaust port boss (raised gasket surface)
        var boss = cylinder(bossDepth, portRadius + bossPadding)
          .translate(portLocalX, yOffset, portZ)
          .rotate(0, bankRotation, 0)
          .translate(bankXOffset, 0, 0)
        bossList.push(boss)

        // Create exhaust port hole
        var port = cylinder(portDepth + bossDepth, portRadius)
          .translate(portLocalX, yOffset, portZ)
          .rotate(0, bankRotation, 0)
          .translate(bankXOffset, 0, 0)
        portList.push(port)
      }

      return {
        bosses: bossList.length > 0 ? group(bossList).unionAll() : null,
        ports: portList.length > 0 ? group(portList).unionAll() : null
      }
    }

    // Combine into one block
    var block = union(leftBank, rightBank).add(crankcase)

    // Add oil pan
    block = block.add(buildOilPan())

    // Add timing cover
    block = block.add(buildTimingCover())

    // Add rear main seal housing
    block = block.add(buildRearMainSealHousing())

    // Bore cylinders on left bank - 3 cylinders for V6
    for (var i = 0; i < 3; i++) {
      var yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      var cylinderBore = cylinder(blockHeight + 10, boreRadius)
        .rotate(0, -halfBankAngle, 0)
        .translate(
          -Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
          yOffset,
          Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2
        )
      block = block.subtract(cylinderBore)
    }

    // Bore cylinders on right bank - 3 cylinders for V6
    for (var i = 0; i < 3; i++) {
      var yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      var cylinderBore = cylinder(blockHeight + 10, boreRadius)
        .rotate(0, halfBankAngle, 0)
        .translate(
          Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
          yOffset,
          Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2
        )
      block = block.subtract(cylinderBore)
    }

    // Bore out main bearing saddles (crank tunnel)
    var crankBore = cylinder(blockLength + 10, mainJournalRadius + 1)
      .rotate(90, 0, 0)
    block = block.subtract(crankBore)

    // Carve out lifter valley between the banks
    block = block.subtract(buildLifterValley())

    // Drill head bolt holes into both banks (visible holes in deck surface)
    block = block.subtract(buildHeadBoltHoles(true))   // Left bank
    block = block.subtract(buildHeadBoltHoles(false))  // Right bank

    // Add exhaust port bosses and drill exhaust ports on both banks
    var leftExhaust = buildExhaustPorts(true)
    var rightExhaust = buildExhaustPorts(false)
    block = block.add(leftExhaust.bosses).add(rightExhaust.bosses)
    block = block.subtract(leftExhaust.ports).subtract(rightExhaust.ports)

    // Add optional intake manifold
    if (showIntakeManifold) {
      block = block.add(buildIntakeManifold())
    }

    // Center the model on Z=0 for printing
    var bbox = block.getBoundingBox()
    block = block.translate(0, 0, -bbox.min[2])

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
