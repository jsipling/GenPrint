/**
 * Spacer builder for Manifold
 * A simple cylindrical spacer with a center hole
 */

import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { maxInnerDiameter, MIN_WALL_THICKNESS, printingWarning, HOLE_CYLINDER_SEGMENTS } from './printingConstants'

interface SpacerParams {
  outer_diameter: number
  inner_hole: number
  height: number
}

export function buildSpacer(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const p: SpacerParams = {
    outer_diameter: Number(params['outer_diameter']) || 20,
    inner_hole: Number(params['inner_hole']) || 5,
    height: Number(params['height']) || 10
  }

  // AGENTS.md: Minimum wall thickness 1.2mm (2.4mm total for both walls)
  const maxInnerHole = maxInnerDiameter(p.outer_diameter)
  const safeInnerHole = Math.min(p.inner_hole, maxInnerHole)

  // Dev warning for thin walls
  const wallThickness = (p.outer_diameter - safeInnerHole) / 2
  if (wallThickness <= MIN_WALL_THICKNESS * 1.25) {
    printingWarning('Spacer', `Wall thickness ${wallThickness.toFixed(2)}mm is near ${MIN_WALL_THICKNESS}mm minimum`)
  }

  // Create outer cylinder
  const outerRadius = p.outer_diameter / 2
  const outer = M.Manifold.cylinder(p.height, outerRadius, outerRadius, 0)

  // Create inner cylinder (through hole)
  const innerRadius = safeInnerHole / 2
  const inner = M.Manifold.cylinder(p.height + 2, innerRadius, innerRadius, HOLE_CYLINDER_SEGMENTS)
    .translate(0, 0, -1)

  // Subtract inner from outer
  const spacer = outer.subtract(inner)

  // Cleanup
  outer.delete()
  inner.delete()

  return spacer
}
