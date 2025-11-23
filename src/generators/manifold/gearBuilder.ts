/**
 * Spur Gear builder for Manifold
 * A parametric spur gear with involute tooth profile
 */

import type { ManifoldToplevel, Manifold, CrossSection } from 'manifold-3d'

interface GearParams {
  teeth: number
  module: number
  height: number
  bore_diameter: number
  pressure_angle: number
  tolerance: number
  tip_sharpness: number
  include_hub: boolean
  hub_diameter: number
  hub_height: number
}

/**
 * Calculate involute curve point at given roll angle
 */
function involutePoint(baseRadius: number, rollAngle: number): [number, number] {
  const rollRad = (rollAngle * Math.PI) / 180
  return [
    baseRadius * (Math.cos(rollRad) + rollRad * Math.sin(rollRad)),
    baseRadius * (Math.sin(rollRad) - rollRad * Math.cos(rollRad))
  ]
}

/**
 * Calculate the roll angle at which involute reaches given radius
 */
function involuteIntersectAngle(baseRadius: number, radius: number): number {
  if (radius <= baseRadius) return 0
  const cosA = baseRadius / radius
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)))
  const invA = Math.tan(a) - a
  return (invA * 180) / Math.PI
}

/**
 * Generate gear tooth polygon points
 */
function generateToothProfile(
  pitchRadius: number,
  baseRadius: number,
  outerRadius: number,
  rootRadius: number,
  mod: number,
  _pressureAngle: number,
  clearance: number,
  tipSharpness: number
): [number, number][] {
  // Tooth thickness at pitch circle
  const pitchThick = (Math.PI * mod) / 2 - clearance
  // Half tooth angle at pitch
  const halfPitchAngle = ((pitchThick / 2) / pitchRadius) * (180 / Math.PI)

  // Involute angles
  const pitchInv = involuteIntersectAngle(baseRadius, pitchRadius)
  const tipInv = involuteIntersectAngle(baseRadius, outerRadius)

  // Offset so tooth centers on X-axis
  const offsetAngle = halfPitchAngle - pitchInv

  // Root half angle (slightly wider at root)
  const rootHalfAngle = halfPitchAngle + 2

  // Generate involute points (20 steps for smooth tooth flanks)
  const steps = 20
  const rightPts: [number, number][] = []
  const leftPts: [number, number][] = []

  for (let i = 0; i <= steps; i++) {
    const roll = (tipInv * i) / steps
    const pt = involutePoint(baseRadius, roll)
    const r = Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1])
    const theta = Math.atan2(pt[1], pt[0]) * (180 / Math.PI)

    // Right side (negative theta, adjusted)
    const rightAngle = (-theta - offsetAngle) * (Math.PI / 180)
    rightPts.push([r * Math.cos(rightAngle), r * Math.sin(rightAngle)])

    // Left side (positive theta, adjusted)
    const leftAngle = (theta + offsetAngle) * (Math.PI / 180)
    leftPts.push([r * Math.cos(leftAngle), r * Math.sin(leftAngle)])
  }

  // Build tooth polygon
  const points: [number, number][] = []

  // Start at root (right side)
  const rootRightAngle = (-rootHalfAngle * Math.PI) / 180
  points.push([rootRadius * Math.cos(rootRightAngle), rootRadius * Math.sin(rootRightAngle)])

  // Right involute flank
  points.push(...rightPts)

  // Tip point (interpolated between flat and pointed)
  if (tipSharpness > 0) {
    const rightTip = rightPts[rightPts.length - 1]!
    const leftTip = leftPts[leftPts.length - 1]!
    const midTip: [number, number] = [(rightTip[0] + leftTip[0]) / 2, (rightTip[1] + leftTip[1]) / 2]
    const pointTip: [number, number] = [outerRadius, 0]
    points.push([
      midTip[0] + tipSharpness * (pointTip[0] - midTip[0]),
      midTip[1] + tipSharpness * (pointTip[1] - midTip[1])
    ])
  }

  // Left involute flank (reversed)
  for (let i = steps; i >= 0; i--) {
    points.push(leftPts[i]!)
  }

  // End at root (left side)
  const rootLeftAngle = (rootHalfAngle * Math.PI) / 180
  points.push([rootRadius * Math.cos(rootLeftAngle), rootRadius * Math.sin(rootLeftAngle)])

  return points
}

