/**
 * Fluent 2D Sketch API for building cross-sections
 * Wraps Manifold's CrossSection with automatic memory management
 */
import type { ManifoldToplevel, CrossSection as ManifoldCrossSection } from 'manifold-3d'
import { Shape } from './Shape'

/**
 * Options for extrude operation
 */
export interface ExtrudeOptions {
  /** Degrees to twist top relative to bottom */
  twist?: number
  /** Scale factor for top (0 = cone) */
  scale?: number
  /** Intermediate slices for smooth twist */
  divisions?: number
}

/**
 * Fluent 2D sketch builder wrapping CrossSection
 * Each operation returns a new Sketch and auto-cleans up inputs
 */
export class Sketch {
  private crossSection: ManifoldCrossSection
  private M: ManifoldToplevel
  private consumed = false
  private consumedBy = ''

  constructor(M: ManifoldToplevel, crossSection: ManifoldCrossSection) {
    this.M = M
    this.crossSection = crossSection
  }

  // ============================================================
  // Static Primitives
  // ============================================================

  /**
   * Create a rectangle
   * @param M - Manifold module
   * @param width - Width (X dimension)
   * @param height - Height (Y dimension)
   */
  static rectangle(M: ManifoldToplevel, width: number, height: number): Sketch {
    const hw = width / 2
    const hh = height / 2
    const points: [number, number][] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh]
    ]
    const crossSection = new M.CrossSection([points])
    return new Sketch(M, crossSection)
  }

  /**
   * Create a circle
   * @param M - Manifold module
   * @param radius - Circle radius
   * @param segments - Number of segments (default: 32)
   */
  static circle(M: ManifoldToplevel, radius: number, segments: number = 32): Sketch {
    const crossSection = M.CrossSection.circle(radius, segments)
    return new Sketch(M, crossSection)
  }

  /**
   * Create a polygon from points
   * @param M - Manifold module
   * @param points - Array of [x, y] coordinates
   */
  static polygon(M: ManifoldToplevel, points: [number, number][]): Sketch {
    const crossSection = new M.CrossSection([points])
    return new Sketch(M, crossSection)
  }

  /**
   * Create a slot (stadium shape)
   * @param M - Manifold module
   * @param length - Total length from end to end
   * @param width - Width of the slot
   * @param segments - Segments per semicircle (default: 16)
   */
  static slot(M: ManifoldToplevel, length: number, width: number, segments: number = 16): Sketch {
    const radius = width / 2
    const straightLength = length - width // Length of straight section

    if (straightLength <= 0) {
      // Just a circle if length <= width
      return Sketch.circle(M, radius, segments * 2)
    }

    // Build points for stadium shape
    const points: [number, number][] = []
    const halfStraight = straightLength / 2

    // Right semicircle (from bottom to top)
    for (let i = 0; i <= segments; i++) {
      const angle = -Math.PI / 2 + (Math.PI * i / segments)
      const x = halfStraight + radius * Math.cos(angle)
      const y = radius * Math.sin(angle)
      points.push([x, y])
    }

    // Left semicircle (from top to bottom)
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI / 2 + (Math.PI * i / segments)
      const x = -halfStraight + radius * Math.cos(angle)
      const y = radius * Math.sin(angle)
      points.push([x, y])
    }

    const crossSection = new M.CrossSection([points])
    return new Sketch(M, crossSection)
  }

  /**
   * Create convex hull of multiple sketches
   * @param M - Manifold module
   * @param sketches - Sketches to hull together
   */
  static hull(M: ManifoldToplevel, ...sketches: Sketch[]): Sketch {
    if (sketches.length === 0) {
      // Return empty sketch
      return new Sketch(M, new M.CrossSection([]))
    }

    const crossSections = sketches.map(s => {
      s.assertNotConsumed()
      return s.crossSection
    })

    const result = M.CrossSection.hull(crossSections)

    // Clean up and mark consumed
    for (let i = 0; i < sketches.length; i++) {
      crossSections[i]!.delete()
      sketches[i]!.markConsumed('hull()')
    }

    return new Sketch(M, result)
  }

  // ============================================================
  // Consumption Safety
  // ============================================================

  private markConsumed(operationName: string): void {
    this.consumed = true
    this.consumedBy = operationName
  }

  private assertNotConsumed(): void {
    if (this.consumed) {
      throw new Error(
        `Sketch has already been consumed by '${this.consumedBy}'. ` +
        `Use .clone() if you need to reuse this geometry.`
      )
    }
  }

  /**
   * Check if this sketch has been consumed
   */
  isConsumed(): boolean {
    return this.consumed
  }

  /**
   * Mark this sketch as consumed (for use by operations)
   * @internal
   */
  _markConsumed(operationName: string): void {
    this.consumed = true
    this.consumedBy = operationName
  }

  // ============================================================
  // Transforms
  // ============================================================

  /**
   * Translate (alias for positioning)
   * @param x - X offset
   * @param y - Y offset
   */
  at(x: number, y: number): Sketch {
    return this.translate(x, y)
  }

  /**
   * Translate the sketch
   * @param x - X offset
   * @param y - Y offset
   */
  translate(x: number, y: number): Sketch {
    this.assertNotConsumed()
    const result = this.crossSection.translate([x, y])
    this.crossSection.delete()
    this.markConsumed('translate()')
    return new Sketch(this.M, result)
  }

  /**
   * Rotate the sketch
   * @param degrees - Rotation angle in degrees
   */
  rotate(degrees: number): Sketch {
    this.assertNotConsumed()
    const result = this.crossSection.rotate(degrees)
    this.crossSection.delete()
    this.markConsumed('rotate()')
    return new Sketch(this.M, result)
  }

  /**
   * Scale the sketch
   * @param factor - Uniform scale factor, or X scale
   * @param y - Optional Y scale (if provided, first arg is X scale)
   */
  scale(factor: number, y?: number): Sketch {
    this.assertNotConsumed()
    const scaleVec: [number, number] = y !== undefined ? [factor, y] : [factor, factor]
    const result = this.crossSection.scale(scaleVec)
    this.crossSection.delete()
    this.markConsumed('scale()')
    return new Sketch(this.M, result)
  }

  /**
   * Mirror the sketch across an axis
   * @param axis - 'x' mirrors across Y axis, 'y' mirrors across X axis
   */
  mirror(axis: 'x' | 'y'): Sketch {
    this.assertNotConsumed()
    const scaleVec: [number, number] = axis === 'x' ? [-1, 1] : [1, -1]
    const result = this.crossSection.scale(scaleVec)
    this.crossSection.delete()
    this.markConsumed('mirror()')
    return new Sketch(this.M, result)
  }

  // ============================================================
  // Boolean Operations
  // ============================================================

  /**
   * Union with another sketch
   * @param other - Sketch to add
   */
  add(other: Sketch): Sketch {
    this.assertNotConsumed()
    other.assertNotConsumed()
    try {
      const result = this.crossSection.add(other.crossSection)
      return new Sketch(this.M, result)
    } finally {
      this.crossSection.delete()
      this.markConsumed('add()')
      other.crossSection.delete()
      other.markConsumed('add()')
    }
  }

  /**
   * Subtract other sketches from this one
   * @param others - Sketches to subtract
   */
  subtract(...others: Sketch[]): Sketch {
    this.assertNotConsumed()
    for (const other of others) {
      other.assertNotConsumed()
    }

    let result = this.crossSection
    let wasTransformed = false

    try {
      for (const other of others) {
        const newResult = result.subtract(other.crossSection)
        if (wasTransformed) {
          result.delete()
        }
        result = newResult
        wasTransformed = true
        other.crossSection.delete()
        other.markConsumed('subtract()')
      }

      if (!wasTransformed) {
        // No subtraction happened, clone to maintain ownership contract
        result = this.crossSection.translate([0, 0])
      }

      return new Sketch(this.M, result)
    } finally {
      if (!wasTransformed) {
        this.crossSection.delete()
      }
      this.markConsumed('subtract()')
    }
  }

  /**
   * Intersect with another sketch
   * @param other - Sketch to intersect with
   */
  intersect(other: Sketch): Sketch {
    this.assertNotConsumed()
    other.assertNotConsumed()
    try {
      const result = this.crossSection.intersect(other.crossSection)
      return new Sketch(this.M, result)
    } finally {
      this.crossSection.delete()
      this.markConsumed('intersect()')
      other.crossSection.delete()
      other.markConsumed('intersect()')
    }
  }

  // ============================================================
  // Modifiers
  // ============================================================

  /**
   * Round corners using offset operations
   * Uses offset(-r).offset(+r) with round join type
   * @param radius - Corner radius
   */
  roundCorners(radius: number): Sketch {
    this.assertNotConsumed()
    if (radius <= 0) {
      // No rounding, return clone
      const result = this.crossSection.translate([0, 0])
      this.crossSection.delete()
      this.markConsumed('roundCorners()')
      return new Sketch(this.M, result)
    }

    // Contract then expand with round joins
    // Use 'Round' join type from Manifold
    const contracted = this.crossSection.offset(-radius, 'Round')
    const expanded = contracted.offset(radius, 'Round')
    contracted.delete()

    this.crossSection.delete()
    this.markConsumed('roundCorners()')
    return new Sketch(this.M, expanded)
  }

  /**
   * Offset (expand/contract) the sketch outline
   * @param delta - Positive expands, negative contracts
   */
  offset(delta: number): Sketch {
    this.assertNotConsumed()
    // Use 'Round' join type
    const result = this.crossSection.offset(delta, 'Round')
    this.crossSection.delete()
    this.markConsumed('offset()')
    return new Sketch(this.M, result)
  }

  // ============================================================
  // 3D Conversion
  // ============================================================

  /**
   * Extrude the sketch to create a 3D shape
   * @param height - Extrusion height
   * @param options - Optional twist, scale, and division settings
   */
  extrude(height: number, options?: ExtrudeOptions): Shape {
    this.assertNotConsumed()
    const twist = options?.twist ?? 0
    const scale = options?.scale ?? 1
    const divisions = options?.divisions ?? 0

    let manifold
    if (twist !== 0 || scale !== 1) {
      // Use extrude with transforms
      manifold = this.crossSection.extrude(height, divisions, twist, [scale, scale])
    } else {
      // Simple extrude
      manifold = this.crossSection.extrude(height)
    }

    this.crossSection.delete()
    this.markConsumed('extrude()')
    return new Shape(this.M, manifold)
  }

  /**
   * Revolve the sketch around the Y axis
   * @param degrees - Revolution angle (default: 360 for full revolution)
   * @param segments - Number of segments (default: 32)
   */
  revolve(degrees: number = 360, segments: number = 32): Shape {
    this.assertNotConsumed()
    const manifold = this.crossSection.revolve(segments, degrees)
    this.crossSection.delete()
    this.markConsumed('revolve()')
    return new Shape(this.M, manifold)
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * Clone this sketch (does not consume the original)
   */
  clone(): Sketch {
    this.assertNotConsumed()
    const copy = this.crossSection.translate([0, 0])
    return new Sketch(this.M, copy)
  }

  /**
   * Get the area of this sketch
   */
  getArea(): number {
    this.assertNotConsumed()
    return this.crossSection.area()
  }

  /**
   * Get the bounding box of this sketch
   */
  getBounds(): { min: [number, number], max: [number, number] } {
    this.assertNotConsumed()
    const rect = this.crossSection.bounds()
    return {
      min: [rect.min[0], rect.min[1]],
      max: [rect.max[0], rect.max[1]]
    }
  }

  /**
   * Explicitly free WASM memory
   */
  delete(): void {
    this.crossSection.delete()
  }
}
