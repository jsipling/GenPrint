export interface NumberParameterDef {
  type: 'number'
  name: string
  label: string
  min: number
  max: number
  default: number
  step?: number
  unit?: string
  description?: string
  /** Dynamic max based on other parameter values. Returns effective max, clamped to static max. */
  dynamicMax?: (params: Record<string, number | string | boolean>) => number
  /** Dynamic min based on other parameter values. Returns effective min, clamped to static min. */
  dynamicMin?: (params: Record<string, number | string | boolean>) => number
}

export interface StringParameterDef {
  type: 'string'
  name: string
  label: string
  default: string
  maxLength?: number
  description?: string
}

export interface SelectParameterDef {
  type: 'select'
  name: string
  label: string
  options: string[]
  default: string
  description?: string
}

export interface BooleanParameterDef {
  type: 'boolean'
  name: string
  label: string
  default: boolean
  children?: ParameterDef[]
  description?: string
}

export type ParameterDef = NumberParameterDef | StringParameterDef | SelectParameterDef | BooleanParameterDef

// Type guards for discriminated union
export function isNumberParam(param: ParameterDef): param is NumberParameterDef {
  return param.type === 'number'
}

export function isStringParam(param: ParameterDef): param is StringParameterDef {
  return param.type === 'string'
}

export function isSelectParam(param: ParameterDef): param is SelectParameterDef {
  return param.type === 'select'
}

export function isBooleanParam(param: ParameterDef): param is BooleanParameterDef {
  return param.type === 'boolean'
}

export interface GeneratorPart {
  id: string
  name: string
  scadTemplate: (params: Record<string, number | string | boolean>) => string
}

export type ParameterValues = Record<string, number | string | boolean>

/**
 * Mesh data for direct rendering (bypasses STL parsing)
 */
export interface MeshData {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

/**
 * Base interface for generators
 */
interface GeneratorBase {
  id: string
  name: string
  description: string
  parameters: ParameterDef[]
  parts?: GeneratorPart[]
}

/**
 * OpenSCAD-based generator (returns SCAD code string)
 */
export interface ScadGenerator extends GeneratorBase {
  type?: 'scad'  // Optional for backwards compatibility
  scadTemplate: (params: ParameterValues) => string
}

/**
 * Manifold-based generator (builds geometry directly)
 * The buildGeometry function runs in a web worker with the manifold-3d module.
 */
export interface ManifoldGenerator extends GeneratorBase {
  type: 'manifold'
  /**
   * Function ID that maps to a registered builder in the worker.
   * This allows the worker to look up the correct build function.
   */
  builderId: string
}

/**
 * Union type for all generator types
 */
export type Generator = ScadGenerator | ManifoldGenerator

/**
 * Type guard for ScadGenerator
 */
export function isScadGenerator(gen: Generator): gen is ScadGenerator {
  return gen.type === undefined || gen.type === 'scad'
}

/**
 * Type guard for ManifoldGenerator
 */
export function isManifoldGenerator(gen: Generator): gen is ManifoldGenerator {
  return gen.type === 'manifold'
}

/**
 * Quality levels for rendering. Affects $fn (circle segments).
 * - draft: Fast preview (~24 segments)
 * - normal: Balanced quality (~48 segments)
 * - high: Production quality (~64 segments)
 */
export type QualityLevel = 'draft' | 'normal' | 'high'

export const QUALITY_FN: Record<QualityLevel, number> = {
  draft: 24,
  normal: 48,
  high: 64
}

/**
 * Returns OpenSCAD $fn setting for the given quality level.
 */
export function getQualityFn(quality: QualityLevel = 'normal'): string {
  return `$fn = ${QUALITY_FN[quality]};`
}

/**
 * Flattens nested parameters (from boolean children) into a single array.
 * Useful for iterating over all parameters regardless of nesting.
 */
export function flattenParameters(params: ParameterDef[]): ParameterDef[] {
  const result: ParameterDef[] = []
  for (const param of params) {
    result.push(param)
    if (isBooleanParam(param) && param.children) {
      result.push(...flattenParameters(param.children))
    }
  }
  return result
}
