/**
 * BuilderContext - Unified context for fluent geometry builders
 * Combines primitives, operations, and constants for AI-generated code
 */
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { Shape } from './Shape'
import { createPrimitives, type Primitives } from './primitives'
import { createOperations, type Operations } from './operations'
import {
  MIN_WALL_THICKNESS,
  MIN_SMALL_FEATURE,
  HOLE_CYLINDER_SEGMENTS,
  CORNER_SEGMENTS_PER_90,
  VERTEX_PRECISION,
  COMPARISON_TOLERANCE
} from '../printingConstants'

/**
 * Printing constants for reference in builders
 */
export const printingConstants = {
  MIN_WALL_THICKNESS,
  MIN_SMALL_FEATURE,
  HOLE_CYLINDER_SEGMENTS,
  CORNER_SEGMENTS_PER_90,
  VERTEX_PRECISION,
  COMPARISON_TOLERANCE
} as const

/**
 * BuilderContext provides all fluent API functionality in one place
 * Use this for AI-generated builders or manual fluent construction
 */
export class BuilderContext {
  private M: ManifoldToplevel
  readonly primitives: Primitives
  readonly ops: Operations
  readonly constants: typeof printingConstants

  constructor(M: ManifoldToplevel) {
    this.M = M
    this.primitives = createPrimitives(M)
    this.ops = createOperations(M)
    this.constants = printingConstants
  }

  // ============================================================
  // Convenience re-exports for cleaner generated code
  // Using arrow functions to support destructuring pattern
  // ============================================================

  /** Create a box (rectangular prism) */
  box = (width: number, depth: number, height: number, centered?: boolean): Shape => {
    return this.primitives.box(width, depth, height, centered)
  }

  /** Create a cylinder */
  cylinder = (height: number, radius: number, segments?: number): Shape => {
    return this.primitives.cylinder(height, radius, segments)
  }

  /** Create a sphere */
  sphere = (radius: number, segments?: number): Shape => {
    return this.primitives.sphere(radius, segments)
  }

  /** Create a cone or truncated cone */
  cone = (height: number, bottomRadius: number, topRadius?: number, segments?: number): Shape => {
    return this.primitives.cone(height, bottomRadius, topRadius, segments)
  }

  /** Create a box with rounded corners */
  roundedBox = (width: number, depth: number, height: number, radius: number, centered?: boolean): Shape => {
    return this.primitives.roundedBox(width, depth, height, radius, centered)
  }

  /** Create a tube (hollow cylinder) */
  tube = (height: number, outerRadius: number, innerRadius: number, segments?: number): Shape => {
    return this.primitives.tube(height, outerRadius, innerRadius, segments)
  }

  /** Create a hole for subtraction */
  hole = (diameter: number, depth: number, segments?: number): Shape => {
    return this.primitives.hole(diameter, depth, segments)
  }

  /** Create a counterbored hole */
  counterboredHole = (
    diameter: number,
    depth: number,
    headDiameter: number,
    headDepth: number,
    segments?: number
  ): Shape => {
    return this.primitives.counterboredHole(diameter, depth, headDiameter, headDepth, segments)
  }

  /** Create a countersunk hole */
  countersunkHole = (diameter: number, depth: number, headDiameter: number, segments?: number): Shape => {
    return this.primitives.countersunkHole(diameter, depth, headDiameter, segments)
  }

  /** Extrude a 2D profile */
  extrude = (profile: [number, number][], height: number): Shape => {
    return this.primitives.extrude(profile, height)
  }

  /** Revolve a 2D profile */
  revolve = (profile: [number, number][], angle?: number, segments?: number): Shape => {
    return this.primitives.revolve(profile, angle, segments)
  }

  // ============================================================
  // Convenience re-exports for operations
  // ============================================================

  /** Union multiple shapes */
  union = (...shapes: Shape[]): Shape => {
    return this.ops.union(...shapes)
  }

  /** Subtract tools from a base */
  difference = (base: Shape, ...tools: Shape[]): Shape => {
    return this.ops.difference(base, ...tools)
  }

  /** Intersect multiple shapes */
  intersection = (...shapes: Shape[]): Shape => {
    return this.ops.intersection(...shapes)
  }

  /** Create a linear array */
  linearArray = (shape: Shape, count: number, spacing: [number, number, number]): Shape => {
    return this.ops.linearArray(shape, count, spacing)
  }

  /** Create a polar array */
  polarArray = (shape: Shape, count: number, axis?: 'x' | 'y' | 'z'): Shape => {
    return this.ops.polarArray(shape, count, axis)
  }

  /** Create a grid array */
  gridArray = (shape: Shape, countX: number, countY: number, spacingX: number, spacingY: number): Shape => {
    return this.ops.gridArray(shape, countX, countY, spacingX, spacingY)
  }

  /** Ensure minimum wall thickness */
  ensureMinWall = (thickness: number): number => {
    return this.ops.ensureMinWall(thickness)
  }

  /** Ensure minimum feature size */
  ensureMinFeature = (size: number): number => {
    return this.ops.ensureMinFeature(size)
  }

  // ============================================================
  // Utility methods
  // ============================================================

  /**
   * Create a Shape from a raw Manifold
   * Useful for wrapping existing geometry
   */
  fromManifold(manifold: Manifold): Shape {
    return new Shape(this.M, manifold)
  }

  /**
   * Get the raw ManifoldToplevel module
   * For advanced operations not covered by the fluent API
   */
  getManifoldModule(): ManifoldToplevel {
    return this.M
  }
}

/**
 * Create a BuilderContext instance
 * Convenience function for creating contexts
 */
export function createBuilderContext(M: ManifoldToplevel): BuilderContext {
  return new BuilderContext(M)
}
