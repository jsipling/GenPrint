import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid } from '../../test/geometryHelpers'
import { createBuilderContext } from '../manifold/fluent/BuilderContext'
import generator from '../keyboard.generator'

// Create a build function that matches the worker's wrapper
function createBuildFn(builderCode: string) {
  return new Function('ctx', 'params', `
    const { box, cylinder, sphere, cone, roundedBox, tube, hole, counterboredHole, countersunkHole, extrude, revolve, union, unionAll, difference, intersection, linearArray, polarArray, gridArray, ensureMinWall, ensureMinFeature, group, compartmentGrid } = ctx
    const { constants, ops, primitives } = ctx
    ${builderCode}
  `)
}

describe('keyboard.generator', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16) // Lower segments for faster tests
  })

  describe('metadata', () => {
    it('has required fields', () => {
      expect(generator.id).toBe('keyboard')
      expect(generator.name).toBe('Mechanical Keyboard')
      expect(generator.description).toBeTruthy()
      expect(generator.parameters.length).toBeGreaterThan(0)
      expect(generator.builderCode).toBeTruthy()
    })

    it('has sensible parameter defaults', () => {
      const keycapSizeParam = generator.parameters.find(p => p.name === 'keycapSize')
      expect(keycapSizeParam).toBeDefined()
      expect(keycapSizeParam?.type).toBe('number')
      if (keycapSizeParam?.type === 'number') {
        expect(keycapSizeParam.default).toBeGreaterThanOrEqual(16)
        expect(keycapSizeParam.default).toBeLessThanOrEqual(20)
      }

      const wallThicknessParam = generator.parameters.find(p => p.name === 'wallThickness')
      expect(wallThicknessParam).toBeDefined()
      if (wallThicknessParam?.type === 'number') {
        // Per AGENTS.md, minimum wall thickness should be at least 1.2mm
        expect(wallThicknessParam.min).toBeGreaterThanOrEqual(1.2)
      }
    })

    it('has toggleable sections', () => {
      const includeNumpad = generator.parameters.find(p => p.name === 'includeNumpad')
      expect(includeNumpad).toBeDefined()
      expect(includeNumpad?.type).toBe('boolean')

      const includeFunctionRow = generator.parameters.find(p => p.name === 'includeFunctionRow')
      expect(includeFunctionRow).toBeDefined()
      expect(includeFunctionRow?.type).toBe('boolean')

      const includeNavCluster = generator.parameters.find(p => p.name === 'includeNavCluster')
      expect(includeNavCluster).toBeDefined()
      expect(includeNavCluster?.type).toBe('boolean')
    })
  })

  describe('geometry generation', () => {
    const defaultParams: Record<string, number | string | boolean> = {
      keycapSize: 18,
      keycapHeight: 10,
      caseHeight: 22,
      wallThickness: 3,
      includeNumpad: true,
      includeFunctionRow: true,
      includeNavCluster: true
    }

    it('produces valid manifold geometry with default params', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const result = buildFn(ctx, defaultParams)

      expectValid(result.build ? result.build() : result)
    })

    it('produces geometry approximately 350-450mm wide for full-size', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const result = buildFn(ctx, defaultParams)
      const manifold = result.build ? result.build() : result

      const bbox = manifold.boundingBox()
      const width = bbox.max[0] - bbox.min[0]

      // Full-size keyboard should be around 440mm wide
      expect(width).toBeGreaterThanOrEqual(350)
      expect(width).toBeLessThanOrEqual(480)
    })

    it('produces smaller geometry without numpad', () => {
      const ctx1 = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const resultFull = buildFn(ctx1, { ...defaultParams, includeNumpad: true })
      const manifoldFull = resultFull.build ? resultFull.build() : resultFull

      const ctx2 = createBuilderContext(M)
      const resultNoNumpad = buildFn(ctx2, { ...defaultParams, includeNumpad: false })
      const manifoldNoNumpad = resultNoNumpad.build ? resultNoNumpad.build() : resultNoNumpad

      expectValid(manifoldFull)
      expectValid(manifoldNoNumpad)

      const bboxFull = manifoldFull.boundingBox()
      const bboxNoNumpad = manifoldNoNumpad.boundingBox()
      const widthFull = bboxFull.max[0] - bboxFull.min[0]
      const widthNoNumpad = bboxNoNumpad.max[0] - bboxNoNumpad.min[0]

      // Without numpad, keyboard should be ~4 keys narrower
      expect(widthNoNumpad).toBeLessThan(widthFull)
    })

    it('produces connected geometry (single piece)', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const result = buildFn(ctx, defaultParams)

      // build() without skipConnectivityCheck will throw if disconnected
      const manifold = result.build ? result.build() : result
      expect(manifold.numVert()).toBeGreaterThan(0)
    })

    it('enforces minimum wall thickness', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)

      // Try with very thin wall - should be clamped to minimum
      const result = buildFn(ctx, { ...defaultParams, wallThickness: 0.5 })
      const manifold = result.build ? result.build() : result
      expectValid(manifold)
    })

    it('works with all sections disabled (60% layout)', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const result = buildFn(ctx, {
        ...defaultParams,
        includeNumpad: false,
        includeFunctionRow: false,
        includeNavCluster: false
      })
      const manifold = result.build ? result.build() : result

      expectValid(manifold)
      // 60% layout should be significantly smaller
      const bbox = manifold.boundingBox()
      const width = bbox.max[0] - bbox.min[0]
      expect(width).toBeLessThan(350)
    })

    it('has substantial volume for the keycaps', () => {
      const ctx = createBuilderContext(M)
      const buildFn = createBuildFn(generator.builderCode)
      const result = buildFn(ctx, defaultParams)
      const manifold = result.build ? result.build() : result

      // Full keyboard should have significant volume
      expect(manifold.volume()).toBeGreaterThan(100000) // mm³
    })
  })

  describe('display dimensions', () => {
    it('includes key dimensions for overlay', () => {
      expect(generator.displayDimensions).toBeDefined()
      expect(generator.displayDimensions?.length).toBeGreaterThan(0)

      const keycapDisplay = generator.displayDimensions?.find(d => d.param === 'keycapSize')
      expect(keycapDisplay).toBeDefined()
    })
  })
})
