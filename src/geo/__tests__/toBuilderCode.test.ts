/**
 * Tests for toBuilderCode - converts GeoNode to executable builderCode string
 *
 * This enables backward compatibility with existing generator infrastructure
 * while allowing new code to use the geo API internally.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { toBuilderCode } from '../toBuilderCode'
import { Box } from '../primitives/Box'
import { Cylinder } from '../primitives/Cylinder'
import { Compiler } from '../Compiler'
import { expectValid, expectVolumeApprox, expectDimensions } from '../../test/geometryHelpers'

describe('toBuilderCode', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  /**
   * Helper to execute builderCode string in the same way the worker does
   */
  function executeBuilderCode(code: string) {
    const fn = new Function('M', 'params', code)
    return fn(M, {})
  }

  describe('primitives', () => {
    it('generates valid builderCode for a box', () => {
      const box = new Box({ width: 10, depth: 20, height: 5 })
      const code = toBuilderCode(box.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)
      expectDimensions(result, { width: 10, depth: 20, height: 5 })
      result.delete()
    })

    it('generates valid builderCode for a cylinder', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      const code = toBuilderCode(cyl.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)
      expectVolumeApprox(result, Math.PI * 25 * 20, 0.02)
      result.delete()
    })
  })

  describe('transforms', () => {
    it('handles translated shapes', () => {
      const box = new Box({ width: 10, depth: 10, height: 10 })
      const target = new Box({ width: 10, depth: 10, height: 10 })

      // Move box up by aligning bottom to top of target
      box.align({
        self: 'bottom',
        target: target,
        to: 'top',
        mode: 'mate'
      })

      const code = toBuilderCode(box.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)
      // Box should be at z=5 to z=15 (translated up by 10)
      const bbox = result.boundingBox()
      expect(bbox.min[2]).toBeCloseTo(5, 1)
      expect(bbox.max[2]).toBeCloseTo(15, 1)

      result.delete()
    })

    it('handles rotated shapes', () => {
      const cyl = new Cylinder({ diameter: 5, height: 20 })
      const target = new Box({ width: 10, depth: 10, height: 10 })

      // Rotate cylinder to point along X axis (mate right sides)
      cyl.align({
        self: 'top',
        target: target,
        to: 'right',
        mode: 'mate'
      })

      const code = toBuilderCode(cyl.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)
      // After rotation, cylinder's height should be along X
      const bbox = result.boundingBox()
      const xExtent = bbox.max[0] - bbox.min[0]
      expect(xExtent).toBeCloseTo(20, 1) // Height becomes X extent

      result.delete()
    })
  })

  describe('boolean operations', () => {
    it('generates valid builderCode for union', () => {
      const box1 = new Box({ width: 10, depth: 10, height: 10 })
      const box2 = new Box({ width: 10, depth: 10, height: 10 })

      // Stack box2 on top of box1
      box2.align({
        self: 'bottom',
        target: box1,
        to: 'top',
        mode: 'mate'
      })

      const part = box1.union(box2)
      const code = toBuilderCode(part.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)
      // Combined height should be 20
      const bbox = result.boundingBox()
      const height = bbox.max[2] - bbox.min[2]
      expect(height).toBeCloseTo(20, 1)

      result.delete()
    })

    it('generates valid builderCode for subtraction', () => {
      const base = new Box({ width: 50, depth: 50, height: 10 })
      const hole = new Cylinder({ diameter: 5, height: 20 })
      hole.align({ self: 'center', target: base, to: 'center' })

      const part = base.subtract(hole)
      const code = toBuilderCode(part.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)
      // Volume should be box minus cylinder through it
      const boxVol = 50 * 50 * 10
      const holeVol = Math.PI * 2.5 * 2.5 * 10
      expectVolumeApprox(result, boxVol - holeVol, 0.02)

      result.delete()
    })

    it('generates valid builderCode for intersection', () => {
      const box1 = new Box({ width: 20, depth: 20, height: 20 })
      const box2 = new Box({ width: 20, depth: 20, height: 20 })

      // Offset box2 by 10 in X (align left side to center of box1)
      box2.align({
        self: 'left',
        target: box1,
        to: 'center',
        mode: 'flush'
      })

      const part = box1.intersect(box2)
      const code = toBuilderCode(part.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)
      // Intersection should be half the box (10x20x20)
      expectVolumeApprox(result, 10 * 20 * 20, 0.02)

      result.delete()
    })

    it('handles chained subtractions', () => {
      const base = new Box({ width: 30, depth: 30, height: 10 })
      const hole1 = new Cylinder({ diameter: 5, height: 20 })
      const hole2 = new Cylinder({ diameter: 5, height: 20 })

      hole1.align({ self: 'center', target: base, to: 'center', offset: { x: -8 } })
      hole2.align({ self: 'center', target: base, to: 'center', offset: { x: 8 } })

      const part = base.subtract(hole1).subtract(hole2)
      const code = toBuilderCode(part.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)

      // Volume should be base minus two holes
      const baseVol = 30 * 30 * 10
      const holeVol = Math.PI * 2.5 * 2.5 * 10 * 2
      expectVolumeApprox(result, baseVol - holeVol, 0.02)

      result.delete()
    })
  })

  describe('equivalence with Compiler', () => {
    it('produces same result as direct compilation for simple box', () => {
      const box = new Box({ width: 30, depth: 20, height: 10 })
      const node = box.getNode()

      // Direct compilation
      const compiler = new Compiler(M)
      const directResult = compiler.compile(node)

      // Via builderCode
      const code = toBuilderCode(node)
      const codeResult = executeBuilderCode(code)

      // Should have same volume
      const directVol = directResult.volume()
      const codeVol = codeResult.volume()
      expect(Math.abs(directVol - codeVol) / directVol).toBeLessThan(0.01)

      directResult.delete()
      codeResult.delete()
    })

    it('produces same result as direct compilation for complex assembly', () => {
      const base = new Box({ width: 30, depth: 30, height: 8 })
      const peg = new Cylinder({ diameter: 6, height: 15 })
      peg.align({ self: 'bottom', target: base, to: 'top' })
      const part = base.union(peg)
      const node = part.getNode()

      // Direct compilation
      const compiler = new Compiler(M)
      const directResult = compiler.compile(node)

      // Via builderCode
      const code = toBuilderCode(node)
      const codeResult = executeBuilderCode(code)

      // Should have same volume
      const directVol = directResult.volume()
      const codeVol = codeResult.volume()
      expect(Math.abs(directVol - codeVol) / directVol).toBeLessThan(0.01)

      directResult.delete()
      codeResult.delete()
    })

    it('produces same result for plate with holes', () => {
      const plate = new Box({ width: 60, depth: 60, height: 5 })
      const hole1 = new Cylinder({ diameter: 4, height: 10 })
      const hole2 = new Cylinder({ diameter: 4, height: 10 })

      hole1.align({ self: 'center', target: plate, to: 'center', offset: { x: -20, y: -20 } })
      hole2.align({ self: 'center', target: plate, to: 'center', offset: { x: 20, y: 20 } })

      const part = plate.subtract(hole1).subtract(hole2)
      const node = part.getNode()

      // Direct compilation
      const compiler = new Compiler(M)
      const directResult = compiler.compile(node)

      // Via builderCode
      const code = toBuilderCode(node)
      const codeResult = executeBuilderCode(code)

      // Should have same volume within tolerance
      const directVol = directResult.volume()
      const codeVol = codeResult.volume()
      expect(Math.abs(directVol - codeVol) / directVol).toBeLessThan(0.01)

      directResult.delete()
      codeResult.delete()
    })
  })

  describe('edge cases', () => {
    it('handles deeply nested operations', () => {
      // ((box - cyl1) union box2) - cyl2
      const box1 = new Box({ width: 40, depth: 40, height: 10 })
      const cyl1 = new Cylinder({ diameter: 5, height: 20 })
      const box2 = new Box({ width: 10, depth: 10, height: 15 })
      const cyl2 = new Cylinder({ diameter: 3, height: 30 })

      cyl1.align({ self: 'center', target: box1, to: 'center' })
      box2.align({ self: 'bottom', target: box1, to: 'top' })
      cyl2.align({ self: 'center', target: box1, to: 'center', offset: { x: 10 } })

      const part = box1.subtract(cyl1).union(box2).subtract(cyl2)
      const code = toBuilderCode(part.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)
      result.delete()
    })

    it('handles identity transform (no actual transform)', () => {
      // Create a box without any alignment - should have identity transform
      const box = new Box({ width: 15, depth: 15, height: 15 })
      const code = toBuilderCode(box.getNode())
      const result = executeBuilderCode(code)

      expectValid(result)
      expectDimensions(result, { width: 15, depth: 15, height: 15 })

      // Should be centered at origin
      const bbox = result.boundingBox()
      expect(bbox.min[0]).toBeCloseTo(-7.5, 1)
      expect(bbox.max[0]).toBeCloseTo(7.5, 1)

      result.delete()
    })
  })
})
