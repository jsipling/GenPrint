import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectValid, expectDimensions } from '../../../../test/geometryHelpers'
import { BuilderContext, createBuilderContext, printingConstants } from '../BuilderContext'
import { MIN_WALL_THICKNESS, HOLE_CYLINDER_SEGMENTS } from '../../printingConstants'

describe('BuilderContext', () => {
  let M: ManifoldToplevel
  let ctx: BuilderContext

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
    ctx = createBuilderContext(M)
  })

  describe('construction', () => {
    it('exposes printing constants', () => {
      expect(ctx.constants.MIN_WALL_THICKNESS).toBe(MIN_WALL_THICKNESS)
      expect(ctx.constants.HOLE_CYLINDER_SEGMENTS).toBe(HOLE_CYLINDER_SEGMENTS)
    })

    it('exposes primitives', () => {
      expect(ctx.primitives).toBeDefined()
      expect(typeof ctx.primitives.box).toBe('function')
    })

    it('exposes operations', () => {
      expect(ctx.ops).toBeDefined()
      expect(typeof ctx.ops.union).toBe('function')
    })
  })

  describe('convenience methods', () => {
    it('box() is available directly', () => {
      const box = ctx.box(10, 20, 30)
      expectValid(box.build())
      expectDimensions(box.build(), { width: 10, depth: 20, height: 30 })
      box.delete()
    })

    it('cylinder() is available directly', () => {
      const cyl = ctx.cylinder(20, 10)
      expectValid(cyl.build())
      cyl.delete()
    })

    it('hole() is available directly', () => {
      const hole = ctx.hole(10, 20)
      expectValid(hole.build())
      hole.delete()
    })

    it('union() is available directly', () => {
      const box1 = ctx.box(10, 10, 10)
      const box2 = ctx.box(10, 10, 10).translate(5, 0, 0)
      const result = ctx.union(box1, box2)
      expectValid(result.build())
      result.delete()
    })

    it('difference() is available directly', () => {
      const base = ctx.box(20, 20, 10)
      const hole = ctx.hole(5, 15)
      const result = ctx.difference(base, hole)
      expectValid(result.build())
      result.delete()
    })
  })

  describe('typical usage patterns', () => {
    it('supports destructuring pattern', () => {
      const { box, cylinder, hole, union } = ctx

      const base = box(30, 20, 5)
      const post = cylinder(10, 5).translate(0, 0, 5)
      const mountHole = hole(4, 20).translate(10, 5, 0)

      const result = union(base, post).subtract(mountHole)

      // Check positive volume (valid geometry)
      expect(result.getVolume()).toBeGreaterThan(0)
      result.delete()
    })

    it('supports fluent chaining', () => {
      const result = ctx.box(30, 20, 10)
        .subtract(ctx.hole(6, 15).translate(-10, 0, 0))
        .subtract(ctx.hole(6, 15).translate(10, 0, 0))
        .translate(0, 0, 5)

      expectValid(result.build())
      result.delete()
    })

    it('supports printing constraint helpers', () => {
      const wallThickness = ctx.ensureMinWall(0.5)
      expect(wallThickness).toBe(MIN_WALL_THICKNESS)

      const featureSize = ctx.ensureMinFeature(0.8)
      expect(featureSize).toBe(1.5)
    })
  })

  describe('fromManifold', () => {
    it('wraps raw Manifold in Shape', () => {
      const rawManifold = M.Manifold.cube([10, 10, 10], true)
      const shape = ctx.fromManifold(rawManifold)

      expectValid(shape.build())
      expect(shape.getVolume()).toBeCloseTo(1000, 0)
      shape.delete()
    })
  })

  describe('getManifoldModule', () => {
    it('returns raw ManifoldToplevel', () => {
      const module = ctx.getManifoldModule()
      expect(module).toBe(M)
    })
  })

  describe('printingConstants export', () => {
    it('exports correct values', () => {
      expect(printingConstants.MIN_WALL_THICKNESS).toBe(1.2)
      expect(printingConstants.MIN_SMALL_FEATURE).toBe(1.5)
      expect(printingConstants.HOLE_CYLINDER_SEGMENTS).toBe(16)
      expect(printingConstants.CORNER_SEGMENTS_PER_90).toBe(8)
    })
  })
})
