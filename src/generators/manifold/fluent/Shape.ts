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
 * Options for cylindrical positioning
 */
export interface CylindricalOptions {
  /** Axis for height direction (default: 'y') */
  axis?: 'x' | 'y' | 'z'
}

/**
 * Options for overlap checking
 */
export interface OverlapOptions {
  /** Minimum intersection volume to consider as overlap (default: 0.001 mm³) */
  minVolume?: number
}

/**
 * Direction for connectTo operation
 */
export type Direction = '-x' | '+x' | '-y' | '+y' | '-z' | '+z'

/**
 * Options for connectTo operation
 */
export interface ConnectToOptions {
  /** How much to overlap with target (in mm) */
  overlap: number
  /** Direction to approach from */
  direction: Direction
  /** Position on target to connect to (default: [0, 0, 0]) */
  at?: [number, number, number]
  /** Align shape's axis with the connection direction */
  alignAxis?: 'length' | 'width' | 'height' | 'none'
  /** Coordinate frame for 'at' (default: 'world') */
  frame?: 'world' | 'target'
}

/**
 * Named surface identifiers for snapTo
 */
export type SurfaceName = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back'

/**
 * Options for snapTo operation
 */
export interface SnapToOptions {
  /** Surface to snap to (named surface or normal vector) */
  surface: SurfaceName
  /** Position on the surface (2D coordinates in surface plane) */
  at?: [number, number]
  /** Penetration depth: negative = gap, positive = embed (default: 0) */
  penetrate?: number
}

/**
 * Fluent wrapper around Manifold for chainable operations
 * Each operation returns a new Shape and auto-cleans up inputs
 */
/**
 * Options for Shape constructor
 */
export interface ShapeOptions {
  attachPoints?: Map<string, [number, number, number]>
  name?: string
  /** Tracked parts for assembly diagnostics (set by union()) */
  trackedParts?: Map<string, Shape>
}

/**
 * Alignment options for X axis
 */
export type XAlign = 'left' | 'center' | 'right' | 'none'

/**
 * Alignment options for Y axis
 */
export type YAlign = 'front' | 'center' | 'back' | 'none'

/**
 * Alignment options for Z axis
 */
export type ZAlign = 'bottom' | 'center' | 'top' | 'none'

/**
 * Color as RGB or RGBA tuple (0-1 range)
 */
export type ShapeColor = [number, number, number] | [number, number, number, number]

export class Shape {
  private manifold: Manifold
  private M: ManifoldToplevel
  private attachPoints: Map<string, [number, number, number]>
  private _name?: string
  private trackedParts: Map<string, Shape>
  private consumed = false
  private consumedBy = ''
  private _color?: ShapeColor

  constructor(
    M: ManifoldToplevel,
    manifold: Manifold,
    attachPoints?: Map<string, [number, number, number]>,
    name?: string,
    trackedParts?: Map<string, Shape>
  ) {
    this.M = M
    this.manifold = manifold
    this.attachPoints = attachPoints ?? new Map()
    this._name = name
    this.trackedParts = trackedParts ?? new Map()
  }

  // ============================================================
  // Consumption Safety
  // ============================================================

  /**
   * Mark this shape as consumed by an operation
   * @param operationName - Name of the operation that consumed this shape
   */
  private markConsumed(operationName: string): void {
    this.consumed = true
    this.consumedBy = operationName
  }

  /**
   * Assert that this shape has not been consumed
   * @throws Error if the shape has been consumed
   */
  private assertNotConsumed(): void {
    if (this.consumed) {
      const name = this._name ? `Shape '${this._name}'` : 'Shape'
      throw new Error(
        `${name} has already been consumed by '${this.consumedBy}'. ` +
        `Use .clone() if you need to reuse this geometry.`
      )
    }
  }

  /**
   * Check if this shape has been consumed
   * @returns true if the shape has been consumed
   */
  isConsumed(): boolean {
    return this.consumed
  }

  /**
   * Mark this shape as consumed (for use by operations that consume shapes)
   * @internal
   */
  _markConsumed(operationName: string): void {
    this.consumed = true
    this.consumedBy = operationName
  }

  // ============================================================
  // Named Parts
  // ============================================================

  /**
   * Set a name for this shape (for debugging and findDisconnected)
   * @param name - Name to identify this shape
   */
  name(name: string): Shape {
    return new Shape(this.M, this.manifold, this.attachPoints, name)
  }

  /**
   * Get the name of this shape
   * @returns Name or undefined if not named
   */
  getName(): string | undefined {
    return this._name
  }

  /**
   * Get names of all tracked parts (from union operations)
   * Used for assembly diagnostics in assertConnected()
   * @returns Array of part names
   */
  getTrackedParts(): string[] {
    return Array.from(this.trackedParts.keys())
  }

  /**
   * Get cloned parts for diagnostics (from union operations)
   * Each clone can be used to check overlap with the merged body
   * @returns Map of part name to cloned Shape
   */
  getTrackedPartClones(): Map<string, Shape> {
    return this.trackedParts
  }

  // ============================================================
  // CSG Operations - return new Shape, auto-cleanup old
  // ============================================================

  /**
   * Union with another shape (add)
   * Both input shapes are consumed and cleaned up
   */
  add(other: Shape): Shape {
    this.assertNotConsumed()
    other.assertNotConsumed()
    try {
      const result = this.manifold.add(other.manifold)
      return new Shape(this.M, result)
    } finally {
      this.manifold.delete()
      this.markConsumed('add()')
      other.manifold.delete()
      other.markConsumed('add()')
    }
  }

  /**
   * Subtract another shape from this one
   * Both input shapes are consumed and cleaned up
   */
  subtract(other: Shape): Shape {
    this.assertNotConsumed()
    other.assertNotConsumed()
    try {
      const result = this.manifold.subtract(other.manifold)
      return new Shape(this.M, result)
    } finally {
      this.manifold.delete()
      this.markConsumed('subtract()')
      other.manifold.delete()
      other.markConsumed('subtract()')
    }
  }

  /**
   * Intersect with another shape
   * Both input shapes are consumed and cleaned up
   */
  intersect(other: Shape): Shape {
    this.assertNotConsumed()
    other.assertNotConsumed()
    try {
      const result = this.manifold.intersect(other.manifold)
      return new Shape(this.M, result)
    } finally {
      this.manifold.delete()
      this.markConsumed('intersect()')
      other.manifold.delete()
      other.markConsumed('intersect()')
    }
  }

  // ============================================================
  // Transforms - return new Shape
  // ============================================================

