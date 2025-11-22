import { spacerGenerator } from './spacer'
import type { Generator } from './types'

export const generators: Generator[] = [
  spacerGenerator
]

export const getGenerator = (id: string): Generator | undefined => {
  return generators.find(g => g.id === id)
}

export * from './types'
