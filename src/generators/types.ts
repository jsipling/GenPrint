export interface NumberParameterDef {
  type: 'number'
  name: string
  label: string
  min: number
  max: number
  default: number
  step?: number
  unit?: string
}

export interface StringParameterDef {
  type: 'string'
  name: string
  label: string
  default: string
  maxLength?: number
}

export type ParameterDef = NumberParameterDef | StringParameterDef

// Type guards for discriminated union
export function isNumberParam(param: ParameterDef): param is NumberParameterDef {
  return param.type === 'number'
}

export function isStringParam(param: ParameterDef): param is StringParameterDef {
  return param.type === 'string'
}

export interface Generator {
  id: string
  name: string
  description: string
  parameters: ParameterDef[]
  scadTemplate: (params: Record<string, number | string>) => string
}

export type ParameterValues = Record<string, number | string>
