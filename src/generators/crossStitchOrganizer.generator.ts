import type { Generator } from './types'

const generator: Generator = {
  id: 'cross-stitch-organizer',
  name: 'Cross Stitch Organizer',
  description: 'Project organizer box with specialized compartments for bobbins, scissors, needles, and accessories. Features an optional hinged lid with embossed cross stitch pattern.',
  parameters: [
    {
      type: 'number',
      name: 'length',
      label: 'Box Length',
      min: 150,
      max: 300,
      default: 220,
      step: 5,
      unit: 'mm',
      description: 'Length of the organizer box (X dimension)'
    },
    {
      type: 'number',
      name: 'width',
      label: 'Box Width',
      min: 100,
      max: 200,
      default: 150,
      step: 5,
      unit: 'mm',
      description: 'Width of the organizer box (Y dimension)'
    },
    {
      type: 'number',
      name: 'height',
      label: 'Box Height',
      min: 30,
      max: 80,
      default: 45,
      step: 5,
      unit: 'mm',
      description: 'Interior height of the compartments'
    },
    {
      type: 'number',
      name: 'wallThickness',
      label: 'Wall Thickness',
      min: 1.5,
      max: 4,
      default: 2,
      step: 0.5,
      unit: 'mm',
      description: 'Thickness of walls and dividers'
    },
    {
      type: 'boolean',
      name: 'includeBobbins',
      label: 'Bobbin Compartments',
      default: true,
      description: 'Include grid of small compartments for thread bobbins',
      children: [
        {
          type: 'number',
          name: 'bobbinRows',
          label: 'Bobbin Rows',
          min: 2,
          max: 8,
          default: 4,
          step: 1,
          description: 'Number of bobbin rows'
        },
        {
          type: 'number',
          name: 'bobbinColumns',
          label: 'Bobbin Columns',
          min: 2,
          max: 10,
          default: 5,
          step: 1,
          description: 'Number of bobbin columns'
        }
      ]
    },
    {
      type: 'boolean',
      name: 'includeScissors',
      label: 'Scissors Compartment',
      default: true,
      description: 'Include large compartment for embroidery scissors'
    },
    {
      type: 'boolean',
      name: 'includeAccessories',
      label: 'Accessories Compartment',
      default: true,
      description: 'Include medium compartment for threaders, thimbles, seam rippers'
    },
    {
      type: 'boolean',
      name: 'includeNeedles',
      label: 'Needle Slot',
      default: true,
      description: 'Include narrow slot section for needles'
    },
    {
      type: 'boolean',
      name: 'showLid',
      label: 'Show Lid',
      default: true,
      description: 'Include the hinged lid with cross stitch pattern',
      children: [
        {
          type: 'number',
          name: 'lidThickness',
          label: 'Lid Thickness',
          min: 2,
          max: 5,
          default: 3,
          step: 0.5,
          unit: 'mm',
          description: 'Thickness of the lid plate'
        }
      ]
    }
  ],
  builderCode: `
    // Parameters with fallback defaults
    var length = Number(params['length']) || 220
    var width = Number(params['width']) || 150
    var height = Number(params['height']) || 45
    var wallThickness = Math.max(Number(params['wallThickness']) || 2, MIN_WALL_THICKNESS)

    // Compartment toggles
    var includeBobbins = params['includeBobbins'] !== false
    var bobbinRows = Math.max(2, Math.floor(Number(params['bobbinRows']) || 4))
    var bobbinColumns = Math.max(2, Math.floor(Number(params['bobbinColumns']) || 5))
    var includeScissors = params['includeScissors'] !== false
    var includeAccessories = params['includeAccessories'] !== false
    var includeNeedles = params['includeNeedles'] !== false

    var showLid = params['showLid'] !== false
    var lidThickness = Math.max(Number(params['lidThickness']) || 3, MIN_WALL_THICKNESS)

    // Check if any side compartments are enabled
    var hasSideCompartments = includeScissors || includeAccessories || includeNeedles

    // Compartment size constants (in mm)
    var SCISSORS_WIDTH = 55      // Width needed for embroidery scissors
    var ACCESSORIES_WIDTH = 40   // Width for threaders, thimbles
    var NEEDLES_WIDTH = 20       // Narrow slot for needles
    var BOBBIN_CELL_SIZE = 28    // Standard bobbin is ~25mm, add margin

    // Calculate side column width (largest needed compartment)
    var sideColumnWidth = 0
    if (includeScissors) sideColumnWidth = Math.max(sideColumnWidth, SCISSORS_WIDTH)
    if (includeAccessories) sideColumnWidth = Math.max(sideColumnWidth, ACCESSORIES_WIDTH)
    if (includeNeedles) sideColumnWidth = Math.max(sideColumnWidth, NEEDLES_WIDTH)

    // Derived dimensions
    var innerLength = length - wallThickness * 2
    var innerWidth = width - wallThickness * 2
    var totalHeight = height + wallThickness // box floor thickness

    // Calculate bobbin section dimensions
    var bobbinSectionWidth = hasSideCompartments ? innerLength - sideColumnWidth - wallThickness : innerLength

    // Pin hinge dimensions
    var hingeRadius = wallThickness * 1.5
    var hingeLength = width * 0.8
    var hingePinRadius = hingeRadius * 0.4
    var hingeGap = 0.3
    var hingeSegmentLength = hingeLength / 5

    // Create the main box shell (outer walls)
    function buildBoxBase() {
      var ob1 = M.Manifold.cube([length, width, totalHeight], false)
      var outerBox = ob1.translate(-length / 2, -width / 2, 0)
      ob1.delete()
      var ib1 = M.Manifold.cube([innerLength, innerWidth, height + 1], false)
      var innerBox = ib1.translate(-innerLength / 2, -innerWidth / 2, wallThickness)
      ib1.delete()
      var result = outerBox.subtract(innerBox)
      outerBox.delete()
      innerBox.delete()
      return result
    }

    // Build the bobbin grid compartments
    function buildBobbinGrid() {
      if (!includeBobbins) return null

      var dividerList = []
      var gridStartX = -innerLength / 2
      var gridEndX = hasSideCompartments ? gridStartX + bobbinSectionWidth : innerLength / 2
      var cellWidth = bobbinSectionWidth / bobbinColumns
      var cellDepth = innerWidth / bobbinRows

      // Vertical dividers (separating columns)
      for (var col = 1; col < bobbinColumns; col++) {
        var xPos = gridStartX + col * cellWidth
        var d1 = M.Manifold.cube([wallThickness, innerWidth, height], false)
        var divider = d1.translate(xPos - wallThickness / 2, -innerWidth / 2, wallThickness)
        d1.delete()
        dividerList.push(divider)
      }

      // Horizontal dividers (separating rows)
      for (var row = 1; row < bobbinRows; row++) {
        var yPos = -innerWidth / 2 + row * cellDepth
        var d1 = M.Manifold.cube([bobbinSectionWidth, wallThickness, height], false)
        var divider = d1.translate(gridStartX, yPos - wallThickness / 2, wallThickness)
        d1.delete()
        dividerList.push(divider)
      }

      if (dividerList.length === 0) return null
      var result = dividerList[0]
      for (var i = 1; i < dividerList.length; i++) {
        var temp = result.add(dividerList[i])
        result.delete()
        dividerList[i].delete()
        result = temp
      }
      return result
    }

    // Build the main vertical divider separating bobbin section from side compartments
    function buildMainDivider() {
      if (!hasSideCompartments || !includeBobbins) return null

      var dividerX = -innerLength / 2 + bobbinSectionWidth
      var d1 = M.Manifold.cube([wallThickness, innerWidth, height], false)
      var result = d1.translate(dividerX, -innerWidth / 2, wallThickness)
      d1.delete()
      return result
    }

    // Build side compartment dividers (scissors, accessories, needles)
    function buildSideCompartments() {
      if (!hasSideCompartments) return null

      var dividerList = []
      var sideStartX = includeBobbins ? (-innerLength / 2 + bobbinSectionWidth + wallThickness) : -innerLength / 2
      var actualSideWidth = includeBobbins ? sideColumnWidth : innerLength

      // Count enabled compartments to calculate heights
      var compartmentCount = 0
      if (includeScissors) compartmentCount++
      if (includeAccessories) compartmentCount++
      if (includeNeedles) compartmentCount++

      if (compartmentCount <= 1) return null // No dividers needed for single compartment

      // Calculate heights based on what's included
      // Scissors gets 50% if included, accessories 35%, needles 15%
      var scissorsHeight = includeScissors ? innerWidth * 0.5 : 0
      var accessoriesHeight = includeAccessories ? innerWidth * 0.35 : 0
      var needlesHeight = includeNeedles ? innerWidth * 0.15 : 0

      // Normalize heights to fill space
      var totalRatio = scissorsHeight + accessoriesHeight + needlesHeight
      if (totalRatio > 0) {
        scissorsHeight = (scissorsHeight / totalRatio) * innerWidth
        accessoriesHeight = (accessoriesHeight / totalRatio) * innerWidth
        needlesHeight = (needlesHeight / totalRatio) * innerWidth
      }

      // Build horizontal dividers between side compartments
      var currentY = -innerWidth / 2

      if (includeScissors && (includeAccessories || includeNeedles)) {
        currentY += scissorsHeight
        var d1 = M.Manifold.cube([actualSideWidth, wallThickness, height], false)
        var divider = d1.translate(sideStartX, currentY - wallThickness / 2, wallThickness)
        d1.delete()
        dividerList.push(divider)
      }

      if (includeAccessories && includeNeedles) {
        currentY += accessoriesHeight
        var d1 = M.Manifold.cube([actualSideWidth, wallThickness, height], false)
        var divider = d1.translate(sideStartX, currentY - wallThickness / 2, wallThickness)
        d1.delete()
        dividerList.push(divider)
      }

      if (dividerList.length === 0) return null
      var result = dividerList[0]
      for (var i = 1; i < dividerList.length; i++) {
        var temp = result.add(dividerList[i])
        result.delete()
        dividerList[i].delete()
        result = temp
      }
      return result
    }

    // Build needle slot ridges (small ridges to hold needles)
    function buildNeedleRidges() {
      if (!includeNeedles) return null

      var ridgeList = []
      var sideStartX = includeBobbins ? (-innerLength / 2 + bobbinSectionWidth + wallThickness) : -innerLength / 2
      var actualSideWidth = includeBobbins ? sideColumnWidth : innerLength

      // Calculate needle section position
      var compartmentCount = (includeScissors ? 1 : 0) + (includeAccessories ? 1 : 0) + (includeNeedles ? 1 : 0)
      var scissorsHeight = includeScissors ? innerWidth * 0.5 : 0
      var accessoriesHeight = includeAccessories ? innerWidth * 0.35 : 0
      var needlesHeight = includeNeedles ? innerWidth * 0.15 : 0
      var totalRatio = scissorsHeight + accessoriesHeight + needlesHeight
      if (totalRatio > 0) {
        scissorsHeight = (scissorsHeight / totalRatio) * innerWidth
        accessoriesHeight = (accessoriesHeight / totalRatio) * innerWidth
        needlesHeight = (needlesHeight / totalRatio) * innerWidth
      }

      var needleStartY = innerWidth / 2 - needlesHeight
      var ridgeHeight = height * 0.3
      var ridgeWidth = wallThickness
      var ridgeSpacing = 8 // 8mm between ridges
      var numRidges = Math.floor((actualSideWidth - wallThickness * 2) / ridgeSpacing)

      for (var i = 0; i < numRidges; i++) {
        var ridgeX = sideStartX + wallThickness + i * ridgeSpacing
        var r1 = M.Manifold.cube([ridgeWidth, needlesHeight - wallThickness, ridgeHeight], false)
        var ridge = r1.translate(ridgeX, needleStartY + wallThickness / 2, wallThickness)
        r1.delete()
        ridgeList.push(ridge)
      }

      if (ridgeList.length === 0) return null
      var result = ridgeList[0]
      for (var i = 1; i < ridgeList.length; i++) {
        var temp = result.add(ridgeList[i])
        result.delete()
        ridgeList[i].delete()
        result = temp
      }
      return result
    }

    // Build hinge knuckles on the box (back edge)
    function buildBoxHingeKnuckles() {
      var knuckleList = []
      var backEdgeY = width / 2
      var hingeZ = totalHeight - hingeRadius
      var startX = -hingeLength / 2

      for (var i = 0; i < 5; i += 2) {
        var segX = startX + i * hingeSegmentLength + hingeSegmentLength / 2
        var k1 = M.Manifold.cylinder(hingeSegmentLength - hingeGap, hingeRadius, hingeRadius, 0)
        var k2 = k1.rotate([0, 90, 0])
        k1.delete()
        var knuckle = k2.translate(segX, backEdgeY, hingeZ)
        k2.delete()
        knuckleList.push(knuckle)
      }
      if (knuckleList.length === 0) return null
      var result = knuckleList[0]
      for (var i = 1; i < knuckleList.length; i++) {
        var temp = result.add(knuckleList[i])
        result.delete()
        knuckleList[i].delete()
        result = temp
      }
      return result
    }

    // Build hinge knuckles on the lid (back edge)
    function buildLidHingeKnuckles() {
      var knuckleList = []
      var backEdgeY = width / 2
      var hingeZ = totalHeight - hingeRadius
      var startX = -hingeLength / 2

      for (var i = 1; i < 5; i += 2) {
        var segX = startX + i * hingeSegmentLength + hingeSegmentLength / 2
        var k1 = M.Manifold.cylinder(hingeSegmentLength - hingeGap, hingeRadius, hingeRadius, 0)
        var k2 = k1.rotate([0, 90, 0])
        k1.delete()
        var knuckle = k2.translate(segX, backEdgeY, hingeZ)
        k2.delete()
        knuckleList.push(knuckle)
      }
      if (knuckleList.length === 0) return null
      var result = knuckleList[0]
      for (var i = 1; i < knuckleList.length; i++) {
        var temp = result.add(knuckleList[i])
        result.delete()
        knuckleList[i].delete()
        result = temp
      }
      return result
    }

    // Build the hinge pin hole through all knuckles
    function buildHingePinHole() {
      var h1 = M.Manifold.cylinder(hingeLength + wallThickness * 4, hingePinRadius, hingePinRadius, 0)
      var h2 = h1.rotate([0, 90, 0])
      h1.delete()
      var result = h2.translate(0, width / 2, totalHeight - hingeRadius)
      h2.delete()
      return result
    }

    // Build the lid with cross stitch pattern
    function buildLid() {
      var backEdgeY = width / 2

      var lp1 = M.Manifold.cube([length - wallThickness * 2, width - wallThickness, lidThickness], true)
      var lidPlate = lp1.translate(0, -width / 2 + (width - wallThickness) / 2, totalHeight + lidThickness / 2)
      lp1.delete()

      // Cross stitch pattern embossing
      var patternDepth = lidThickness * 0.3
      var gridSize = 8
      var patternSpacing = gridSize * 2
      var patternLength = length - wallThickness * 6
      var patternWidth = width - wallThickness * 6
      var numPatternX = Math.floor(patternLength / patternSpacing)
      var numPatternY = Math.floor(patternWidth / patternSpacing)

      function createStitch(size) {
        var strokeWidth = size * 0.15
        var d1 = M.Manifold.cube([size * 1.4, strokeWidth, patternDepth + 0.5], true)
        var diag1 = d1.rotate([0, 0, 45])
        d1.delete()
        var d2 = M.Manifold.cube([size * 1.4, strokeWidth, patternDepth + 0.5], true)
        var diag2 = d2.rotate([0, 0, -45])
        d2.delete()
        var result = diag1.add(diag2)
        diag1.delete()
        diag2.delete()
        return result
      }

      var stitchList = []
      var patternStartX = -(numPatternX - 1) * patternSpacing / 2
      var patternStartY = -width / 2 + (width - wallThickness) / 2 - (numPatternY - 1) * patternSpacing / 2 + patternSpacing

      for (var px = 0; px < numPatternX; px++) {
        for (var py = 0; py < numPatternY; py++) {
          var st1 = createStitch(gridSize)
          var stitch = st1.translate(
            patternStartX + px * patternSpacing,
            patternStartY + py * patternSpacing,
            totalHeight + lidThickness - patternDepth / 2
          )
          st1.delete()
          stitchList.push(stitch)
        }
      }

      if (stitchList.length > 0) {
        var stitchCuts = stitchList[0]
        for (var i = 1; i < stitchList.length; i++) {
          var temp = stitchCuts.add(stitchList[i])
          stitchCuts.delete()
          stitchList[i].delete()
          stitchCuts = temp
        }
        var lidPlate2 = lidPlate.subtract(stitchCuts)
        lidPlate.delete()
        stitchCuts.delete()
        lidPlate = lidPlate2
      }

      var lidKnuckles = buildLidHingeKnuckles()
      if (lidKnuckles !== null) {
        var stripWidth = hingeRadius * 2
        var stripHeight = lidThickness
        var s1 = M.Manifold.cube([hingeLength + hingeSegmentLength, stripWidth, stripHeight], true)
        var strip = s1.translate(0, backEdgeY - stripWidth / 2, totalHeight + stripHeight / 2)
        s1.delete()
        var lp3 = lidPlate.add(strip)
        lidPlate.delete()
        strip.delete()
        var lp4 = lp3.add(lidKnuckles)
        lp3.delete()
        lidKnuckles.delete()
        lidPlate = lp4
      }

      return lidPlate
    }

    // Build finger recess at front of lid
    function buildFingerRecess() {
      var recessRadius = wallThickness * 3
      var recessLength = length * 0.3
      var r1 = M.Manifold.cylinder(recessLength, recessRadius, recessRadius, 0)
      var r2 = r1.rotate([0, 90, 0])
      r1.delete()
      var result = r2.translate(0, -width / 2 + wallThickness, totalHeight + lidThickness / 2)
      r2.delete()
      return result
    }

    // Assemble the organizer
    var organizer = buildBoxBase()

    // Add bobbin grid
    var bobbinGrid = buildBobbinGrid()
    if (bobbinGrid !== null) {
      var org2 = organizer.add(bobbinGrid)
      organizer.delete()
      bobbinGrid.delete()
      organizer = org2
    }

    // Add main divider between bobbin section and side compartments
    var mainDivider = buildMainDivider()
    if (mainDivider !== null) {
      var org3 = organizer.add(mainDivider)
      organizer.delete()
      mainDivider.delete()
      organizer = org3
    }

    // Add side compartment dividers
    var sideCompartments = buildSideCompartments()
    if (sideCompartments !== null) {
      var org4 = organizer.add(sideCompartments)
      organizer.delete()
      sideCompartments.delete()
      organizer = org4
    }

    // Add needle ridges
    var needleRidges = buildNeedleRidges()
    if (needleRidges !== null) {
      var org5 = organizer.add(needleRidges)
      organizer.delete()
      needleRidges.delete()
      organizer = org5
    }

    if (showLid) {
      var boxKnuckles = buildBoxHingeKnuckles()
      if (boxKnuckles !== null) {
        var org6 = organizer.add(boxKnuckles)
        organizer.delete()
        boxKnuckles.delete()
        organizer = org6
      }

      var lid = buildLid()
      var org7 = organizer.add(lid)
      organizer.delete()
      lid.delete()
      organizer = org7

      var pinHole = buildHingePinHole()
      var org8 = organizer.subtract(pinHole)
      organizer.delete()
      pinHole.delete()
      organizer = org8

      var fingerRecess = buildFingerRecess()
      var org9 = organizer.subtract(fingerRecess)
      organizer.delete()
      fingerRecess.delete()

      return org9
    }

    return organizer
  `,
  displayDimensions: [
    { label: 'Length', param: 'length', format: '{value}mm' },
    { label: 'Width', param: 'width', format: '{value}mm' },
    { label: 'Height', param: 'height', format: '{value}mm' },
    { label: 'Bobbins', param: 'bobbinRows', format: '{value} rows' }
  ]
}

export default generator
