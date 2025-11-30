import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import {
  flattenParameters,
  isBooleanParam,
  isMultiPartResult,
  isSinglePartResult,
  type ParameterDef,
  type BooleanParameterDef,
  type MeshData,
  type BoundingBox,
  type NamedPart,
  type MultiPartResult
} from './types'
import { generators } from './index'
import { getManifold, setCircularSegments } from '../test/manifoldSetup'
import { MIN_WALL_THICKNESS, MIN_FEATURE_SIZE } from './manifold/printingConstants'

// Find v8-engine generator from the auto-discovered generators
const v8EngineGenerator = generators.find(g => g.id === 'v8-engine')!

// Worker wrapper - matches src/workers/manifold.worker.ts executeUserBuilder()
function createWorkerBuildFn(builderCode: string, M: ManifoldToplevel) {
  return new Function('M', 'MIN_WALL_THICKNESS', 'MIN_FEATURE_SIZE', 'params', `
    ${builderCode}
  `).bind(null, M, MIN_WALL_THICKNESS, MIN_FEATURE_SIZE)
}

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
  it('exports all generators', () => {
    expect(generators.length).toBeGreaterThan(0)
  })

  it('all generators have required fields', () => {
    for (const gen of generators) {
      expect(gen.id).toBeDefined()
      expect(gen.name).toBeDefined()
      expect(gen.description).toBeDefined()
      expect(gen.parameters).toBeDefined()
      expect(gen.builderCode).toBeDefined()
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

  it('v8Engine wallThickness has minimum wall thickness per AGENTS.md', () => {
    const wallParam = v8EngineGenerator.parameters.find(
      p => p.type === 'number' && p.name === 'wallThickness'
    )
    expect(wallParam).toBeDefined()
    expect(wallParam!.type).toBe('number')
    // Per AGENTS.md, minimum wall thickness should be at least 1.2mm
    expect((wallParam as { min: number }).min).toBeGreaterThanOrEqual(1.2)
  })
})

describe('generator builderCode validation', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16) // Lower segments for faster validation
  })

  it('all generators execute without syntax or runtime errors', () => {
    for (const gen of generators) {
      // Build default params from generator definition
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(gen.parameters)) {
        params[param.name] = param.default
      }

      // Execute builderCode with worker wrapper (catches redeclaration errors, etc.)
      const buildFn = createWorkerBuildFn(gen.builderCode, M)

      // This will throw if there are syntax errors or runtime errors
      expect(() => {
        const result = buildFn(params)
        // Ensure it returns something (Shape or Manifold)
        expect(result).toBeDefined()
      }).not.toThrow()
    }
  })

  it('all generators produce valid manifold geometry', () => {
    // Some generators intentionally produce multi-part geometry for assembly
    const multiPartGenerators = new Set(['cross-stitch-organizer'])

    for (const gen of generators) {
      // Build default params
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(gen.parameters)) {
        params[param.name] = param.default
      }

      const buildFn = createWorkerBuildFn(gen.builderCode, M)
      const result = buildFn(params)

      // Check if result is multi-part (array of named parts)
      if (Array.isArray(result) && result.length > 0 && result[0].name && result[0].manifold) {
        // Multi-part generator: validate each part's manifold
        for (const part of result) {
          expect(part.manifold.volume(), `${gen.name}/${part.name} should have positive volume`).toBeGreaterThan(0)
          // Multi-part generators are inherently disconnected (each part is separate)
        }
        // Clean up manifolds
        for (const part of result) {
          part.manifold.delete()
        }
        continue
      }

      // Get the manifold (handle both Shape and raw Manifold returns)
      // Don't skip connectivity check - catch disconnected geometry
      const manifold = result.build
        ? result.build()
        : result

      // Validate geometry
      expect(manifold.volume(), `${gen.name} should have positive volume`).toBeGreaterThan(0)

      // Multi-part generators have negative genus (intentionally disconnected)
      if (!multiPartGenerators.has(gen.id)) {
        expect(manifold.genus(), `${gen.name} should be watertight (genus >= 0)`).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

// Helper to create valid MeshData for testing
function createTestMeshData(): MeshData {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2])
  }
}

// Helper to create valid BoundingBox for testing
function createTestBoundingBox(): BoundingBox {
  return {
    min: [0, 0, 0],
    max: [10, 10, 10]
  }
}

