import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectValid } from '../../../../test/geometryHelpers'
import { createBuilderContext, BuilderContext } from '../BuilderContext'

describe('ShapeGroup', () => {
  let M: ManifoldToplevel
  let ctx: BuilderContext

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
    ctx = createBuilderContext(M)
  })

  describe('group()', () => {
    it('creates a group from multiple shapes', () => {
      const shape1 = ctx.box(10, 10, 10)
      const shape2 = ctx.box(10, 10, 10).translate(20, 0, 0)
      const shape3 = ctx.box(10, 10, 10).translate(40, 0, 0)

      const group = ctx.group([shape1, shape2, shape3])

      expect(group.count()).toBe(3)
    })

    it('handles empty array', () => {
      const group = ctx.group([])

      expect(group.count()).toBe(0)
    })

    it('handles single shape', () => {
      const shape = ctx.box(10, 10, 10)
      const group = ctx.group([shape])

      expect(group.count()).toBe(1)
    })
  })

  describe('translateAll()', () => {
    it('translates all shapes in the group', () => {
      const shape1 = ctx.box(10, 10, 10) // centered at origin
      const shape2 = ctx.box(10, 10, 10).translate(20, 0, 0) // centered at x=20

      const group = ctx.group([shape1, shape2]).translateAll(0, 0, 100)

      const shapes = group.getShapes()
      // First shape should now be at z=100
      expect(shapes[0]!.getBoundingBox().min[2]).toBeCloseTo(95, 1)
      // Second shape should also be at z=100
      expect(shapes[1]!.getBoundingBox().min[2]).toBeCloseTo(95, 1)

      for (const s of shapes) s.delete()
    })

    it('returns a new group (immutable)', () => {
      const shape1 = ctx.box(10, 10, 10)
      const original = ctx.group([shape1])
      const translated = original.translateAll(10, 0, 0)

      expect(translated).not.toBe(original)
    })
  })

  describe('rotateAll()', () => {
    it('rotates all shapes in the group around origin', () => {
      const shape1 = ctx.box(10, 10, 10).translate(20, 0, 0) // at x=20

      const group = ctx.group([shape1]).rotateAll(0, 0, 90) // rotate 90° around Z

      const shapes = group.getShapes()
      const bbox = shapes[0]!.getBoundingBox()
      // After 90° Z rotation, x=20 becomes y=20
      expect((bbox.min[1] + bbox.max[1]) / 2).toBeCloseTo(20, 1)
      expect((bbox.min[0] + bbox.max[0]) / 2).toBeCloseTo(0, 1)

      for (const s of shapes) s.delete()
    })
  })

  describe('scaleAll()', () => {
    it('scales all shapes in the group from origin', () => {
      const shape1 = ctx.box(10, 10, 10) // 10x10x10

      const group = ctx.group([shape1]).scaleAll(2)

      const shapes = group.getShapes()
      const bbox = shapes[0]!.getBoundingBox()
      // Should now be 20x20x20
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(20, 1)

      for (const s of shapes) s.delete()
    })
  })

  describe('unionAll()', () => {
    it('unions all shapes into a single shape', () => {
      const shape1 = ctx.box(10, 10, 10)
      const shape2 = ctx.box(10, 10, 10).translate(5, 0, 0) // overlapping

      const group = ctx.group([shape1, shape2])
      const result = group.unionAll()

      expectValid(result!.build())
      // Combined width should be 15 (10 + 5 overlap)
      const bbox = result!.getBoundingBox()
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(15, 1)

      result!.delete()
    })

    it('returns null for empty group', () => {
      const group = ctx.group([])
      const result = group.unionAll()

      expect(result).toBeNull()
    })
  })

  describe('getShapes()', () => {
    it('returns array of shapes in the group', () => {
      const shape1 = ctx.box(10, 10, 10)
      const shape2 = ctx.cylinder(10, 5)

      const group = ctx.group([shape1, shape2])
      const shapes = group.getShapes()

      expect(shapes.length).toBe(2)

      for (const s of shapes) s.delete()
    })
  })

  describe('chaining', () => {
    it('supports chained transforms', () => {
      const knuckle1 = ctx.box(5, 5, 5).translate(0, 0, 0)
      const knuckle2 = ctx.box(5, 5, 5).translate(10, 0, 0)
      const knuckle3 = ctx.box(5, 5, 5).translate(20, 0, 0)

      const positioned = ctx.group([knuckle1, knuckle2, knuckle3])
        .translateAll(0, 0, 100) // Move all up by 100

      const shapes = positioned.getShapes()
      expect(shapes.length).toBe(3)

      // All shapes should now be at z=100 (center)
      for (const shape of shapes) {
        const bbox = shape.getBoundingBox()
        expect(bbox.min[2]).toBeCloseTo(97.5, 1) // z-2.5 (half of 5)
        shape.delete()
      }
    })
  })
})
