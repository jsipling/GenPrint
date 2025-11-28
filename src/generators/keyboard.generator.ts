import type { Generator } from './types'

const generator: Generator = {
  id: 'keyboard',
  name: 'Mechanical Keyboard',
  description: 'Full-size mechanical keyboard display model with sculpted keycap profiles. Features toggleable sections: numpad, function row, and navigation cluster. High-profile case design with realistic key spacing.',
  parameters: [
    {
      type: 'number',
      name: 'keycapSize',
      label: 'Keycap Size (1U)',
      min: 16,
      max: 20,
      default: 18,
      step: 0.5,
      unit: 'mm',
      description: 'Standard 1U keycap width/depth'
    },
    {
      type: 'number',
      name: 'keycapHeight',
      label: 'Keycap Height',
      min: 8,
      max: 14,
      default: 10,
      step: 0.5,
      unit: 'mm',
      description: 'Height of keycaps above the plate'
    },
    {
      type: 'number',
      name: 'caseHeight',
      label: 'Case Height',
      min: 15,
      max: 30,
      default: 22,
      step: 1,
      unit: 'mm',
      description: 'Total height of the keyboard case'
    },
    {
      type: 'number',
      name: 'wallThickness',
      label: 'Wall Thickness',
      min: 2,
      max: 5,
      default: 3,
      step: 0.5,
      unit: 'mm',
      description: 'Thickness of case walls'
    },
    {
      type: 'boolean',
      name: 'includeNumpad',
      label: 'Include Numpad',
      default: true,
      description: 'Include the numeric keypad section (17 keys)'
    },
    {
      type: 'boolean',
      name: 'includeFunctionRow',
      label: 'Include Function Row',
      default: true,
      description: 'Include F1-F12 keys and top row'
    },
    {
      type: 'boolean',
      name: 'includeNavCluster',
      label: 'Include Nav Cluster',
      default: true,
      description: 'Include navigation keys (arrows, insert, delete, etc.)'
    }
  ],
  builderCode: `
    var MIN_WALL_THICKNESS = ctx.constants.MIN_WALL_THICKNESS

    // Parameters with fallback defaults
    var keycapSize = Number(params['keycapSize']) || 18
    var keycapHeight = Number(params['keycapHeight']) || 10
    var caseHeight = Math.max(Number(params['caseHeight']) || 22, keycapHeight + 8)
    var wallThickness = Math.max(Number(params['wallThickness']) || 3, MIN_WALL_THICKNESS)

    // Section toggles
    var includeNumpad = params['includeNumpad'] !== false
    var includeFunctionRow = params['includeFunctionRow'] !== false
    var includeNavCluster = params['includeNavCluster'] !== false

    // Keyboard layout constants
    var KEY_GAP = 1  // Gap between keys
    var KEY_PITCH = keycapSize + KEY_GAP  // Center-to-center distance
    var SECTION_GAP = keycapSize * 0.5  // Gap between keyboard sections

    // Row definitions (sculpted profile angles in degrees)
    var ROW_ANGLES = [12, 8, 4, 0, -4, -8]  // F-row to space row
    var ROW_HEIGHTS = [1.0, 0.9, 0.8, 0.7, 0.65, 0.6]  // Height multipliers

    // Key widths in units (1U = keycapSize)
    var MAIN_ROWS = [
      // Row 0: Number row (13 keys + backspace)
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
      // Row 1: QWERTY row (Tab + 12 keys + backslash)
      [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
      // Row 2: Home row (Caps + 11 keys + Enter)
      [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
      // Row 3: Shift row (LShift + 10 keys + RShift)
      [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
      // Row 4: Bottom row (Ctrl, Win, Alt, Space, Alt, Win, Menu, Ctrl)
      [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25]
    ]

    // Function row (F1-F12 with gaps)
    var FUNCTION_ROW = [
      { width: 1, keys: 1 },        // Esc
      { gap: 1 },                    // Gap
      { width: 1, keys: 4 },        // F1-F4
      { gap: 0.5 },                  // Gap
      { width: 1, keys: 4 },        // F5-F8
      { gap: 0.5 },                  // Gap
      { width: 1, keys: 4 }         // F9-F12
    ]

    // Calculate section widths
    function calculateMainWidth() {
      var maxWidth = 0
      for (var i = 0; i < MAIN_ROWS.length; i++) {
        var rowWidth = 0
        for (var j = 0; j < MAIN_ROWS[i].length; j++) {
          rowWidth += MAIN_ROWS[i][j]
        }
        if (rowWidth > maxWidth) maxWidth = rowWidth
      }
      return maxWidth * KEY_PITCH
    }

    var mainWidth = calculateMainWidth()
    var navWidth = 3 * KEY_PITCH
    var numpadWidth = 4 * KEY_PITCH

    // Total keyboard dimensions
    var totalWidth = mainWidth
    if (includeNavCluster) totalWidth += SECTION_GAP + navWidth
    if (includeNumpad) totalWidth += SECTION_GAP + numpadWidth

    var mainRows = includeFunctionRow ? 6 : 5
    var totalDepth = mainRows * KEY_PITCH + wallThickness * 2

    // Case dimensions
    var caseWidth = totalWidth + wallThickness * 2
    var caseDepth = totalDepth + wallThickness * 2

    // Plate height (top surface of the case where keycaps sit)
    var plateZ = caseHeight

    // Stem penetration ensures keycaps always connect to case regardless of rotation
    // Must be deep enough to account for rotation angles up to 12 degrees
    var STEM_PENETRATION = 5  // mm into case

    // Build a single keycap - includes stem that penetrates into case for connectivity
    function buildKeycap(widthUnits, rowIndex) {
      var width = widthUnits * keycapSize + (widthUnits - 1) * KEY_GAP
      var depth = keycapSize
      var height = keycapHeight * (ROW_HEIGHTS[rowIndex] || 0.7)
      var angle = ROW_ANGLES[rowIndex] || 0

      // Top surface is slightly smaller than base
      var topInset = 1.5
      var topWidth = width - topInset * 2
      var topDepth = depth - topInset * 2
      var topHeight = height * 0.7

      // Base of keycap - starts at Z=0, extends up
      var baseHeight = height * 0.3
      var base = box(width, depth, baseHeight)
        .translate(0, 0, baseHeight / 2)

      // Top dish (sculpted) - sits on top of base
      // Overlap 0.5mm into base to ensure volumetric connection (not just surface contact)
      var topOverlap = 0.5
      var top = box(topWidth, topDepth, topHeight + topOverlap)
        .translate(0, 0, baseHeight - topOverlap + (topHeight + topOverlap) / 2)

      // Add stem that extends below Z=0 into the case for guaranteed connectivity
      // Stem overlaps 0.5mm into the base to ensure volumetric connection (not just surface contact)
      var stemOverlap = 0.5
      var stemSize = Math.min(width, depth) * 0.4
      var stem = box(stemSize, stemSize, STEM_PENETRATION + stemOverlap)
        .translate(0, 0, (-STEM_PENETRATION + stemOverlap) / 2)

      // Union all parts - they're positioned with proper overlaps
      var keycap = group([base, top, stem]).unionAll()

      // Apply row angle (tilt front/back)
      if (angle !== 0) {
        keycap = keycap.rotate(angle, 0, 0)
      }

      return keycap
    }

    // Build a tall keycap (2U height) - includes stem for connectivity
    function buildTallKeycap(widthUnits, heightUnits, rowIndex) {
      var width = widthUnits * keycapSize + (widthUnits - 1) * KEY_GAP
      var depth = heightUnits * keycapSize + (heightUnits - 1) * KEY_GAP
      var height = keycapHeight * (ROW_HEIGHTS[rowIndex] || 0.7)

      // Base of keycap
      var baseHeight = height * 0.4
      var base = box(width, depth, baseHeight)
        .translate(0, 0, baseHeight / 2)

      // Top part - overlaps 0.5mm into base for volumetric connection
      var topInset = 1.5
      var topOverlap = 0.5
      var topHeight = height * 0.6
      var top = box(width - topInset * 2, depth - topInset * 2, topHeight + topOverlap)
        .translate(0, 0, baseHeight - topOverlap + (topHeight + topOverlap) / 2)

      // Add stem that extends below Z=0 into the case for guaranteed connectivity
      // Stem overlaps 0.5mm into the base to ensure volumetric connection (not just surface contact)
      var stemOverlap = 0.5
      var stemSize = Math.min(width, depth) * 0.4
      var stem = box(stemSize, stemSize, STEM_PENETRATION + stemOverlap)
        .translate(0, 0, (-STEM_PENETRATION + stemOverlap) / 2)

      // Union all parts - they're positioned with proper overlaps
      var keycap = group([base, top, stem]).unionAll()

      return keycap
    }

    // Build a row of keycaps
    function buildKeyRow(keyWidths, rowIndex, startX, startY) {
      var keys = []
      var xPos = startX

      for (var i = 0; i < keyWidths.length; i++) {
        var keyWidth = keyWidths[i]
        var keyCenter = xPos + (keyWidth * keycapSize + (keyWidth - 1) * KEY_GAP) / 2

        var keycap = buildKeycap(keyWidth, rowIndex)
          .translate(keyCenter, startY, plateZ)

        keys.push(keycap)
        xPos += keyWidth * KEY_PITCH
      }

      return keys
    }

    // Build function row with gaps
    function buildFunctionRow(startX, startY) {
      var keys = []
      var xPos = startX

      for (var i = 0; i < FUNCTION_ROW.length; i++) {
        var section = FUNCTION_ROW[i]

        if (section.gap) {
          xPos += section.gap * KEY_PITCH
        } else {
          for (var j = 0; j < section.keys; j++) {
            var keycap = buildKeycap(section.width, 0)
              .translate(xPos + keycapSize / 2, startY, plateZ)
            keys.push(keycap)
            xPos += KEY_PITCH
          }
        }
      }

      return keys
    }

    // Build navigation cluster
    function buildNavCluster(startX, startY) {
      var keys = []
      var rowOffset = includeFunctionRow ? 1 : 0

      // Top 2x3 block (Ins, Home, PgUp / Del, End, PgDn)
      for (var row = 0; row < 2; row++) {
        for (var col = 0; col < 3; col++) {
          var keycap = buildKeycap(1, row + rowOffset)
            .translate(
              startX + col * KEY_PITCH + keycapSize / 2,
              startY - row * KEY_PITCH,
              plateZ
            )
          keys.push(keycap)
        }
      }

      // Gap then arrow keys
      var arrowStartY = startY - 3 * KEY_PITCH

      // Up arrow
      var upKey = buildKeycap(1, 4)
        .translate(
          startX + KEY_PITCH + keycapSize / 2,
          arrowStartY,
          plateZ
        )
      keys.push(upKey)

      // Left, Down, Right arrows
      for (var i = 0; i < 3; i++) {
        var arrowKey = buildKeycap(1, 5)
          .translate(
            startX + i * KEY_PITCH + keycapSize / 2,
            arrowStartY - KEY_PITCH,
            plateZ
          )
        keys.push(arrowKey)
      }

      return keys
    }

    // Build numpad
    function buildNumpad(startX, startY) {
      var keys = []
      var rowOffset = includeFunctionRow ? 1 : 0

      // Row 0: NumLock, /, *, -
      var row0Widths = [1, 1, 1, 1]
      var row0Keys = buildKeyRow(row0Widths, 0 + rowOffset, startX, startY)
      for (var i = 0; i < row0Keys.length; i++) keys.push(row0Keys[i])

      // Row 1: 7, 8, 9
      for (var col = 0; col < 3; col++) {
        var key = buildKeycap(1, 1 + rowOffset)
          .translate(
            startX + col * KEY_PITCH + keycapSize / 2,
            startY - KEY_PITCH,
            plateZ
          )
        keys.push(key)
      }

      // + key (2U tall, spans rows 1-2)
      var plusKey = buildTallKeycap(1, 2, 1 + rowOffset)
        .translate(
          startX + 3 * KEY_PITCH + keycapSize / 2,
          startY - KEY_PITCH - keycapSize / 2 - KEY_GAP / 2,
          plateZ
        )
      keys.push(plusKey)

      // Row 2: 4, 5, 6
      for (var col = 0; col < 3; col++) {
        var key = buildKeycap(1, 2 + rowOffset)
          .translate(
            startX + col * KEY_PITCH + keycapSize / 2,
            startY - 2 * KEY_PITCH,
            plateZ
          )
        keys.push(key)
      }

      // Row 3: 1, 2, 3
      for (var col = 0; col < 3; col++) {
        var key = buildKeycap(1, 3 + rowOffset)
          .translate(
            startX + col * KEY_PITCH + keycapSize / 2,
            startY - 3 * KEY_PITCH,
            plateZ
          )
        keys.push(key)
      }

      // Enter key (2U tall, spans rows 3-4)
      var enterKey = buildTallKeycap(1, 2, 3 + rowOffset)
        .translate(
          startX + 3 * KEY_PITCH + keycapSize / 2,
          startY - 3 * KEY_PITCH - keycapSize / 2 - KEY_GAP / 2,
          plateZ
        )
      keys.push(enterKey)

      // Row 4: 0 (2U wide), .
      var zeroKey = buildKeycap(2, 4 + rowOffset)
        .translate(
          startX + keycapSize + KEY_GAP / 2,
          startY - 4 * KEY_PITCH,
          plateZ
        )
      keys.push(zeroKey)

      var dotKey = buildKeycap(1, 4 + rowOffset)
        .translate(
          startX + 2 * KEY_PITCH + keycapSize / 2,
          startY - 4 * KEY_PITCH,
          plateZ
        )
      keys.push(dotKey)

      return keys
    }

    // Build the case - solid body
    function buildCase() {
      // Solid case body (no hollowing - this is a display model)
      var outerCase = roundedBox(caseWidth, caseDepth, caseHeight, 3)
        .translate(0, 0, caseHeight / 2)

      return outerCase
    }

    // Assemble all keycaps
    function buildAllKeycaps() {
      var allKeys = []

      // Starting positions - keycaps are centered on their positions
      var mainStartX = -totalWidth / 2 + keycapSize / 2
      var mainStartY = totalDepth / 2 - wallThickness - keycapSize / 2

      var currentY = mainStartY

      // Function row (if enabled)
      if (includeFunctionRow) {
        var funcKeys = buildFunctionRow(mainStartX - keycapSize / 2, currentY)
        for (var i = 0; i < funcKeys.length; i++) allKeys.push(funcKeys[i])
        currentY -= KEY_PITCH
      }

      // Main keyboard rows
      for (var rowIdx = 0; rowIdx < MAIN_ROWS.length; rowIdx++) {
        var rowAngleIdx = includeFunctionRow ? rowIdx + 1 : rowIdx
        var rowKeys = buildKeyRow(MAIN_ROWS[rowIdx], rowAngleIdx, mainStartX - keycapSize / 2, currentY)
        for (var i = 0; i < rowKeys.length; i++) allKeys.push(rowKeys[i])
        currentY -= KEY_PITCH
      }

      // Navigation cluster (if enabled)
      if (includeNavCluster) {
        var navStartX = -totalWidth / 2 + mainWidth + SECTION_GAP
        var navStartY = mainStartY - (includeFunctionRow ? KEY_PITCH : 0)
        var navKeys = buildNavCluster(navStartX, navStartY)
        for (var i = 0; i < navKeys.length; i++) allKeys.push(navKeys[i])
      }

      // Numpad (if enabled)
      if (includeNumpad) {
        var numpadStartX = -totalWidth / 2 + mainWidth + (includeNavCluster ? SECTION_GAP + navWidth + SECTION_GAP : SECTION_GAP)
        var numpadStartY = mainStartY - (includeFunctionRow ? KEY_PITCH : 0)
        var numpadKeys = buildNumpad(numpadStartX, numpadStartY)
        for (var i = 0; i < numpadKeys.length; i++) allKeys.push(numpadKeys[i])
      }

      return allKeys
    }

    // Build the keyboard - keycaps are added on top of solid case
    // This ensures they're physically connected
    var keyboard = buildCase()

    // Collect all keycaps
    var keycaps = buildAllKeycaps()

    // Union keycaps with the case using add() for fail-fast connectivity validation
    // Each keycap has a stem that penetrates into the case for guaranteed connectivity
    if (keycaps.length > 0) {
      // First union all keycaps together (they don't need to touch each other)
      var keycapUnion = group(keycaps).unionAll()
      if (keycapUnion !== null) {
        // Union with case - keycap stems penetrate into the case, ensuring overlap
        keyboard = group([keyboard, keycapUnion]).unionAll()
      }
    }

    return keyboard
  `,
  displayDimensions: [
    { label: 'Keycap', param: 'keycapSize', format: '{value}mm (1U)' },
    { label: 'Height', param: 'caseHeight', format: '{value}mm' },
    { label: 'Wall', param: 'wallThickness', format: '{value}mm' }
  ]
}

export default generator