/**
 * Create 2D gear profile
 */
function gearProfile(M: ManifoldToplevel, params: GearParams): CrossSection {
  const { teeth, module: mod, pressure_angle, tolerance, tip_sharpness } = params

  const pitchRadius = (teeth * mod) / 2
  const baseRadius = pitchRadius * Math.cos((pressure_angle * Math.PI) / 180)
  const outerRadius = pitchRadius + mod
  const rootRadius = pitchRadius - 1.25 * mod

  // Create root circle
  const rootPoints: [number, number][] = []
  const rootSegments = teeth * 4
  for (let i = 0; i < rootSegments; i++) {
    const angle = (2 * Math.PI * i) / rootSegments
    rootPoints.push([rootRadius * Math.cos(angle), rootRadius * Math.sin(angle)])
  }

  // Start with root circle profile
  let gearCross = new M.CrossSection([rootPoints])

  // Add each tooth
  const toothPoints = generateToothProfile(
    pitchRadius,
    baseRadius,
    outerRadius,
    rootRadius,
    mod,
    pressure_angle,
    tolerance,
    tip_sharpness
  )

  // Batch all teeth and union once (faster than individual unions)
  const toothCrosses: CrossSection[] = []
  for (let i = 0; i < teeth; i++) {
    const angle = (360 * i) / teeth
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    const rotatedPoints: [number, number][] = toothPoints.map(([x, y]) => [
      x * cos - y * sin,
      x * sin + y * cos
    ])

    toothCrosses.push(new M.CrossSection([rotatedPoints]))
  }

  // Single batch union of all teeth
  const allTeeth = M.CrossSection.union(toothCrosses)
  toothCrosses.forEach(t => t.delete())

  const newGear = gearCross.add(allTeeth)
  gearCross.delete()
  allTeeth.delete()
  gearCross = newGear

  return gearCross
}

export function buildGear(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const teeth = Math.max(8, Math.floor(Number(params['teeth']) || 20))
  const mod = Math.max(1, Number(params['module']) || 2)
  const height = Number(params['height']) || 5
  const boreDiameter = Number(params['bore_diameter']) || 5
  const includeHub = Boolean(params['include_hub'])
  const hubDiameter = Number(params['hub_diameter']) || 15
  const hubHeight = Number(params['hub_height']) || 5
  const pressureAngle = Number(params['pressure_angle']) || 20
  const tolerance = Number(params['tolerance']) || 0
  const tipSharpness = Number(params['tip_sharpness']) || 0

  // Validate tooth thickness for printability (minimum 1mm at pitch circle)
  const toothThickness = (Math.PI * mod) / 2
  if (toothThickness < 1.0) {
    console.warn(`[Gear] Tooth thickness ${toothThickness.toFixed(2)}mm may be too thin for FDM printing`)
  }

  const pitchDiameter = teeth * mod
  const rootDiameter = pitchDiameter - 2.5 * mod

  // Safe bore
  const maxBore = Math.max(0, rootDiameter - 4)
  const safeBore = Math.min(boreDiameter, maxBore)

  // Safe hub diameter
  const safeHubDiameter = Math.max(hubDiameter, safeBore + 4)

  const p: GearParams = {
    teeth,
    module: mod,
    height,
    bore_diameter: safeBore,
    pressure_angle: pressureAngle,
    tolerance,
    tip_sharpness: tipSharpness,
    include_hub: includeHub,
    hub_diameter: safeHubDiameter,
    hub_height: hubHeight
  }

  // Create gear profile and extrude
  const profile = gearProfile(M, p)
  let gear = profile.extrude(height)
  profile.delete()

  // Add hub if included
  if (includeHub && hubHeight > 0) {
    const hub = M.Manifold.cylinder(hubHeight, safeHubDiameter / 2, safeHubDiameter / 2, 0)
      .translate(0, 0, height)

    const newGear = gear.add(hub)
    gear.delete()
    hub.delete()
    gear = newGear
  }

  // Bore hole
  if (safeBore > 0) {
    const bore = M.Manifold.cylinder(height + hubHeight + 2, safeBore / 2, safeBore / 2, 0)
      .translate(0, 0, -1)

    const newGear = gear.subtract(bore)
    gear.delete()
    bore.delete()
    gear = newGear
  }

  return gear
}
