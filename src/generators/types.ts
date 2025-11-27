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
 * The builderCode runs in a web worker with access to the fluent geometry API.
 */
export interface Generator {
  id: string
  name: string
  description: string
  parameters: ParameterDef[]
  /**
   * Builder code as a string that uses the fluent geometry API.
   * Has access to: ctx methods (box, cylinder, etc.), params object.
   * Must return a Shape or Manifold.
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
