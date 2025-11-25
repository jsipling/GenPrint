/**
 * Gridfinity bin builder for Manifold - Single Shell Construction
 *
 * Optimized for speed by constructing the bin as a single shell
 * rather than unioning individual base units.
 *
 * Gridfinity specification (Zack Freedman):
 * - Base unit: 42mm x 42mm grid
 * - Height unit: 7mm (z-pitch)
 * - Base profile: 0.8mm high, complex chamfered profile
 * - Lip profile: For stacking
 */

import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { roundedRect } from './shapes'
import { MIN_WALL_THICKNESS, HOLE_CYLINDER_SEGMENTS } from './printingConstants'

// Gridfinity constants
const GRID_PITCH = 42    // mm per grid unit
const Z_PITCH = 7        // mm per height unit
const WALL_THICKNESS = MIN_WALL_THICKNESS
const BASE_HEIGHT = 5    // Total base height
const LIP_HEIGHT = 4.4   // Stacking lip
const TOLERANCE = 0.25   // Gap for fit

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
 * Build a Gridfinity bin using single-shell construction
 * Much faster than unioning individual base units
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

  const outerWidth = totalWidth - TOLERANCE * 2
  const outerDepth = totalDepth - TOLERANCE * 2
  const cornerRadius = 4

  // === SINGLE SHELL CONSTRUCTION ===
  // Create entire outer shell in one extrusion
  const outerProfile = roundedRect(M, outerWidth, outerDepth, cornerRadius)
  const outerShell = outerProfile.extrude(totalHeight)
  outerProfile.delete()

  // Create inner cavity - leaves walls all around
  const innerWidth = outerWidth - WALL_THICKNESS * 2
  const innerDepth = outerDepth - WALL_THICKNESS * 2
  const innerRadius = Math.max(0.5, cornerRadius - WALL_THICKNESS)
  const innerProfile = roundedRect(M, innerWidth, innerDepth, innerRadius)

  // Cavity starts above base floor
  const floorThickness = 1.5
  const innerCavity = innerProfile.extrude(totalHeight).translate(0, 0, floorThickness)
  innerProfile.delete()

  // Subtract cavity to create hollow bin
  let bin = outerShell.subtract(innerCavity)
  outerShell.delete()
  innerCavity.delete()

  // === ADD LIP ===
  if (p.lip_style !== 'none') {
    const lipInset = p.lip_style === 'reduced' ? 0.6 : 0.8
    const lipOuterProfile = roundedRect(M, outerWidth, outerDepth, cornerRadius)
    const lipOuter = lipOuterProfile.extrude(LIP_HEIGHT).translate(0, 0, totalHeight)
    lipOuterProfile.delete()

    const lipInnerSize = p.lip_style === 'minimum' ? 2 : 1.6
    const lipInnerProfile = roundedRect(M, outerWidth - lipInnerSize, outerDepth - lipInnerSize, Math.max(0.5, cornerRadius - lipInset))
    const lipInner = lipInnerProfile.extrude(LIP_HEIGHT + 1).translate(0, 0, totalHeight - 0.5)
    lipInnerProfile.delete()

    const lip = lipOuter.subtract(lipInner)
    lipOuter.delete()
    lipInner.delete()

    const newBin = bin.add(lip)
    bin.delete()
    lip.delete()
    bin = newBin
  }

  // === MAGNET HOLES (batched) ===
  if (p.enable_magnets) {
    const magnetRadius = 3.25
    const magnetDepth = 2.4
    const magnetHoles: Manifold[] = []

    for (let x = 0; x < p.grid_x; x++) {
      for (let y = 0; y < p.grid_y; y++) {
        const cx = (x + 0.5) * GRID_PITCH - totalWidth / 2
        const cy = (y + 0.5) * GRID_PITCH - totalDepth / 2

        const offsets = [[-13, -13], [13, -13], [-13, 13], [13, 13]]
        for (const [ox, oy] of offsets) {
          const hole = M.Manifold.cylinder(magnetDepth, magnetRadius, magnetRadius, HOLE_CYLINDER_SEGMENTS)
          magnetHoles.push(hole.translate(cx + ox!, cy + oy!, 0))
          hole.delete()
        }
      }
    }

    const allMagnetHoles = M.Manifold.union(magnetHoles)
    magnetHoles.forEach(h => h.delete())
    const newBin = bin.subtract(allMagnetHoles)
    bin.delete()
    allMagnetHoles.delete()
    bin = newBin
  }

  // === SCREW HOLES (batched) ===
  if (p.enable_screws) {
    const screwRadius = 1.5
    const screwDepth = 6
    const screwHoles: Manifold[] = []

    for (let x = 0; x < p.grid_x; x++) {
      for (let y = 0; y < p.grid_y; y++) {
        const cx = (x + 0.5) * GRID_PITCH - totalWidth / 2
        const cy = (y + 0.5) * GRID_PITCH - totalDepth / 2
        const hole = M.Manifold.cylinder(screwDepth, screwRadius, screwRadius, HOLE_CYLINDER_SEGMENTS)
        screwHoles.push(hole.translate(cx, cy, 0))
        hole.delete()
      }
    }

    const allScrewHoles = M.Manifold.union(screwHoles)
    screwHoles.forEach(h => h.delete())
    const newBin = bin.subtract(allScrewHoles)
    bin.delete()
    allScrewHoles.delete()
    bin = newBin
  }

  // === DIVIDERS (batched) ===
  if (p.dividers_x > 0 || p.dividers_y > 0) {
    const dividerThickness = 1.2
    const dividerHeight = totalHeight - floorThickness
    const dividers: Manifold[] = []

    for (let i = 1; i <= p.dividers_x; i++) {
      const xPos = (i / (p.dividers_x + 1)) * innerWidth - innerWidth / 2
      const divider = M.Manifold.cube([dividerThickness, innerDepth - 2, dividerHeight], true)
        .translate(xPos, 0, floorThickness + dividerHeight / 2)
      dividers.push(divider)
    }

    for (let i = 1; i <= p.dividers_y; i++) {
      const yPos = (i / (p.dividers_y + 1)) * innerDepth - innerDepth / 2
      const divider = M.Manifold.cube([innerWidth - 2, dividerThickness, dividerHeight], true)
        .translate(0, yPos, floorThickness + dividerHeight / 2)
      dividers.push(divider)
    }

    if (dividers.length > 0) {
      const allDividers = M.Manifold.union(dividers)
      dividers.forEach(d => d.delete())
      const newBin = bin.add(allDividers)
      bin.delete()
      allDividers.delete()
      bin = newBin
    }
  }

  // === FINGER SLIDE (scoop cutout for easy access) ===
  if (p.finger_slide) {
    // Create a curved scoop on the front edge (-Y side)
    // The scoop is a cylinder rotated to create a smooth curved cutout
    const scoopRadius = totalHeight * 0.6
    const scoopWidth = innerWidth * 0.7  // 70% of interior width

    // Create scoop cylinder oriented along X axis
    const scoop = M.Manifold.cylinder(scoopWidth, scoopRadius, scoopRadius, 32, true)
      .rotate(0, 90, 0)  // Orient along X
      .translate(0, -outerDepth / 2 + scoopRadius * 0.3, totalHeight * 0.7)

    const newBin = bin.subtract(scoop)
    bin.delete()
    scoop.delete()
    bin = newBin
  }

  return bin
}
