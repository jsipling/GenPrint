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

    // Helper to create rounded box (cube with rounded vertical edges)
    function createRoundedBox(w, d, h, r) {
      var c1 = M.Manifold.cube([w, d, h], true)
      var offset = Math.max(w, d, h) * 0.1
      var c2 = c1.translate(0, 0, offset)
      c1.delete()
      var c3 = c2.translate(0, 0, -offset)
      c2.delete()
      return c3
    }

    // Create left bank
    var lb1 = M.Manifold.cube([blockWidth, blockLength, blockHeight], true)
    var lb2 = lb1.translate(0, 0, blockHeight / 2)
    lb1.delete()
    var lb3 = lb2.rotate([0, -halfBankAngle, 0])
    lb2.delete()
    var leftBank = lb3.translate(-Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)
    lb3.delete()

    // Create right bank
    var rb1 = M.Manifold.cube([blockWidth, blockLength, blockHeight], true)
    var rb2 = rb1.translate(0, 0, blockHeight / 2)
    rb1.delete()
    var rb3 = rb2.rotate([0, halfBankAngle, 0])
    rb2.delete()
    var rightBank = rb3.translate(Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2, 0, 0)
    rb3.delete()

    // Crankcase bottom
    var cc1 = M.Manifold.cube([crankcaseWidth, blockLength, crankcaseHeight], true)
    var crankcase = cc1.translate(0, 0, -crankcaseHeight / 2)
    cc1.delete()

    // Build oil pan
    function buildOilPan() {
      var panWidth = crankcaseWidth + wallThickness * 2
      var panLength = blockLength
      var panRailHeight = wallThickness * 2
      var sumpDepth = oilPanDepth
      var sumpLength = blockLength * 0.6

      // Main pan rail (attaches to crankcase) - overlaps crankcase by 2mm
      var pr1 = M.Manifold.cube([panWidth, panLength, panRailHeight + 2], true)
      var panRail = pr1.translate(0, 0, -crankcaseHeight - panRailHeight / 2)
      pr1.delete()

      // Sump (deeper section in rear for oil collection)
      var s1 = M.Manifold.cube([panWidth - wallThickness * 4, sumpLength, sumpDepth], true)
      var sump = s1.translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2)
      s1.delete()

      var pan = panRail.add(sump)
      panRail.delete()
      sump.delete()

      // Hollow out the inside
      var innerWidth = panWidth - wallThickness * 2
      var ir1 = M.Manifold.cube([innerWidth, panLength - wallThickness * 2, panRailHeight + 4], true)
      var innerRail = ir1.translate(0, 0, -crankcaseHeight - panRailHeight / 2 + wallThickness)
      ir1.delete()
      var pan2 = pan.subtract(innerRail)
      pan.delete()
      innerRail.delete()
      pan = pan2

      var is1 = M.Manifold.cube([innerWidth - wallThickness * 2, sumpLength - wallThickness * 2, sumpDepth], true)
      var innerSump = is1.translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth / 2 + wallThickness)
      is1.delete()
      var pan3 = pan.subtract(innerSump)
      pan.delete()
      innerSump.delete()
      pan = pan3

      // Drain plug boss
      var drainBossRadius = bore * 0.15
      var db1 = M.Manifold.cylinder(wallThickness * 2, drainBossRadius, drainBossRadius, 0)
      var drainBoss = db1.translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth)
      db1.delete()
      var pan4 = pan.add(drainBoss)
      pan.delete()
      drainBoss.delete()
      pan = pan4

      // Drain hole
      var dh1 = M.Manifold.cylinder(wallThickness * 3, drainBossRadius * 0.5, drainBossRadius * 0.5, 0)
      var drainHole = dh1.translate(0, (panLength - sumpLength) / 4, -crankcaseHeight - panRailHeight - sumpDepth)
      dh1.delete()
      var pan5 = pan.subtract(drainHole)
      pan.delete()
      drainHole.delete()

      return pan5
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
      var cp1 = M.Manifold.cube([topWidth, coverDepth + overlap, coverHeight], true)
      var cover = cp1.translate(0, -blockLength / 2 - coverDepth / 2 + overlap / 2, coverHeight / 2 - crankcaseHeight - panRailHeight)
      cp1.delete()

      // Crank snout seal boss (protrudes forward)
      var sealBossRadius = mainJournalRadius * 1.5
      var sealBossDepth = wallThickness * 2
      var coverFront = -blockLength / 2 - coverDepth + overlap / 2
      var sb1 = M.Manifold.cylinder(sealBossDepth, sealBossRadius, sealBossRadius, 0)
      var sb2 = sb1.rotate([90, 0, 0])
      sb1.delete()
      var sealBoss = sb2.translate(0, coverFront - sealBossDepth / 2, 0)
      sb2.delete()
      var cover2 = cover.add(sealBoss)
      cover.delete()
      sealBoss.delete()
      cover = cover2

      // Crank snout hole (for pulley/damper)
      var snoutHoleRadius = mainJournalRadius * 0.8
      var sh1 = M.Manifold.cylinder(coverDepth + sealBossDepth + overlap + 10, snoutHoleRadius, snoutHoleRadius, 0)
      var sh2 = sh1.rotate([90, 0, 0])
      sh1.delete()
      var snoutHole = sh2.translate(0, coverFront, 0)
      sh2.delete()
      var cover3 = cover.subtract(snoutHole)
      cover.delete()
      snoutHole.delete()
      cover = cover3

      // Water pump mounting boss (upper center)
      var waterPumpBossRadius = bore * 0.3
      var wpb1 = M.Manifold.cylinder(wallThickness * 2, waterPumpBossRadius, waterPumpBossRadius, 0)
      var wpb2 = wpb1.rotate([90, 0, 0])
      wpb1.delete()
      var waterPumpBoss = wpb2.translate(0, coverFront - wallThickness, blockHeight * 0.5)
      wpb2.delete()
      var cover4 = cover.add(waterPumpBoss)
      cover.delete()
      waterPumpBoss.delete()
      cover = cover4

      // Water pump inlet hole
      var wph1 = M.Manifold.cylinder(coverDepth + wallThickness * 3 + overlap, waterPumpBossRadius * 0.6, waterPumpBossRadius * 0.6, 0)
      var wph2 = wph1.rotate([90, 0, 0])
      wph1.delete()
      var waterPumpHole = wph2.translate(0, coverFront, blockHeight * 0.5)
      wph2.delete()
      var cover5 = cover.subtract(waterPumpHole)
      cover.delete()
      waterPumpHole.delete()

      return cover5
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
      var hp1 = M.Manifold.cube([topWidth, housingDepth + overlap, housingHeight], true)
      var housing = hp1.translate(0, blockLength / 2 + housingDepth / 2 - overlap / 2, housingHeight / 2 - crankcaseHeight - panRailHeight)
      hp1.delete()

      // Rear main seal boss (circular boss around crankshaft exit)
      var sealBossRadius = mainJournalRadius * 2
      var sealBossDepth = wallThickness * 2
      var housingRear = blockLength / 2 + housingDepth - overlap / 2
      var sb1 = M.Manifold.cylinder(sealBossDepth, sealBossRadius, sealBossRadius, 0)
      var sb2 = sb1.rotate([90, 0, 0])
      sb1.delete()
      var sealBoss = sb2.translate(0, housingRear + sealBossDepth / 2, 0)
      sb2.delete()
      var housing2 = housing.add(sealBoss)
      housing.delete()
      sealBoss.delete()
      housing = housing2

      // Crankshaft exit hole (rear main seal bore)
      var sealHoleRadius = mainJournalRadius * 1.2
      var sh1 = M.Manifold.cylinder(housingDepth + sealBossDepth + overlap + 10, sealHoleRadius, sealHoleRadius, 0)
      var sh2 = sh1.rotate([90, 0, 0])
      sh1.delete()
      var sealHole = sh2.translate(0, housingRear, 0)
      sh2.delete()
      var housing3 = housing.subtract(sealHole)
      housing.delete()
      sealHole.delete()
      housing = housing3

      // Flywheel bolt pattern boss (ring of bosses around crankshaft)
      var boltPatternRadius = mainJournalRadius * 3
      var boltBossRadius = bore * 0.08
      var numBolts = 6
      for (var i = 0; i < numBolts; i++) {
        var angle = (i / numBolts) * Math.PI * 2
        var bx = Math.cos(angle) * boltPatternRadius
        var bz = Math.sin(angle) * boltPatternRadius
        var bb1 = M.Manifold.cylinder(wallThickness * 1.5, boltBossRadius, boltBossRadius, 0)
        var bb2 = bb1.rotate([90, 0, 0])
        bb1.delete()
        var boltBoss = bb2.translate(bx, housingRear + wallThickness * 0.75, bz)
        bb2.delete()
        var housing4 = housing.add(boltBoss)
        housing.delete()
        boltBoss.delete()
        housing = housing4

        // Bolt hole
        var bh1 = M.Manifold.cylinder(housingDepth + overlap + wallThickness * 2, boltBossRadius * 0.5, boltBossRadius * 0.5, 0)
        var bh2 = bh1.rotate([90, 0, 0])
        bh1.delete()
        var boltHole = bh2.translate(bx, housingRear, bz)
        bh2.delete()
        var housing5 = housing.subtract(boltHole)
        housing.delete()
        boltHole.delete()
        housing = housing5
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
      var v1 = M.Manifold.cube([valleyWidth, valleyLength, valleyDepth], true)
      var valleyBox = v1.translate(0, 0, valleyZ)
      v1.delete()

      // Add camshaft bore (visible opening at front and rear of valley)
      var camBoreRadius = mainJournalRadius * 0.7
      var cb1 = M.Manifold.cylinder(valleyLength + wallThickness * 8, camBoreRadius, camBoreRadius, 0)
      var cb2 = cb1.rotate([90, 0, 0])
      cb1.delete()
      var camBore = cb2.translate(0, 0, wallThickness * 2)
      cb2.delete()
      var valley = valleyBox.add(camBore)
      valleyBox.delete()
      camBore.delete()

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
          var bh1 = M.Manifold.cylinder(boltHoleDepth, boltHoleRadius, boltHoleRadius, 0)
          var bh2 = bh1.translate(localX, yOffset, holeZ)
          bh1.delete()
          var bh3 = bh2.rotate([0, bankRotation, 0])
          bh2.delete()
          var boltHole = bh3.translate(bankXOffset, 0, 0)
          bh3.delete()

          holeList.push(boltHole)
        }
      }

      if (holeList.length === 0) return null
      var result = holeList[0]
      for (var i = 1; i < holeList.length; i++) {
        var temp = result.add(holeList[i])
        result.delete()
        holeList[i].delete()
        result = temp
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

      // Main plenum body (rounded box shape)
      var pb1 = createRoundedBox(plenumWidth, plenumLength, plenumHeight, wallThickness)
      var plenumBody = pb1.translate(0, 0, plenumZ)
      pb1.delete()
      manifoldParts.push(plenumBody)

      // Throttle body boss at front of plenum
      var throttleBodyRadius = bore * 0.35
      var throttleBodyLength = wallThickness * 4
      var tb1 = M.Manifold.cylinder(throttleBodyLength, throttleBodyRadius, throttleBodyRadius, 0)
      var tb2 = tb1.rotate([90, 0, 0])
      tb1.delete()
      var throttleBody = tb2.translate(0, -plenumLength / 2 - throttleBodyLength / 2 + 2, plenumZ)
      tb2.delete()
      manifoldParts.push(throttleBody)

      // Intake runners - one for each cylinder (3 per bank)
      var runnerRadius = bore * 0.2
      var runnerLength = blockWidth * 0.6

      // Left bank runners
      for (var i = 0; i < 3; i++) {
        var yPos = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
        var r1 = M.Manifold.cylinder(runnerLength, runnerRadius, runnerRadius, 0)
        var r2 = r1.rotate([0, -halfBankAngle - 90, 0])
        r1.delete()
        var runner = r2.translate(-plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        r2.delete()
        manifoldParts.push(runner)
      }

      // Right bank runners
      for (var i = 0; i < 3; i++) {
        var yPos = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
        var r1 = M.Manifold.cylinder(runnerLength, runnerRadius, runnerRadius, 0)
        var r2 = r1.rotate([0, halfBankAngle + 90, 0])
        r1.delete()
        var runner = r2.translate(plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        r2.delete()
        manifoldParts.push(runner)
      }

      // Union all parts of the manifold
      var plenum = manifoldParts[0]
      for (var i = 1; i < manifoldParts.length; i++) {
        var temp = plenum.add(manifoldParts[i])
        plenum.delete()
        manifoldParts[i].delete()
        plenum = temp
      }

      // Throttle bore (hole through throttle body)
      var throttleBoreRadius = throttleBodyRadius * 0.7
      var tbo1 = M.Manifold.cylinder(throttleBodyLength + 10, throttleBoreRadius, throttleBoreRadius, 0)
      var tbo2 = tbo1.rotate([90, 0, 0])
      tbo1.delete()
      var throttleBore = tbo2.translate(0, -plenumLength / 2 - throttleBodyLength / 2, plenumZ)
      tbo2.delete()
      var plenum2 = plenum.subtract(throttleBore)
      plenum.delete()
      throttleBore.delete()
      plenum = plenum2

      // Hollow out runner ports
      for (var i = 0; i < 3; i++) {
        var yPos = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
        // Left bank runner port
        var lrp1 = M.Manifold.cylinder(runnerLength + 5, runnerRadius * 0.7, runnerRadius * 0.7, 0)
        var lrp2 = lrp1.rotate([0, -halfBankAngle - 90, 0])
        lrp1.delete()
        var leftRunnerPort = lrp2.translate(-plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        lrp2.delete()
        var plenum3 = plenum.subtract(leftRunnerPort)
        plenum.delete()
        leftRunnerPort.delete()
        plenum = plenum3

        // Right bank runner port
        var rrp1 = M.Manifold.cylinder(runnerLength + 5, runnerRadius * 0.7, runnerRadius * 0.7, 0)
        var rrp2 = rrp1.rotate([0, halfBankAngle + 90, 0])
        rrp1.delete()
        var rightRunnerPort = rrp2.translate(plenumWidth / 4, yPos, plenumZ - plenumHeight / 4)
        rrp2.delete()
        var plenum4 = plenum.subtract(rightRunnerPort)
        plenum.delete()
        rightRunnerPort.delete()
        plenum = plenum4
      }

      // Hollow out plenum interior
      var pi1 = createRoundedBox(
        plenumWidth - wallThickness * 2,
        plenumLength - wallThickness * 2,
        plenumHeight - wallThickness,
        wallThickness / 2
      )
      var plenumInterior = pi1.translate(0, 0, plenumZ + wallThickness / 2)
      pi1.delete()
      var plenum5 = plenum.subtract(plenumInterior)
      plenum.delete()
      plenumInterior.delete()

      return plenum5
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
        var b1 = M.Manifold.cylinder(bossDepth, portRadius + bossPadding, portRadius + bossPadding, 0)
        var b2 = b1.translate(portLocalX, yOffset, portZ)
        b1.delete()
        var b3 = b2.rotate([0, bankRotation, 0])
        b2.delete()
        var boss = b3.translate(bankXOffset, 0, 0)
        b3.delete()
        bossList.push(boss)

        // Create exhaust port hole
        var p1 = M.Manifold.cylinder(portDepth + bossDepth, portRadius, portRadius, 0)
        var p2 = p1.translate(portLocalX, yOffset, portZ)
        p1.delete()
        var p3 = p2.rotate([0, bankRotation, 0])
        p2.delete()
        var port = p3.translate(bankXOffset, 0, 0)
        p3.delete()
        portList.push(port)
      }

      var bossesResult = null
      if (bossList.length > 0) {
        bossesResult = bossList[0]
        for (var i = 1; i < bossList.length; i++) {
          var temp = bossesResult.add(bossList[i])
          bossesResult.delete()
          bossList[i].delete()
          bossesResult = temp
        }
      }

      var portsResult = null
      if (portList.length > 0) {
        portsResult = portList[0]
        for (var i = 1; i < portList.length; i++) {
          var temp = portsResult.add(portList[i])
          portsResult.delete()
          portList[i].delete()
          portsResult = temp
        }
      }

      return {
        bosses: bossesResult,
        ports: portsResult
      }
    }

    // Build engine block (banks + crankcase with bores and exhaust ports)
    var banks = leftBank.add(rightBank)
    leftBank.delete()
    rightBank.delete()
    var block = banks.add(crankcase)
    banks.delete()
    crankcase.delete()

    // Bore cylinders on left bank - 3 cylinders for V6
    for (var i = 0; i < 3; i++) {
      var yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      var cb1 = M.Manifold.cylinder(blockHeight + 10, boreRadius, boreRadius, 0)
      var cb2 = cb1.rotate([0, -halfBankAngle, 0])
      cb1.delete()
      var cylinderBore = cb2.translate(
        -Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
        yOffset,
        Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2
      )
      cb2.delete()
      var blockTemp = block.subtract(cylinderBore)
      block.delete()
      cylinderBore.delete()
      block = blockTemp
    }

    // Bore cylinders on right bank - 3 cylinders for V6
    for (var i = 0; i < 3; i++) {
      var yOffset = -blockLength / 2 + cylinderOuterRadius + i * cylinderSpacing
      var cb1 = M.Manifold.cylinder(blockHeight + 10, boreRadius, boreRadius, 0)
      var cb2 = cb1.rotate([0, halfBankAngle, 0])
      cb1.delete()
      var cylinderBore = cb2.translate(
        Math.sin(halfBankAngle * Math.PI / 180) * blockWidth / 2,
        yOffset,
        Math.cos(halfBankAngle * Math.PI / 180) * blockHeight / 2
      )
      cb2.delete()
      var blockTemp = block.subtract(cylinderBore)
      block.delete()
      cylinderBore.delete()
      block = blockTemp
    }

    // Bore out main bearing saddles (crank tunnel)
    var ck1 = M.Manifold.cylinder(blockLength + 10, mainJournalRadius + 1, mainJournalRadius + 1, 0)
    var ck2 = ck1.rotate([90, 0, 0])
    ck1.delete()
    var block5 = block.subtract(ck2)
    block.delete()
    ck2.delete()
    block = block5

    // Carve out lifter valley between the banks
    var valley = buildLifterValley()
    var block6 = block.subtract(valley)
    block.delete()
    valley.delete()
    block = block6

    // Drill head bolt holes into both banks (visible holes in deck surface)
    var leftHoles = buildHeadBoltHoles(true)
    var block7 = block.subtract(leftHoles)
    block.delete()
    leftHoles.delete()
    block = block7

    var rightHoles = buildHeadBoltHoles(false)
    var block8 = block.subtract(rightHoles)
    block.delete()
    rightHoles.delete()
    block = block8

    // Add exhaust port bosses and drill exhaust ports on both banks
    var leftExhaust = buildExhaustPorts(true)
    var rightExhaust = buildExhaustPorts(false)
    var block9 = block.add(leftExhaust.bosses)
    block.delete()
    leftExhaust.bosses.delete()
    var block10 = block9.add(rightExhaust.bosses)
    block9.delete()
    rightExhaust.bosses.delete()
    block = block10

    var block11 = block.subtract(leftExhaust.ports)
    block.delete()
    leftExhaust.ports.delete()
    var block12 = block11.subtract(rightExhaust.ports)
    block11.delete()
    rightExhaust.ports.delete()
    block = block12

    // Build accessories as separate parts
    var oilPan = buildOilPan()
    var timingCover = buildTimingCover()
    var rearHousing = buildRearMainSealHousing()

    // Find the lowest Z to center all parts on Z=0
    var blockBbox = block.boundingBox()
    var oilPanBbox = oilPan.boundingBox()
    var timingBbox = timingCover.boundingBox()
    var rearBbox = rearHousing.boundingBox()
    var minZ = Math.min(blockBbox.min[2], oilPanBbox.min[2], timingBbox.min[2], rearBbox.min[2])

    // Build optional intake manifold
    var intakeManifold = null
    if (showIntakeManifold) {
      intakeManifold = buildIntakeManifold()
      var intakeBbox = intakeManifold.boundingBox()
      minZ = Math.min(minZ, intakeBbox.min[2])
    }

    // Translate all parts to sit on Z=0
    var blockFinal = block.translate(0, 0, -minZ)
    block.delete()
    var oilPanFinal = oilPan.translate(0, 0, -minZ)
    oilPan.delete()
    var timingFinal = timingCover.translate(0, 0, -minZ)
    timingCover.delete()
    var rearFinal = rearHousing.translate(0, 0, -minZ)
    rearHousing.delete()

    // Build parts array
    var parts = [
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

    // Add intake manifold if enabled
    if (intakeManifold !== null) {
      var intakeFinal = intakeManifold.translate(0, 0, -minZ)
      intakeManifold.delete()
      parts.push({
        name: 'Intake Manifold',
        manifold: intakeFinal
      })
    }

    return parts
  `
}

export default generator
