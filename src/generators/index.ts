import { spacerGenerator } from './spacer'
import { signGenerator } from './sign'
import { boxGenerator } from './box'
import { gearGenerator } from './gear'
import { thumbKnobGenerator } from './thumbKnob'
import type { Generator } from './types'

export const generators: Generator[] = [
  spacerGenerator,
  signGenerator,
  boxGenerator,
  gearGenerator,
  thumbKnobGenerator
]

export type { Generator, ParameterDef, ParameterValues, NumberParameterDef, StringParameterDef, SelectParameterDef, BooleanParameterDef } from './types'
export { isNumberParam, isStringParam, isSelectParam, isBooleanParam } from './types'
