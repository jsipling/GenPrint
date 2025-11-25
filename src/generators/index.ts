import { spacerGenerator } from './spacer'
import { signGenerator } from './sign'
import { boxGenerator } from './box'
import { gearGenerator } from './gear'
import { thumbKnobGenerator } from './thumbKnob'
import { washerGenerator } from './washer'
import { bracketGenerator } from './bracket'
import { hookGenerator } from './hook'
import { gridfinityBinGenerator } from './gridfinityBinManifold'
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

export type { Generator, ManifoldGenerator, ParameterDef, ParameterValues, NumberParameterDef, StringParameterDef, SelectParameterDef, BooleanParameterDef, MeshData, DisplayDimension, BoundingBox } from './types'
export { isNumberParam, isStringParam, isSelectParam, isBooleanParam, isManifoldGenerator, flattenParameters } from './types'