  /**
   * Translate (move) the shape
   */
  translate(x: number, y: number, z: number): Shape {
    this.assertNotConsumed()
    const result = this.manifold.translate(x, y, z)
    this.manifold.delete()
    this.markConsumed('translate()')
    // Transform attach points
    const newPoints = new Map<string, [number, number, number]>()
    for (const [name, point] of this.attachPoints) {
      newPoints.set(name, [point[0] + x, point[1] + y, point[2] + z])
    }
    // Transform tracked parts (they need to be translated too for accurate touch detection)
    const newTrackedParts = new Map<string, Shape>()
    for (const [name, part] of this.trackedParts) {
      newTrackedParts.set(name, part.translate(x, y, z))
    }
    return new Shape(this.M, result, newPoints, this._name, newTrackedParts)
  }

  /**
   * Rotate the shape (angles in degrees)
   */
  rotate(x: number, y: number = 0, z: number = 0): Shape {
    this.assertNotConsumed()
    const result = this.manifold.rotate([x, y, z])
    this.manifold.delete()
    this.markConsumed('rotate()')
    // Transform attach points
    const newPoints = new Map<string, [number, number, number]>()
    for (const [name, point] of this.attachPoints) {
      newPoints.set(name, rotatePoint(point, x, y, z))
    }
    return new Shape(this.M, result, newPoints, this._name)
  }

  /**
   * Scale the shape uniformly or per-axis
   * If only x is provided, scales uniformly
   */
  scale(x: number, y?: number, z?: number): Shape {
    this.assertNotConsumed()
    const scaleVec: [number, number, number] = [
      x,
      y !== undefined ? y : x,
      z !== undefined ? z : (y !== undefined ? y : x)
    ]
    const result = this.manifold.scale(scaleVec)
    this.manifold.delete()
    this.markConsumed('scale()')
    // Transform attach points
    const newPoints = new Map<string, [number, number, number]>()
    for (const [name, point] of this.attachPoints) {
      newPoints.set(name, [point[0] * scaleVec[0], point[1] * scaleVec[1], point[2] * scaleVec[2]])
    }
    return new Shape(this.M, result, newPoints, this._name)
  }

  /**
   * Mirror the shape across an axis
   */
  mirror(axis: 'x' | 'y' | 'z'): Shape {
    this.assertNotConsumed()
    const scaleVec: [number, number, number] = [
      axis === 'x' ? -1 : 1,
      axis === 'y' ? -1 : 1,
      axis === 'z' ? -1 : 1
    ]
    const result = this.manifold.scale(scaleVec)
    this.manifold.delete()
    this.markConsumed('mirror()')
    // Transform attach points
    const newPoints = new Map<string, [number, number, number]>()
    for (const [name, point] of this.attachPoints) {
      newPoints.set(name, [point[0] * scaleVec[0], point[1] * scaleVec[1], point[2] * scaleVec[2]])
    }
    return new Shape(this.M, result, newPoints, this._name)
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
    this.assertNotConsumed()
    // Clamp count to prevent memory exhaustion
    const safeCount = Math.min(count, MAX_PATTERN_COUNT)

    if (safeCount <= 0) {
      // Return clone to maintain consistent "original is consumed" contract
      const result = this.clone()
      this.manifold.delete()
      this.markConsumed('linearPattern()')
      return result
    }
    if (safeCount === 1) {
      // Return clone to maintain consistent "original is consumed" contract
      const result = this.clone()
      this.manifold.delete()
      this.markConsumed('linearPattern()')
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
      this.markConsumed('linearPattern()')
    }
  }

