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
    var MIN_WALL_THICKNESS = ctx.constants.MIN_WALL_THICKNESS

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
      var outerBox = box(length, width, totalHeight, false)
        .translate(-length / 2, -width / 2, 0)
      var innerBox = box(innerLength, innerWidth, height + 1, false)
        .translate(-innerLength / 2, -innerWidth / 2, wallThickness)
      return outerBox.subtract(innerBox)
    }

    // Build the bobbin grid compartments
    function buildBobbinGrid() {
      if (!includeBobbins) return null

      var dividers = null
      var gridStartX = -innerLength / 2
      var gridEndX = hasSideCompartments ? gridStartX + bobbinSectionWidth : innerLength / 2
      var cellWidth = bobbinSectionWidth / bobbinColumns
      var cellDepth = innerWidth / bobbinRows

      // Vertical dividers (separating columns)
      for (var col = 1; col < bobbinColumns; col++) {
        var xPos = gridStartX + col * cellWidth
        var divider = box(wallThickness, innerWidth, height, false)
          .translate(xPos - wallThickness / 2, -innerWidth / 2, wallThickness)
        if (dividers === null) {
          dividers = divider
        } else {
          dividers = dividers.add(divider)
        }
      }

      // Horizontal dividers (separating rows)
      for (var row = 1; row < bobbinRows; row++) {
        var yPos = -innerWidth / 2 + row * cellDepth
        var divider = box(bobbinSectionWidth, wallThickness, height, false)
          .translate(gridStartX, yPos - wallThickness / 2, wallThickness)
        if (dividers === null) {
          dividers = divider
        } else {
          dividers = dividers.add(divider)
        }
      }

      return dividers
    }

    // Build the main vertical divider separating bobbin section from side compartments
    function buildMainDivider() {
      if (!hasSideCompartments || !includeBobbins) return null

      var dividerX = -innerLength / 2 + bobbinSectionWidth
      return box(wallThickness, innerWidth, height, false)
        .translate(dividerX, -innerWidth / 2, wallThickness)
    }

    // Build side compartment dividers (scissors, accessories, needles)
    function buildSideCompartments() {
      if (!hasSideCompartments) return null

      var dividers = null
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
        var divider = box(actualSideWidth, wallThickness, height, false)
          .translate(sideStartX, currentY - wallThickness / 2, wallThickness)
        if (dividers === null) {
          dividers = divider
        } else {
          dividers = dividers.add(divider)
        }
      }

      if (includeAccessories && includeNeedles) {
        currentY += accessoriesHeight
        var divider = box(actualSideWidth, wallThickness, height, false)
          .translate(sideStartX, currentY - wallThickness / 2, wallThickness)
        if (dividers === null) {
          dividers = divider
        } else {
          dividers = dividers.add(divider)
        }
      }

      return dividers
    }

    // Build needle slot ridges (small ridges to hold needles)
    function buildNeedleRidges() {
      if (!includeNeedles) return null

      var ridges = null
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
        var ridge = box(ridgeWidth, needlesHeight - wallThickness, ridgeHeight, false)
          .translate(ridgeX, needleStartY + wallThickness / 2, wallThickness)
        if (ridges === null) {
          ridges = ridge
        } else {
          ridges = ridges.add(ridge)
        }
      }

      return ridges
    }

    // Build hinge knuckles on the box (back edge)
    function buildBoxHingeKnuckles() {
      var knuckles = null
      var backEdgeY = width / 2
      var hingeZ = totalHeight - hingeRadius
      var startX = -hingeLength / 2

      for (var i = 0; i < 5; i += 2) {
        var segX = startX + i * hingeSegmentLength + hingeSegmentLength / 2
        var knuckle = cylinder(hingeSegmentLength - hingeGap, hingeRadius)
          .rotate(0, 90, 0)
          .translate(segX, backEdgeY, hingeZ)
        if (knuckles === null) {
          knuckles = knuckle
        } else {
          knuckles = knuckles.add(knuckle)
        }
      }
      return knuckles
    }

    // Build hinge knuckles on the lid (back edge)
    function buildLidHingeKnuckles() {
      var knuckles = null
      var backEdgeY = width / 2
      var hingeZ = totalHeight - hingeRadius
      var startX = -hingeLength / 2

      for (var i = 1; i < 5; i += 2) {
        var segX = startX + i * hingeSegmentLength + hingeSegmentLength / 2
        var knuckle = cylinder(hingeSegmentLength - hingeGap, hingeRadius)
          .rotate(0, 90, 0)
          .translate(segX, backEdgeY, hingeZ)
        if (knuckles === null) {
          knuckles = knuckle
        } else {
          knuckles = knuckles.add(knuckle)
        }
      }
      return knuckles
    }

    // Build the hinge pin hole through all knuckles
    function buildHingePinHole() {
      return cylinder(hingeLength + wallThickness * 4, hingePinRadius)
        .rotate(0, 90, 0)
        .translate(0, width / 2, totalHeight - hingeRadius)
    }

    // Build the lid with cross stitch pattern
    function buildLid() {
      var backEdgeY = width / 2

      var lidPlate = box(length - wallThickness * 2, width - wallThickness, lidThickness)
        .translate(0, -width / 2 + (width - wallThickness) / 2, totalHeight + lidThickness / 2)

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
        var diag1 = box(size * 1.4, strokeWidth, patternDepth + 0.5).rotate(0, 0, 45)
        var diag2 = box(size * 1.4, strokeWidth, patternDepth + 0.5).rotate(0, 0, -45)
        return diag1.add(diag2)
      }

      var stitchCuts = null
      var patternStartX = -(numPatternX - 1) * patternSpacing / 2
      var patternStartY = -width / 2 + (width - wallThickness) / 2 - (numPatternY - 1) * patternSpacing / 2 + patternSpacing

      for (var px = 0; px < numPatternX; px++) {
        for (var py = 0; py < numPatternY; py++) {
          var stitch = createStitch(gridSize)
            .translate(
              patternStartX + px * patternSpacing,
              patternStartY + py * patternSpacing,
              totalHeight + lidThickness - patternDepth / 2
            )
          if (stitchCuts === null) {
            stitchCuts = stitch
          } else {
            stitchCuts = stitchCuts.add(stitch)
          }
        }
      }

      if (stitchCuts !== null) {
        lidPlate = lidPlate.subtract(stitchCuts)
      }

      var lidKnuckles = buildLidHingeKnuckles()
      if (lidKnuckles !== null) {
        var stripWidth = hingeRadius * 2
        var stripHeight = lidThickness
        var strip = box(hingeLength + hingeSegmentLength, stripWidth, stripHeight)
          .translate(0, backEdgeY - stripWidth / 2, totalHeight + stripHeight / 2)
        lidPlate = lidPlate.add(strip).add(lidKnuckles)
      }

      return lidPlate
    }

    // Build finger recess at front of lid
    function buildFingerRecess() {
      var recessRadius = wallThickness * 3
      var recessLength = length * 0.3
      return cylinder(recessLength, recessRadius)
        .rotate(0, 90, 0)
        .translate(0, -width / 2 + wallThickness, totalHeight + lidThickness / 2)
    }

    // Assemble the organizer
    var organizer = buildBoxBase()

    // Add bobbin grid
    var bobbinGrid = buildBobbinGrid()
    if (bobbinGrid !== null) {
      organizer = organizer.add(bobbinGrid)
    }

    // Add main divider between bobbin section and side compartments
    var mainDivider = buildMainDivider()
    if (mainDivider !== null) {
      organizer = organizer.add(mainDivider)
    }

    // Add side compartment dividers
    var sideCompartments = buildSideCompartments()
    if (sideCompartments !== null) {
      organizer = organizer.add(sideCompartments)
    }

    // Add needle ridges
    var needleRidges = buildNeedleRidges()
    if (needleRidges !== null) {
      organizer = organizer.add(needleRidges)
    }

    if (showLid) {
      var boxKnuckles = buildBoxHingeKnuckles()
      if (boxKnuckles !== null) {
        organizer = organizer.add(boxKnuckles)
      }

      var lid = buildLid()
      organizer = organizer.add(lid)

      var pinHole = buildHingePinHole()
      organizer = organizer.subtract(pinHole)

      var fingerRecess = buildFingerRecess()
      organizer = organizer.subtract(fingerRecess)

      return organizer.build({ skipConnectivityCheck: true })
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
