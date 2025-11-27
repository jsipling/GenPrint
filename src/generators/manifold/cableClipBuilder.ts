/**
 * Cable clip builder using the fluent geometry API
 * A C-shaped clip that snaps around cables with optional mounting hole
 */

import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { createBuilderContext } from './fluent'
import { MIN_WALL_THICKNESS } from './printingConstants'

export function buildCableClip(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const ctx = createBuilderContext(M)
  const { tube, box, hole, difference, union } = ctx

  // Extract parameters with defaults
  const cableDiameter = Number(params['cable_diameter']) || 6
  const wallThickness = Math.max(Number(params['wall_thickness']) || 2, MIN_WALL_THICKNESS)
  const width = Number(params['width']) || 10
  const gapWidth = Number(params['gap_width']) || 2
  const hasBase = Boolean(params['has_base'])
  const hasHole = Boolean(params['has_hole'])
  const holeDiameter = Number(params['hole_diameter']) || 4

  // Calculate dimensions
  const innerRadius = cableDiameter / 2
  const outerRadius = innerRadius + wallThickness
  const outerDiameter = outerRadius * 2

  // Create the main tube (C-shaped when we cut the gap)
  const mainTube = tube(width, outerRadius, innerRadius)

  // Create the gap cutting block
  // Position it at the top of the clip, centered on Y
  const gapHeight = outerRadius + 1 // Extend past the top
  const gapBlock = box(gapWidth, gapHeight, width + 2, false)
    .translate(-gapWidth / 2, 0, -1)

  // Cut the gap to create C-shape
  let clip = difference(mainTube, gapBlock)

  // Add mounting base if requested
  if (hasBase) {
    const baseThickness = wallThickness
    const baseWidth = outerDiameter + 6 // Extra width for stability
    const baseDepth = outerRadius + baseThickness

    // Create base plate positioned at the bottom of the clip
    const basePlate = box(baseWidth, baseDepth, width, false)
      .translate(-baseWidth / 2, -outerRadius - baseThickness, 0)

    clip = union(clip, basePlate)

    // Add mounting hole in the base if requested
    if (hasHole && holeDiameter > 0) {
      const safeHoleDia = Math.min(holeDiameter, baseDepth - MIN_WALL_THICKNESS * 2)
      const holeY = -outerRadius - baseThickness / 2
      const holeZ = width / 2

      const mountHole = hole(safeHoleDia, baseWidth + 2)
        .rotate(0, 90, 0)
        .translate(-baseWidth / 2 - 1, holeY, holeZ)

      clip = difference(clip, mountHole)
    }
  }

  return clip.build()
}
