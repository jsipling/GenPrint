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

export interface Generator {
  id: string
  name: string
  description: string
  parameters: ParameterDef[]
  scadTemplate: (params: Record<string, number | string>) => string
}

export type ParameterValues = Record<string, number | string>
