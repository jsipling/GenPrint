/**
 * Fluent Shape API for chainable geometry operations
 * Wraps Manifold with automatic memory management
 */
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { MIN_SMALL_FEATURE } from '../printingConstants'

/**
 * Bounding box representation
 */
export interface BoundingBox {
  min: [number, number, number]
  max: [number, number, number]
}

/**
 * Fluent wrapper around Manifold for chainable operations
 * Each operation returns a new Shape and auto-cleans up inputs
 */
export class Shape {
  private manifold: Manifold
  private M: ManifoldToplevel

  constructor(M: ManifoldToplevel, manifold: Manifold) {
    this.M = M
    this.manifold = manifold
  }

  // ============================================================
  // CSG Operations - return new Shape, auto-cleanup old
  // ============================================================

  /**
   * Union with another shape (add)
   * Both input shapes are consumed and cleaned up
   */
  add(other: Shape): Shape {
    const result = this.manifold.add(other.manifold)
    this.manifold.delete()
    other.manifold.delete()
    return new Shape(this.M, result)
  }

  /**
   * Subtract another shape from this one
   * Both input shapes are consumed and cleaned up
   */
  subtract(other: Shape): Shape {
    const result = this.manifold.subtract(other.manifold)
    this.manifold.delete()
    other.manifold.delete()
    return new Shape(this.M, result)
  }

  /**
   * Intersect with another shape
   * Both input shapes are consumed and cleaned up
   */
  intersect(other: Shape): Shape {
    const result = this.manifold.intersect(other.manifold)
    this.manifold.delete()
    other.manifold.delete()
    return new Shape(this.M, result)
  }

  // ============================================================
  // Transforms - return new Shape
  // ============================================================

  /**
   * Translate (move) the shape
   */
  translate(x: number, y: number, z: number): Shape {
    const result = this.manifold.translate(x, y, z)
    this.manifold.delete()
    return new Shape(this.M, result)
  }

  /**
   * Rotate the shape (angles in degrees)
   */
  rotate(x: number, y: number = 0, z: number = 0): Shape {
    const result = this.manifold.rotate([x, y, z])
    this.manifold.delete()
    return new Shape(this.M, result)
  }

  /**
   * Scale the shape uniformly or per-axis
   * If only x is provided, scales uniformly
   */
  scale(x: number, y?: number, z?: number): Shape {
    const scaleVec: [number, number, number] = [
      x,
      y !== undefined ? y : x,
      z !== undefined ? z : (y !== undefined ? y : x)
    ]
    const result = this.manifold.scale(scaleVec)
    this.manifold.delete()
    return new Shape(this.M, result)
  }

  /**
   * Mirror the shape across an axis
   */
  mirror(axis: 'x' | 'y' | 'z'): Shape {
    const scaleVec: [number, number, number] = [
      axis === 'x' ? -1 : 1,
      axis === 'y' ? -1 : 1,
      axis === 'z' ? -1 : 1
    ]
    const result = this.manifold.scale(scaleVec)
    this.manifold.delete()
    return new Shape(this.M, result)
  }

  // ============================================================
  // Patterns - create arrays of shapes
  // ============================================================

  /**
   * Create a linear pattern of this shape
   * Returns union of count copies spaced along an axis
   */
  linearPattern(count: number, spacing: number, axis: 'x' | 'y' | 'z' = 'x'): Shape {
    if (count <= 0) {
      return this
    }
    if (count === 1) {
      return this
    }

    // Clamp spacing to minimum to prevent overlapping copies
    const safeSpacing = Math.max(spacing, MIN_SMALL_FEATURE)
    const copies = []

    for (let i = 0; i < count; i++) {
      const offset = i * safeSpacing
      const translation: [number, number, number] = [
        axis === 'x' ? offset : 0,
        axis === 'y' ? offset : 0,
        axis === 'z' ? offset : 0
      ]
      copies.push(this.manifold.translate(...translation))
    }

    // Use batch union for O(1) performance
    const result = this.M.Manifold.union(copies)

    // Clean up all intermediate manifolds
    for (const copy of copies) {
      copy.delete()
    }
    this.manifold.delete()

    return new Shape(this.M, result)
  }

  /**
   * Create a circular pattern of this shape
   * Returns union of count copies rotated around an axis
   */
  circularPattern(count: number, axis: 'x' | 'y' | 'z' = 'z'): Shape {
    if (count <= 0) {
      return this
    }
    if (count === 1) {
      return this
    }

    const angleStep = 360 / count
    const copies = []

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep
      const rotation: [number, number, number] = [
        axis === 'x' ? angle : 0,
        axis === 'y' ? angle : 0,
        axis === 'z' ? angle : 0
      ]
      copies.push(this.manifold.rotate(rotation))
    }

    // Use batch union for O(1) performance
    const result = this.M.Manifold.union(copies)

    // Clean up all intermediate manifolds
    for (const copy of copies) {
      copy.delete()
    }
    this.manifold.delete()

    return new Shape(this.M, result)
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * Clone this shape (does not consume the original)
   */
  clone(): Shape {
    // Create a copy by translating 0,0,0 - returns new manifold
    const copy = this.manifold.translate(0, 0, 0)
    return new Shape(this.M, copy)
  }

  /**
   * Get the bounding box of this shape
   */
  getBoundingBox(): BoundingBox {
    const bbox = this.manifold.boundingBox()
    return {
      min: [bbox.min[0], bbox.min[1], bbox.min[2]],
      max: [bbox.max[0], bbox.max[1], bbox.max[2]]
    }
  }

  /**
   * Get the volume of this shape
   */
  getVolume(): number {
    return this.manifold.volume()
  }

  /**
   * Get the surface area of this shape
   */
  getSurfaceArea(): number {
    return this.manifold.surfaceArea()
  }

  /**
   * Check if the shape is valid (watertight manifold)
   */
  isValid(): boolean {
    return this.manifold.volume() > 0 && this.manifold.genus() >= 0
  }

  // ============================================================
  // Internal - for final output and cleanup
  // ============================================================

  /**
   * Get the raw Manifold for final build output
   * WARNING: After calling this, the Shape should not be used further
   * The caller is responsible for cleanup
   */
  build(): Manifold {
    return this.manifold
  }

  /**
   * Alias for build() for compatibility with plan
   */
  _getManifold(): Manifold {
    return this.manifold
  }

  /**
   * Explicitly free WASM memory
   * Call this when you're done with a Shape that won't be returned
   */
  delete(): void {
    this.manifold.delete()
  }

  /**
   * Alias for delete() for compatibility
   */
  _cleanup(): void {
    this.manifold.delete()
  }
}