  /**
   * Create a circular pattern of this shape
   * Returns union of count copies rotated around an axis
   * @param count - Number of copies (clamped to MAX_PATTERN_COUNT)
   */
  circularPattern(count: number, axis: 'x' | 'y' | 'z' = 'z'): Shape {
    this.assertNotConsumed()
    // Clamp count to prevent memory exhaustion
    const safeCount = Math.min(count, MAX_PATTERN_COUNT)

    if (safeCount <= 0) {
      // Return clone to maintain consistent "original is consumed" contract
      const result = this.clone()
      this.manifold.delete()
      this.markConsumed('circularPattern()')
      return result
    }
    if (safeCount === 1) {
      // Return clone to maintain consistent "original is consumed" contract
      const result = this.clone()
      this.manifold.delete()
      this.markConsumed('circularPattern()')
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
      this.markConsumed('circularPattern()')
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
    this.assertNotConsumed()
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
    this.markConsumed('mirrorUnion()')

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
    this.assertNotConsumed()
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
    this.markConsumed('inFrame()')
    return new Shape(this.M, result, newPoints, this._name)
  }

  // ============================================================
  // Polar/Cylindrical Positioning
  // ============================================================

  /**
   * Position by angle and radius in a plane
   * Natural for rotary assemblies (engines, gearboxes, turbines)
   * @param angle - Angle in degrees
   * @param radius - Distance from origin
   * @param plane - Plane for polar coordinates (default: 'xz')
   */
  polar(angle: number, radius: number, plane: 'xy' | 'xz' | 'yz' = 'xz'): Shape {
    const rad = angle * Math.PI / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    let dx = 0, dy = 0, dz = 0
    switch (plane) {
      case 'xy':
        dx = radius * cos
        dy = radius * sin
        break
      case 'xz':
        dx = radius * sin
        dz = radius * cos
        break
      case 'yz':
        dy = radius * cos
        dz = radius * sin
        break
    }

    return this.translate(dx, dy, dz)
  }

  /**
   * Position by angle, radius, and height (cylindrical coordinates)
   * Natural for engine geometry where positions are angle + radius + Y offset
   * @param angle - Angle in degrees
   * @param radius - Distance from axis
   * @param height - Position along the axis
   * @param options - Configuration options
   */
  cylindrical(angle: number, radius: number, height: number, options?: CylindricalOptions): Shape {
    const axis = options?.axis ?? 'y'
    const rad = angle * Math.PI / 180

    let dx = 0, dy = 0, dz = 0
    switch (axis) {
      case 'x': // Height along X, radius in YZ plane
        dx = height
        dy = radius * Math.cos(rad)
        dz = radius * Math.sin(rad)
        break
      case 'y': // Height along Y, radius in XZ plane
        dx = radius * Math.sin(rad)
        dy = height
        dz = radius * Math.cos(rad)
        break
      case 'z': // Height along Z, radius in XY plane
        dx = radius * Math.cos(rad)
        dy = radius * Math.sin(rad)
        dz = height
        break
    }

    return this.translate(dx, dy, dz)
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
  alignToPoint(target: Shape, myPoint: string, targetPoint: string): Shape {
    this.assertNotConsumed()
    const myPointPos = this.getPoint(myPoint)
    const targetPointPos = target.getPoint(targetPoint)

    if (!myPointPos || !targetPointPos) {
      // Warn in dev mode to help catch typos
      if (process.env.NODE_ENV !== 'production') {
        if (!myPointPos) {
          console.warn(`alignToPoint: point '${myPoint}' not found on source shape`)
        }
        if (!targetPointPos) {
          console.warn(`alignToPoint: point '${targetPoint}' not found on target shape`)
        }
      }
      return this.clone()
    }

    // Calculate translation to align points
    const dx = targetPointPos[0] - myPointPos[0]
    const dy = targetPointPos[1] - myPointPos[1]
    const dz = targetPointPos[2] - myPointPos[2]

    return this.translate(dx, dy, dz)
  }

  /**
   * @deprecated Use alignToPoint() for point-based alignment
   */
  alignTo(target: Shape, myPoint: string, targetPoint: string): Shape
  /**
   * Align this shape relative to another shape (face-to-face alignment)
   */
  alignTo(target: Shape, x: XAlign, y: YAlign, z: ZAlign): Shape
  alignTo(target: Shape, arg2: string | XAlign, arg3: string | YAlign, arg4?: string | ZAlign): Shape {
    this.assertNotConsumed()

    // Detect which overload is being used
    // If arg4 is undefined, it's the old 3-arg point-based alignment
    // If arg4 is defined and is a ZAlign, it's the new face-to-face alignment
    if (arg4 === undefined) {
      // Old point-based alignment: alignTo(target, myPoint, targetPoint)
      return this.alignToPoint(target, arg2 as string, arg3 as string)
    }

    // New face-to-face alignment: alignTo(target, x, y, z)
    const x = arg2 as XAlign
    const y = arg3 as YAlign
    const z = arg4 as ZAlign

    const thisBbox = this.getBoundingBox()
    const targetBbox = target.getBoundingBox()

    let dx = 0, dy = 0, dz = 0

    // Calculate X offset
    switch (x) {
      case 'left':
        dx = targetBbox.min[0] - thisBbox.min[0]
        break
      case 'center':
        dx = ((targetBbox.min[0] + targetBbox.max[0]) / 2) - ((thisBbox.min[0] + thisBbox.max[0]) / 2)
        break
      case 'right':
        dx = targetBbox.max[0] - thisBbox.max[0]
        break
      case 'none':
        dx = 0
        break
    }

    // Calculate Y offset
    switch (y) {
      case 'front':
        dy = targetBbox.min[1] - thisBbox.min[1]
        break
      case 'center':
        dy = ((targetBbox.min[1] + targetBbox.max[1]) / 2) - ((thisBbox.min[1] + thisBbox.max[1]) / 2)
        break
      case 'back':
        dy = targetBbox.max[1] - thisBbox.max[1]
        break
      case 'none':
        dy = 0
        break
    }

    // Calculate Z offset
    switch (z) {
      case 'bottom':
        dz = targetBbox.min[2] - thisBbox.min[2]
        break
      case 'center':
        dz = ((targetBbox.min[2] + targetBbox.max[2]) / 2) - ((thisBbox.min[2] + thisBbox.max[2]) / 2)
        break
      case 'top':
        dz = targetBbox.max[2] - thisBbox.max[2]
        break
      case 'none':
        dz = 0
        break
    }

    return this.translate(dx, dy, dz)
  }

  // ============================================================
  // Assembly Positioning
  // ============================================================

  /**
   * Connect this shape to a target with specified overlap
   * Automatically positions the shape to overlap the target by the specified amount
   * @param target - Shape to connect to (not consumed)
   * @param options - Connection options
   */
  connectTo(target: Shape, options: ConnectToOptions): Shape {
    const { overlap, direction, at = [0, 0, 0], alignAxis = 'length' } = options

    // Get target bounding box to find surface positions
    const targetBbox = target.getBoundingBox()

    // Determine the axis and sign from direction
    const axis = direction[1] as 'x' | 'y' | 'z'
    const isNegative = direction[0] === '-'

    // First, optionally rotate to align with direction
    let shape: Shape = this
    if (alignAxis === 'length') {
      // Rotate to align Z axis (length) with the target direction
      switch (axis) {
        case 'x':
          shape = this.rotate(0, isNegative ? -90 : 90, 0)
          break
        case 'y':
          shape = this.rotate(isNegative ? 90 : -90, 0, 0)
          break
        case 'z':
          // Z is already the length axis, just flip if needed
          if (isNegative) {
            shape = this.rotate(180, 0, 0)
          } else {
            // No rotation needed, but we need to consume the manifold consistently
            shape = this.translate(0, 0, 0)
          }
          break
      }
    } else {
      // No alignment, just consume the manifold consistently
      shape = this.translate(0, 0, 0)
    }

    // Get our bounding box after rotation
    const shapeBbox = shape.getBoundingBox()

    // Calculate translation to position shape
    let dx = at[0]
    let dy = at[1]
    let dz = at[2]

    // Position based on direction
    switch (direction) {
      case '-x': {
        // Position to the left of target, overlapping by `overlap`
        const targetLeftFace = targetBbox.min[0]
        const shapeRightFace = shapeBbox.max[0]
        // We want shapeRightFace to be at targetLeftFace + overlap
        dx += targetLeftFace + overlap - shapeRightFace
        break
      }
      case '+x': {
        // Position to the right of target, overlapping by `overlap`
        const targetRightFace = targetBbox.max[0]
        const shapeLeftFace = shapeBbox.min[0]
        dx += targetRightFace - overlap - shapeLeftFace
        break
      }
      case '-y': {
        const targetFrontFace = targetBbox.min[1]
        const shapeBackFace = shapeBbox.max[1]
        dy += targetFrontFace + overlap - shapeBackFace
        break
      }
      case '+y': {
        const targetBackFace = targetBbox.max[1]
        const shapeFrontFace = shapeBbox.min[1]
        dy += targetBackFace - overlap - shapeFrontFace
        break
      }
      case '-z': {
        const targetBottomFace = targetBbox.min[2]
        const shapeTopFace = shapeBbox.max[2]
        dz += targetBottomFace + overlap - shapeTopFace
        break
      }
      case '+z': {
        const targetTopFace = targetBbox.max[2]
        const shapeBottomFace = shapeBbox.min[2]
        dz += targetTopFace - overlap - shapeBottomFace
        break
      }
    }

    return shape.translate(dx, dy, dz)
  }

  /**
   * Snap this shape flush against a target's surface
   * Used for fasteners, bosses, and surface-mounted features
   * @param target - Shape to snap to (not consumed)
   * @param options - Snap options
   */
  snapTo(target: Shape, options: SnapToOptions): Shape {
    const { surface, at = [0, 0], penetrate = 0 } = options

    // Get target bounding box
    const targetBbox = target.getBoundingBox()

    // Get our bounding box
    const shapeBbox = this.getBoundingBox()

    // Calculate translation based on surface
    let dx = 0, dy = 0, dz = 0

    switch (surface) {
      case 'top': {
        // Place on top surface (Z max)
        const targetTop = targetBbox.max[2]
        const shapeBottom = shapeBbox.min[2]
        dx = at[0]
        dy = at[1]
        dz = targetTop - shapeBottom - penetrate
        break
      }
      case 'bottom': {
        // Place on bottom surface (Z min)
        const targetBottom = targetBbox.min[2]
        const shapeTop = shapeBbox.max[2]
        dx = at[0]
        dy = at[1]
        dz = targetBottom - shapeTop + penetrate
        break
      }
      case 'right': {
        // Place on right surface (X max)
        const targetRight = targetBbox.max[0]
        const shapeLeft = shapeBbox.min[0]
        dx = targetRight - shapeLeft - penetrate
        dy = at[0]
        dz = at[1]
        break
      }
      case 'left': {
        // Place on left surface (X min)
        const targetLeft = targetBbox.min[0]
        const shapeRight = shapeBbox.max[0]
        dx = targetLeft - shapeRight + penetrate
        dy = at[0]
        dz = at[1]
        break
      }
      case 'front': {
        // Place on front surface (Y max)
        const targetFront = targetBbox.max[1]
        const shapeBack = shapeBbox.min[1]
        dx = at[0]
        dy = targetFront - shapeBack - penetrate
        dz = at[1]
        break
      }
      case 'back': {
        // Place on back surface (Y min)
        const targetBack = targetBbox.min[1]
        const shapeFront = shapeBbox.max[1]
        dx = at[0]
        dy = targetBack - shapeFront + penetrate
        dz = at[1]
        break
      }
    }

    return this.translate(dx, dy, dz)
  }

  /**
   * Position this shape to overlap with target by a specified amount
   * Simpler alternative to connectTo - user positions shape near target, API adjusts for overlap
   * @param target - Shape to overlap with (not consumed)
   * @param amount - How much to overlap (in mm)
   * @param direction - Direction to approach from ('+x', '-x', '+y', '-y', '+z', '-z')
   *                   If not specified, auto-detects based on shape positions
   */
  overlapWith(target: Shape, amount: number, direction?: Direction): Shape {
    const targetBbox = target.getBoundingBox()
    const shapeBbox = this.getBoundingBox()

    // Auto-detect direction if not specified
    if (!direction) {
      direction = this.detectOverlapDirection(target)
    }

    let dx = 0, dy = 0, dz = 0

    switch (direction) {
      case '+x': {
        // Shape is to the right of target, move left to overlap
        const targetRightFace = targetBbox.max[0]
        const shapeLeftFace = shapeBbox.min[0]
        // Desired position: shapeLeftFace = targetRightFace - amount
        const desiredPosition = targetRightFace - amount
        dx = desiredPosition - shapeLeftFace
        // Only move if there's a gap to close
        if (dx > 0) dx = 0
        break
      }
      case '-x': {
        // Shape is to the left of target, move right to overlap
        const targetLeftFace = targetBbox.min[0]
        const shapeRightFace = shapeBbox.max[0]
        // Desired position: shapeRightFace = targetLeftFace + amount
        const desiredPosition = targetLeftFace + amount
        dx = desiredPosition - shapeRightFace
        // Only move if there's a gap to close
        if (dx < 0) dx = 0
        break
      }
      case '+y': {
        // Shape is in front of target (positive Y), move back to overlap
        const targetFrontFace = targetBbox.max[1]
        const shapeBackFace = shapeBbox.min[1]
        const desiredPosition = targetFrontFace - amount
        dy = desiredPosition - shapeBackFace
        if (dy > 0) dy = 0
        break
      }
      case '-y': {
        // Shape is behind target (negative Y), move forward to overlap
        const targetBackFace = targetBbox.min[1]
        const shapeFrontFace = shapeBbox.max[1]
        const desiredPosition = targetBackFace + amount
        dy = desiredPosition - shapeFrontFace
        if (dy < 0) dy = 0
        break
      }
      case '+z': {
        // Shape is above target, move down to overlap
        const targetTopFace = targetBbox.max[2]
        const shapeBottomFace = shapeBbox.min[2]
        const desiredPosition = targetTopFace - amount
        dz = desiredPosition - shapeBottomFace
        if (dz > 0) dz = 0
        break
      }
      case '-z': {
        // Shape is below target, move up to overlap
        const targetBottomFace = targetBbox.min[2]
        const shapeTopFace = shapeBbox.max[2]
        const desiredPosition = targetBottomFace + amount
        dz = desiredPosition - shapeTopFace
        if (dz < 0) dz = 0
        break
      }
    }

    return this.translate(dx, dy, dz)
  }

  /**
   * Auto-detect the direction for overlapWith based on shape positions
   * @param target - Target shape
   * @returns Detected direction
   * @throws Error if direction is ambiguous
   */
  private detectOverlapDirection(target: Shape): Direction {
    const targetBbox = target.getBoundingBox()
    const shapeBbox = this.getBoundingBox()

    // Calculate distance from each shape face to corresponding target face
    // Positive distance = gap, negative = overlap
    const distances: { direction: Direction; distance: number }[] = [
      { direction: '+x', distance: shapeBbox.min[0] - targetBbox.max[0] }, // shape left face to target right face
      { direction: '-x', distance: targetBbox.min[0] - shapeBbox.max[0] }, // target left face to shape right face
      { direction: '+y', distance: shapeBbox.min[1] - targetBbox.max[1] }, // shape back face to target front face
      { direction: '-y', distance: targetBbox.min[1] - shapeBbox.max[1] }, // target back face to shape front face
      { direction: '+z', distance: shapeBbox.min[2] - targetBbox.max[2] }, // shape bottom face to target top face
      { direction: '-z', distance: targetBbox.min[2] - shapeBbox.max[2] }, // target bottom face to shape top face
    ]

    // Find the direction with the smallest positive distance (closest gap)
    // or largest overlap (negative, meaning already overlapping)
    // We want the direction that represents "this shape is positioned in that direction from target"
    const sortedByDistance = [...distances].sort((a, b) => b.distance - a.distance)

    // The direction with the largest distance indicates where the shape is relative to target
    const best = sortedByDistance[0]!
    const secondBest = sortedByDistance[1]!

    // Check for ambiguity - if two directions have similar distances (within 1mm tolerance)
    const tolerance = 1.0
    if (Math.abs(best.distance - secondBest.distance) < tolerance) {
      throw new Error(
        `Ambiguous direction for overlapWith. Shape is equidistant from multiple faces. ` +
        `Please specify direction explicitly: ${distances.map(d => d.direction).join(', ')}`
      )
    }

    return best.direction
  }

  // ============================================================
  // Overlap Verification
  // ============================================================

  /**
   * Check if this shape overlaps with another shape (shares volume)
   * Does not consume either shape
   * @param other - Shape to check overlap with
   * @param options - Configuration options
   * @returns true if shapes intersect with at least minVolume
   */
  overlaps(other: Shape, options?: OverlapOptions): boolean {
    const minVolume = options?.minVolume ?? 0.001

    // Clone both manifolds to avoid consuming them
    const thisClone = this.manifold.translate(0, 0, 0)
    const otherClone = other.manifold.translate(0, 0, 0)

    try {
      const intersection = thisClone.intersect(otherClone)
      const volume = intersection.volume()
      intersection.delete()
      return volume >= minVolume
    } finally {
      thisClone.delete()
      otherClone.delete()
    }
  }

  /**
   * Check if this shape touches another shape (bounding boxes are adjacent or overlapping)
   * Parts that share a surface/edge are considered touching.
   * Does not consume either shape.
   * @param other - Shape to check touching with
   * @param tolerance - Distance tolerance for considering parts as touching (default: 0.01mm)
   * @returns true if bounding boxes are within tolerance of each other
   */
  touches(other: Shape, tolerance: number = 0.01): boolean {
    const bboxA = this.getBoundingBox()
    const bboxB = other.getBoundingBox()

    // Check if bounding boxes are within tolerance on all axes
    // Two boxes touch if they're adjacent or overlapping on all three axes
    const touchesX = bboxA.max[0] + tolerance >= bboxB.min[0] && bboxA.min[0] - tolerance <= bboxB.max[0]
    const touchesY = bboxA.max[1] + tolerance >= bboxB.min[1] && bboxA.min[1] - tolerance <= bboxB.max[1]
    const touchesZ = bboxA.max[2] + tolerance >= bboxB.min[2] && bboxA.min[2] - tolerance <= bboxB.max[2]

    return touchesX && touchesY && touchesZ
  }

  /**
   * Assert that this shape forms a connected assembly
   * Uses Manifold's decompose() to detect topologically disconnected components.
   * Throws if the geometry contains multiple disconnected parts.
   * @returns this for chaining
   */
  assertConnected(): this {
    // Use decompose() to find topologically disconnected components
    // This is the authoritative check - if decompose returns > 1 component,
    // the geometry is definitely disconnected
    const components = this.manifold.decompose()
    const numComponents = components.length

    // Clean up the decomposed manifolds
    for (const component of components) {
      component.delete()
    }

    if (numComponents > 1) {
      const name = this._name ? `"${this._name}"` : 'Shape'
      const hint = `If this is intentional (e.g., multi-part prints), use .build({ skipConnectivityCheck: true }).`

      // If we have tracked parts, try to identify which ones are disconnected
      if (this.trackedParts.size > 0) {
        const disconnectedNames = this.findDisconnectedFromTracked()
        if (disconnectedNames.length > 0) {
          throw new Error(
            `${name} has ${numComponents} disconnected components. ` +
            `Disconnected parts: ${disconnectedNames.join(', ')}. ` +
            `Ensure all components touch. ${hint}`
          )
        }
      }

      throw new Error(
        `${name} has ${numComponents} disconnected components. ` +
        `Ensure all parts touch or overlap. ${hint}`
      )
    }

    return this
  }

  /**
   * Find which tracked parts are disconnected from the assembly
   * Uses touch detection (bounding box proximity) between parts to determine connectivity.
   * Parts that share a surface are considered connected.
   * @returns Array of disconnected part names
   */
  private findDisconnectedFromTracked(): string[] {
    const partNames = Array.from(this.trackedParts.keys())
    if (partNames.length === 0) return []

    // Build adjacency list for parts that touch each other
    const connections = new Map<string, Set<string>>()
    for (const name of partNames) {
      connections.set(name, new Set())
    }

    // Check each pair of parts for touching (bounding box proximity)
    for (let i = 0; i < partNames.length; i++) {
      for (let j = i + 1; j < partNames.length; j++) {
        const nameA = partNames[i]!
        const nameB = partNames[j]!
        const partA = this.trackedParts.get(nameA)!
        const partB = this.trackedParts.get(nameB)!

        if (partA.touches(partB)) {
          connections.get(nameA)!.add(nameB)
          connections.get(nameB)!.add(nameA)
        }
      }
    }

    // Find connected components using BFS
    const visited = new Set<string>()
    const components: string[][] = []

    for (const name of partNames) {
      if (visited.has(name)) continue

      const component: string[] = []
      const queue = [name]

      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue

        visited.add(current)
        component.push(current)

        for (const neighbor of connections.get(current)!) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor)
          }
        }
      }

