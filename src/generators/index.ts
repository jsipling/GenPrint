import { spacerGenerator } from './spacer'
import { signGenerator } from './sign'
import { boxGenerator } from './box'
import { gearGenerator } from './gear'
import type { Generator } from './types'

export const generators: Generator[] = [
  spacerGenerator,
  signGenerator,
  boxGenerator,
  gearGenerator
]

export type { Generator, ParameterDef, ParameterValues, NumberParameterDef, StringParameterDef } from './types'
export { isNumberParam, isStringParam } from './types'
