import type { Generator } from './types'

// Auto-discover all *.generator.ts files using Vite's glob import
const modules = import.meta.glob('./*.generator.ts', { eager: true }) as Record<string, { default: Generator }>

export const generators: Generator[] = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name))

export type { Generator, ParameterDef, ParameterValues, NumberParameterDef, StringParameterDef, SelectParameterDef, BooleanParameterDef, MeshData, DisplayDimension, BoundingBox } from './types'
export { isNumberParam, isStringParam, isSelectParam, isBooleanParam, flattenParameters } from './types'
