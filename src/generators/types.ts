export interface ParameterDef {
  name: string
  label: string
  min: number
  max: number
  default: number
  step?: number
  unit?: string
}

export interface Generator {
  id: string
  name: string
  description: string
  parameters: ParameterDef[]
  scadTemplate: (params: Record<string, number>) => string
}

export type ParameterValues = Record<string, number>
