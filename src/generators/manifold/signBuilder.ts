/**
 * Sign builder for Manifold
 * A customizable sign with raised text using stroke-based font
 */

import type { ManifoldToplevel, Manifold, CrossSection } from 'manifold-3d'
import { STROKE_FONT, DOTTED_CHARS, getCharSpacing } from './strokeFont'

interface SignParams {
  text: string
  text_size: number
  text_depth: number
  padding: number
  base_depth: number
  corner_radius: number
}

/**
 * Create a rounded rectangle cross-section
 */
function roundedRect(
  M: ManifoldToplevel,
  width: number,
  height: number,
  radius: number
): CrossSection {
  const r = Math.min(radius, width / 2, height / 2)
  if (r <= 0) {
    return new M.CrossSection([[[0, 0], [width, 0], [width, height], [0, height]]])
  }

  const points: [number, number][] = []
  const segments = 8

  // Four corners: BR, TR, TL, BL
  const corners = [
    { cx: width - r, cy: r },      // Bottom-right
    { cx: width - r, cy: height - r }, // Top-right
    { cx: r, cy: height - r },     // Top-left
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

/**
 * Create a cylinder for stroke rendering
 */
function strokeCylinder(
  M: ManifoldToplevel,
  height: number,
  diameter: number
): Manifold {
  return M.Manifold.cylinder(height, diameter / 2, diameter / 2, 12)
}

/**
 * Create a stroke segment between two points using hull of cylinders
 * This approximates OpenSCAD's hull() of two cylinders
 */
function strokeSegment(
  M: ManifoldToplevel,
  p1: [number, number],
  p2: [number, number],
  strokeWidth: number,
  height: number
): Manifold {
  // Calculate the direction and length
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const length = Math.sqrt(dx * dx + dy * dy)

  if (length < 0.001) {
    // Points are same, just return a cylinder
    return strokeCylinder(M, height, strokeWidth).translate(p1[0], p1[1], 0)
  }

  const angle = Math.atan2(dy, dx) * (180 / Math.PI)

  // Create a capsule shape (rectangle with rounded ends)
  const radius = strokeWidth / 2

  // Build capsule profile
  const segments = 8
  const points: [number, number][] = []

  // Left semicircle
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / segments
    points.push([radius * Math.cos(a), radius * Math.sin(a)])
  }

  // Right semicircle
  for (let i = 0; i <= segments; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / segments
    points.push([length + radius * Math.cos(a), radius * Math.sin(a)])
  }

  const capsuleProfile = new M.CrossSection([points])
  const capsule = capsuleProfile.extrude(height)
    .rotate(0, 0, angle)
    .translate(p1[0], p1[1], 0)

  capsuleProfile.delete()
  return capsule
}

/**
 * Draw a path (series of connected segments)
 */
function drawPath(
  M: ManifoldToplevel,
  points: [number, number][],
  strokeWidth: number,
  height: number,
  scale: number,
  offsetX: number,
  offsetY: number
): Manifold {
  if (points.length < 2) {
    if (points.length === 1) {
      const p = points[0]!
      return strokeCylinder(M, height, strokeWidth)
        .translate(p[0] * scale + offsetX, p[1] * scale + offsetY, 0)
    }
    return M.Manifold.cube([0.001, 0.001, 0.001])
  }

  const segments: Manifold[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!
    const p2 = points[i + 1]!

    const segment = strokeSegment(
      M,
      [p1[0] * scale + offsetX, p1[1] * scale + offsetY],
      [p2[0] * scale + offsetX, p2[1] * scale + offsetY],
      strokeWidth,
      height
    )
    segments.push(segment)
  }

  // Union all segments
  let result = M.Manifold.union(segments)
  segments.forEach(s => s.delete())

  return result
}

/**
 * Render a single character
 */
function renderChar(
  M: ManifoldToplevel,
  char: string,
  size: number,
  depth: number,
  offsetX: number,
  offsetY: number
): Manifold {
  const strokeWidth = size * 0.15
  const scale = size / 6

  const paths = STROKE_FONT[char]
  if (!paths || paths.length === 0) {
    // Check if it's a dotted character (dot only)
    if (char === '.') {
      return strokeCylinder(M, depth, strokeWidth)
        .translate(2 * scale + offsetX, 0.5 * scale + offsetY, 0)
    }
    // Space or unknown character
    return M.Manifold.cube([0.001, 0.001, 0.001])
  }

  const pathManifolds: Manifold[] = []

  // Render each path in the character
  for (const path of paths) {
    const pathManifold = drawPath(M, path, strokeWidth, depth, scale, offsetX, offsetY)
    pathManifolds.push(pathManifold)
  }

  // Add dot for '!' and '.'
  if (DOTTED_CHARS.includes(char)) {
    const dotX = 2 * scale + offsetX
    const dotY = 0.5 * scale + offsetY
    const dot = strokeCylinder(M, depth, strokeWidth).translate(dotX, dotY, 0)
    pathManifolds.push(dot)
  }

  // Union all paths
  let result = M.Manifold.union(pathManifolds)
  pathManifolds.forEach(p => p.delete())

  return result
}

/**
 * Render text string
 */
function renderText(
  M: ManifoldToplevel,
  text: string,
  size: number,
  depth: number,
  offsetX: number,
  offsetY: number
): Manifold {
  const spacing = size * getCharSpacing()
  const chars: Manifold[] = []

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    const charManifold = renderChar(M, char, size, depth, offsetX + i * spacing, offsetY)
    chars.push(charManifold)
  }

  if (chars.length === 0) {
    return M.Manifold.cube([0.001, 0.001, 0.001])
  }

  let result = M.Manifold.union(chars)
  chars.forEach(c => c.delete())

  return result
}

export function buildSign(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  // Sanitize text
  const rawText = String(params['text'] || 'HELLO')
    .toUpperCase()
    .replace(/[^A-Z0-9 !.\-]/g, '')
    .trim()
  const text = rawText.length > 0 ? rawText : 'TEXT'

  const p: SignParams = {
    text,
    text_size: Number(params['text_size']) || 12,
    text_depth: Number(params['text_depth']) || 2,
    padding: Number(params['padding']) || 5,
    base_depth: Number(params['base_depth']) || 3,
    corner_radius: Number(params['corner_radius']) || 2
  }

  // Calculate dimensions
  const charSpacing = p.text_size * getCharSpacing()
  const textWidth = text.length * charSpacing
  const baseWidth = textWidth + p.padding * 2
  const baseHeight = p.text_size + p.padding * 2

  // Create base plate
  const baseProfile = roundedRect(M, baseWidth, baseHeight, p.corner_radius)
  let sign = baseProfile.extrude(p.base_depth)
  baseProfile.delete()

  // Create text
  const textManifold = renderText(M, text, p.text_size, p.text_depth, p.padding, p.padding)
    .translate(0, 0, p.base_depth)

  // Combine base and text
  const combined = sign.add(textManifold)
  sign.delete()
  textManifold.delete()

  return combined
}
