/**
 * LLM-Native Geometry Library
 *
 * A declarative geometry API that uses semantic anchors instead of coordinate math.
 * Builds lazy instruction graphs and compiles to Manifold for actual CSG operations.
 *
 * @example
 * ```typescript
 * import { shape, Compiler } from './geo'
 *
 * // 1. Declare shapes (stateless, no WASM)
 * const base = shape.box({ width: 50, depth: 50, height: 10 })
 * const hole = shape.cylinder({ diameter: 5, height: 20 })
 *
 * // 2. Align (semantic, no coordinate math)
 * hole.align({
 *   self: 'center',
 *   target: base,
 *   to: 'center'
 * })
 *
 * // 3. Boolean operation
 * const part = base.subtract(hole)
 *
 * // 4. Compile to Manifold (single WASM call)
 * const compiler = new Compiler(manifoldModule)
 * const manifold = compiler.compile(part.getNode())
 * ```
 */

// Types
export * from './types'

// Math utilities (selective export)
export {
  IDENTITY_MATRIX,
  translationMatrix,
  rotationMatrix,
  multiplyMatrices,
  transformPoint,
  transformDirection
} from './math'

// Shape classes
export { Shape, BooleanShape } from './Shape'
import { Box as BoxClass } from './primitives/Box'
import { Cylinder as CylinderClass } from './primitives/Cylinder'
import { Component as ComponentClass } from './primitives/Component'
import type { ComponentParams } from './primitives/Component'
export { BoxClass as Box }
export type { BoxParams } from './primitives/Box'
export { CylinderClass as Cylinder }
export type { CylinderParams } from './primitives/Cylinder'

// Compiler
export { Compiler } from './Compiler'
export type { CompilerOptions } from './Compiler'

// Validator
export { Validator } from './Validator'
export type {
  ValidationWarning,
  ValidationResult,
  ValidatorOptions,
  ValidationWarningType
} from './Validator'

// Component
export { Component } from './primitives/Component'
export type { ComponentParams, AnchorDefinition } from './primitives/Component'

// Builder code generation (for backward compatibility with generators)
export { toBuilderCode } from './toBuilderCode'

// Factory functions for clean API
export const shape = {
  /**
   * Create a box (rectangular prism) centered at origin
   * @param params Named parameters: width (X), depth (Y), height (Z)
   */
  box: (params: { width: number; depth: number; height: number }): BoxClass =>
    new BoxClass(params),

  /**
   * Create a cylinder centered at origin along Z axis
   * @param params Named parameters: diameter, height
   */
  cylinder: (params: { diameter: number; height: number }): CylinderClass =>
    new CylinderClass(params),

  /**
   * Create a component - a shape with custom named anchors
   * @param params Shape and custom anchor definitions
   */
  component: (params: ComponentParams): ComponentClass =>
    new ComponentClass(params)
}
