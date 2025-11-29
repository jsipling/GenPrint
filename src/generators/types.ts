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

export interface SelectOptionObject {
  value: string
  label: string
}

export type SelectOption = string | SelectOptionObject

export interface SelectParameterDef {
  type: 'select'
  name: string
  label: string
  options: SelectOption[]
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

export type ParameterValues = Record<string, number | string | boolean>

/**
 * Configuration for displaying a parameter value in the dimension overlay.
 * Used by generators to highlight key functional dimensions.
 */
export interface DisplayDimension {
  /** Label shown in the panel (e.g., "Bore", "Wall") */
  label: string
  /** Key into params object. Supports nested paths like "bore.diameter" */
  param: string
  /** Optional format string. Use {value} for the value (e.g., "⌀{value}mm") */
  format?: string
}

/**
 * Axis-aligned bounding box computed from Manifold geometry.
 */
export interface BoundingBox {
  min: [number, number, number]
  max: [number, number, number]
}

/**
 * Mesh data for direct rendering (bypasses STL parsing)
 */
export interface MeshData {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

/**
 * Generator definition with inline builder code.
 * The builderCode runs in a web worker with direct access to the Manifold-3D API.
 */
export interface Generator {
  id: string
  name: string
  description: string
  parameters: ParameterDef[]
  /**
   * Builder code as a string that uses direct Manifold API operations.
   * Has access to: M (ManifoldToplevel), MIN_WALL_THICKNESS, params object.
   * Must return a Manifold.
   */
  builderCode: string
  /**
   * Optional list of parameters to display in the dimension overlay panel.
   * Generators without this field show only the bounding box dimensions.
   */
  displayDimensions?: DisplayDimension[]
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

/**
 * A named part with its own geometry and display metadata.
 * Used for multi-part models where individual components need identification.
 */
export interface NamedPart {
  /** Unique identifier for this part within the model */
  name: string
  /** Mesh data for this part's geometry */
  meshData: MeshData
  /** Bounding box for this part */
  boundingBox: BoundingBox
  /** Optional dimensions to show in tooltip */
  dimensions?: DisplayDimension[]
  /** Optional parameter values for dimension formatting */
  params?: ParameterValues
}

/**
 * Result from a multi-part generator build.
 * Contains array of named parts plus overall model bounds.
 */
export interface MultiPartResult {
  parts: NamedPart[]
  /** Combined bounding box of all parts */
  boundingBox: BoundingBox
}

/**
 * Type guard to check if a result is a MultiPartResult.
 * Returns true if the result has a parts array and boundingBox.
 */
export function isMultiPartResult(result: unknown): result is MultiPartResult {
  if (result === null || result === undefined) {
    return false
  }
  if (typeof result !== 'object') {
    return false
  }
  const obj = result as Record<string, unknown>
  return Array.isArray(obj.parts) && obj.boundingBox !== undefined
}

/**
 * Type guard to check if a result is a single-part result (has meshData, no parts).
 * Used to distinguish between single-part and multi-part generator results.
 */
export function isSinglePartResult(result: { meshData?: MeshData; parts?: NamedPart[] }): boolean {
  return result.meshData !== undefined && !result.parts
}
