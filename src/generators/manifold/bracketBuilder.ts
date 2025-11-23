/**
 * Bracket builder for Manifold
 * An L-bracket with mounting holes for corner reinforcement
 */

import type { ManifoldToplevel, Manifold, CrossSection } from 'manifold-3d'

interface BracketParams {
  width: number
  arm_length: number
  thickness: number
  hole_diameter: number
  fillet_radius: number
  hole_count_arm_1: number
  hole_count_arm_2: number
  add_rib: boolean
  rib_thickness: number
}

/**
 * Create a fillet profile (quarter circle to fill corner)
 * Points must be counter-clockwise for positive area in CrossSection
 */
function createFilletProfile(M: ManifoldToplevel, radius: number, segments: number = 16): CrossSection {
  // Build quarter pie shape with counter-clockwise winding:
  // (0,0) → (radius,0) → arc → (0,radius) → back to (0,0)
  const points: [number, number][] = [[0, 0]]

  for (let i = 0; i <= segments; i++) {
    const angle = (Math.PI / 2) * (i / segments)
    points.push([
      radius * Math.cos(angle),
      radius * Math.sin(angle)
    ])
  }

  return new M.CrossSection([points])
}

export function buildBracket(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const p: BracketParams = {
    width: Number(params['width']) || 30,
    arm_length: Number(params['arm_length']) || 40,
    thickness: Number(params['thickness']) || 4,
    hole_diameter: Number(params['hole_diameter']) || 5,
    fillet_radius: Number(params['fillet_radius']) || 5,
    hole_count_arm_1: Math.floor(Number(params['hole_count_arm_1']) || 1),
    hole_count_arm_2: Math.floor(Number(params['hole_count_arm_2']) || 1),
    add_rib: Boolean(params['add_rib']),
    rib_thickness: Number(params['rib_thickness']) || 4
  }

  // Create horizontal arm
  const horizontalArm = M.Manifold.cube([p.arm_length, p.width, p.thickness], false)

  // Create vertical arm
  const verticalArm = M.Manifold.cube([p.thickness, p.width, p.arm_length], false)

  // Combine arms
  let bracket = horizontalArm.add(verticalArm)
  horizontalArm.delete()
  verticalArm.delete()

  // Add fillet for strength (fill in the corner)
  if (p.fillet_radius > 0) {
    // Create fillet as a solid triangular prism that fills the corner
    const filletProfile = createFilletProfile(M, p.fillet_radius)
    const fillet = filletProfile.extrude(p.width)
      .rotate(90, 0, 0)
      .translate(p.thickness, p.width, p.thickness)

    const newBracket = bracket.add(fillet)
    bracket.delete()
    fillet.delete()
    filletProfile.delete()
    bracket = newBracket
  }

  // Add rib for strength (triangular brace in the inner corner)
  if (p.add_rib) {
    // Rib fills the inner corner between the two arms
    // Use fillet_radius as rib size if set, otherwise default to arm_length/4
    const defaultRibSize = Math.max(p.fillet_radius, (p.arm_length - p.thickness) / 4)
    const ribSize = Math.min(defaultRibSize, p.arm_length - p.thickness)

    // Profile in XY plane, extruded in Z, then rotated to XZ plane
    const ribPoints: [number, number][] = [
      [0, 0],
      [ribSize, 0],
      [0, ribSize]
    ]
    const ribProfile = new M.CrossSection([ribPoints])
    const rib = ribProfile.extrude(p.rib_thickness)
      .rotate(90, 0, 0)  // Rotate so rib is in XZ plane
      .translate(p.thickness, (p.width + p.rib_thickness) / 2, p.thickness)

    const newBracket = bracket.add(rib)
    bracket.delete()
    rib.delete()
    ribProfile.delete()
    bracket = newBracket
  }

  // Add holes (batched for performance)
  const allHoles: Manifold[] = []
  const holeRadius = p.hole_diameter / 2

  // Horizontal arm holes
  if (p.hole_count_arm_1 > 0) {
    const holeOffsetStart = (p.arm_length - p.thickness) / (p.hole_count_arm_1 + 1) + p.thickness
    const holeSpacing = (p.arm_length - p.thickness) / (p.hole_count_arm_1 + 1)

    for (let i = 0; i < p.hole_count_arm_1; i++) {
      const hole = M.Manifold.cylinder(p.thickness + 0.4, holeRadius, holeRadius, 16)
        .translate(holeOffsetStart + i * holeSpacing, p.width / 2, -0.2)
      allHoles.push(hole)
    }
  }

  // Vertical arm holes
  if (p.hole_count_arm_2 > 0) {
    const holeOffsetStart = (p.arm_length - p.thickness) / (p.hole_count_arm_2 + 1) + p.thickness
    const holeSpacing = (p.arm_length - p.thickness) / (p.hole_count_arm_2 + 1)

    for (let i = 0; i < p.hole_count_arm_2; i++) {
      const hole = M.Manifold.cylinder(p.thickness + 0.4, holeRadius, holeRadius, 16)
        .rotate(0, 90, 0)
        .translate(-0.2, p.width / 2, holeOffsetStart + i * holeSpacing)
      allHoles.push(hole)
    }
  }

  // Single batched subtract
  if (allHoles.length > 0) {
    const combinedHoles = M.Manifold.union(allHoles)
    allHoles.forEach(h => h.delete())
    const newBracket = bracket.subtract(combinedHoles)
    bracket.delete()
    combinedHoles.delete()
    bracket = newBracket
  }

  return bracket
}
