/**
 * Hook builder for Manifold
 * A simple wall hook for hanging items
 */

import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { createFilletProfile } from './shapes'

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

  // Create L-shape using two boxes (like bracket does)
  // Vertical back plate
  const backPlate = M.Manifold.cube([p.thickness, p.hook_height, p.width], false)

  // Horizontal hook arm
  const hookArm = M.Manifold.cube([p.hook_depth, p.thickness, p.width], false)

  // Combine into L-shape
  let hook = backPlate.add(hookArm)
  backPlate.delete()
  hookArm.delete()

  // Add corner fillet for structural strength at the L-joint
  // Fillet radius is half the thickness for good strength without being too bulky
  const filletRadius = p.thickness / 2
  const filletProfile = createFilletProfile(M, filletRadius, 8)
  const fillet = filletProfile.extrude(p.width)
    .rotate(90, 0, 0)
    .translate(p.thickness, p.width, p.thickness)

  const filletedHook = hook.add(fillet)
  hook.delete()
  fillet.delete()
  filletProfile.delete()
  hook = filletedHook

  // Add mounting hole if specified
  if (p.hole_diameter > 0) {
    const holeRadius = p.hole_diameter / 2
    const hole = M.Manifold.cylinder(p.thickness * 2, holeRadius, holeRadius, 16)
      .rotate(0, 90, 0)
      .translate(p.thickness / 2, p.hook_height - p.thickness * 1.5, p.width / 2)

    const newHook = hook.subtract(hole)
    hook.delete()
    hole.delete()
    hook = newHook
  }

  return hook
}
