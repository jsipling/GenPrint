import { describe, it, expect } from 'vitest'
import {
  flattenParameters,
  isBooleanParam,
  type ParameterDef,
  type BooleanParameterDef
} from './types'
import { generators } from './index'

describe('flattenParameters', () => {
  it('should return flat array unchanged', () => {
    const params: ParameterDef[] = [
      { type: 'number', name: 'width', label: 'Width', min: 0, max: 100, default: 50 },
      { type: 'boolean', name: 'enabled', label: 'Enabled', default: true }
    ]

    const result = flattenParameters(params)

    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('width')
    expect(result[1]!.name).toBe('enabled')
  })

  it('should flatten children of boolean parameters', () => {
    const params: ParameterDef[] = [
      { type: 'number', name: 'width', label: 'Width', min: 0, max: 100, default: 50 },
      {
        type: 'boolean',
        name: 'include_hub',
        label: 'Include Hub',
        default: true,
        children: [
          { type: 'number', name: 'hub_diameter', label: 'Hub Diameter', min: 5, max: 50, default: 15 },
          { type: 'number', name: 'hub_height', label: 'Hub Height', min: 0, max: 30, default: 5 }
        ]
      } as BooleanParameterDef
    ]

    const result = flattenParameters(params)

    expect(result).toHaveLength(4)
    expect(result.map(p => p.name)).toEqual(['width', 'include_hub', 'hub_diameter', 'hub_height'])
  })

  it('should handle nested booleans with children', () => {
    const params: ParameterDef[] = [
      {
        type: 'boolean',
        name: 'parent',
        label: 'Parent',
        default: true,
        children: [
          {
            type: 'boolean',
            name: 'child',
            label: 'Child',
            default: false,
            children: [
              { type: 'number', name: 'grandchild', label: 'Grandchild', min: 0, max: 10, default: 5 }
            ]
          } as BooleanParameterDef
        ]
      } as BooleanParameterDef
    ]

    const result = flattenParameters(params)

    expect(result).toHaveLength(3)
    expect(result.map(p => p.name)).toEqual(['parent', 'child', 'grandchild'])
  })

  it('should handle empty children array', () => {
    const params: ParameterDef[] = [
      {
        type: 'boolean',
        name: 'flag',
        label: 'Flag',
        default: true,
        children: []
      } as BooleanParameterDef
    ]

    const result = flattenParameters(params)

    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('flag')
  })

  it('should handle empty params array', () => {
    const result = flattenParameters([])
    expect(result).toHaveLength(0)
  })
})

describe('BooleanParameterDef with children', () => {
  it('should allow children property on boolean parameters', () => {
    const boolParam: BooleanParameterDef = {
      type: 'boolean',
      name: 'include_hub',
      label: 'Include Hub',
      default: true,
      children: [
        { type: 'number', name: 'hub_diameter', label: 'Hub Diameter', min: 5, max: 50, default: 15 }
      ]
    }

    expect(isBooleanParam(boolParam)).toBe(true)
    expect(boolParam.children).toHaveLength(1)
    expect(boolParam.children![0]!.name).toBe('hub_diameter')
  })

  it('should work without children (backwards compatible)', () => {
    const boolParam: BooleanParameterDef = {
      type: 'boolean',
      name: 'enabled',
      label: 'Enabled',
      default: false
    }

    expect(isBooleanParam(boolParam)).toBe(true)
    expect(boolParam.children).toBeUndefined()
  })
})

describe('generators', () => {
  it('exports all 9 generators', () => {
    expect(generators).toHaveLength(9)
  })

  it('all generators have required fields', () => {
    for (const gen of generators) {
      expect(gen.id).toBeDefined()
      expect(gen.type).toBe('manifold')
      expect(gen.name).toBeDefined()
      expect(gen.description).toBeDefined()
      expect(gen.parameters).toBeDefined()
      expect(gen.builderId).toBeDefined()
    }
  })

  it('all generator IDs are unique', () => {
    const ids = generators.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all generators have valid default parameters', () => {
    for (const gen of generators) {
      for (const param of flattenParameters(gen.parameters)) {
        expect(param.default).toBeDefined()
        if (param.type === 'number') {
          expect(typeof param.default).toBe('number')
          expect(param.default).toBeGreaterThanOrEqual(param.min)
          expect(param.default).toBeLessThanOrEqual(param.max)
        }
      }
    }
  })

  it('dynamicMax functions return valid numbers', () => {
    for (const gen of generators) {
      const params: Record<string, number> = {}
      for (const param of flattenParameters(gen.parameters)) {
        if (param.type === 'number') {
          params[param.name] = param.default
        }
      }

      for (const param of flattenParameters(gen.parameters)) {
        if (param.type === 'number' && param.dynamicMax) {
          const result = param.dynamicMax(params)
          expect(typeof result).toBe('number')
          expect(result).toBeGreaterThan(0)
        }
      }
    }
  })

  it('dynamicMin functions return valid numbers', () => {
    for (const gen of generators) {
      const params: Record<string, number> = {}
      for (const param of flattenParameters(gen.parameters)) {
        if (param.type === 'number') {
          params[param.name] = param.default
        }
      }

      for (const param of flattenParameters(gen.parameters)) {
        if (param.type === 'number' && param.dynamicMin) {
          const result = param.dynamicMin(params)
          expect(typeof result).toBe('number')
        }
      }
    }
  })
})
