/**
 * Box builder for Manifold
 * A customizable box with optional lid, dividers, and features
 */

import type { ManifoldToplevel, Manifold, CrossSection } from 'manifold-3d'


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
  if (r <= 0) {
    // Simple rectangle
    const w2 = width / 2
    const d2 = depth / 2
    return new M.CrossSection([[[-w2, -d2], [w2, -d2], [w2, d2], [-w2, d2]]])
  }

  const w2 = width / 2
  const d2 = depth / 2
  const points: [number, number][] = []
  const segments = 8

  const corners = [
    { cx: w2 - r, cy: d2 - r },
    { cx: -w2 + r, cy: d2 - r },
    { cx: -w2 + r, cy: -d2 + r },
    { cx: w2 - r, cy: -d2 + r }
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
 * Create rounded box (3D)
 */
function roundedBox(
  M: ManifoldToplevel,
  width: number,
  depth: number,
  height: number,
  radius: number
): Manifold {
  const profile = roundedRect(M, width, depth, radius)
  const extruded = profile.extrude(height)
  profile.delete()
  return extruded
}

/**
 * Create finger cutout (semicircular groove)
 */
function fingerCutout(
  M: ManifoldToplevel,
  width: number,
  height: number,
  wallThickness: number
): Manifold {
  const gripWidth = Math.min(width * 0.4, 30)
  const gripDepth = wallThickness + 1
  const gripHeight = Math.min(height * 0.3, 15)

  // Create a cylinder and scale it to make elliptical cutout
  const cutout = M.Manifold.cylinder(gripDepth, gripHeight, gripHeight, 32)
    .scale([gripWidth / gripHeight, 1, 1])
    .rotate([90, 0, 0])
    .translate([0, -gripDepth / 2, height - gripHeight])

  return cutout
}

export function buildBox(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const width = Number(params['width']) || 50
  const depth = Number(params['depth']) || 50
  const height = Number(params['height']) || 30
  const wallThickness = Number(params['wall_thickness']) || 2
  const cornerRadius = Number(params['corner_radius']) || 3
  const includeLid = Boolean(params['include_lid'])
  const lidHeight = Number(params['lid_height']) || 8
  const lidClearance = Number(params['lid_clearance']) || 0.2
  const lidLipHeight = Number(params['lid_lip_height']) || 5
  const bottomThickness = Number(params['bottom_thickness']) || 2
  const dividersX = Math.floor(Number(params['dividers_x']) || 0)
  const dividersY = Math.floor(Number(params['dividers_y']) || 0)
  const fingerGrip = Boolean(params['finger_grip'])
  const stackable = Boolean(params['stackable'])

  // Safe values (1.2mm minimum for reliable FDM printing)
  const safeWall = Math.max(1.2, Math.min(wallThickness, width / 2 - 0.5, depth / 2 - 0.5, height - 1))
  const safeBottom = Math.max(1.2, Math.min(bottomThickness, height - 1))
  const maxCorner = Math.max(0, Math.min(width, depth) / 2 - safeWall)
  const safeCorner = Math.max(0, Math.min(cornerRadius, maxCorner))
  const safeLidClearance = Math.min(Math.max(lidClearance, 0), 1)
  const safeLidHeight = Math.max(lidHeight, safeWall + 1)
  const safeLipHeight = Math.max(1, Math.min(lidLipHeight, height - safeWall))

  const innerWidth = Math.max(1, width - safeWall * 2)
  const innerDepth = Math.max(1, depth - safeWall * 2)
  const innerHeight = Math.max(1, height - safeBottom)

  // Create box body
  const outerBox = roundedBox(M, width, depth, height, safeCorner)
  const innerCavity = roundedBox(M, innerWidth, innerDepth, height, Math.max(0, safeCorner - safeWall))
    .translate(0, 0, safeBottom)

  let boxBody = outerBox.subtract(innerCavity)
  outerBox.delete()
  innerCavity.delete()

  // Add dividers
  if (dividersX > 0) {
    const cellWidth = innerWidth / (dividersX + 1)
    for (let i = 1; i <= dividersX; i++) {
      const xPos = i * cellWidth - innerWidth / 2
      const divider = M.Manifold.cube([safeWall, innerDepth, innerHeight], true)
        .translate(xPos, 0, safeBottom + innerHeight / 2)

      const newBody = boxBody.add(divider)
      boxBody.delete()
      divider.delete()
      boxBody = newBody
    }
  }

  if (dividersY > 0) {
    const cellDepth = innerDepth / (dividersY + 1)
    for (let i = 1; i <= dividersY; i++) {
      const yPos = i * cellDepth - innerDepth / 2
      const divider = M.Manifold.cube([innerWidth, safeWall, innerHeight], true)
        .translate(0, yPos, safeBottom + innerHeight / 2)

      const newBody = boxBody.add(divider)
      boxBody.delete()
      divider.delete()
      boxBody = newBody
    }
  }

  // Add stackable lip
  if (stackable) {
    const lipInset = safeLidClearance
    const lipH = Math.min(5, height * 0.15)
    const lip = roundedBox(
      M,
      Math.max(1, innerWidth - 2 * lipInset),
      Math.max(1, innerDepth - 2 * lipInset),
      lipH + 0.01,
      Math.max(0, safeCorner - safeWall - lipInset)
    ).translate(0, 0, -lipH)

    const newBody = boxBody.add(lip)
    boxBody.delete()
    lip.delete()
    boxBody = newBody
  }

  // Finger grip cutout
  if (fingerGrip) {
    const cutout = fingerCutout(M, width, height, safeWall)
      .translate(0, -depth / 2, 0)

    const newBody = boxBody.subtract(cutout)
    boxBody.delete()
    cutout.delete()
    boxBody = newBody
  }

  // Create lid if included
  if (includeLid) {
    // Lid outer shell
    const lidOuter = roundedBox(M, width, depth, safeLidHeight, safeCorner)
    const lidInner = roundedBox(
      M,
      Math.max(1, width - safeWall * 2),
      Math.max(1, depth - safeWall * 2),
      safeLidHeight - safeWall,
      Math.max(0, safeCorner - safeWall)
    )

    let lid = lidOuter.subtract(lidInner)
    lidOuter.delete()
    lidInner.delete()

    // Inner lip
    const lipOuter = roundedBox(
      M,
      Math.max(1, innerWidth - 2 * safeLidClearance),
      Math.max(1, innerDepth - 2 * safeLidClearance),
      safeLipHeight,
      Math.max(0, safeCorner - safeWall - safeLidClearance)
    )

    const newLid = lid.add(lipOuter)
    lid.delete()
    lipOuter.delete()
    lid = newLid

    // Finger grip on lid
    if (fingerGrip) {
      const cutout = fingerCutout(M, width, safeLidHeight, safeWall)
        .translate(0, -depth / 2, 0)

      const newLid2 = lid.subtract(cutout)
      lid.delete()
      cutout.delete()
      lid = newLid2
    }

    // Position lid next to box
    const positionedLid = lid.translate(width + 5, 0, 0)
    lid.delete()

    const combined = boxBody.add(positionedLid)
    boxBody.delete()
    positionedLid.delete()
    boxBody = combined
  }

  return boxBody
}
