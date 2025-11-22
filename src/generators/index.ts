import { spacerGenerator } from './spacer'
import { signGenerator } from './sign'
import { boxGenerator } from './box'
import { gearGenerator } from './gear'
import { thumbKnobGenerator } from './thumbKnob'
import { washerGenerator } from './washer'
import { bracketGenerator } from './bracket'
import { hookGenerator } from './hook'
import { gridfinityBinGenerator } from './gridfinityBin'
import type { Generator } from './types'

export const generators: Generator[] = [
  spacerGenerator,
  signGenerator,
  boxGenerator,
  gearGenerator,
  thumbKnobGenerator,
  washerGenerator,
  bracketGenerator,
  hookGenerator,
  gridfinityBinGenerator
]

export type { Generator, GeneratorPart, ParameterDef, ParameterValues, NumberParameterDef, StringParameterDef, SelectParameterDef, BooleanParameterDef, QualityLevel } from './types'
export { isNumberParam, isStringParam, isSelectParam, isBooleanParam, flattenParameters, getQualityFn, QUALITY_FN } from './types'
