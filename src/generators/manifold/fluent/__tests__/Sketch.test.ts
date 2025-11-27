import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectValid, expectDimensions } from '../../../../test/geometryHelpers'
import { Sketch } from '../Sketch'

describe('Sketch', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
  })

  describe('primitives', () => {
    it('rectangle() creates centered rectangle', () => {
      const sketch = Sketch.rectangle(M, 10, 20)
      const bounds = sketch.getBounds()

      expect(bounds.min[0]).toBeCloseTo(-5, 1)
      expect(bounds.max[0]).toBeCloseTo(5, 1)
      expect(bounds.min[1]).toBeCloseTo(-10, 1)
      expect(bounds.max[1]).toBeCloseTo(10, 1)
      expect(sketch.getArea()).toBeCloseTo(200, 0)

      sketch.delete()
    })

    it('circle() creates circle with correct area', () => {
      const radius = 10
      const sketch = Sketch.circle(M, radius, 64)
      const expectedArea = Math.PI * radius * radius

      // Allow 1% tolerance due to polygon approximation
      expect(Math.abs(sketch.getArea() - expectedArea) / expectedArea).toBeLessThan(0.01)
      sketch.delete()
    })

    it('polygon() creates shape from points', () => {
      const points: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ]
      const sketch = Sketch.polygon(M, points)

      expect(sketch.getArea()).toBeCloseTo(100, 0)
      sketch.delete()
    })

    it('slot() creates stadium shape', () => {
      const sketch = Sketch.slot(M, 20, 10, 16)
      const bounds = sketch.getBounds()

      // Should be 20 long and 10 wide
      expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(20, 1)
      expect(bounds.max[1] - bounds.min[1]).toBeCloseTo(10, 1)

      sketch.delete()
    })

    it('slot() with length <= width creates circle', () => {
      const sketch = Sketch.slot(M, 10, 10, 16)
      // Area should be close to circle area (allow 1% tolerance)
      const expectedArea = Math.PI * 5 * 5
      expect(Math.abs(sketch.getArea() - expectedArea) / expectedArea).toBeLessThan(0.01)
      sketch.delete()
    })
  })

  describe('transforms', () => {
    it('at() positions sketch', () => {
      const sketch = Sketch.rectangle(M, 10, 10).at(20, 30)
      const bounds = sketch.getBounds()

      expect(bounds.min[0]).toBeCloseTo(15, 1)
      expect(bounds.max[0]).toBeCloseTo(25, 1)
      expect(bounds.min[1]).toBeCloseTo(25, 1)
      expect(bounds.max[1]).toBeCloseTo(35, 1)

      sketch.delete()
    })

    it('translate() moves sketch', () => {
      const sketch = Sketch.rectangle(M, 10, 10).translate(5, 10)
      const bounds = sketch.getBounds()

      expect(bounds.min[0]).toBeCloseTo(0, 1)
      expect(bounds.max[0]).toBeCloseTo(10, 1)
      expect(bounds.min[1]).toBeCloseTo(5, 1)
      expect(bounds.max[1]).toBeCloseTo(15, 1)

      sketch.delete()
    })

    it('rotate() rotates sketch', () => {
      const sketch = Sketch.rectangle(M, 20, 10).rotate(90)
      const bounds = sketch.getBounds()

      // After 90 degree rotation, dimensions swap
      expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(10, 1)
      expect(bounds.max[1] - bounds.min[1]).toBeCloseTo(20, 1)

      sketch.delete()
    })

    it('scale() scales uniformly', () => {
      const sketch = Sketch.rectangle(M, 10, 10).scale(2)
      const bounds = sketch.getBounds()

      expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(20, 1)
      expect(bounds.max[1] - bounds.min[1]).toBeCloseTo(20, 1)

      sketch.delete()
    })

    it('scale() scales per-axis', () => {
      const sketch = Sketch.rectangle(M, 10, 10).scale(2, 3)
      const bounds = sketch.getBounds()

      expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(20, 1)
      expect(bounds.max[1] - bounds.min[1]).toBeCloseTo(30, 1)

      sketch.delete()
    })

    it('mirror("x") mirrors across Y axis', () => {
      const sketch = Sketch.rectangle(M, 10, 10).translate(10, 0).mirror('x')
      const bounds = sketch.getBounds()

      // Original was at 5-15, mirrored should be at -15 to -5
      expect(bounds.min[0]).toBeCloseTo(-15, 1)
      expect(bounds.max[0]).toBeCloseTo(-5, 1)

      sketch.delete()
    })

    it('mirror("y") mirrors across X axis', () => {
      const sketch = Sketch.rectangle(M, 10, 10).translate(0, 10).mirror('y')
      const bounds = sketch.getBounds()

      // Original was at 5-15, mirrored should be at -15 to -5
      expect(bounds.min[1]).toBeCloseTo(-15, 1)
      expect(bounds.max[1]).toBeCloseTo(-5, 1)

      sketch.delete()
    })
  })

  describe('boolean operations', () => {
    it('add() unions two sketches', () => {
      const rect1 = Sketch.rectangle(M, 10, 10)
      const rect2 = Sketch.rectangle(M, 10, 10).translate(5, 0)
      const result = rect1.add(rect2)

      const bounds = result.getBounds()
      expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(15, 1)

      result.delete()
    })

    it('subtract() creates difference', () => {
      const outer = Sketch.rectangle(M, 20, 20)
      const inner = Sketch.circle(M, 5, 32).at(0, 0)
      const result = outer.subtract(inner)

      // Area should be square minus circle (allow 1% tolerance due to polygon approx)
      const expectedArea = 400 - Math.PI * 25
      expect(Math.abs(result.getArea() - expectedArea) / expectedArea).toBeLessThan(0.01)

      result.delete()
    })

    it('subtract() accepts multiple sketches', () => {
      const outer = Sketch.rectangle(M, 30, 20)
      const hole1 = Sketch.circle(M, 3, 16).at(-8, 0)
      const hole2 = Sketch.circle(M, 3, 16).at(8, 0)
      const result = outer.subtract(hole1, hole2)

      // Area should be rectangle minus two circles (allow 1% tolerance)
      const expectedArea = 600 - 2 * Math.PI * 9
      expect(Math.abs(result.getArea() - expectedArea) / expectedArea).toBeLessThan(0.01)

      result.delete()
    })

    it('intersect() creates intersection', () => {
      const rect1 = Sketch.rectangle(M, 10, 10)
      const rect2 = Sketch.rectangle(M, 10, 10).translate(5, 5)
      const result = rect1.intersect(rect2)

      // Intersection should be 5x5 = 25
      expect(result.getArea()).toBeCloseTo(25, 0)

      result.delete()
    })
  })

  describe('modifiers', () => {
    it('roundCorners() rounds corners', () => {
      const sharp = Sketch.rectangle(M, 20, 20)
      const rounded = Sketch.rectangle(M, 20, 20).roundCorners(2)

      // Rounded should have slightly less area due to corner removal
      expect(rounded.getArea()).toBeLessThan(400)
      expect(rounded.getArea()).toBeGreaterThan(350)

      sharp.delete()
      rounded.delete()
    })

    it('roundCorners(0) returns unchanged sketch', () => {
      const sketch = Sketch.rectangle(M, 20, 20).roundCorners(0)

      expect(sketch.getArea()).toBeCloseTo(400, 0)
      sketch.delete()
    })

    it('offset() expands positive', () => {
      const original = Sketch.rectangle(M, 10, 10)
      const expanded = Sketch.rectangle(M, 10, 10).offset(2)

      expect(expanded.getArea()).toBeGreaterThan(100)

      original.delete()
      expanded.delete()
    })

    it('offset() contracts negative', () => {
      const original = Sketch.rectangle(M, 20, 20)
      const contracted = Sketch.rectangle(M, 20, 20).offset(-2)

      expect(contracted.getArea()).toBeLessThan(400)

      original.delete()
      contracted.delete()
    })
  })

  describe('3D conversion', () => {
    it('extrude() creates 3D shape', () => {
      const sketch = Sketch.rectangle(M, 10, 20)
      const shape = sketch.extrude(5)

      expectValid(shape.build())
      expectDimensions(shape.build(), { width: 10, depth: 20, height: 5 })

      shape.delete()
    })

    it('extrude() with twist creates twisted shape', () => {
      const sketch = Sketch.rectangle(M, 10, 10)
      const shape = sketch.extrude(20, { twist: 90, divisions: 10 })

      expectValid(shape.build())
      // Shape should be valid 3D geometry
      expect(shape.getVolume()).toBeGreaterThan(0)

      shape.delete()
    })

    it('extrude() with scale creates tapered shape', () => {
      const sketch = Sketch.rectangle(M, 10, 10)
      const shape = sketch.extrude(10, { scale: 0.5 })

      expectValid(shape.build())
      // Volume should be less than a full box (some tapering)
      expect(shape.getVolume()).toBeLessThan(1000)
      expect(shape.getVolume()).toBeGreaterThan(0)

      shape.delete()
    })

    it('revolve() creates revolved shape', () => {
      // Create L-shaped profile for revolution
      const profile = Sketch.polygon(M, [
        [5, 0],
        [10, 0],
        [10, 20],
        [5, 20]
      ])
      const shape = profile.revolve(360, 32)

      expectValid(shape.build())
      expect(shape.getVolume()).toBeGreaterThan(0)

      shape.delete()
    })

    it('revolve() with partial angle creates arc', () => {
      const profile = Sketch.polygon(M, [
        [5, 0],
        [10, 0],
        [10, 10],
        [5, 10]
      ])
      const shape = profile.revolve(180, 16)

      expectValid(shape.build())
      shape.delete()
    })
  })

  describe('hull', () => {
    it('hull() creates convex hull of two sketches', () => {
      const circle1 = Sketch.circle(M, 5, 16).at(0, 0)
      const circle2 = Sketch.circle(M, 5, 16).at(20, 0)
      const result = Sketch.hull(M, circle1, circle2)

      const bounds = result.getBounds()
      expect(bounds.min[0]).toBeCloseTo(-5, 1)
      expect(bounds.max[0]).toBeCloseTo(25, 1)

      result.delete()
    })

    it('hull() consumes input sketches', () => {
      const a = Sketch.circle(M, 5, 16)
      const b = Sketch.circle(M, 5, 16).at(20, 0)
      Sketch.hull(M, a, b)

      expect(a.isConsumed()).toBe(true)
      expect(b.isConsumed()).toBe(true)
    })
  })

  describe('consumption safety', () => {
    it('throws when accessing consumed sketch', () => {
      const sketch = Sketch.rectangle(M, 10, 10)
      sketch.translate(1, 0)

      expect(() => sketch.translate(2, 0)).toThrow(/consumed/i)
    })

    it('clone() creates non-consumed copy', () => {
      const sketch = Sketch.rectangle(M, 10, 10)
      const cloned = sketch.clone()
      sketch.translate(1, 0)

      // Clone should still be usable
      expect(cloned.getArea()).toBeCloseTo(100, 0)
      cloned.delete()
    })

    it('isConsumed() returns correct state', () => {
      const sketch = Sketch.rectangle(M, 10, 10)
      expect(sketch.isConsumed()).toBe(false)

      sketch.translate(1, 0)
      expect(sketch.isConsumed()).toBe(true)
    })
  })

  describe('chaining', () => {
    it('supports fluent chaining', () => {
      const shape = Sketch.rectangle(M, 20, 10)
        .roundCorners(2)
        .subtract(Sketch.circle(M, 3, 16).at(0, 0))
        .extrude(5)

      expectValid(shape.build())
      shape.delete()
    })

    it('complex shape with multiple operations', () => {
      const shape = Sketch.rectangle(M, 30, 20)
        .subtract(
          Sketch.circle(M, 3, 16).at(-10, 0),
          Sketch.circle(M, 3, 16).at(10, 0)
        )
        .roundCorners(1)
        .extrude(3)

      expectValid(shape.build())
      expect(shape.getVolume()).toBeGreaterThan(0)
      shape.delete()
    })
  })
})
