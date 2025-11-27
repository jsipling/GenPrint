/**
 * Fluent Geometry API - Public exports
 *
 * Usage:
 * ```typescript
 * import { createBuilderContext, Shape } from '@/generators/manifold/fluent'
 *
 * function buildMyGenerator(M: ManifoldToplevel, params: Params): Manifold {
 *   const ctx = createBuilderContext(M)
 *   const { box, cylinder, hole } = ctx
 *
 *   return box(30, 20, 5)
 *     .add(cylinder(10, 6).translate(15, 10, 5))
 *     .subtract(hole(4, 10).translate(15, 10, 0))
 *     .build()
 * }
 * ```
 */

// Core Shape class
export { Shape, type BoundingBox, type Frame, type MirrorUnionOptions, type XAlign, type YAlign, type ZAlign, type ShapeColor } from './Shape'

// 2D Sketch builder
export { Sketch, type ExtrudeOptions } from './Sketch'

// Primitives factory
export { createPrimitives, type Primitives } from './primitives'

// Operations factory
export { createOperations, type Operations } from './operations'

// BuilderContext - unified API
export {
  BuilderContext,
  createBuilderContext,
  printingConstants
} from './BuilderContext'
