/**
 * Washer builder for Manifold
 * A flat ring washer with configurable dimensions
 */

import type { ManifoldToplevel, Manifold } from 'manifold-3d'

interface WasherParams {
  outer_diameter: number
  inner_diameter: number
  thickness: number
}

export function buildWasher(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const p: WasherParams = {
    outer_diameter: Number(params['outer_diameter']) || 12,
    inner_diameter: Number(params['inner_diameter']) || 6,
    thickness: Number(params['thickness']) || 1.5
  }

  // AGENTS.md: Minimum wall thickness 1.2mm (2.4mm total for both walls)
  const maxInner = p.outer_diameter - 2.4
  const safeInnerD = Math.min(p.inner_diameter, maxInner)

  // Create outer cylinder
  const outerRadius = p.outer_diameter / 2
  const outer = M.Manifold.cylinder(p.thickness, outerRadius, outerRadius, 0)

  // Create inner cylinder (through hole)
  const innerRadius = safeInnerD / 2
  const inner = M.Manifold.cylinder(p.thickness + 0.4, innerRadius, innerRadius, 0)
    .translate(0, 0, -0.2)

  // Subtract inner from outer
  const washer = outer.subtract(inner)

  // Cleanup
  outer.delete()
  inner.delete()

  return washer
}
