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
      // geo.shape.box is centered, so we translate Z up by half height to sit on Z=0
      var outerBox = geo.shape.box({ width: length, depth: width, height: totalHeight })
        .translate(0, 0, totalHeight / 2)
      var innerBox = geo.shape.box({ width: innerLength, depth: innerWidth, height: height + 1 })
        .translate(0, 0, wallThickness + (height + 1) / 2)
      return outerBox.subtract(innerBox)
    }

    // Build the bobbin grid compartments
    function buildBobbinGrid() {
      if (!includeBobbins) return null

      var dividers = []
      var gridStartX = -innerLength / 2
      var cellWidth = bobbinSectionWidth / bobbinColumns
      var cellDepth = innerWidth / bobbinRows

      // Vertical dividers (separating columns)
      for (var col = 1; col < bobbinColumns; col++) {
        var xPos = gridStartX + col * cellWidth
        var divider = geo.shape.box({ width: wallThickness, depth: innerWidth, height: height })
          .translate(xPos, 0, wallThickness + height / 2)
        dividers.push(divider)
      }

      // Horizontal dividers (separating rows)
      for (var row = 1; row < bobbinRows; row++) {
        var yPos = -innerWidth / 2 + row * cellDepth
        var divider = geo.shape.box({ width: bobbinSectionWidth, depth: wallThickness, height: height })
          .translate(gridStartX + bobbinSectionWidth / 2, yPos, wallThickness + height / 2)
        dividers.push(divider)
      }

      if (dividers.length === 0) return null

      var result = dividers[0]
      for (var i = 1; i < dividers.length; i++) {
        result = result.union(dividers[i])
      }
      return result
    }

    // Build the main vertical divider separating bobbin section from side compartments
    function buildMainDivider() {
      if (!hasSideCompartments || !includeBobbins) return null

      var dividerX = -innerLength / 2 + bobbinSectionWidth + wallThickness / 2
      return geo.shape.box({ width: wallThickness, depth: innerWidth, height: height })
        .translate(dividerX, 0, wallThickness + height / 2)
    }

    // Build side compartment dividers (scissors, accessories, needles)
    function buildSideCompartments() {
      if (!hasSideCompartments) return null

      var dividers = []
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
        var divider = geo.shape.box({ width: actualSideWidth, depth: wallThickness, height: height })
          .translate(sideStartX + actualSideWidth / 2, currentY, wallThickness + height / 2)
        dividers.push(divider)
      }

      if (includeAccessories && includeNeedles) {
        currentY += accessoriesHeight
        var divider = geo.shape.box({ width: actualSideWidth, depth: wallThickness, height: height })
          .translate(sideStartX + actualSideWidth / 2, currentY, wallThickness + height / 2)
        dividers.push(divider)
      }

      if (dividers.length === 0) return null

      var result = dividers[0]
      for (var i = 1; i < dividers.length; i++) {
        result = result.union(dividers[i])
      }
      return result
    }

    // Build needle slot ridges (small ridges to hold needles)
    function buildNeedleRidges() {
      if (!includeNeedles) return null

      var ridges = []
      var sideStartX = includeBobbins ? (-innerLength / 2 + bobbinSectionWidth + wallThickness) : -innerLength / 2
      var actualSideWidth = includeBobbins ? sideColumnWidth : innerLength

      // Calculate needle section position
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
        var ridgeX = sideStartX + wallThickness + i * ridgeSpacing + ridgeWidth / 2
        var ridge = geo.shape.box({ width: ridgeWidth, depth: needlesHeight - wallThickness, height: ridgeHeight })
          .translate(ridgeX, needleStartY + (needlesHeight - wallThickness) / 2 + wallThickness / 2, wallThickness + ridgeHeight / 2)
        ridges.push(ridge)
      }

      if (ridges.length === 0) return null

      var result = ridges[0]
      for (var i = 1; i < ridges.length; i++) {
        result = result.union(ridges[i])
      }
      return result
    }

    // Build hinge knuckles on the box (back edge)
    function buildBoxHingeKnuckles() {
      var knuckles = []
      var backEdgeY = width / 2
      var hingeZ = totalHeight - hingeRadius
      var startX = -hingeLength / 2

      for (var i = 0; i < 5; i += 2) {
        var segX = startX + i * hingeSegmentLength + hingeSegmentLength / 2
        var knuckle = geo.shape.cylinder({ diameter: hingeRadius * 2, height: hingeSegmentLength - hingeGap })
          .rotate(0, 90, 0)
          .translate(segX, backEdgeY, hingeZ)
        knuckles.push(knuckle)
      }

      if (knuckles.length === 0) return null

      var result = knuckles[0]
      for (var i = 1; i < knuckles.length; i++) {
        result = result.union(knuckles[i])
      }
      return result
    }

    // Build hinge knuckles on the lid (back edge)
    function buildLidHingeKnuckles() {
      var knuckles = []
      var backEdgeY = width / 2
      var hingeZ = totalHeight - hingeRadius
      var startX = -hingeLength / 2

      for (var i = 1; i < 5; i += 2) {
        var segX = startX + i * hingeSegmentLength + hingeSegmentLength / 2
        var knuckle = geo.shape.cylinder({ diameter: hingeRadius * 2, height: hingeSegmentLength - hingeGap })
          .rotate(0, 90, 0)
          .translate(segX, backEdgeY, hingeZ)
        knuckles.push(knuckle)
      }

      if (knuckles.length === 0) return null

      var result = knuckles[0]
      for (var i = 1; i < knuckles.length; i++) {
        result = result.union(knuckles[i])
      }
      return result
    }

    // Build the hinge pin hole through all knuckles
    function buildHingePinHole() {
      return geo.shape.cylinder({ diameter: hingePinRadius * 2, height: hingeLength + wallThickness * 4 })
        .rotate(0, 90, 0)
        .translate(0, width / 2, totalHeight - hingeRadius)
    }

    // Build the lid with cross stitch pattern
    function buildLid() {
      var backEdgeY = width / 2

      var lidPlate = geo.shape.box({ width: length - wallThickness * 2, depth: width - wallThickness, height: lidThickness })
        .translate(0, -wallThickness / 2, totalHeight + lidThickness / 2)

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
        var diag1 = geo.shape.box({ width: size * 1.4, depth: strokeWidth, height: patternDepth + 0.5 })
          .rotate(0, 0, 45)
        var diag2 = geo.shape.box({ width: size * 1.4, depth: strokeWidth, height: patternDepth + 0.5 })
          .rotate(0, 0, -45)
        return diag1.union(diag2)
      }

      var stitches = []
      var patternStartX = -(numPatternX - 1) * patternSpacing / 2
      var patternStartY = -wallThickness / 2 - (numPatternY - 1) * patternSpacing / 2 + patternSpacing

      for (var px = 0; px < numPatternX; px++) {
        for (var py = 0; py < numPatternY; py++) {
          var stitch = createStitch(gridSize)
            .translate(
              patternStartX + px * patternSpacing,
              patternStartY + py * patternSpacing,
              totalHeight + lidThickness - patternDepth / 2
            )
          stitches.push(stitch)
        }
      }

      if (stitches.length > 0) {
        var stitchCuts = stitches[0]
        for (var i = 1; i < stitches.length; i++) {
          stitchCuts = stitchCuts.union(stitches[i])
        }
        lidPlate = lidPlate.subtract(stitchCuts)
      }

      var lidKnuckles = buildLidHingeKnuckles()
      if (lidKnuckles !== null) {
        var stripWidth = hingeRadius * 2
        var stripHeight = lidThickness
        var strip = geo.shape.box({ width: hingeLength + hingeSegmentLength, depth: stripWidth, height: stripHeight })
          .translate(0, backEdgeY - stripWidth / 2, totalHeight + stripHeight / 2)
        lidPlate = lidPlate.union(strip).union(lidKnuckles)
      }

      return lidPlate
    }

    // Build finger recess at front of lid
    function buildFingerRecess() {
      var recessRadius = wallThickness * 3
      var recessLength = length * 0.3
      return geo.shape.cylinder({ diameter: recessRadius * 2, height: recessLength })
        .rotate(0, 90, 0)
        .translate(0, -width / 2 + wallThickness, totalHeight + lidThickness / 2)
    }

    // Assemble the organizer
    var organizer = buildBoxBase()

    // Add bobbin grid
    var bobbinGrid = buildBobbinGrid()
    if (bobbinGrid !== null) {
      organizer = organizer.union(bobbinGrid)
    }

    // Add main divider between bobbin section and side compartments
    var mainDivider = buildMainDivider()
    if (mainDivider !== null) {
      organizer = organizer.union(mainDivider)
    }

    // Add side compartment dividers
    var sideCompartments = buildSideCompartments()
    if (sideCompartments !== null) {
      organizer = organizer.union(sideCompartments)
    }

    // Add needle ridges
    var needleRidges = buildNeedleRidges()
    if (needleRidges !== null) {
      organizer = organizer.union(needleRidges)
    }

    if (showLid) {
      var boxKnuckles = buildBoxHingeKnuckles()
      if (boxKnuckles !== null) {
        organizer = organizer.union(boxKnuckles)
      }

      var lid = buildLid()
      organizer = organizer.union(lid)

      var pinHole = buildHingePinHole()
      organizer = organizer.subtract(pinHole)

      var fingerRecess = buildFingerRecess()
      organizer = organizer.subtract(fingerRecess)
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