// Helper to create valid NamedPart for testing
function createTestNamedPart(name: string): NamedPart {
  return {
    name,
    meshData: createTestMeshData(),
    boundingBox: createTestBoundingBox()
  }
}

describe('isMultiPartResult', () => {
  it('returns true for valid MultiPartResult with parts array', () => {
    const result: MultiPartResult = {
      parts: [createTestNamedPart('part1'), createTestNamedPart('part2')],
      boundingBox: createTestBoundingBox()
    }

    expect(isMultiPartResult(result)).toBe(true)
  })

  it('returns true for MultiPartResult with empty parts array', () => {
    const result: MultiPartResult = {
      parts: [],
      boundingBox: createTestBoundingBox()
    }

    expect(isMultiPartResult(result)).toBe(true)
  })

  it('returns false for null', () => {
    expect(isMultiPartResult(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isMultiPartResult(undefined)).toBe(false)
  })

  it('returns false for primitive values', () => {
    expect(isMultiPartResult(42)).toBe(false)
    expect(isMultiPartResult('string')).toBe(false)
    expect(isMultiPartResult(true)).toBe(false)
  })

  it('returns false for object without parts property', () => {
    const result = {
      meshData: createTestMeshData(),
      boundingBox: createTestBoundingBox()
    }

    expect(isMultiPartResult(result)).toBe(false)
  })

  it('returns false when parts is not an array', () => {
    const result = {
      parts: 'not an array',
      boundingBox: createTestBoundingBox()
    }

    expect(isMultiPartResult(result)).toBe(false)
  })

  it('returns false for object without boundingBox', () => {
    const result = {
      parts: [createTestNamedPart('part1')]
    }

    expect(isMultiPartResult(result)).toBe(false)
  })
})

describe('isSinglePartResult', () => {
  it('returns true for result with meshData and no parts', () => {
    const result = {
      meshData: createTestMeshData(),
      boundingBox: createTestBoundingBox()
    }

    expect(isSinglePartResult(result)).toBe(true)
  })

  it('returns false for result with parts array', () => {
    const result = {
      meshData: createTestMeshData(),
      parts: [createTestNamedPart('part1')],
      boundingBox: createTestBoundingBox()
    }

    expect(isSinglePartResult(result)).toBe(false)
  })

  it('returns false for result without meshData', () => {
    // Type assertion to test runtime behavior with malformed input
    const result = {
      boundingBox: createTestBoundingBox()
    } as { meshData?: MeshData; parts?: NamedPart[] }

    expect(isSinglePartResult(result)).toBe(false)
  })

  it('returns true when parts is undefined', () => {
    const result = {
      meshData: createTestMeshData(),
      parts: undefined,
      boundingBox: createTestBoundingBox()
    }

    expect(isSinglePartResult(result)).toBe(true)
  })
})

describe('NamedPart type structure', () => {
  it('creates valid NamedPart with required fields', () => {
    const part: NamedPart = {
      name: 'cylinder-bore',
      meshData: createTestMeshData(),
      boundingBox: createTestBoundingBox()
    }

    expect(part.name).toBe('cylinder-bore')
    expect(part.meshData).toBeDefined()
    expect(part.boundingBox).toBeDefined()
    expect(part.dimensions).toBeUndefined()
    expect(part.params).toBeUndefined()
  })

  it('creates valid NamedPart with optional fields', () => {
    const part: NamedPart = {
      name: 'cylinder-bore',
      meshData: createTestMeshData(),
      boundingBox: createTestBoundingBox(),
      dimensions: [{ label: 'Bore', param: 'bore', format: '{value}mm' }],
      params: { bore: 50 }
    }

    expect(part.name).toBe('cylinder-bore')
    expect(part.dimensions).toHaveLength(1)
    expect(part.dimensions![0]!.label).toBe('Bore')
    expect(part.params).toEqual({ bore: 50 })
  })
})

describe('MultiPartResult type structure', () => {
  it('creates valid MultiPartResult', () => {
    const result: MultiPartResult = {
      parts: [
        createTestNamedPart('part-a'),
        createTestNamedPart('part-b')
      ],
      boundingBox: createTestBoundingBox()
    }

    expect(result.parts).toHaveLength(2)
    expect(result.parts[0]!.name).toBe('part-a')
    expect(result.parts[1]!.name).toBe('part-b')
    expect(result.boundingBox).toBeDefined()
  })
})
