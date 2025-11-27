/**
 * Fluent Shape API for chainable geometry operations
 * Wraps Manifold with automatic memory management
 */
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { MIN_SMALL_FEATURE, MAX_PATTERN_COUNT } from '../printingConstants'

/**
 * Bounding box representation
 */
export interface BoundingBox {
  min: [number, number, number]
  max: [number, number, number]
}

/**
 * Coordinate frame for positioning shapes
 * Rotation is applied first, then translation
 */
export interface Frame {
  rotate?: [number, number, number]  // degrees around X, Y, Z
  translate?: [number, number, number]
}

/**
 * Options for mirrorUnion operation
 */
export interface MirrorUnionOptions {
  /** Offset to apply before mirroring (creates gap between halves) */
  offset?: number
}

/**
 * Fluent wrapper around Manifold for chainable operations
 * Each operation returns a new Shape and auto-cleans up inputs
 */
export class Shape {
  private manifold: Manifold
  private M: ManifoldToplevel
  private attachPoints: Map<string, [number, number, number]>

  constructor(M: ManifoldToplevel, manifold: Manifold, attachPoints?: Map<string, [number, number, number]>) {
    this.M = M
    this.manifold = manifold
    this.attachPoints = attachPoints ?? new Map()
  }

  // ============================================================
  // CSG Operations - return new Shape, auto-cleanup old
  // ============================================================

  /**
   * Union with another shape (add)
   * Both input shapes are consumed and cleaned up
   */
  add(other: Shape): Shape {
    try {
      const result = this.manifold.add(other.manifold)
      return new Shape(this.M, result)
    } finally {
      this.manifold.delete()
      other.manifold.delete()
    }
  }

  /**
   * Subtract another shape from this one
   * Both input shapes are consumed and cleaned up
   */
  subtract(other: Shape): Shape {
    try {
      const result = this.manifold.subtract(other.manifold)
      return new Shape(this.M, result)
    } finally {
      this.manifold.delete()
      other.manifold.delete()
    }
  }

  /**
   * Intersect with another shape
   * Both input shapes are consumed and cleaned up
   */
  intersect(other: Shape): Shape {
    try {
      const result = this.manifold.intersect(other.manifold)
      return new Shape(this.M, result)
    } finally {
      this.manifold.delete()
      other.manifold.delete()
    }
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
    // Transform attach points
    const newPoints = new Map<string, [number, number, number]>()
    for (const [name, point] of this.attachPoints) {
      newPoints.set(name, [point[0] + x, point[1] + y, point[2] + z])
    }
    return new Shape(this.M, result, newPoints)
  }

  /**
   * Rotate the shape (angles in degrees)
   */
  rotate(x: number, y: number = 0, z: number = 0): Shape {
    const result = this.manifold.rotate([x, y, z])
    this.manifold.delete()
    // Transform attach points
    const newPoints = new Map<string, [number, number, number]>()
    for (const [name, point] of this.attachPoints) {
      newPoints.set(name, rotatePoint(point, x, y, z))
    }
    return new Shape(this.M, result, newPoints)
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
    // Transform attach points
    const newPoints = new Map<string, [number, number, number]>()
    for (const [name, point] of this.attachPoints) {
      newPoints.set(name, [point[0] * scaleVec[0], point[1] * scaleVec[1], point[2] * scaleVec[2]])
    }
    return new Shape(this.M, result, newPoints)
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
    // Transform attach points
    const newPoints = new Map<string, [number, number, number]>()
    for (const [name, point] of this.attachPoints) {
      newPoints.set(name, [point[0] * scaleVec[0], point[1] * scaleVec[1], point[2] * scaleVec[2]])
    }
    return new Shape(this.M, result, newPoints)
  }

  // ============================================================
  // Patterns - create arrays of shapes
  // ============================================================