      components.push(component)
    }

    // Find the largest component (main body)
    let largestComponent: string[] = []
    for (const component of components) {
      if (component.length > largestComponent.length) {
        largestComponent = component
      }
    }

    // Parts not in the largest component are disconnected
    const disconnected: string[] = []
    for (const name of partNames) {
      if (!largestComponent.includes(name)) {
        disconnected.push(name)
      }
    }

    return disconnected
  }

  // ============================================================
  // Alignment
  // ============================================================

  /**
   * Align this shape to the origin based on bounding box
   * Uses standard 3D printing coordinate system:
   * - X: left (-) / right (+)
   * - Y: front (-) / back (+)
   * - Z: bottom (-) / top (+)
   * @param x - X alignment: 'left', 'center', 'right', or 'none'
   * @param y - Y alignment: 'front', 'center', 'back', or 'none'
   * @param z - Z alignment: 'bottom', 'center', 'top', or 'none'
   */
  align(x: XAlign, y: YAlign, z: ZAlign): Shape {
    this.assertNotConsumed()
    const bbox = this.getBoundingBox()

    let dx = 0, dy = 0, dz = 0

    // Calculate X offset
    switch (x) {
      case 'left':
        dx = -bbox.min[0]
        break
      case 'center':
        dx = -(bbox.min[0] + bbox.max[0]) / 2
        break
      case 'right':
        dx = -bbox.max[0]
        break
      case 'none':
        dx = 0
        break
    }

    // Calculate Y offset
    switch (y) {
      case 'front':
        dy = -bbox.min[1]
        break
      case 'center':
        dy = -(bbox.min[1] + bbox.max[1]) / 2
        break
      case 'back':
        dy = -bbox.max[1]
        break
      case 'none':
        dy = 0
        break
    }

    // Calculate Z offset
    switch (z) {
      case 'bottom':
        dz = -bbox.min[2]
        break
      case 'center':
        dz = -(bbox.min[2] + bbox.max[2]) / 2
        break
      case 'top':
        dz = -bbox.max[2]
        break
      case 'none':
        dz = 0
        break
    }

    return this.translate(dx, dy, dz)
  }

  // ============================================================
  // Chamfers and Fillets (for cylinder-like shapes)
  // ============================================================

  /**
   * Add a chamfer (angled cut) to the top edge
   * Best used on cylinders or shapes with circular cross-section
   * @param size - Chamfer size (45° cut)
   */
  chamferTop(size: number): Shape {
    this.assertNotConsumed()
    if (size <= 0) {
      return this.clone()
    }

    const bbox = this.getBoundingBox()
    const radius = Math.max(bbox.max[0], bbox.max[1]) // Assume centered
    const height = bbox.max[2] - bbox.min[2]
    const zBase = bbox.min[2]

    // Clamp size to not exceed radius or height
    const safeSize = Math.min(size, radius, height)

    // Create chamfer as truncated cone on top
    const baseHeight = height - safeSize
    const baseCylinder = this.M.Manifold.cylinder(baseHeight, radius, radius, 0)
      .translate(0, 0, zBase)

    const chamferCone = this.M.Manifold.cylinder(safeSize, radius, radius - safeSize, 0)
      .translate(0, 0, zBase + baseHeight)

    const result = baseCylinder.add(chamferCone)

    // Intersect with original to preserve any holes/features
    const intersected = this.manifold.intersect(result)

    // Cleanup
    baseCylinder.delete()
    chamferCone.delete()
    result.delete()
    this.manifold.delete()
    this.markConsumed('chamferTop()')

    return new Shape(this.M, intersected, this.attachPoints, this._name)
  }

  /**
   * Add a chamfer (angled cut) to the bottom edge
   * Best used on cylinders or shapes with circular cross-section
   * @param size - Chamfer size (45° cut)
   */
  chamferBottom(size: number): Shape {
    this.assertNotConsumed()
    if (size <= 0) {
      return this.clone()
    }

    const bbox = this.getBoundingBox()
    const radius = Math.max(bbox.max[0], bbox.max[1])
    const height = bbox.max[2] - bbox.min[2]
    const zBase = bbox.min[2]

    const safeSize = Math.min(size, radius, height)

    // Create chamfer as truncated cone on bottom
    const chamferCone = this.M.Manifold.cylinder(safeSize, radius - safeSize, radius, 0)
      .translate(0, 0, zBase)

    const topCylinder = this.M.Manifold.cylinder(height - safeSize, radius, radius, 0)
      .translate(0, 0, zBase + safeSize)

    const result = chamferCone.add(topCylinder)
    const intersected = this.manifold.intersect(result)

    chamferCone.delete()
    topCylinder.delete()
    result.delete()
    this.manifold.delete()
    this.markConsumed('chamferBottom()')

    return new Shape(this.M, intersected, this.attachPoints, this._name)
  }

  /**
   * Add chamfers to both top and bottom edges
   * @param size - Chamfer size for both ends
   */
  chamferBoth(size: number): Shape {
    this.assertNotConsumed()
    if (size <= 0) {
      return this.clone()
    }

    const bbox = this.getBoundingBox()
    const radius = Math.max(bbox.max[0], bbox.max[1])
    const height = bbox.max[2] - bbox.min[2]
    const zBase = bbox.min[2]

    const safeSize = Math.min(size, radius, height / 2)

    // Bottom chamfer cone
    const bottomCone = this.M.Manifold.cylinder(safeSize, radius - safeSize, radius, 0)
      .translate(0, 0, zBase)

    // Middle cylinder
    const middleCylinder = this.M.Manifold.cylinder(height - 2 * safeSize, radius, radius, 0)
      .translate(0, 0, zBase + safeSize)

    // Top chamfer cone
    const topCone = this.M.Manifold.cylinder(safeSize, radius, radius - safeSize, 0)
      .translate(0, 0, zBase + height - safeSize)

    const combined = this.M.Manifold.union([bottomCone, middleCylinder, topCone])
    const intersected = this.manifold.intersect(combined)

    bottomCone.delete()
    middleCylinder.delete()
    topCone.delete()
    combined.delete()
    this.manifold.delete()
    this.markConsumed('chamferBoth()')

    return new Shape(this.M, intersected, this.attachPoints, this._name)
  }

  /**
   * Add a fillet (rounded edge) to the top
   * Best used on cylinders or shapes with circular cross-section
   * @param radius - Fillet radius
   * @param segments - Segments for quarter-circle (default: 8)
   */
  filletTop(radius: number, segments: number = 8): Shape {
    this.assertNotConsumed()
    if (radius <= 0) {
      return this.clone()
    }

    const bbox = this.getBoundingBox()
    const cylinderRadius = Math.max(bbox.max[0], bbox.max[1])
    const height = bbox.max[2] - bbox.min[2]
    const zBase = bbox.min[2]

    const safeRadius = Math.min(radius, cylinderRadius, height)

    // Create a complete cylinder profile with rounded top corner
    // Profile starts at center and goes around clockwise
    const profile: [number, number][] = []

    // Start at origin
    profile.push([0, 0])
    // Go to outer edge at bottom
    profile.push([cylinderRadius, 0])
    // Go up to where fillet starts
    profile.push([cylinderRadius, height - safeRadius])
    // Quarter circle for fillet (going from outer edge inward and up)
    for (let i = 1; i <= segments; i++) {
      const angle = (Math.PI / 2) * (i / segments)
      const x = cylinderRadius - safeRadius + safeRadius * Math.cos(angle)
      const y = height - safeRadius + safeRadius * Math.sin(angle)
      profile.push([x, y])
    }
    // Go back to center at top
    profile.push([0, height])

    // Create the filleted cylinder via revolution
    const crossSection = new this.M.CrossSection([profile])
    const filleted = crossSection.revolve(0, 360)
      .translate(0, 0, zBase)
    crossSection.delete()

    // Intersect with original to preserve holes/features
    const intersected = this.manifold.intersect(filleted)

    filleted.delete()
    this.manifold.delete()
    this.markConsumed('filletTop()')

    return new Shape(this.M, intersected, this.attachPoints, this._name)
  }

  /**
   * Add a fillet (rounded edge) to the bottom
   * Best used on cylinders or shapes with circular cross-section
   * @param radius - Fillet radius
   * @param segments - Segments for quarter-circle (default: 8)
   */
  filletBottom(radius: number, segments: number = 8): Shape {
    this.assertNotConsumed()
    if (radius <= 0) {
      return this.clone()
    }

    const bbox = this.getBoundingBox()
    const cylinderRadius = Math.max(bbox.max[0], bbox.max[1])
    const height = bbox.max[2] - bbox.min[2]
    const zBase = bbox.min[2]

    const safeRadius = Math.min(radius, cylinderRadius, height)

    // Create a complete cylinder profile with rounded bottom corner
    const profile: [number, number][] = []

    // Start at center bottom
    profile.push([0, 0])
    // Go to start of fillet
    profile.push([cylinderRadius - safeRadius, 0])
    // Quarter circle for fillet (going from inward to outer edge and up)
    for (let i = 1; i <= segments; i++) {
      const angle = -Math.PI / 2 + (Math.PI / 2) * (i / segments)
      const x = cylinderRadius - safeRadius + safeRadius * Math.cos(angle)
      const y = safeRadius + safeRadius * Math.sin(angle)
      profile.push([x, y])
    }
    // Go up to top
    profile.push([cylinderRadius, height])
    // Go back to center at top
    profile.push([0, height])

    const crossSection = new this.M.CrossSection([profile])
    const filleted = crossSection.revolve(0, 360)
      .translate(0, 0, zBase)
    crossSection.delete()

    const intersected = this.manifold.intersect(filleted)

    filleted.delete()
    this.manifold.delete()
    this.markConsumed('filletBottom()')

    return new Shape(this.M, intersected, this.attachPoints, this._name)
  }

  /**
   * Add fillets to both top and bottom edges
   * @param radius - Fillet radius for both ends
   * @param segments - Segments for quarter-circle (default: 8)
   */
  filletBoth(radius: number, segments: number = 8): Shape {
    this.assertNotConsumed()
    if (radius <= 0) {
      return this.clone()
    }

    // Apply bottom fillet first, then top fillet to result
    // This works because fillet operations intersect with the shape
    const bottomFilleted = this.filletBottom(radius, segments)
    return bottomFilleted.filletTop(radius, segments)
  }

  /**
   * Add chamfers to top edges of a box-like shape (subtractive)
   * @param size - Chamfer size (45° cuts along top edges)
   */
  chamferTopEdges(size: number): Shape {
    this.assertNotConsumed()
    if (size <= 0) {
      return this.clone()
    }

    const bbox = this.getBoundingBox()
    const width = bbox.max[0] - bbox.min[0]
    const depth = bbox.max[1] - bbox.min[1]
    const height = bbox.max[2] - bbox.min[2]

    // Clamp size
    const safeSize = Math.min(size, width / 2, depth / 2, height)

    const prisms: ReturnType<typeof this.manifold.translate>[] = []

    // Create wedge profiles for each edge direction

    // For edges along X axis (front and back edges):
    // Profile in YZ plane, extrude along X
    const xEdgeProfile: [number, number][] = [
      [0, 0],
      [safeSize, 0],
      [0, safeSize]
    ]
    const xCrossSection = new this.M.CrossSection([xEdgeProfile])

    // Front edge (at Y min, Z max)
    const frontPrism = xCrossSection.extrude(width + 2)
      .rotate([90, 0, 90])
      .translate(bbox.min[0] - 1, bbox.min[1], bbox.max[2] - safeSize)
    prisms.push(frontPrism)

    // Back edge (at Y max, Z max) - rotated 180 around X
    const backPrism = xCrossSection.extrude(width + 2)
      .rotate([90, 0, 90])
      .scale([1, -1, 1])
      .translate(bbox.min[0] - 1, bbox.max[1], bbox.max[2] - safeSize)
    prisms.push(backPrism)

    xCrossSection.delete()

    // For edges along Y axis (left and right edges):
    // Profile in XZ plane, extrude along Y
    const yEdgeProfile: [number, number][] = [
      [0, 0],
      [safeSize, 0],
      [0, safeSize]
    ]
    const yCrossSection = new this.M.CrossSection([yEdgeProfile])

    // Left edge (at X min, Z max)
    const leftPrism = yCrossSection.extrude(depth + 2)
      .rotate([90, 0, 0])
      .translate(bbox.min[0], bbox.min[1] - 1, bbox.max[2] - safeSize)
    prisms.push(leftPrism)

    // Right edge (at X max, Z max) - mirrored
    const rightPrism = yCrossSection.extrude(depth + 2)
      .rotate([90, 0, 0])
      .scale([-1, 1, 1])
      .translate(bbox.max[0], bbox.min[1] - 1, bbox.max[2] - safeSize)
    prisms.push(rightPrism)

    yCrossSection.delete()

    // Subtract all prisms
    const unionedPrisms = this.M.Manifold.union(prisms)
    const result = this.manifold.subtract(unionedPrisms)

    // Cleanup
    for (const prism of prisms) {
      prism.delete()
    }
    unionedPrisms.delete()
    this.manifold.delete()
    this.markConsumed('chamferTopEdges()')

    return new Shape(this.M, result, this.attachPoints, this._name)
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * Clone this shape (does not consume the original)
   */
  clone(): Shape {
    this.assertNotConsumed()
    // Create a copy by translating 0,0,0 - returns new manifold
    const copy = this.manifold.translate(0, 0, 0)
    // Clone attach points
    const newPoints = new Map(this.attachPoints)
    return new Shape(this.M, copy, newPoints, this._name)
  }

  /**
   * Get the bounding box of this shape
   */
  getBoundingBox(): BoundingBox {
    this.assertNotConsumed()
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
    this.assertNotConsumed()
    return this.manifold.volume()
  }

  /**
   * Get the surface area of this shape
   */
  getSurfaceArea(): number {
    this.assertNotConsumed()
    return this.manifold.surfaceArea()
  }

  /**
   * Check if the shape is valid (watertight manifold)
   */
  isValid(): boolean {
    this.assertNotConsumed()
    return this.manifold.volume() > 0 && this.manifold.genus() >= 0
  }

  // ============================================================
  // Debug and Inspection
  // ============================================================

  /**
   * Log shape statistics to console and return this for chaining
   * @param label - Optional label for identifying the shape in output
   */
  inspect(label?: string): this {
    this.assertNotConsumed()
    const bbox = this.getBoundingBox()
    const volume = this.manifold.volume()
    const valid = volume > 0 && this.manifold.genus() >= 0

    const prefix = label ? `[${label}]` : '[Shape]'
    const bboxStr = `[${bbox.min[0].toFixed(2)},${bbox.min[1].toFixed(2)},${bbox.min[2].toFixed(2)}] → [${bbox.max[0].toFixed(2)},${bbox.max[1].toFixed(2)},${bbox.max[2].toFixed(2)}]`

    console.log(`${prefix} Volume: ${volume.toFixed(2)} mm³ | BBox: ${bboxStr} | Valid: ${valid}`)

    return this
  }

  /**
   * Export shape to STL file for debugging and log stats
   * Creates ./debug/ directory if it doesn't exist
   * @param filename - Filename without extension (e.g., 'step1' creates ./debug/step1.stl)
   */
  debug(filename: string): this {
    this.assertNotConsumed()

    // Log stats first
    this.inspect(filename)

    // Get mesh data for STL export
    const mesh = this.manifold.getMesh()

    // Build binary STL content
    const numTriangles = mesh.triVerts.length / 3
    const buffer = new ArrayBuffer(84 + numTriangles * 50)
    const view = new DataView(buffer)

    // 80-byte header
    const header = `GenPrint Debug: ${filename}`
    for (let i = 0; i < 80; i++) {
      view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0)
    }

    // Number of triangles
    view.setUint32(80, numTriangles, true)

    // Write triangles
    let offset = 84
    for (let i = 0; i < numTriangles; i++) {
      const i0 = mesh.triVerts[i * 3] ?? 0
      const i1 = mesh.triVerts[i * 3 + 1] ?? 0
      const i2 = mesh.triVerts[i * 3 + 2] ?? 0

      const v0: [number, number, number] = [
        mesh.vertProperties[i0 * 3] ?? 0,
        mesh.vertProperties[i0 * 3 + 1] ?? 0,
        mesh.vertProperties[i0 * 3 + 2] ?? 0
      ]
      const v1: [number, number, number] = [
        mesh.vertProperties[i1 * 3] ?? 0,
        mesh.vertProperties[i1 * 3 + 1] ?? 0,
        mesh.vertProperties[i1 * 3 + 2] ?? 0
      ]
      const v2: [number, number, number] = [
        mesh.vertProperties[i2 * 3] ?? 0,
        mesh.vertProperties[i2 * 3 + 1] ?? 0,
        mesh.vertProperties[i2 * 3 + 2] ?? 0
      ]

      // Calculate normal
      const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]]
      const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]]
      const normal = [
        e1[1]! * e2[2]! - e1[2]! * e2[1]!,
        e1[2]! * e2[0]! - e1[0]! * e2[2]!,
        e1[0]! * e2[1]! - e1[1]! * e2[0]!
      ]
      const len = Math.sqrt(normal[0]! ** 2 + normal[1]! ** 2 + normal[2]! ** 2)
      if (len > 0) {
        normal[0]! /= len
        normal[1]! /= len
        normal[2]! /= len
      }

      // Write normal
      view.setFloat32(offset, normal[0]!, true)
      view.setFloat32(offset + 4, normal[1]!, true)
      view.setFloat32(offset + 8, normal[2]!, true)
      offset += 12

      // Write vertices
      for (const v of [v0, v1, v2]) {
        view.setFloat32(offset, v[0], true)
        view.setFloat32(offset + 4, v[1], true)
        view.setFloat32(offset + 8, v[2], true)
        offset += 12
      }

      // Attribute byte count
      view.setUint16(offset, 0, true)
      offset += 2
    }

    // Write to file (using Node.js fs - only works in Node.js environment)
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fs = new Function('return require("fs")')()
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const path = new Function('return require("path")')()
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const cwd = new Function('return process.cwd()')()
      const debugDir = path.join(cwd, 'debug')
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true })
      }
      const filepath = path.join(debugDir, `${filename}.stl`)
      fs.writeFileSync(filepath, new Uint8Array(buffer))
      console.log(`  → Wrote ${filepath}`)
    } catch (e) {
      console.warn(`  → Could not write STL file: ${(e as Error).message}`)
    }

    return this
  }

  /**
   * Set color metadata for visual debugging or 3MF export
   * @param color - RGB or RGBA tuple (0-1 range) or hex string like '#ff0000'
   */
  color(color: ShapeColor | string): Shape {
    this.assertNotConsumed()

    let colorValue: ShapeColor
    if (typeof color === 'string') {
      // Parse hex string
      const hex = color.replace('#', '')
      if (hex.length === 6) {
        colorValue = [
          parseInt(hex.substring(0, 2), 16) / 255,
          parseInt(hex.substring(2, 4), 16) / 255,
          parseInt(hex.substring(4, 6), 16) / 255
        ]
      } else if (hex.length === 8) {
        colorValue = [
          parseInt(hex.substring(0, 2), 16) / 255,
          parseInt(hex.substring(2, 4), 16) / 255,
          parseInt(hex.substring(4, 6), 16) / 255,
          parseInt(hex.substring(6, 8), 16) / 255
        ]
      } else {
        throw new Error(`Invalid hex color: ${color}`)
      }
    } else {
      colorValue = color
    }

    // Clone with new color
    const copy = this.manifold.translate(0, 0, 0)
    this.manifold.delete()
    this.markConsumed('color()')

    const newShape = new Shape(this.M, copy, this.attachPoints, this._name)
    newShape._color = colorValue
    return newShape
  }

  /**
   * Get the color of this shape
   */
  getColor(): ShapeColor | undefined {
    return this._color
  }

  // ============================================================
  // Internal - for final output and cleanup
  // ============================================================

  /**
   * Get the raw Manifold for final build output
   * By default, validates that the geometry is a single connected body.
   * WARNING: After calling this, the Shape should not be used further
   * The caller is responsible for cleanup
   * @param options.skipConnectivityCheck - Set to true to allow disconnected geometry
   */
  build(options?: { skipConnectivityCheck?: boolean }): Manifold {
    this.assertNotConsumed()
    if (!options?.skipConnectivityCheck) {
      this.assertConnected()
    }
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
