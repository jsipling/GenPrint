import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectValid, expectDimensions, expectVolumeApprox } from '../../../../test/geometryHelpers'
import { createPrimitives } from '../primitives'
import { createOperations } from '../operations'
import { MIN_WALL_THICKNESS, MIN_SMALL_FEATURE } from '../../printingConstants'
import type { Primitives } from '../primitives'
import type { Operations } from '../operations'

describe('operations', () => {
  let M: ManifoldToplevel
  let p: Primitives
  let ops: Operations

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
    p = createPrimitives(M)
    ops = createOperations(M)
  })

  describe('batch CSG', () => {
    it('union() combines multiple shapes', () => {
      const box1 = p.box(10, 10, 10)
      const box2 = p.box(10, 10, 10).translate(5, 0, 0)
      const box3 = p.box(10, 10, 10).translate(10, 0, 0)

      const result = ops.union(box1, box2, box3)

      expectValid(result.build())
      expectDimensions(result.build(), { width: 20 }) // 10 + 5 + 5 = 20
      result.delete()
    })

    it('union() with single shape returns that shape', () => {
      const box = p.box(10, 10, 10)
      const originalVolume = box.getVolume()
      const result = ops.union(box)

      expect(result.getVolume()).toBeCloseTo(originalVolume, 0)
      result.delete()
    })

    it('difference() subtracts multiple tools', () => {
      const base = p.box(30, 30, 10)
      const hole1 = p.hole(5, 15).translate(-8, 0, 0)
      const hole2 = p.hole(5, 15).translate(8, 0, 0)

      const result = ops.difference(base, hole1, hole2)

      expectValid(result.build())
      const expectedVolume = 30 * 30 * 10 - 2 * Math.PI * 6.25 * 10
      expectVolumeApprox(result.build(), expectedVolume, 0.05)
      result.delete()
    })

    it('intersection() finds common volume', () => {
      const box1 = p.box(10, 10, 10)
      const box2 = p.box(10, 10, 10).translate(5, 5, 0)

      const result = ops.intersection(box1, box2)

      expectValid(result.build())
      // Intersection is 5x5x10 = 250
      expect(result.getVolume()).toBeCloseTo(250, 0)
      result.delete()
    })
  })

  describe('patterns', () => {
    it('linearArray() creates evenly spaced copies', () => {
      const box = p.box(5, 5, 5)
      const result = ops.linearArray(box, 4, [10, 0, 0])

      // For disjoint geometry (non-overlapping shapes), volume is the key check
      // Genus can be negative for multiple disjoint components
      expect(result.getVolume()).toBeCloseTo(4 * 125, 0) // 4 cubes of 5x5x5

      // 4 boxes at 0, 10, 20, 30 = spans from -2.5 to 32.5 = 35mm
      expectDimensions(result.build(), { width: 35 })
      result.delete()
    })

    it('linearArray() with diagonal spacing', () => {
      const box = p.box(5, 5, 5)
      const result = ops.linearArray(box, 3, [10, 10, 10])

      // For disjoint geometry, check volume instead of genus
      expect(result.getVolume()).toBeCloseTo(3 * 125, 0) // 3 cubes of 5x5x5

      // 3 boxes along diagonal
      const bbox = result.getBoundingBox()
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(25, 0) // 0 to 20 + 5
      expect(bbox.max[1] - bbox.min[1]).toBeCloseTo(25, 0)
      expect(bbox.max[2] - bbox.min[2]).toBeCloseTo(25, 0)
      result.delete()
    })

    it('polarArray() creates rotational pattern', () => {
      const box = p.box(5, 5, 5, false).translate(15, 0, 0)
      const result = ops.polarArray(box, 6, 'z')

      // For disjoint geometry, check volume instead of genus
      expect(result.getVolume()).toBeCloseTo(6 * 125, 0) // 6 cubes of 5x5x5

      // 6 boxes around Z axis should span roughly 40mm in X and Y
      const bbox = result.getBoundingBox()
      expect(bbox.max[0]).toBeGreaterThan(15)
      expect(bbox.min[0]).toBeLessThan(-10)
      result.delete()
    })

    it('gridArray() creates 2D grid of copies', () => {
      const box = p.box(5, 5, 5)
      const result = ops.gridArray(box, 3, 2, 10, 10)

      // For disjoint geometry, check volume instead of genus
      expect(result.getVolume()).toBeCloseTo(6 * 125, 0) // 3x2 = 6 cubes of 5x5x5

      // 3x2 grid with 10mm spacing
      // X: -2.5 to 22.5 = 25mm, Y: -2.5 to 12.5 = 15mm
      expectDimensions(result.build(), { width: 25, depth: 15 })
      result.delete()
    })
  })

  describe('printing constraints', () => {
    it('ensureMinWall() enforces minimum thickness', () => {
      expect(ops.ensureMinWall(0.5)).toBe(MIN_WALL_THICKNESS)
      expect(ops.ensureMinWall(2.0)).toBe(2.0)
      expect(ops.ensureMinWall(1.2)).toBe(1.2)
    })

    it('ensureMinFeature() enforces minimum feature size', () => {
      expect(ops.ensureMinFeature(0.5)).toBe(MIN_SMALL_FEATURE)
      expect(ops.ensureMinFeature(3.0)).toBe(3.0)
      expect(ops.ensureMinFeature(1.5)).toBe(1.5)
    })

    it('safeWall() clamps to both min and max', () => {
      // Below minimum
      expect(ops.safeWall(0.5)).toBe(MIN_WALL_THICKNESS)

      // Normal range
      expect(ops.safeWall(2.0)).toBe(2.0)

      // Above geometry maximum
      expect(ops.safeWall(5.0, 3.0)).toBe(3.0)

      // Below minimum but also below max
      expect(ops.safeWall(0.5, 3.0)).toBe(MIN_WALL_THICKNESS)
    })
  })

  describe('findDisconnected', () => {
    it('returns empty array when all parts overlap with main body', () => {
      const main = p.box(20, 20, 20)
      const part1 = p.box(5, 5, 5).translate(5, 0, 0).name('part1')
      const part2 = p.box(5, 5, 5).translate(-5, 0, 0).name('part2')

      const result = ops.findDisconnected(main, [part1, part2])
      expect(result).toEqual([])
    })

    it('identifies parts that do not overlap with main body', () => {
      const main = p.box(20, 20, 20)
      const connected = p.box(5, 5, 5).translate(5, 0, 0).name('connected')
      const disconnected = p.box(5, 5, 5).translate(50, 0, 0).name('disconnected')

      const result = ops.findDisconnected(main, [connected, disconnected])
      expect(result).toEqual(['disconnected'])
    })

    it('returns unnamed for parts without names', () => {
      const main = p.box(20, 20, 20)
      const disconnected = p.box(5, 5, 5).translate(50, 0, 0) // No name

      const result = ops.findDisconnected(main, [disconnected])
      expect(result).toEqual(['<unnamed>'])
    })

    it('respects minVolume option', () => {
      const main = p.box(20, 20, 20)
      // Barely overlapping - 0.5mm overlap = 0.5 * 5 * 5 = 12.5 mm³
      const barelyConnected = p.box(5, 5, 5).translate(12.25, 0, 0).name('barelyConnected')

      // With low threshold, should be considered connected
      const resultLow = ops.findDisconnected(main, [barelyConnected.clone()], { minVolume: 1 })
      expect(resultLow).toEqual([])

      // With high threshold, should be considered disconnected
      const resultHigh = ops.findDisconnected(main, [barelyConnected], { minVolume: 100 })
      expect(resultHigh).toEqual(['barelyConnected'])
    })

    it('returns multiple disconnected parts', () => {
      const main = p.box(10, 10, 10)
      const disc1 = p.box(5, 5, 5).translate(50, 0, 0).name('disc1')
      const disc2 = p.box(5, 5, 5).translate(-50, 0, 0).name('disc2')
      const disc3 = p.box(5, 5, 5).translate(0, 50, 0).name('disc3')

      const result = ops.findDisconnected(main, [disc1, disc2, disc3])
      expect(result).toHaveLength(3)
      expect(result).toContain('disc1')
      expect(result).toContain('disc2')
      expect(result).toContain('disc3')
    })

    it('does not consume the main body or parts', () => {
      const main = p.box(20, 20, 20)
      const part = p.box(5, 5, 5).translate(50, 0, 0).name('part')

      ops.findDisconnected(main, [part])

      // Both should still be usable
      expect(main.getVolume()).toBeCloseTo(8000, 0)
      expect(part.getVolume()).toBeCloseTo(125, 0)

      main.delete()
      part.delete()
    })
  })

  describe('edge cases', () => {
    it('union() with empty array returns empty geometry', () => {
      const result = ops.union()
      expect(result.getVolume()).toBe(0)
      result.delete()
    })

    it('linearArray() with count 0 returns empty geometry', () => {
      const box = p.box(10, 10, 10)
      const result = ops.linearArray(box, 0, [10, 0, 0])
      expect(result.getVolume()).toBe(0)
      result.delete()
    })

    it('gridArray() with zero count returns empty geometry', () => {
      const box = p.box(10, 10, 10)
      const result = ops.gridArray(box, 0, 3, 10, 10)
      expect(result.getVolume()).toBe(0)
      result.delete()
    })

    it('linearArray() with zero spacing clamps to minimum spacing', () => {
      const box = p.box(5, 5, 5)
      const result = ops.linearArray(box, 3, [0, 0, 0])

      // With clamped spacing (MIN_SMALL_FEATURE = 1.5mm), 5mm cubes will still overlap
      // but volume should be greater than a single cube
      expect(result.getVolume()).toBeGreaterThan(125) // More than single cube
      result.delete()
    })

    it('gridArray() with zero spacing clamps to minimum spacing', () => {
      const box = p.box(5, 5, 5)
      const result = ops.gridArray(box, 2, 2, 0, 0)

      // With clamped spacing (MIN_SMALL_FEATURE = 1.5mm), 5mm cubes will still overlap
      // but volume should be greater than a single cube
      expect(result.getVolume()).toBeGreaterThan(125) // More than single cube
      result.delete()
    })

    it('linearArray() with negative spacing clamps to minimum', () => {
      const box = p.box(5, 5, 5)
      const result = ops.linearArray(box, 3, [-10, 0, 0])

      // Should still produce valid geometry with positive spacing
      expect(result.getVolume()).toBeGreaterThan(125) // More than single cube
      result.delete()
    })

    it('gridArray() with negative spacing clamps to minimum', () => {
      const box = p.box(5, 5, 5)
      const result = ops.gridArray(box, 2, 2, -10, -10)

      // Should still produce valid geometry with positive spacing
      expect(result.getVolume()).toBeGreaterThan(125) // More than single cube
      result.delete()
    })
  })
})