  /**
   * Create a linear pattern of this shape
   * Returns union of count copies spaced along an axis
   * @param count - Number of copies (clamped to MAX_PATTERN_COUNT)
   */
  linearPattern(count: number, spacing: number, axis: 'x' | 'y' | 'z' = 'x'): Shape {
    // Clamp count to prevent memory exhaustion
    const safeCount = Math.min(count, MAX_PATTERN_COUNT)

    if (safeCount <= 0) {
      // Return clone to maintain consistent "original is consumed" contract
      const result = this.clone()
      this.manifold.delete()
      return result
    }
    if (safeCount === 1) {
      // Return clone to maintain consistent "original is consumed" contract
      const result = this.clone()
      this.manifold.delete()
      return result
    }

    // Clamp spacing to minimum to prevent overlapping copies
    const safeSpacing = Math.max(spacing, MIN_SMALL_FEATURE)
    const copies: Manifold[] = []

    try {
      for (let i = 0; i < safeCount; i++) {
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
      return new Shape(this.M, result)
    } finally {
      // Clean up all intermediate manifolds (even on exception)
      for (const copy of copies) {
        copy.delete()
      }
      this.manifold.delete()
    }
  }

  /**
   * Create a circular pattern of this shape
   * Returns union of count copies rotated around an axis
   * @param count - Number of copies (clamped to MAX_PATTERN_COUNT)
   */
  circularPattern(count: number, axis: 'x' | 'y' | 'z' = 'z'): Shape {
    // Clamp count to prevent memory exhaustion
    const safeCount = Math.min(count, MAX_PATTERN_COUNT)

    if (safeCount <= 0) {
      // Return clone to maintain consistent "original is consumed" contract
      const result = this.clone()
      this.manifold.delete()
      return result
    }
    if (safeCount === 1) {
      // Return clone to maintain consistent "original is consumed" contract
      const result = this.clone()
      this.manifold.delete()
      return result
    }

    const angleStep = 360 / safeCount
    const copies: Manifold[] = []

    try {
      for (let i = 0; i < safeCount; i++) {
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
      return new Shape(this.M, result)
    } finally {
      // Clean up all intermediate manifolds (even on exception)
      for (const copy of copies) {
        copy.delete()
      }
      this.manifold.delete()
    }
  }

  // ============================================================
  // Mirror Union - symmetric assemblies
  // ============================================================

  /**
   * Create a symmetric union by mirroring across a plane
   * Useful for V-configurations and symmetric parts
   * @param axis - 'x' mirrors across YZ plane, 'y' across XZ, 'z' across XY
   * @param options - Optional offset to create gap between halves
   */
  mirrorUnion(axis: 'x' | 'y' | 'z', options: MirrorUnionOptions = {}): Shape {
    const { offset = 0 } = options

    // If offset is specified, translate shape by offset/2 first
    let workingManifold = this.manifold
    if (offset !== 0) {
      const halfOffset = offset / 2
      const translation: [number, number, number] = [
        axis === 'x' ? halfOffset : 0,
        axis === 'y' ? halfOffset : 0,
        axis === 'z' ? halfOffset : 0
      ]
      workingManifold = this.manifold.translate(...translation)
      this.manifold.delete()
    }

    // Create mirrored copy
    const scaleVec: [number, number, number] = [
      axis === 'x' ? -1 : 1,
      axis === 'y' ? -1 : 1,
      axis === 'z' ? -1 : 1
    ]
    const mirrored = workingManifold.scale(scaleVec)

    // Union original and mirrored
    const result = this.M.Manifold.union([workingManifold, mirrored])

    // Cleanup
    workingManifold.delete()
    mirrored.delete()

    return new Shape(this.M, result)
  }

  // ============================================================
  // Coordinate Frames - positioned assemblies
  // ============================================================

  /**
   * Apply a coordinate frame transform to this shape
   * Rotation is applied first, then translation
   * @param frame - Frame with optional rotate and translate components
   */
  inFrame(frame: Frame): Shape {
    let result = this.manifold
    let wasTransformed = false

    // Apply rotation first
    if (frame.rotate) {
      const rotated = result.rotate(frame.rotate)
      if (wasTransformed) {
        result.delete()
      }
      result = rotated
      wasTransformed = true
    }

    // Then apply translation
    if (frame.translate) {
      const translated = result.translate(...frame.translate)
      if (wasTransformed) {
        result.delete()
      }
      result = translated
      wasTransformed = true
    }

    // Transform attach points
    const newPoints = new Map<string, [number, number, number]>()
    for (const [name, point] of this.attachPoints) {
      let transformedPoint = point
      if (frame.rotate) {
        transformedPoint = rotatePoint(transformedPoint, frame.rotate[0], frame.rotate[1], frame.rotate[2])
      }
      if (frame.translate) {
        transformedPoint = [
          transformedPoint[0] + frame.translate[0],
          transformedPoint[1] + frame.translate[1],
          transformedPoint[2] + frame.translate[2]
        ]
      }
      newPoints.set(name, transformedPoint)
    }

    // If no transforms applied, clone to maintain ownership contract
    if (!wasTransformed) {
      result = this.manifold.translate(0, 0, 0)
    }

    this.manifold.delete()
    return new Shape(this.M, result, newPoints)
  }

  // ============================================================
  // Attach Points - assembly joints
  // ============================================================

  /**
   * Define a named attachment point on this shape
   * Points are preserved through transforms
   * @param name - Name of the attachment point
   * @param position - [x, y, z] coordinates relative to shape origin
   */
  definePoint(name: string, position: [number, number, number]): Shape {
    const newPoints = new Map(this.attachPoints)
    newPoints.set(name, [...position] as [number, number, number])
    return new Shape(this.M, this.manifold, newPoints)
  }

  /**
   * Get a named attachment point
   * @param name - Name of the attachment point
   * @returns [x, y, z] position or undefined if not found
   */
  getPoint(name: string): [number, number, number] | undefined {
    const point = this.attachPoints.get(name)
    return point ? [...point] as [number, number, number] : undefined
  }

  /**
   * Position this shape by aligning an attachment point to a target point
   * @param target - Target shape with attachment point
   * @param myPoint - Name of attachment point on this shape
   * @param targetPoint - Name of attachment point on target shape
   */
  alignTo(target: Shape, myPoint: string, targetPoint: string): Shape {
    const myPointPos = this.getPoint(myPoint)
    const targetPointPos = target.getPoint(targetPoint)

    if (!myPointPos || !targetPointPos) {
      // If points not found, return clone unchanged
      return this.clone()
    }

    // Calculate translation to align points
    const dx = targetPointPos[0] - myPointPos[0]
    const dy = targetPointPos[1] - myPointPos[1]
    const dz = targetPointPos[2] - myPointPos[2]

    return this.translate(dx, dy, dz)
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
    // Clone attach points
    const newPoints = new Map(this.attachPoints)
    return new Shape(this.M, copy, newPoints)
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
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Rotate a point around the origin by angles in degrees (X, Y, Z order)
 */
function rotatePoint(point: [number, number, number], xDeg: number, yDeg: number, zDeg: number): [number, number, number] {
  const toRad = Math.PI / 180
  const xRad = xDeg * toRad
  const yRad = yDeg * toRad
  const zRad = zDeg * toRad

  let [x, y, z] = point

  // Rotate around X axis
  if (xRad !== 0) {
    const cosX = Math.cos(xRad)
    const sinX = Math.sin(xRad)
    const newY = y * cosX - z * sinX
    const newZ = y * sinX + z * cosX
    y = newY
    z = newZ
  }

  // Rotate around Y axis
  if (yRad !== 0) {
    const cosY = Math.cos(yRad)
    const sinY = Math.sin(yRad)
    const newX = x * cosY + z * sinY
    const newZ = -x * sinY + z * cosY
    x = newX
    z = newZ
  }

  // Rotate around Z axis
  if (zRad !== 0) {
    const cosZ = Math.cos(zRad)
    const sinZ = Math.sin(zRad)
    const newX = x * cosZ - y * sinZ
    const newY = x * sinZ + y * cosZ
    x = newX
    y = newY
  }

  return [x, y, z]
}
