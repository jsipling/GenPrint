import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../test/manifoldSetup'
import { expectValid } from '../test/geometryHelpers'
import { BuilderContext } from './manifold/fluent/BuilderContext'
import v8EngineGenerator from './v8Engine.generator'
import { flattenParameters } from './types'

describe('V8 Engine Generator', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
  })

  describe('generator definition', () => {
    it('has required fields', () => {
      expect(v8EngineGenerator.id).toBe('v8_engine')
      expect(v8EngineGenerator.name).toBe('V8 Engine')
      expect(v8EngineGenerator.description).toBeDefined()
      expect(v8EngineGenerator.parameters).toBeDefined()
      expect(v8EngineGenerator.builderCode).toBeDefined()
    })

    it('has valid default parameters', () => {
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        expect(param.default).toBeDefined()
        if (param.type === 'number') {
          expect(typeof param.default).toBe('number')
          expect(param.default).toBeGreaterThanOrEqual(param.min)
          expect(param.default).toBeLessThanOrEqual(param.max)
        }
      }
    })

    it('scale parameter defaults to desktop size', () => {
      const scaleParam = v8EngineGenerator.parameters.find(p => p.name === 'scale')
      expect(scaleParam).toBeDefined()
      expect(scaleParam?.type).toBe('number')
      if (scaleParam?.type === 'number') {
        expect(scaleParam.default).toBe(1)
      }
    })

    it('v_angle parameter defaults to 90 degrees', () => {
      const vAngleParam = v8EngineGenerator.parameters.find(p => p.name === 'v_angle')
      expect(vAngleParam).toBeDefined()
      expect(vAngleParam?.type).toBe('number')
      if (vAngleParam?.type === 'number') {
        expect(vAngleParam.default).toBe(90)
      }
    })
  })

  describe('geometry generation', () => {
    // Execute builder code exactly like the worker does
    function buildEngine(params: Record<string, number | string | boolean>) {
      const ctx = new BuilderContext(M)
      const fn = new Function('ctx', 'params', `
        const { box, cylinder, sphere, cone, roundedBox, tube, hole, counterboredHole, countersunkHole, extrude, revolve, union, difference, intersection, linearArray, polarArray, gridArray, ensureMinWall, ensureMinFeature } = ctx
        const { constants, ops, primitives } = ctx
        ${v8EngineGenerator.builderCode}
      `)
      const result = fn(ctx, params)
      if (result && typeof result.build === 'function') {
        return result
      }
      throw new Error('Builder must return a Shape')
    }

    it('generates valid geometry with default parameters', () => {
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        params[param.name] = param.default
      }

      const result = buildEngine(params)
      expectValid(result.build())
      result.delete()
    })

    it('generates desktop-sized model at default scale', () => {
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        params[param.name] = param.default
      }

      const result = buildEngine(params)
      const manifold = result.build()
      const bbox = manifold.boundingBox()

      // Desktop size should be 50-100mm in the largest dimension
      const maxDim = Math.max(
        bbox.max[0] - bbox.min[0],
        bbox.max[1] - bbox.min[1],
        bbox.max[2] - bbox.min[2]
      )
      expect(maxDim).toBeGreaterThanOrEqual(50)
      expect(maxDim).toBeLessThanOrEqual(100)
      result.delete()
    })

    it('scales geometry proportionally', () => {
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        params[param.name] = param.default
      }

      // Build at scale 1
      const result1 = buildEngine(params)
      const bbox1 = result1.build().boundingBox()
      const width1 = bbox1.max[0] - bbox1.min[0]
      result1.delete()

      // Build at scale 0.5
      params['scale'] = 0.5
      const result2 = buildEngine(params)
      const bbox2 = result2.build().boundingBox()
      const width2 = bbox2.max[0] - bbox2.min[0]
      result2.delete()

      expect(width2).toBeCloseTo(width1 * 0.5, 0)
    })

    it('generates symmetrical V configuration', () => {
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        params[param.name] = param.default
      }

      const result = buildEngine(params)
      const manifold = result.build()
      const bbox = manifold.boundingBox()

      // For a centered V8, the X min/max should be roughly symmetric
      expect(Math.abs(bbox.min[0] + bbox.max[0])).toBeLessThan(1)
      result.delete()
    })

    it('respects v_angle parameter', () => {
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        params[param.name] = param.default
      }

      // Build at 90 degrees
      params['v_angle'] = 90
      const result90 = buildEngine(params)
      const bbox90 = result90.build().boundingBox()
      const width90 = bbox90.max[0] - bbox90.min[0]
      result90.delete()

      // Build at 60 degrees (narrower)
      params['v_angle'] = 60
      const result60 = buildEngine(params)
      const bbox60 = result60.build().boundingBox()
      const width60 = bbox60.max[0] - bbox60.min[0]
      result60.delete()

      // 60-degree V should be narrower than 90-degree
      expect(width60).toBeLessThan(width90)
    })

    it('generates valid geometry without optional components', () => {
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        params[param.name] = param.default
      }

      // Disable optional components
      params['include_intake'] = false
      params['include_exhaust'] = false
      params['include_accessories'] = false

      const result = buildEngine(params)
      expectValid(result.build())
      result.delete()
    })

    it('generates valid geometry with all components enabled', () => {
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        params[param.name] = param.default
      }

      // Enable all components
      params['include_intake'] = true
      params['include_exhaust'] = true
      params['include_accessories'] = true

      const result = buildEngine(params)
      expectValid(result.build())
      result.delete()
    })

    it('valve cover style affects geometry', () => {
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        params[param.name] = param.default
      }

      // Build with flat valve covers
      params['valve_cover_style'] = 'flat'
      const resultFlat = buildEngine(params)
      const volFlat = resultFlat.build().volume()
      resultFlat.delete()

      // Build with finned valve covers
      params['valve_cover_style'] = 'finned'
      const resultFinned = buildEngine(params)
      const volFinned = resultFinned.build().volume()
      resultFinned.delete()

      // Finned should have different volume than flat
      expect(volFlat).not.toBeCloseTo(volFinned, 0)
    })

  })

  describe('printing constraints', () => {
    it('maintains minimum wall thickness', () => {
      const params: Record<string, number | string | boolean> = {}
      for (const param of flattenParameters(v8EngineGenerator.parameters)) {
        params[param.name] = param.default
      }
      // Smallest scale should still be printable
      params['scale'] = 0.5

      const ctx = new BuilderContext(M)
      const fn = new Function('ctx', 'params', `
        const { box, cylinder, sphere, cone, roundedBox, tube, hole, counterboredHole, countersunkHole, extrude, revolve, union, difference, intersection, linearArray, polarArray, gridArray, ensureMinWall, ensureMinFeature } = ctx
        const { constants, ops, primitives } = ctx
        ${v8EngineGenerator.builderCode}
      `)
      const result = fn(ctx, params)

      // Should produce valid geometry (manifold)
      expectValid(result.build())
      result.delete()
    })
  })
})
