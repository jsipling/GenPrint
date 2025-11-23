/**
 * Gridfinity bin builder for Manifold
 *
 * Gridfinity specification (Zack Freedman):
 * - Base unit: 42mm x 42mm grid
 * - Height unit: 7mm (z-pitch)
 * - Base profile: 0.8mm high, complex chamfered profile
 * - Lip profile: For stacking
 */

import type { ManifoldToplevel, Manifold, CrossSection } from 'manifold-3d'

// Gridfinity constants
const GRID_PITCH = 42    // mm per grid unit
const Z_PITCH = 7        // mm per height unit
const WALL_THICKNESS = 1.2
const BASE_HEIGHT = 5    // Total base height
const LIP_HEIGHT = 4.4   // Stacking lip

interface GridfinityParams {
  grid_x: number
  grid_y: number
  grid_z: number
  lip_style: string
  enable_magnets: boolean
  enable_screws: boolean
  dividers_x: number
  dividers_y: number
  finger_slide: boolean
}

/**
 * Create a rounded rectangle cross-section
 */
function roundedRect(
  M: ManifoldToplevel,
  width: number,
  depth: number,
  radius: number
): CrossSection {
  const r = Math.min(radius, width / 2, depth / 2)
  const w2 = width / 2
  const d2 = depth / 2

  // Create rounded rectangle as polygon with arcs
  const points: [number, number][] = []
  const segments = 4 // segments per corner (reduced for performance)

  // Four corners: TR, TL, BL, BR
  const corners = [
    { cx: w2 - r, cy: d2 - r },   // Top-right
    { cx: -w2 + r, cy: d2 - r },  // Top-left
    { cx: -w2 + r, cy: -d2 + r }, // Bottom-left
    { cx: w2 - r, cy: -d2 + r }   // Bottom-right
  ]

  for (let i = 0; i < 4; i++) {
    const corner = corners[i]!
    const startAngle = (i * Math.PI) / 2
    for (let j = 0; j <= segments; j++) {
      const angle = startAngle + (j * Math.PI) / (2 * segments)
      points.push([
        corner.cx + r * Math.cos(angle),
        corner.cy + r * Math.sin(angle)
      ])
    }
  }

  return new M.CrossSection([points])
}

/**
 * Create Gridfinity base profile (the complex 0.8mm edge)
 * Profile from bottom to top:
 * - 0.8mm chamfer outward at 45°
 * - 1.8mm vertical wall
 * - 2.15mm chamfer outward at 45°
 * - 0.25mm vertical lip
 */
function createBaseUnit(M: ManifoldToplevel, unitSize: number): Manifold {
  // Base dimensions
  const outerSize = unitSize - 0.5 // 0.25mm gap on each side for tolerance
  const baseRadius = 4

  // Create the base shape by building from bottom up
  // Start with outer rounded rectangle at bottom
  const baseProfile = roundedRect(M, outerSize, outerSize, baseRadius)

  // Simple approach: create solid base, then hollow it out
  const solidBase = baseProfile.extrude(BASE_HEIGHT)

  // Inner cavity (wall thickness inset)
  const innerSize = outerSize - WALL_THICKNESS * 2
  const innerRadius = Math.max(0.5, baseRadius - WALL_THICKNESS)
  const innerProfile = roundedRect(M, innerSize, innerSize, innerRadius)
  const innerCavity = innerProfile.extrude(BASE_HEIGHT + 1).translate(0, 0, 1.5)

  // Subtract cavity to create hollow base
  const hollowBase = solidBase.subtract(innerCavity)

  // Cleanup
  baseProfile.delete()
  innerProfile.delete()
  solidBase.delete()
  innerCavity.delete()

  return hollowBase
}

/**
 * Create the stacking lip profile
 */
function createLip(M: ManifoldToplevel, width: number, depth: number, style: string): Manifold {
  if (style === 'none') {
    return M.Manifold.cube([0.001, 0.001, 0.001]) // Empty manifold
  }

  const lipRadius = 4
  const lipInset = style === 'reduced' ? 0.6 : 0.8

  // Outer lip shape
  const outerProfile = roundedRect(M, width, depth, lipRadius)
  const outerLip = outerProfile.extrude(LIP_HEIGHT)

  // Inner cutout for lip
  const innerSize = style === 'minimum' ? 2 : 1.6
  const innerProfile = roundedRect(M, width - innerSize, depth - innerSize, Math.max(0.5, lipRadius - lipInset))
  const innerCut = innerProfile.extrude(LIP_HEIGHT + 1).translate(0, 0, -0.5)

  const lip = outerLip.subtract(innerCut)

  // Cleanup
  outerProfile.delete()
  innerProfile.delete()
  outerLip.delete()
  innerCut.delete()

  return lip
}

/**
 * Build a Gridfinity bin
 */
