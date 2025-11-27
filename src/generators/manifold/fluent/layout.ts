/**
 * Layout helpers for the fluent geometry API
 * Provides automatic positioning and divider calculations for compartmentalized designs
 */
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { Shape } from './Shape'
import { MIN_WALL_THICKNESS } from '../printingConstants'

/**
 * Options for compartmentGrid
 */
export interface CompartmentGridOptions {
  /** Inner dimensions [width, depth] of the compartment area */
  bounds: [number, number]
  /** Number of rows (horizontal divisions) */
  rows: number
  /** Number of columns (vertical divisions) */
  columns: number
  /** Height of the divider walls */
  height: number
  /** Thickness of divider walls (clamped to MIN_WALL_THICKNESS) */
  wallThickness: number
  /** If true, position at corner (minX=0, minY=0). Default: centered */
  corner?: boolean
  /** If true, include perimeter walls. Default: false */
  includePerimeter?: boolean
}

/**
 * Layout interface for type safety
 */
export interface Layout {
  compartmentGrid(options: CompartmentGridOptions): Shape | null
}

/**
 * Factory function that creates layout helpers bound to a Manifold instance
 */
export function createLayout(M: ManifoldToplevel): Layout {
  return {
    /**
     * Create a grid of compartment divider walls
     * Automatically calculates and positions dividers for the specified grid
     *
     * @param options - Grid configuration
     * @returns Shape with all divider walls unioned, or null if no dividers needed (1x1 grid)
     *
     * @example
     * ```typescript
     * // Create a 4x5 grid of compartments
     * const dividers = ctx.compartmentGrid({
     *   bounds: [innerLength, innerWidth],
     *   rows: 4,
     *   columns: 5,
     *   height: 20,
     *   wallThickness: 2
     * })
     * // Result: all divider walls positioned and connected
     * ```
     */
    compartmentGrid(options: CompartmentGridOptions): Shape | null {
      const {
        bounds,
        rows,
        columns,
        height,
        wallThickness,
        corner = false,
        includePerimeter = false
      } = options

      const [width, depth] = bounds

      // Clamp wall thickness to minimum printable
      const safeWallThickness = Math.max(wallThickness, MIN_WALL_THICKNESS)

      // Calculate number of dividers
      // N columns = N-1 vertical dividers
      // M rows = M-1 horizontal dividers
      const numVerticalDividers = columns - 1
      const numHorizontalDividers = rows - 1

      // If 1x1 grid and no perimeter, no dividers needed
      if (numVerticalDividers <= 0 && numHorizontalDividers <= 0 && !includePerimeter) {
        return null
      }

      // Calculate cell sizes (excluding wall thickness from available space)
      const totalVerticalWallSpace = numVerticalDividers * safeWallThickness
      const totalHorizontalWallSpace = numHorizontalDividers * safeWallThickness
      const perimeterSpace = includePerimeter ? safeWallThickness * 2 : 0

      const cellWidth = (width - totalVerticalWallSpace - perimeterSpace) / columns
      const cellDepth = (depth - totalHorizontalWallSpace - perimeterSpace) / rows

      const walls: Manifold[] = []

      // Calculate offset for positioning
      // If corner=true, origin is at corner. If centered, origin is at center.
      const offsetX = corner ? (includePerimeter ? safeWallThickness : 0) : -width / 2 + (includePerimeter ? safeWallThickness : 0)
      const offsetY = corner ? (includePerimeter ? safeWallThickness : 0) : -depth / 2 + (includePerimeter ? safeWallThickness : 0)

      // Create vertical dividers (along Y axis, separating columns)
      for (let i = 0; i < numVerticalDividers; i++) {
        const x = offsetX + (i + 1) * cellWidth + i * safeWallThickness
        // Vertical divider spans full depth (including perimeter if present)
        const dividerDepth = includePerimeter
          ? depth - safeWallThickness * 2
          : depth
        const dividerY = includePerimeter
          ? (corner ? safeWallThickness : -depth / 2 + safeWallThickness)
          : (corner ? 0 : -depth / 2)

        const wall = M.Manifold.cube([safeWallThickness, dividerDepth, height], false)
          .translate(x, dividerY, 0)
        walls.push(wall)
      }

      // Create horizontal dividers (along X axis, separating rows)
      for (let j = 0; j < numHorizontalDividers; j++) {
        const y = offsetY + (j + 1) * cellDepth + j * safeWallThickness
        // Horizontal divider spans full width (including perimeter if present)
        const dividerWidth = includePerimeter
          ? width - safeWallThickness * 2
          : width
        const dividerX = includePerimeter
          ? (corner ? safeWallThickness : -width / 2 + safeWallThickness)
          : (corner ? 0 : -width / 2)

        const wall = M.Manifold.cube([dividerWidth, safeWallThickness, height], false)
          .translate(dividerX, y, 0)
        walls.push(wall)
      }

      // Create perimeter walls if requested
      if (includePerimeter) {
        const perimeterX = corner ? 0 : -width / 2
        const perimeterY = corner ? 0 : -depth / 2

        // Left wall
        const leftWall = M.Manifold.cube([safeWallThickness, depth, height], false)
          .translate(perimeterX, perimeterY, 0)
        walls.push(leftWall)

        // Right wall
        const rightWall = M.Manifold.cube([safeWallThickness, depth, height], false)
          .translate(perimeterX + width - safeWallThickness, perimeterY, 0)
        walls.push(rightWall)

        // Front wall (connects left to right, excluding corners to avoid overlap)
        const frontWall = M.Manifold.cube([width - safeWallThickness * 2, safeWallThickness, height], false)
          .translate(perimeterX + safeWallThickness, perimeterY, 0)
        walls.push(frontWall)

        // Back wall (connects left to right, excluding corners)
        const backWall = M.Manifold.cube([width - safeWallThickness * 2, safeWallThickness, height], false)
          .translate(perimeterX + safeWallThickness, perimeterY + depth - safeWallThickness, 0)
        walls.push(backWall)
      }

      if (walls.length === 0) {
        return null
      }

      // Union all walls
      const result = M.Manifold.union(walls)

      // Clean up intermediate manifolds
      for (const wall of walls) {
        wall.delete()
      }

      return new Shape(M, result)
    }
  }
}
