/**
 * Shared geometry utilities for Manifold builders
 * Extracted from individual builders to reduce code duplication
 */

import type { ManifoldToplevel, CrossSection } from 'manifold-3d'

/**
 * Create a rounded rectangle cross-section
 * @param M - Manifold module
 * @param width - Width of rectangle
 * @param depth - Depth (height in 2D) of rectangle
 * @param radius - Corner radius
 * @param centered - If true, center at origin; if false, bottom-left at origin
 * @param segments - Number of segments per 90° arc (default: 8 for FDM printing)
 */
export function roundedRect(
  M: ManifoldToplevel,
  width: number,
  depth: number,
  radius: number,
  centered: boolean = true,
  segments: number = 8
): CrossSection {
  const r = Math.min(radius, width / 2, depth / 2)

  if (centered) {
    // Centered version (used by boxBuilder, gridfinityBuilder)
    if (r <= 0) {
      const w2 = width / 2
      const d2 = depth / 2
      return new M.CrossSection([[[-w2, -d2], [w2, -d2], [w2, d2], [-w2, d2]]])
    }

    const w2 = width / 2
    const d2 = depth / 2
    const points: [number, number][] = []

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
  } else {
    // Non-centered version (used by signBuilder) - bottom-left at origin
    if (r <= 0) {
      return new M.CrossSection([[[0, 0], [width, 0], [width, depth], [0, depth]]])
    }

    const points: [number, number][] = []

    // Four corners: BR, TR, TL, BL
    const corners = [
      { cx: width - r, cy: r },      // Bottom-right
      { cx: width - r, cy: depth - r }, // Top-right
      { cx: r, cy: depth - r },     // Top-left
      { cx: r, cy: r }               // Bottom-left
    ]

    for (let i = 0; i < 4; i++) {
      const corner = corners[i]!
      const startAngle = (-Math.PI / 2) + (i * Math.PI) / 2
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
}

/**
 * Create a fillet profile (quarter circle to fill corner)
 * Points are counter-clockwise for positive area in CrossSection
 * @param M - Manifold module
 * @param radius - Fillet radius
 * @param segments - Number of segments for the arc (default: 16 for smooth fillets)
 */
export function createFilletProfile(
  M: ManifoldToplevel,
  radius: number,
  segments: number = 16
): CrossSection {
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
