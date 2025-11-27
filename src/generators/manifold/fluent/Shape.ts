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

export class Shape {
  private manifold: Manifold
  private M: ManifoldToplevel
  private attachPoints: Map<string, [number, number, number]>
  private _name?: string
  private trackedParts: Map<string, Shape>

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
    const result = this.manifold.rotate([x, y, z])
    this.manifold.delete()
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
    return new Shape(this.M, result, newPoints, this._name)
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
   * Parts are considered connected if they touch (share a surface) or overlap.
   * Throws if any parts are isolated (not touching any other part).
   * @returns this for chaining
   */
  assertConnected(): this {
    // If we have tracked parts, verify they form a connected graph via touching
    if (this.trackedParts.size > 0) {
      const disconnectedNames = this.findDisconnectedFromTracked()
      if (disconnectedNames.length > 0) {
        const genus = this.manifold.genus()
        throw new Error(`Disconnected parts: ${disconnectedNames.join(', ')} (genus: ${genus})`)
      }
      // All parts touch - assembly is connected
      return this
    }

    // No tracked parts - fall back to genus check for single bodies
    const genus = this.manifold.genus()
    if (genus < 0) {
      const name = this._name ? `"${this._name}"` : 'Shape'
      throw new Error(`${name} has disconnected parts (genus: ${genus}). Ensure all components touch.`)
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
    return new Shape(this.M, copy, newPoints, this._name)
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
   * By default, validates that the geometry is a single connected body.
   * WARNING: After calling this, the Shape should not be used further
   * The caller is responsible for cleanup
   * @param options.skipConnectivityCheck - Set to true to allow disconnected geometry
   */
  build(options?: { skipConnectivityCheck?: boolean }): Manifold {
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