export function buildGridfinityBin(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const p: GridfinityParams = {
    grid_x: Number(params['grid_x']) || 2,
    grid_y: Number(params['grid_y']) || 2,
    grid_z: Number(params['grid_z']) || 3,
    lip_style: String(params['lip_style']) || 'normal',
    enable_magnets: Boolean(params['enable_magnets']),
    enable_screws: Boolean(params['enable_screws']),
    dividers_x: Math.floor(Number(params['dividers_x']) || 0),
    dividers_y: Math.floor(Number(params['dividers_y']) || 0),
    finger_slide: Boolean(params['finger_slide'])
  }

  // Calculate overall dimensions
  const totalWidth = p.grid_x * GRID_PITCH
  const totalDepth = p.grid_y * GRID_PITCH
  const totalHeight = p.grid_z * Z_PITCH + BASE_HEIGHT

  // Create array of base units
  const baseUnits: Manifold[] = []
  for (let x = 0; x < p.grid_x; x++) {
    for (let y = 0; y < p.grid_y; y++) {
      const unit = createBaseUnit(M, GRID_PITCH)
      const positioned = unit.translate(
        (x + 0.5) * GRID_PITCH - totalWidth / 2,
        (y + 0.5) * GRID_PITCH - totalDepth / 2,
        0
      )
      baseUnits.push(positioned)
      unit.delete()
    }
  }

  // Union all base units
  let base = M.Manifold.union(baseUnits)
  baseUnits.forEach(u => u.delete())

  // Create main bin body (above base)
  const bodyRadius = 4
  const bodyWidth = totalWidth - 0.5
  const bodyDepth = totalDepth - 0.5
  const bodyHeight = totalHeight - BASE_HEIGHT

  const bodyProfile = roundedRect(M, bodyWidth, bodyDepth, bodyRadius)
  const solidBody = bodyProfile.extrude(bodyHeight).translate(0, 0, BASE_HEIGHT)

  // Inner cavity for body
  const cavityWidth = bodyWidth - WALL_THICKNESS * 2
  const cavityDepth = bodyDepth - WALL_THICKNESS * 2
  const cavityRadius = Math.max(0.5, bodyRadius - WALL_THICKNESS)
  const cavityProfile = roundedRect(M, cavityWidth, cavityDepth, cavityRadius)
  const cavity = cavityProfile.extrude(bodyHeight + 1).translate(0, 0, BASE_HEIGHT + WALL_THICKNESS)

  const body = solidBody.subtract(cavity)

  // Cleanup body construction
  bodyProfile.delete()
  solidBody.delete()
  cavityProfile.delete()
  cavity.delete()

  // Add stacking lip
  const lip = createLip(M, bodyWidth, bodyDepth, p.lip_style)
  const positionedLip = lip.translate(0, 0, totalHeight)
  lip.delete()

  // Combine base + body + lip
  let bin = base.add(body).add(positionedLip)
  base.delete()
  body.delete()
  positionedLip.delete()

  // Add magnet holes if enabled (batched for performance)
  if (p.enable_magnets) {
    const magnetRadius = 3.25
    const magnetDepth = 2.4
    const magnetHoles: Manifold[] = []

    for (let x = 0; x < p.grid_x; x++) {
      for (let y = 0; y < p.grid_y; y++) {
        const cx = (x + 0.5) * GRID_PITCH - totalWidth / 2
        const cy = (y + 0.5) * GRID_PITCH - totalDepth / 2

        // Four corners of each grid unit
        const offsets = [
          [-13, -13], [13, -13], [-13, 13], [13, 13]
        ]

        for (const [ox, oy] of offsets) {
          const hole = M.Manifold.cylinder(magnetDepth, magnetRadius, magnetRadius, 12)
          magnetHoles.push(hole.translate(cx + ox!, cy + oy!, 0))
          hole.delete()
        }
      }
    }

    // Single batched subtract
    const allMagnetHoles = M.Manifold.union(magnetHoles)
    magnetHoles.forEach(h => h.delete())
    const newBin = bin.subtract(allMagnetHoles)
    bin.delete()
    allMagnetHoles.delete()
    bin = newBin
  }

  // Add screw holes if enabled (batched for performance)
  if (p.enable_screws) {
    const screwRadius = 1.5
    const screwDepth = 6
    const screwHoles: Manifold[] = []

    for (let x = 0; x < p.grid_x; x++) {
      for (let y = 0; y < p.grid_y; y++) {
        const cx = (x + 0.5) * GRID_PITCH - totalWidth / 2
        const cy = (y + 0.5) * GRID_PITCH - totalDepth / 2

        const hole = M.Manifold.cylinder(screwDepth, screwRadius, screwRadius, 8)
        screwHoles.push(hole.translate(cx, cy, 0))
        hole.delete()
      }
    }

    // Single batched subtract
    const allScrewHoles = M.Manifold.union(screwHoles)
    screwHoles.forEach(h => h.delete())
    const newBin = bin.subtract(allScrewHoles)
    bin.delete()
    allScrewHoles.delete()
    bin = newBin
  }

  // Add dividers if specified (batched for performance)
  if (p.dividers_x > 0 || p.dividers_y > 0) {
    const dividerThickness = 1.2
    const dividerHeight = totalHeight - BASE_HEIGHT - WALL_THICKNESS
    const dividers: Manifold[] = []

    // X dividers (running along Y axis)
    for (let i = 1; i <= p.dividers_x; i++) {
      const xPos = (i / (p.dividers_x + 1)) * cavityWidth - cavityWidth / 2
      const divider = M.Manifold.cube([dividerThickness, cavityDepth - 2, dividerHeight], true)
        .translate(xPos, 0, BASE_HEIGHT + WALL_THICKNESS + dividerHeight / 2)
      dividers.push(divider)
    }

    // Y dividers (running along X axis)
    for (let i = 1; i <= p.dividers_y; i++) {
      const yPos = (i / (p.dividers_y + 1)) * cavityDepth - cavityDepth / 2
      const divider = M.Manifold.cube([cavityWidth - 2, dividerThickness, dividerHeight], true)
        .translate(0, yPos, BASE_HEIGHT + WALL_THICKNESS + dividerHeight / 2)
      dividers.push(divider)
    }

    // Single batched add
    if (dividers.length > 0) {
      const allDividers = M.Manifold.union(dividers)
      dividers.forEach(d => d.delete())
      const newBin = bin.add(allDividers)
      bin.delete()
      allDividers.delete()
      bin = newBin
    }
  }

  return bin
}
