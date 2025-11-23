import { spacerGenerator } from './spacer'
import { signGenerator } from './sign'
import { boxGenerator } from './box'
import { gearGenerator } from './gear'
import { thumbKnobGenerator } from './thumbKnob'
import { washerGenerator } from './washer'
import { bracketGenerator } from './bracket'
import { hookGenerator } from './hook'
import { gridfinityBinGenerator } from './gridfinityBin'
import { gridfinityBinManifoldGenerator } from './gridfinityBinManifold'
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
  gridfinityBinGenerator,
  gridfinityBinManifoldGenerator
]

export type { Generator, ScadGenerator, ManifoldGenerator, GeneratorPart, ParameterDef, ParameterValues, NumberParameterDef, StringParameterDef, SelectParameterDef, BooleanParameterDef, QualityLevel, MeshData } from './types'
export { isNumberParam, isStringParam, isSelectParam, isBooleanParam, isScadGenerator, isManifoldGenerator, flattenParameters, getQualityFn, QUALITY_FN } from './types'
