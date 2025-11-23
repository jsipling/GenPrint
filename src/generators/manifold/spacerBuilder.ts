/**
 * Spacer builder for Manifold
 * A simple cylindrical spacer with a center hole
 */

import type { ManifoldToplevel, Manifold } from 'manifold-3d'

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

  // Clamp inner_hole to be at most outer_diameter - 2mm for minimum wall thickness
  const maxInnerHole = p.outer_diameter - 2
  const safeInnerHole = Math.min(p.inner_hole, maxInnerHole)

  // Create outer cylinder
  const outerRadius = p.outer_diameter / 2
  const outer = M.Manifold.cylinder(p.height, outerRadius, outerRadius, 0)

  // Create inner cylinder (through hole)
  const innerRadius = safeInnerHole / 2
  const inner = M.Manifold.cylinder(p.height + 2, innerRadius, innerRadius, 0)
    .translate(0, 0, -1)

  // Subtract inner from outer
  const spacer = outer.subtract(inner)

  // Cleanup
  outer.delete()
  inner.delete()

  return spacer
}
