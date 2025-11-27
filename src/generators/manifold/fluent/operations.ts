/**
 * Operation helpers for the fluent geometry API
 * Provides batch operations, patterns, and printing constraint helpers
 */
import type { ManifoldToplevel } from 'manifold-3d'
import { Shape } from './Shape'
import {
  MIN_WALL_THICKNESS,
  MIN_SMALL_FEATURE,
  safeWallThickness
} from '../printingConstants'

/**
 * Operations interface for type safety
 */
export interface Operations {
  // Batch CSG operations
  union(...shapes: Shape[]): Shape
  difference(base: Shape, ...tools: Shape[]): Shape
  intersection(...shapes: Shape[]): Shape

  // Patterns
  linearArray(shape: Shape, count: number, spacing: [number, number, number]): Shape
  polarArray(shape: Shape, count: number, axis?: 'x' | 'y' | 'z'): Shape
  gridArray(shape: Shape, countX: number, countY: number, spacingX: number, spacingY: number): Shape

  // Printing constraint helpers
  ensureMinWall(thickness: number): number
  ensureMinFeature(size: number): number
  safeWall(requested: number, maxByGeometry?: number): number
}

/**
 * Factory function that creates operation helpers bound to a Manifold instance
 */
export function createOperations(M: ManifoldToplevel): Operations {
  return {
    /**
     * Union multiple shapes into one
     * All input shapes are consumed and cleaned up
     */
    union(...shapes: Shape[]): Shape {
      if (shapes.length === 0) {
        // Return empty manifold
        return new Shape(M, M.Manifold.cube([0, 0, 0]))
      }

      if (shapes.length === 1) {
        return shapes[0]!
      }

      // Extract raw manifolds for batch union
      const manifolds = shapes.map(s => s.build())
      const result = M.Manifold.union(manifolds)

      // Clean up all inputs
      for (const manifold of manifolds) {
        manifold.delete()
      }

      return new Shape(M, result)
    },

    /**
     * Subtract multiple tools from a base shape
     * All input shapes are consumed and cleaned up
     */
    difference(base: Shape, ...tools: Shape[]): Shape {
      if (tools.length === 0) {
        return base
      }

      // For single tool, use direct subtract
      if (tools.length === 1) {
        return base.subtract(tools[0]!)
      }

      // For multiple tools, union them first then subtract
      const toolManifolds = tools.map(s => s.build())
      const unionedTools = M.Manifold.union(toolManifolds)

      const baseManifold = base.build()
      const result = baseManifold.subtract(unionedTools)

      // Clean up all inputs
      baseManifold.delete()
      unionedTools.delete()
      for (const manifold of toolManifolds) {
        manifold.delete()
      }

      return new Shape(M, result)
    },

    /**
     * Intersect multiple shapes
     * All input shapes are consumed and cleaned up
     */
    intersection(...shapes: Shape[]): Shape {
      if (shapes.length === 0) {
        return new Shape(M, M.Manifold.cube([0, 0, 0]))
      }

      if (shapes.length === 1) {
        return shapes[0]!
      }

      // Extract raw manifolds for batch intersection
      const manifolds = shapes.map(s => s.build())
      const result = M.Manifold.intersection(manifolds)

      // Clean up all inputs
      for (const manifold of manifolds) {
        manifold.delete()
      }

      return new Shape(M, result)
    },

    /**
     * Create a linear array of shapes
     * @param shape - Shape to duplicate
     * @param count - Number of copies
     * @param spacing - Spacing as [x, y, z] offset between copies
     */
    linearArray(shape: Shape, count: number, spacing: [number, number, number]): Shape {
      if (count <= 0) {
        shape.delete()
        return new Shape(M, M.Manifold.cube([0, 0, 0]))
      }

      if (count === 1) {
        return shape
      }

      // Clamp spacing components to minimum to prevent overlapping copies
      const safeSpacing: [number, number, number] = [
        Math.max(spacing[0], MIN_SMALL_FEATURE),
        Math.max(spacing[1], MIN_SMALL_FEATURE),
        Math.max(spacing[2], MIN_SMALL_FEATURE)
      ]

      const baseManifold = shape.build()
      const copies = []

      for (let i = 0; i < count; i++) {
        copies.push(baseManifold.translate(safeSpacing[0] * i, safeSpacing[1] * i, safeSpacing[2] * i))
      }

      // Use batch boolean which creates separate geometry
      const result = M.Manifold.union(copies)

      // Clean up all intermediate manifolds
      for (const copy of copies) {
        copy.delete()
      }
      baseManifold.delete()

      return new Shape(M, result)
    },

    /**
     * Create a polar (circular) array of shapes
     * @param shape - Shape to duplicate
     * @param count - Number of copies
     * @param axis - Rotation axis (default: 'z')
     */
    polarArray(shape: Shape, count: number, axis: 'x' | 'y' | 'z' = 'z'): Shape {
      if (count <= 0) {
        shape.delete()
        return new Shape(M, M.Manifold.cube([0, 0, 0]))
      }

      if (count === 1) {
        return shape
      }

      const baseManifold = shape.build()
      const angleStep = 360 / count

      // Build incrementally using add() to avoid batch union issues
      let result = baseManifold.rotate([0, 0, 0]) // First copy at 0 degrees

      for (let i = 1; i < count; i++) {
        const angle = i * angleStep
        const rotation: [number, number, number] = [
          axis === 'x' ? angle : 0,
          axis === 'y' ? angle : 0,
          axis === 'z' ? angle : 0
        ]
        const copy = baseManifold.rotate(rotation)
        const newResult = result.add(copy)
        result.delete()
        copy.delete()
        result = newResult
      }

      baseManifold.delete()
      return new Shape(M, result)
    },

    /**
     * Create a 2D grid array of shapes
     * @param shape - Shape to duplicate
     * @param countX - Number of copies in X direction
     * @param countY - Number of copies in Y direction
     * @param spacingX - Spacing in X direction
     * @param spacingY - Spacing in Y direction
     */
    gridArray(shape: Shape, countX: number, countY: number, spacingX: number, spacingY: number): Shape {
      if (countX <= 0 || countY <= 0) {
        shape.delete()
        return new Shape(M, M.Manifold.cube([0, 0, 0]))
      }

      // Clamp spacing to minimum to prevent overlapping copies
      const safeSpacingX = Math.max(spacingX, MIN_SMALL_FEATURE)
      const safeSpacingY = Math.max(spacingY, MIN_SMALL_FEATURE)

      const baseManifold = shape.build()

      // Build incrementally using add() to avoid batch union issues
      let result = baseManifold.translate(0, 0, 0) // First copy at origin
      let isFirst = true

      for (let y = 0; y < countY; y++) {
        for (let x = 0; x < countX; x++) {
          if (isFirst) {
            isFirst = false
            continue // Skip first since we already have it
          }
          const copy = baseManifold.translate(x * safeSpacingX, y * safeSpacingY, 0)
          const newResult = result.add(copy)
          result.delete()
          copy.delete()
          result = newResult
        }
      }

      baseManifold.delete()
      return new Shape(M, result)
    },

    /**
     * Ensure minimum wall thickness for printability
     * @param thickness - Requested thickness
     * @returns Clamped thickness (minimum MIN_WALL_THICKNESS)
     */
    ensureMinWall(thickness: number): number {
      return Math.max(thickness, MIN_WALL_THICKNESS)
    },

    /**
     * Ensure minimum feature size for printability
     * @param size - Requested feature size
     * @returns Clamped size (minimum MIN_SMALL_FEATURE)
     */
    ensureMinFeature(size: number): number {
      return Math.max(size, MIN_SMALL_FEATURE)
    },

    /**
     * Calculate safe wall thickness with optional geometry constraint
     * @param requested - Requested thickness
     * @param maxByGeometry - Maximum allowed by geometry constraints
     * @returns Clamped thickness between MIN_WALL_THICKNESS and maxByGeometry
     */
    safeWall(requested: number, maxByGeometry: number = Infinity): number {
      return safeWallThickness(requested, maxByGeometry)
    }
  }
}
