import { spacerGenerator } from './spacer'
import { signGenerator } from './sign'
import type { Generator } from './types'

export const generators: Generator[] = [
  spacerGenerator,
  signGenerator
]

export const getGenerator = (id: string): Generator | undefined => {
  return generators.find(g => g.id === id)
}

export type { Generator, ParameterDef, ParameterValues, NumberParameterDef, StringParameterDef } from './types'
