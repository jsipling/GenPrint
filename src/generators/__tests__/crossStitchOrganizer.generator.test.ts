import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { MIN_WALL_THICKNESS } from '../manifold/printingConstants'
import generator from '../crossStitchOrganizer.generator'
import type { DisplayDimension, ParameterValues } from '../types'

/**
 * Shape returned by multi-part generators from builderCode.
 */
interface NamedManifoldResult {
  name: string
  manifold: Manifold
  dimensions?: DisplayDimension[]
  params?: ParameterValues
}

// Create a build function that matches the worker's wrapper
function createBuildFn(builderCode: string, M: ManifoldToplevel) {
  return new Function('M', 'MIN_WALL_THICKNESS', 'params', `
    ${builderCode}
  `).bind(null, M, MIN_WALL_THICKNESS)
}

describe('crossStitchOrganizer.generator', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  describe('metadata', () => {
    it('has required fields', () => {
      expect(generator.id).toBe('cross-stitch-organizer')
      expect(generator.name).toBe('Cross Stitch Organizer')
      expect(generator.description).toBeTruthy()
      expect(generator.parameters.length).toBeGreaterThan(0)
      expect(generator.builderCode).toBeTruthy()
    })

    it('has sensible parameter defaults', () => {
      const lengthParam = generator.parameters.find(p => p.name === 'length')
      expect(lengthParam).toBeDefined()
      expect(lengthParam?.type).toBe('number')
      if (lengthParam?.type === 'number') {
        expect(lengthParam.default).toBeGreaterThanOrEqual(150)
        expect(lengthParam.default).toBeLessThanOrEqual(300)
      }

      const widthParam = generator.parameters.find(p => p.name === 'width')
      expect(widthParam).toBeDefined()

      const heightParam = generator.parameters.find(p => p.name === 'height')
      expect(heightParam).toBeDefined()
    })

    it('has compartment type parameters', () => {
      const bobbinsParam = generator.parameters.find(p => p.name === 'includeBobbins')
      expect(bobbinsParam).toBeDefined()
      expect(bobbinsParam?.type).toBe('boolean')

      const scissorsParam = generator.parameters.find(p => p.name === 'includeScissors')
      expect(scissorsParam).toBeDefined()
      expect(scissorsParam?.type).toBe('boolean')

      const accessoriesParam = generator.parameters.find(p => p.name === 'includeAccessories')
      expect(accessoriesParam).toBeDefined()
      expect(accessoriesParam?.type).toBe('boolean')

      const needlesParam = generator.parameters.find(p => p.name === 'includeNeedles')
      expect(needlesParam).toBeDefined()
      expect(needlesParam?.type).toBe('boolean')
    })

    it('wall thickness meets minimum printing requirements', () => {
      const wallParam = generator.parameters.find(p => p.name === 'wallThickness')
      expect(wallParam).toBeDefined()
      expect(wallParam?.type).toBe('number')
      if (wallParam?.type === 'number') {
        expect(wallParam.min).toBeGreaterThanOrEqual(1.2)
      }
    })
  })

  describe('multi-part output', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      length: 220,
      width: 150,
      height: 45,
      wallThickness: 2,
      includeBobbins: true,
      bobbinRows: 4,
      bobbinColumns: 5,
      includeScissors: true,
      includeAccessories: true,
      includeNeedles: true,
      showLid: true,
      lidThickness: 3
    }

    it('returns an array of 3 named parts with lid enabled', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(3) // Box, Dividers, Lid
    })

    it('returns an array of 2 named parts without lid', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({ ...defaultParams, showLid: false }) as NamedManifoldResult[]

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2) // Box, Dividers
    })

    it('parts have correct names', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      expect(result[0]!.name).toBe('Box')
      expect(result[1]!.name).toBe('Dividers')
      expect(result[2]!.name).toBe('Lid')
    })

    it('each part produces valid manifold geometry', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      // Box should be fully valid
      expectValid(result[0]!.manifold)

      // Dividers and Lid may have complex geometry (hinge holes, grid), check volume
      expect(result[1]!.manifold.volume()).toBeGreaterThan(0)
      expect(result[2]!.manifold.volume()).toBeGreaterThan(0)
    })

    it('box has dimensions metadata', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      const box = result[0]!
      expect(box.dimensions).toBeDefined()
      expect(Array.isArray(box.dimensions)).toBe(true)
      expect(box.dimensions!.length).toBeGreaterThan(0)

      const lengthDisplay = box.dimensions?.find(d => d.param === 'length')
      expect(lengthDisplay).toBeDefined()
    })

    it('lid has thickness dimension', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      const lid = result[2]!
      expect(lid.dimensions).toBeDefined()
      expect(lid.params?.thickness).toBe(3)
    })
  })

  describe('geometry generation', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      length: 220,
      width: 150,
      height: 45,
      wallThickness: 2,
      includeBobbins: true,
      bobbinRows: 4,
      bobbinColumns: 5,
      includeScissors: true,
      includeAccessories: true,
      includeNeedles: true,
      showLid: true,
      lidThickness: 3
    }

    it('produces geometry with correct approximate dimensions', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn(defaultParams) as NamedManifoldResult[]

      // Check box dimensions
      const box = result[0]!.manifold
      const bbox = box.boundingBox()
      const actualWidth = bbox.max[0] - bbox.min[0]
      const actualDepth = bbox.max[1] - bbox.min[1]

      // Box should be approximately the requested size
      expect(actualWidth).toBeCloseTo(defaultParams.length as number, 0)
      expect(actualDepth).toBeGreaterThanOrEqual(defaultParams.width as number)
      expect(actualDepth).toBeLessThan((defaultParams.width as number) + 10)
    })

    it('enforces minimum wall thickness', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({ ...defaultParams, wallThickness: 0.5 }) as NamedManifoldResult[]

      // Box should be valid even with thin walls (clamped to minimum)
      expectValid(result[0]!.manifold)
      // All parts should have positive volume
      for (const part of result) {
        expect(part.manifold.volume()).toBeGreaterThan(0)
      }
    })

    it('creates bobbin compartments when enabled', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({ ...defaultParams, includeBobbins: true }) as NamedManifoldResult[]

      // Dividers part should have volume when bobbins are enabled
      const dividers = result[1]!.manifold
      expect(dividers.volume()).toBeGreaterThan(0)
    })

    it('handles different bobbin grid configurations', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const configs = [
        { bobbinRows: 2, bobbinColumns: 3 },
        { bobbinRows: 4, bobbinColumns: 6 },
        { bobbinRows: 6, bobbinColumns: 8 }
      ]

      for (const config of configs) {
        const result = buildFn({ ...defaultParams, ...config }) as NamedManifoldResult[]

        for (const part of result) {
          expect(part.manifold.volume()).toBeGreaterThan(0)
        }
      }
    })

    it('lid part only present when showLid is true', () => {
      const buildFn = createBuildFn(generator.builderCode, M)

      const resultWithLid = buildFn({ ...defaultParams, showLid: true }) as NamedManifoldResult[]
      expect(resultWithLid.length).toBe(3)
      expect(resultWithLid.some(p => p.name === 'Lid')).toBe(true)

      const resultNoLid = buildFn({ ...defaultParams, showLid: false }) as NamedManifoldResult[]
      expect(resultNoLid.length).toBe(2)
      expect(resultNoLid.some(p => p.name === 'Lid')).toBe(false)
    })

    it('can disable all side compartments for bobbins-only mode', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({
        ...defaultParams,
        includeScissors: false,
        includeAccessories: false,
        includeNeedles: false,
        showLid: false
      }) as NamedManifoldResult[]

      // Should still have Box and Dividers (bobbin grid)
      expect(result.length).toBe(2)
      // Box should be valid
      expectValid(result[0]!.manifold)
      // Dividers may have higher genus due to grid structure, just check volume
      expect(result[1]!.manifold.volume()).toBeGreaterThan(0)
    })

    it('can enable only side compartments without bobbins', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({
        ...defaultParams,
        includeBobbins: false,
        includeScissors: true,
        includeAccessories: true,
        includeNeedles: true,
        showLid: false
      }) as NamedManifoldResult[]

      // Should have Box and Dividers (side compartments)
      expect(result.length).toBe(2)
      // Box should be valid
      expectValid(result[0]!.manifold)
      // Dividers (with needle ridges) may have complex geometry, just check volume
      expect(result[1]!.manifold.volume()).toBeGreaterThan(0)
    })

    it('handles no dividers (only box and optional lid)', () => {
      const buildFn = createBuildFn(generator.builderCode, M)
      const result = buildFn({
        ...defaultParams,
        includeBobbins: false,
        includeScissors: false,
        includeAccessories: false,
        includeNeedles: false,
        showLid: false
      }) as NamedManifoldResult[]

      // Should only have Box when no dividers or lid
      expect(result.length).toBe(1)
      expect(result[0]!.name).toBe('Box')
      expectValid(result[0]!.manifold)
    })
  })
})
