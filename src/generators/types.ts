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
}

export interface SelectParameterDef {
  type: 'select'
  name: string
  label: string
  options: string[]
  default: string
}

export interface BooleanParameterDef {
  type: 'boolean'
  name: string
  label: string
  default: boolean
  children?: ParameterDef[]
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

export interface Generator {
  id: string
  name: string
  description: string
  parameters: ParameterDef[]
  scadTemplate: (params: Record<string, number | string | boolean>) => string
  /** Optional separate parts that can be downloaded individually */
  parts?: GeneratorPart[]
}

export type ParameterValues = Record<string, number | string | boolean>

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
