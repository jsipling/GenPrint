import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectValid } from '../../../../test/geometryHelpers'
import { createPrimitives } from '../primitives'
import { createOperations } from '../operations'
import type { Primitives } from '../primitives'
import type { Operations } from '../operations'

describe('operations', () => {
  let M: ManifoldToplevel
  let p: Primitives
  let ops: Operations

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
    p = createPrimitives(M)
    ops = createOperations(M)
  })

  describe('union() connectivity validation', () => {
    it('union() succeeds for overlapping shapes', () => {
      const part1 = p.box(10, 10, 10).name('partA')
      const part2 = p.box(10, 10, 10).translate(5, 0, 0).name('partB')
      const result = ops.union(part1, part2)

      expectValid(result.build())
      result.delete()
    })

    it('union() succeeds for touching shapes (bounding boxes adjacent)', () => {
      const part1 = p.box(10, 10, 10).name('left')
      const part2 = p.box(10, 10, 10).translate(10, 0, 0).name('right') // adjacent

      const result = ops.union(part1, part2)

      expectValid(result.build())
      result.delete()
    })

    it('union() throws for disconnected shapes', () => {
      const part1 = p.box(10, 10, 10).name('partA')
      const part2 = p.box(10, 10, 10).translate(50, 0, 0).name('partB') // far apart

      expect(() => ops.union(part1, part2)).toThrow(/disconnected/i)
    })

    it('union() error identifies disconnected part by index', () => {
      const connected1 = p.box(10, 10, 10).name('main')
      const connected2 = p.box(10, 10, 10).translate(5, 0, 0).name('attached')
      const disconnected = p.box(10, 10, 10).translate(50, 0, 0).name('floating')

      try {
        ops.union(connected1, connected2, disconnected)
        expect.fail('Should have thrown')
      } catch (e) {
        const message = (e as Error).message
        expect(message).toMatch(/index.*2/i)
      }
    })

    it('union() allows disconnected shapes with skipConnectionCheck option', () => {
      const part1 = p.box(10, 10, 10).name('partA')
      const part2 = p.box(10, 10, 10).translate(50, 0, 0).name('partB')

      const result = ops.union(part1, part2, { skipConnectionCheck: true })

      // Geometry is valid (though disconnected)
      expect(result.getVolume()).toBeCloseTo(2000, 0)
      result.delete()
    })

    it('union() validates entire connectivity graph', () => {
      // Three shapes where A-B connected, C disconnected from both
      const a = p.box(10, 10, 10).name('a')
      const b = p.box(10, 10, 10).translate(5, 0, 0).name('b') // overlaps a
      const c = p.box(10, 10, 10).translate(50, 0, 0).name('c') // disconnected

      expect(() => ops.union(a, b, c)).toThrow(/disconnected/i)
    })

    it('union() succeeds for chain of touching shapes', () => {
      // Three shapes in a row, each touching the next
      const a = p.box(10, 10, 10).name('a')
      const b = p.box(10, 10, 10).translate(10, 0, 0).name('b') // touches a
      const c = p.box(10, 10, 10).translate(20, 0, 0).name('c') // touches b

      const result = ops.union(a, b, c)

      expectValid(result.build())
      result.delete()
    })
  })

  describe('union() part tracking', () => {
    it('union() returns Shape that tracks input part names', () => {
      const part1 = p.box(10, 10, 10).name('partA')
      const part2 = p.box(10, 10, 10).translate(5, 0, 0).name('partB')
      const result = ops.union(part1, part2)

      expect(result.getTrackedParts()).toContain('partA')
      expect(result.getTrackedParts()).toContain('partB')
      result.delete()
    })

    it('union() preserves unnamed parts as indexed entries', () => {
      const part1 = p.box(10, 10, 10).name('namedPart')
      const part2 = p.box(10, 10, 10).translate(5, 0, 0) // unnamed
      const result = ops.union(part1, part2)

      const tracked = result.getTrackedParts()
      expect(tracked).toContain('namedPart')
      expect(tracked.some(name => name.startsWith('<part '))).toBe(true)
      result.delete()
    })

    it('union() clones parts before merging for later diagnostics', () => {
      const part1 = p.box(10, 10, 10).name('partA')
      const part2 = p.box(10, 10, 10).translate(5, 0, 0).name('partB')
      const result = ops.union(part1, part2)

      const clones = result.getTrackedPartClones()
      expect(clones.size).toBe(2)
      result.delete()
    })

    it('union() single shape returns unchanged without tracking', () => {
      const part = p.box(10, 10, 10).name('single')
      const result = ops.union(part)

      // Single shape optimization - returned unchanged
      expect(result).toBe(part)
      expect(result.getName()).toBe('single')
      result.delete()
    })

    it('union() result is valid geometry', () => {
      const part1 = p.box(10, 10, 10).name('partA')
      const part2 = p.box(10, 10, 10).translate(5, 0, 0).name('partB')
      const result = ops.union(part1, part2)

      expectValid(result.build())
      result.delete()
    })
  })

  describe('basic operations', () => {
    it('difference() subtracts shapes', () => {
      const base = p.box(20, 20, 20)
      const tool = p.box(10, 10, 10)
      const result = ops.difference(base, tool)

      // 8000 - 1000 = 7000
      expect(result.getVolume()).toBeCloseTo(7000, 0)
      result.delete()
    })

    it('intersection() keeps overlap', () => {
      const a = p.box(10, 10, 10)
      const b = p.box(10, 10, 10).translate(5, 0, 0)
      const result = ops.intersection(a, b)

      // Overlap is 5x10x10 = 500
      expect(result.getVolume()).toBeCloseTo(500, 0)
      result.delete()
    })
  })

  describe('unionAll()', () => {
    it('unionAll() combines array of connected shapes', () => {
      const shapes = [
        p.box(10, 10, 10).name('a'),
        p.box(10, 10, 10).translate(5, 0, 0).name('b'),
        p.box(10, 10, 10).translate(10, 0, 0).name('c')
      ]
      const result = ops.unionAll(shapes)

      expect(result).not.toBeNull()
      expect(result!.getVolume()).toBeGreaterThan(0)
      result!.delete()
    })

    it('unionAll() throws for disconnected shapes', () => {
      const shapes = [
        p.box(10, 10, 10).name('a'),
        p.box(10, 10, 10).translate(5, 0, 0).name('b'),
        p.box(10, 10, 10).translate(50, 0, 0).name('c') // disconnected
      ]

      expect(() => ops.unionAll(shapes)).toThrow(/disconnected/i)
    })

    it('unionAll() allows disconnected shapes with skipConnectionCheck option', () => {
      const shapes = [
        p.box(10, 10, 10).name('a'),
        p.box(10, 10, 10).translate(50, 0, 0).name('b')
      ]

      const result = ops.unionAll(shapes, { skipConnectionCheck: true })

      expect(result).not.toBeNull()
      expect(result!.getVolume()).toBeCloseTo(2000, 0)
      result!.delete()
    })

    it('unionAll() filters null values', () => {
      const shapes = [
        p.box(10, 10, 10).name('a'),
        null,
        p.box(10, 10, 10).translate(5, 0, 0).name('b'),
        undefined,
        p.box(10, 10, 10).translate(10, 0, 0).name('c')
      ]
      const result = ops.unionAll(shapes)

      expect(result).not.toBeNull()
      expect(result!.getTrackedParts()).toHaveLength(3)
      result!.delete()
    })

    it('unionAll() returns null for empty array', () => {
      const result = ops.unionAll([])
      expect(result).toBeNull()
    })

    it('unionAll() returns null for array of only nulls', () => {
      const result = ops.unionAll([null, undefined, null])
      expect(result).toBeNull()
    })

    it('unionAll() returns single shape for array with one shape', () => {
      const shape = p.box(10, 10, 10).name('single')
      const result = ops.unionAll([shape])

      expect(result).toBe(shape)
      result!.delete()
    })
  })

  describe('findDisconnected', () => {
    it('finds parts that do not overlap with main body', () => {
      const mainBody = p.box(20, 20, 20)
      const connected = p.box(10, 10, 10).translate(10, 0, 0).name('connected')
      const disconnected = p.box(5, 5, 5).translate(50, 0, 0).name('floating')

      const result = ops.findDisconnected(mainBody, [connected, disconnected])

      expect(result).toContain('floating')
      expect(result).not.toContain('connected')

      mainBody.delete()
      connected.delete()
      disconnected.delete()
    })

    it('returns empty array when all parts overlap', () => {
      const mainBody = p.box(20, 20, 20)
      const connected1 = p.box(10, 10, 10).translate(10, 0, 0).name('part1')
      const connected2 = p.box(10, 10, 10).translate(-10, 0, 0).name('part2')

      const result = ops.findDisconnected(mainBody, [connected1, connected2])

      expect(result).toHaveLength(0)

      mainBody.delete()
      connected1.delete()
      connected2.delete()
    })
  })
})
