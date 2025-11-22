import { spacerGenerator } from './spacer'
import { signGenerator } from './sign'
import type { Generator } from './types'

export const generators: Generator[] = [
  spacerGenerator,
  signGenerator
]

export type { Generator, ParameterDef, ParameterValues, NumberParameterDef, StringParameterDef } from './types'
export { isNumberParam, isStringParam } from './types'
