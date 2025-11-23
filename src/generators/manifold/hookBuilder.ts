/**
 * Hook builder for Manifold
 * A simple wall hook for hanging items
 */

import type { ManifoldToplevel, Manifold } from 'manifold-3d'

interface HookParams {
  width: number
  hook_depth: number
  hook_height: number
  thickness: number
  hole_diameter: number
}

export function buildHook(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const p: HookParams = {
    width: Number(params['width']) || 15,
    hook_depth: Number(params['hook_depth']) || 25,
    hook_height: Number(params['hook_height']) || 30,
    thickness: Number(params['thickness']) || 5,
    hole_diameter: Number(params['hole_diameter']) || 4
  }

  // Create hook profile as polygon
  // L-shape: vertical back + horizontal hook
  const points: [number, number][] = [
    [0, 0],
    [0, p.hook_height],
    [p.thickness, p.hook_height],
    [p.thickness, p.thickness],
    [p.hook_depth, p.thickness],
    [p.hook_depth, 0]
  ]

  const profile = new M.CrossSection([points])
  let hook = profile.extrude(p.width)
  profile.delete()

  // Add mounting hole if specified
  if (p.hole_diameter > 0) {
    const holeRadius = p.hole_diameter / 2
    const hole = M.Manifold.cylinder(p.thickness * 2, holeRadius, holeRadius, 0)
      .rotate(0, 90, 0)
      .translate(p.thickness / 2, p.hook_height - p.thickness * 1.5, p.width / 2)

    const newHook = hook.subtract(hole)
    hook.delete()
    hole.delete()
    hook = newHook
  }

  return hook
}
