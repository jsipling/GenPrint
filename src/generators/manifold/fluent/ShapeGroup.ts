/**
 * ShapeGroup - Group multiple shapes for batch operations
 * Allows transforming multiple shapes together without manual accumulation
 */
import type { ManifoldToplevel } from 'manifold-3d'
import { Shape } from './Shape'

/**
 * A group of shapes that can be transformed together
 * All transform operations return a new ShapeGroup (immutable)
 */
export class ShapeGroup {
  private M: ManifoldToplevel
  private shapes: Shape[]

  constructor(M: ManifoldToplevel, shapes: Shape[]) {
    this.M = M
    this.shapes = shapes
  }

  /**
   * Get the number of shapes in the group
   */
  count(): number {
    return this.shapes.length
  }

  /**
   * Translate all shapes in the group
   * @param x - X offset
   * @param y - Y offset
   * @param z - Z offset
   */
  translateAll(x: number, y: number, z: number): ShapeGroup {
    const translated = this.shapes.map(shape => shape.translate(x, y, z))
    return new ShapeGroup(this.M, translated)
  }

  /**
   * Rotate all shapes in the group around the origin
   * @param x - X rotation in degrees
   * @param y - Y rotation in degrees
   * @param z - Z rotation in degrees
   */
  rotateAll(x: number, y: number = 0, z: number = 0): ShapeGroup {
    const rotated = this.shapes.map(shape => shape.rotate(x, y, z))
    return new ShapeGroup(this.M, rotated)
  }

  /**
   * Scale all shapes in the group from the origin
   * @param factor - Uniform scale factor, or X scale
   * @param y - Optional Y scale
   * @param z - Optional Z scale
   */
  scaleAll(factor: number, y?: number, z?: number): ShapeGroup {
    const scaled = this.shapes.map(shape => shape.scale(factor, y, z))
    return new ShapeGroup(this.M, scaled)
  }

  /**
   * Mirror all shapes in the group across an axis
   * @param axis - Axis to mirror across
   */
  mirrorAll(axis: 'x' | 'y' | 'z'): ShapeGroup {
    const mirrored = this.shapes.map(shape => shape.mirror(axis))
    return new ShapeGroup(this.M, mirrored)
  }

  /**
   * Union all shapes in the group into a single shape
   * @returns Single unified shape, or null if group is empty
   */
  unionAll(): Shape | null {
    if (this.shapes.length === 0) {
      return null
    }

    if (this.shapes.length === 1) {
      return this.shapes[0]!
    }

    // Extract manifolds for batch union
    const manifolds = this.shapes.map(s => s.build({ skipConnectivityCheck: true }))
    const result = this.M.Manifold.union(manifolds)

    // Clean up
    for (const m of manifolds) {
      m.delete()
    }

    return new Shape(this.M, result)
  }

  /**
   * Get clones of all shapes in the group
   * Use this to extract shapes for individual operations
   */
  getShapes(): Shape[] {
    return this.shapes.map(shape => shape.clone())
  }

  /**
   * Get the shape at a specific index (cloned)
   * @param index - Index of shape to get
   */
  get(index: number): Shape | undefined {
    const shape = this.shapes[index]
    return shape ? shape.clone() : undefined
  }

  /**
   * Apply a custom transform to all shapes
   * @param transform - Function that transforms each shape
   */
  mapAll(transform: (shape: Shape, index: number) => Shape): ShapeGroup {
    const transformed = this.shapes.map((shape, index) => transform(shape.clone(), index))
    return new ShapeGroup(this.M, transformed)
  }
}

/**
 * Factory function to create a ShapeGroup
 * @param M - Manifold module
 * @param shapes - Array of shapes to group
 */
export function createGroup(M: ManifoldToplevel, shapes: Shape[]): ShapeGroup {
  // Clone all shapes so the group owns its copies
  const clonedShapes = shapes.map(s => s.clone())
  return new ShapeGroup(M, clonedShapes)
}
