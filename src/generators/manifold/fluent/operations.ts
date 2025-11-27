/**
 * Operation helpers for the fluent geometry API
 * Provides batch operations, patterns, and printing constraint helpers
 */
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { Shape } from './Shape'
import {
  MIN_WALL_THICKNESS,
  MIN_SMALL_FEATURE,
  MAX_PATTERN_COUNT,
  safeWallThickness
} from '../printingConstants'

/**
 * Options for findDisconnected operation
 */
export interface FindDisconnectedOptions {
  /** Minimum intersection volume to consider as connected (default: 0.001 mm³) */
  minVolume?: number
}

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

  // Assembly validation
  findDisconnected(mainBody: Shape, parts: Shape[], options?: FindDisconnectedOptions): string[]

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
     * - For 2+ shapes: All input shapes are consumed and cleaned up, parts are tracked
     * - For 1 shape: Returns input unchanged (optimization, not consumed)
     * - For 0 shapes: Returns empty geometry
     */
    union(...shapes: Shape[]): Shape {
      if (shapes.length === 0) {
        // Return empty manifold
        return new Shape(M, M.Manifold.cube([0, 0, 0]))
      }

      if (shapes.length === 1) {
        return shapes[0]!
      }

      // Clone parts for tracking before we consume them
      const trackedParts = new Map<string, Shape>()
      for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i]!
        const name = shape.getName() ?? `<part ${i}>`
        trackedParts.set(name, shape.clone())
      }

      // Extract raw manifolds for batch union
      // Skip connectivity check here - connectivity is verified at final build()
      const manifolds = shapes.map(s => s.build({ skipConnectivityCheck: true }))
      const result = M.Manifold.union(manifolds)

      // Clean up all inputs
      for (const manifold of manifolds) {
        manifold.delete()
      }

      return new Shape(M, result, undefined, undefined, trackedParts)
    },

    /**
     * Subtract multiple tools from a base shape
     * - For 1+ tools: All input shapes (base and tools) are consumed
     * - For 0 tools: Returns base unchanged (not consumed)
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
     * - For 2+ shapes: All input shapes are consumed and cleaned up
     * - For 1 shape: Returns input unchanged (optimization, not consumed)
     * - For 0 shapes: Returns empty geometry
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
     * - For count >= 2: Shape is consumed and cleaned up
     * - For count === 1: Returns input unchanged (optimization, not consumed)
     * - For count <= 0: Shape is consumed, returns empty geometry
     * @param shape - Shape to duplicate
     * @param count - Number of copies (clamped to MAX_PATTERN_COUNT)
     * @param spacing - Spacing as [x, y, z] offset between copies
     */
    linearArray(shape: Shape, count: number, spacing: [number, number, number]): Shape {
      // Clamp count to prevent memory exhaustion
      const safeCount = Math.min(count, MAX_PATTERN_COUNT)

      if (safeCount <= 0) {
        shape.delete()
        return new Shape(M, M.Manifold.cube([0, 0, 0]))
      }

      if (safeCount === 1) {
        return shape
      }

      // Clamp spacing components to minimum to prevent overlapping copies
      const safeSpacing: [number, number, number] = [
        Math.max(spacing[0], MIN_SMALL_FEATURE),
        Math.max(spacing[1], MIN_SMALL_FEATURE),
        Math.max(spacing[2], MIN_SMALL_FEATURE)
      ]

      const baseManifold = shape.build()
      const copies: Manifold[] = []

      try {
        for (let i = 0; i < safeCount; i++) {
          copies.push(baseManifold.translate(safeSpacing[0] * i, safeSpacing[1] * i, safeSpacing[2] * i))
        }

        // Use batch boolean which creates separate geometry
        const result = M.Manifold.union(copies)
        return new Shape(M, result)
      } finally {
        // Clean up all intermediate manifolds (even on exception)
        for (const copy of copies) {
          copy.delete()
        }
        baseManifold.delete()
      }
    },

    /**
     * Create a polar (circular) array of shapes
     * - For count >= 2: Shape is consumed and cleaned up
     * - For count === 1: Returns input unchanged (optimization, not consumed)
     * - For count <= 0: Shape is consumed, returns empty geometry
     * @param shape - Shape to duplicate
     * @param count - Number of copies (clamped to MAX_PATTERN_COUNT)
     * @param axis - Rotation axis (default: 'z')
     */
    polarArray(shape: Shape, count: number, axis: 'x' | 'y' | 'z' = 'z'): Shape {
      // Clamp count to prevent memory exhaustion
      const safeCount = Math.min(count, MAX_PATTERN_COUNT)

      if (safeCount <= 0) {
        shape.delete()
        return new Shape(M, M.Manifold.cube([0, 0, 0]))
      }

      if (safeCount === 1) {
        return shape
      }

      const baseManifold = shape.build()
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
          copies.push(baseManifold.rotate(rotation))
        }

        // Use batch union for O(1) performance
        const result = M.Manifold.union(copies)
        return new Shape(M, result)
      } finally {
        // Clean up all intermediate manifolds (even on exception)
        for (const copy of copies) {
          copy.delete()
        }
        baseManifold.delete()
      }
    },

    /**
     * Create a 2D grid array of shapes
     * Shape is always consumed and cleaned up
     * @param shape - Shape to duplicate (consumed)
     * @param countX - Number of copies in X direction (total clamped to MAX_PATTERN_COUNT)
     * @param countY - Number of copies in Y direction (total clamped to MAX_PATTERN_COUNT)
     * @param spacingX - Spacing in X direction
     * @param spacingY - Spacing in Y direction
     */
    gridArray(shape: Shape, countX: number, countY: number, spacingX: number, spacingY: number): Shape {
      if (countX <= 0 || countY <= 0) {
        shape.delete()
        return new Shape(M, M.Manifold.cube([0, 0, 0]))
      }

      // Clamp total count to prevent memory exhaustion
      const totalCount = countX * countY
      let safeCountX = countX
      let safeCountY = countY
      if (totalCount > MAX_PATTERN_COUNT) {
        // Scale both dimensions proportionally to stay under limit
        const scale = Math.sqrt(MAX_PATTERN_COUNT / totalCount)
        safeCountX = Math.max(1, Math.floor(countX * scale))
        safeCountY = Math.max(1, Math.floor(countY * scale))
      }

      // Clamp spacing to minimum to prevent overlapping copies
      const safeSpacingX = Math.max(spacingX, MIN_SMALL_FEATURE)
      const safeSpacingY = Math.max(spacingY, MIN_SMALL_FEATURE)

      const baseManifold = shape.build()
      const copies: Manifold[] = []

      try {
        for (let y = 0; y < safeCountY; y++) {
          for (let x = 0; x < safeCountX; x++) {
            copies.push(baseManifold.translate(x * safeSpacingX, y * safeSpacingY, 0))
          }
        }

        // Use batch union for O(1) performance
        const result = M.Manifold.union(copies)
        return new Shape(M, result)
      } finally {
        // Clean up all intermediate manifolds (even on exception)
        for (const copy of copies) {
          copy.delete()
        }
        baseManifold.delete()
      }
    },

    /**
     * Find parts that do not overlap with the main body
     * Does not consume any shapes
     * @param mainBody - The main shape to check against
     * @param parts - Array of parts to check
     * @param options - Configuration options
     * @returns Array of names of disconnected parts
     */
    findDisconnected(mainBody: Shape, parts: Shape[], options?: FindDisconnectedOptions): string[] {
      const minVolume = options?.minVolume ?? 0.001
      const disconnected: string[] = []

      for (const part of parts) {
        if (!mainBody.overlaps(part, { minVolume })) {
          disconnected.push(part.getName() ?? '<unnamed>')
        }
      }

      return disconnected
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
