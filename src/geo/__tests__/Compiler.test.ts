import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { Compiler } from '../Compiler'
import type { GeoNode } from '../types'
import { Box } from '../primitives/Box'
import { Cylinder } from '../primitives/Cylinder'
import { expectValid, expectDimensions, expectVolumeApprox } from '../../test/geometryHelpers'

describe('Compiler', () => {
  let M: ManifoldToplevel
  let compiler: Compiler

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
    compiler = new Compiler(M)
  })

  describe('primitives', () => {
    it('compiles a box primitive', () => {
      const node: GeoNode = { type: 'primitive', shape: 'box', width: 10, depth: 20, height: 5 }
      const result = compiler.compile(node)

      expectValid(result)
      expectDimensions(result, { width: 10, depth: 20, height: 5 })

      result.delete()
    })

    it('compiles a cylinder primitive', () => {
      const node: GeoNode = { type: 'primitive', shape: 'cylinder', diameter: 10, height: 20 }
      const result = compiler.compile(node)

      expectValid(result)
      // Cylinder volume = pi * r^2 * h
      const expectedVolume = Math.PI * 25 * 20 // r=5, h=20
      expectVolumeApprox(result, expectedVolume, 0.02) // 2% tolerance for cylinder approximation

      result.delete()
    })

    it('respects circularSegments option', () => {
      const lowSegmentsCompiler = new Compiler(M, { circularSegments: 8 })
      const highSegmentsCompiler = new Compiler(M, { circularSegments: 64 })

      const node: GeoNode = { type: 'primitive', shape: 'cylinder', diameter: 10, height: 20 }

      const lowResult = lowSegmentsCompiler.compile(node)
      const highResult = highSegmentsCompiler.compile(node)

      expectValid(lowResult)
      expectValid(highResult)

      // Lower segments = fewer vertices
      const lowMesh = lowResult.getMesh()
      const highMesh = highResult.getMesh()
      expect(lowMesh.numVert).toBeLessThan(highMesh.numVert)

      lowResult.delete()
      highResult.delete()
    })
  })

  describe('operations', () => {
    it('compiles union of two boxes', () => {
      const node: GeoNode = {
        type: 'operation',
        op: 'union',
        children: [
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 }
        ]
      }
      const result = compiler.compile(node)

      expectValid(result)
      // Two overlapping boxes at origin have volume = 1000 (they fully overlap)
      expectVolumeApprox(result, 1000, 0.01)

      result.delete()
    })

    it('compiles subtraction (box with hole)', () => {
      // A 50x50x10 box with a diameter 5 cylinder hole through center
      const node: GeoNode = {
        type: 'operation',
        op: 'subtract',
        children: [
          { type: 'primitive', shape: 'box', width: 50, depth: 50, height: 10 },
          { type: 'primitive', shape: 'cylinder', diameter: 5, height: 20 }
        ]
      }
      const result = compiler.compile(node)

      expectValid(result)
      const boxVolume = 50 * 50 * 10
      const holeVolume = Math.PI * 2.5 * 2.5 * 10 // Cylinder cuts through 10mm of box
      expectVolumeApprox(result, boxVolume - holeVolume, 0.02)

      result.delete()
    })

    it('compiles intersection', () => {
      // Two boxes that partially overlap
      const node: GeoNode = {
        type: 'operation',
        op: 'intersect',
        children: [
          {
            type: 'transform',
            child: { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] // identity
          },
          {
            type: 'transform',
            child: { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
            matrix: [1, 0, 0, 5, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] // translate X by 5
          }
        ]
      }
      const result = compiler.compile(node)

      expectValid(result)
      // Intersection is a 5x10x10 box
      expectVolumeApprox(result, 500, 0.01)

      result.delete()
    })

    it('throws error for operation with no children', () => {
      const node: GeoNode = {
        type: 'operation',
        op: 'union',
        children: []
      }

      expect(() => compiler.compile(node)).toThrow('Operation requires at least one child')
    })

    it('handles single-child union', () => {
      const node: GeoNode = {
        type: 'operation',
        op: 'union',
        children: [{ type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 }]
      }
      const result = compiler.compile(node)

      expectValid(result)
      expectVolumeApprox(result, 1000, 0.01)

      result.delete()
    })
  })

  describe('transforms', () => {
    it('applies translation transform', () => {
      const node: GeoNode = {
        type: 'transform',
        child: { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        matrix: [1, 0, 0, 100, 0, 1, 0, 200, 0, 0, 1, 300, 0, 0, 0, 1]
      }
      const result = compiler.compile(node)

      expectValid(result)
      const bbox = result.boundingBox()
      // Centered box translated to (100, 200, 300)
      expect(bbox.min[0]).toBeCloseTo(95, 1)
      expect(bbox.min[1]).toBeCloseTo(195, 1)
      expect(bbox.min[2]).toBeCloseTo(295, 1)

      result.delete()
    })

    it('applies rotation transform', () => {
      // 90 degree rotation around Z axis
      const node: GeoNode = {
        type: 'transform',
        child: { type: 'primitive', shape: 'box', width: 20, depth: 10, height: 5 },
        matrix: [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] // 90 deg Z rotation
      }
      const result = compiler.compile(node)

      expectValid(result)
      // After 90 deg Z rotation, width/depth swap
      expectDimensions(result, { width: 10, depth: 20, height: 5 })

      result.delete()
    })

    it('preserves volume under translation', () => {
      const baseNode: GeoNode = { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 }
      const translatedNode: GeoNode = {
        type: 'transform',
        child: baseNode,
        matrix: [1, 0, 0, 50, 0, 1, 0, 50, 0, 0, 1, 50, 0, 0, 0, 1]
      }

      const base = compiler.compile(baseNode)
      const translated = compiler.compile(translatedNode)

      expect(translated.volume()).toBeCloseTo(base.volume(), 6)

      base.delete()
      translated.delete()
    })
  })

  describe('nested structures', () => {
    it('compiles deeply nested operations', () => {
      // ((box1 - cylinder) union box2) - cylinder2
      const node: GeoNode = {
        type: 'operation',
        op: 'subtract',
        children: [
          {
            type: 'operation',
            op: 'union',
            children: [
              {
                type: 'operation',
                op: 'subtract',
                children: [
                  { type: 'primitive', shape: 'box', width: 30, depth: 30, height: 10 },
                  { type: 'primitive', shape: 'cylinder', diameter: 5, height: 20 }
                ]
              },
              {
                type: 'transform',
                child: { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 20 },
                matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 10, 0, 0, 0, 1] // translate up
              }
            ]
          },
          {
            type: 'transform',
            child: { type: 'primitive', shape: 'cylinder', diameter: 3, height: 40 },
            matrix: [1, 0, 0, 5, 0, 1, 0, 5, 0, 0, 1, 0, 0, 0, 0, 1] // offset
          }
        ]
      }
      const result = compiler.compile(node)

      expectValid(result)
      expect(result.volume()).toBeGreaterThan(0)

      result.delete()
    })
  })

  describe('integration with Shape API', () => {
    it('compiles a Shape.getNode() result', () => {
      const box = new Box({ width: 30, depth: 20, height: 10 })
      const result = compiler.compile(box.getNode())

      expectValid(result)
      expectDimensions(result, { width: 30, depth: 20, height: 10 })

      result.delete()
    })

    it('compiles aligned shapes', () => {
      const base = new Box({ width: 50, depth: 50, height: 10 })
      const peg = new Cylinder({ diameter: 10, height: 20 })

      // Stack peg on top of base (mate bottom of peg to top of base)
      peg.align({
        self: 'bottom',
        target: base,
        to: 'top',
        mode: 'mate'
      })

      const combined = base.union(peg)
      const result = compiler.compile(combined.getNode())

      expectValid(result)
      // Total height should be base (10) + peg (20) = 30
      const bbox = result.boundingBox()
      const height = bbox.max[2] - bbox.min[2]
      expect(height).toBeCloseTo(30, 1)

      result.delete()
    })

    it('compiles subtraction with alignment (hole in box)', () => {
      const base = new Box({ width: 50, depth: 50, height: 10 })
      const hole = new Cylinder({ diameter: 5, height: 20 })

      hole.align({
        self: 'center',
        target: base,
        to: 'center',
        mode: 'flush'
      })

      const result = compiler.compile(base.subtract(hole).getNode())

      expectValid(result)
      result.delete()
    })

    it('compiles complex assembly', () => {
      // Create a plate with 4 corner holes
      const plate = new Box({ width: 100, depth: 100, height: 10 })

      // Create holes at corners
      const hole1 = new Cylinder({ diameter: 5, height: 20 })
      const hole2 = new Cylinder({ diameter: 5, height: 20 })
      const hole3 = new Cylinder({ diameter: 5, height: 20 })
      const hole4 = new Cylinder({ diameter: 5, height: 20 })

      // Position holes at corners (offset from edges)
      hole1.align({ self: 'center', target: plate, to: 'topFrontLeft', offset: { x: 10, y: 10 } })
      hole2.align({ self: 'center', target: plate, to: 'topFrontRight', offset: { x: -10, y: 10 } })
      hole3.align({ self: 'center', target: plate, to: 'topBackLeft', offset: { x: 10, y: -10 } })
      hole4.align({ self: 'center', target: plate, to: 'topBackRight', offset: { x: -10, y: -10 } })

      const withHoles = plate.subtract(hole1).subtract(hole2).subtract(hole3).subtract(hole4)
      const result = compiler.compile(withHoles.getNode())

      expectValid(result)

      // Volume should be plate minus 4 holes
      const plateVolume = 100 * 100 * 10
      const holeVolume = Math.PI * 2.5 * 2.5 * 10 * 4 // 4 holes through 10mm plate
      expectVolumeApprox(result, plateVolume - holeVolume, 0.03)

      result.delete()
    })
  })

  describe('error handling', () => {
    it('throws on unknown primitive shape', () => {
      const node = {
        type: 'primitive' as const,
        shape: 'sphere' as unknown,
        radius: 10
      } as unknown as GeoNode

      expect(() => compiler.compile(node)).toThrow('Unknown primitive')
    })

    it('throws on unknown operation', () => {
      const node = {
        type: 'operation' as const,
        op: 'xor' as unknown,
        children: [{ type: 'primitive' as const, shape: 'box' as const, width: 10, depth: 10, height: 10 }]
      } as unknown as GeoNode

      expect(() => compiler.compile(node)).toThrow('Unknown operation')
    })
  })
})
