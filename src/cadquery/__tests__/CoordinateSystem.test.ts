import { describe, it, expect } from 'vitest'
import {
  planeToCoordinateSystem,
  coordinateSystemOnFace,
  localToGlobal,
  localToGlobal3D,
  cross,
  dot,
  normalize,
  length,
  subtract,
  getTransformMatrix
} from '../CoordinateSystem'

const EPSILON = 1e-10

describe('CoordinateSystem', () => {
  describe('planeToCoordinateSystem', () => {
    it('should create XY plane coordinate system', () => {
      const cs = planeToCoordinateSystem('XY')
      expect(cs.origin).toEqual([0, 0, 0])
      expect(cs.xDir).toEqual([1, 0, 0])
      expect(cs.yDir).toEqual([0, 1, 0])
      expect(cs.zDir).toEqual([0, 0, 1])
    })

    it('should create XZ plane coordinate system', () => {
      const cs = planeToCoordinateSystem('XZ')
      expect(cs.origin).toEqual([0, 0, 0])
      expect(cs.xDir).toEqual([1, 0, 0])
      expect(cs.yDir).toEqual([0, 0, 1])
      expect(cs.zDir).toEqual([0, -1, 0])
    })

    it('should create YZ plane coordinate system', () => {
      const cs = planeToCoordinateSystem('YZ')
      expect(cs.origin).toEqual([0, 0, 0])
      expect(cs.xDir).toEqual([0, 1, 0])
      expect(cs.yDir).toEqual([0, 0, 1])
      expect(cs.zDir).toEqual([1, 0, 0])
    })

    it('should create orthogonal basis vectors', () => {
      const planes = ['XY', 'XZ', 'YZ'] as const
      for (const plane of planes) {
        const cs = planeToCoordinateSystem(plane)
        // xDir and yDir should be perpendicular
        const dotXY = dot(cs.xDir, cs.yDir)
        expect(Math.abs(dotXY)).toBeLessThan(EPSILON)
        // yDir and zDir should be perpendicular
        const dotYZ = dot(cs.yDir, cs.zDir)
        expect(Math.abs(dotYZ)).toBeLessThan(EPSILON)
      }
    })
  })

  describe('coordinateSystemOnFace', () => {
    it('should create coordinate system at face centroid', () => {
      const centroid: [number, number, number] = [5, 10, 15]
      const normal: [number, number, number] = [0, 0, 1]
      const cs = coordinateSystemOnFace(centroid, normal)
      expect(cs.origin).toEqual(centroid)
    })

    it('should use normal as Z direction when not inverted', () => {
      const centroid: [number, number, number] = [0, 0, 0]
      const normal: [number, number, number] = [0, 0, 1]
      const cs = coordinateSystemOnFace(centroid, normal, 0, false)
      expect(cs.zDir).toEqual([0, 0, 1])
    })

    it('should invert normal when invert flag is true', () => {
      const centroid: [number, number, number] = [0, 0, 0]
      const normal: [number, number, number] = [1, 0, 0]
      const cs = coordinateSystemOnFace(centroid, normal, 0, true)
      expect(cs.zDir[0]).toBeCloseTo(-1)
      expect(cs.zDir[1]).toBeCloseTo(0)
      expect(cs.zDir[2]).toBeCloseTo(0)
    })

    it('should apply offset along normal direction', () => {
      const centroid: [number, number, number] = [0, 0, 0]
      const normal: [number, number, number] = [0, 0, 1]
      const cs = coordinateSystemOnFace(centroid, normal, 5)
      expect(cs.origin).toEqual([0, 0, 5])
    })

    it('should apply negative offset along normal direction', () => {
      const centroid: [number, number, number] = [10, 10, 10]
      const normal: [number, number, number] = [0, 1, 0]
      const cs = coordinateSystemOnFace(centroid, normal, -3)
      expect(cs.origin).toEqual([10, 7, 10])
    })

    it('should create orthogonal basis vectors', () => {
      const centroid: [number, number, number] = [5, 5, 5]
      const normal: [number, number, number] = [1, 0, 0]
      const cs = coordinateSystemOnFace(centroid, normal)
      // Verify orthogonality
      const dotXY = dot(cs.xDir, cs.yDir)
      const dotYZ = dot(cs.yDir, cs.zDir)
      const dotZX = dot(cs.zDir, cs.xDir)
      expect(Math.abs(dotXY)).toBeLessThan(EPSILON)
      expect(Math.abs(dotYZ)).toBeLessThan(EPSILON)
      expect(Math.abs(dotZX)).toBeLessThan(EPSILON)
    })

    it('should handle arbitrary normals', () => {
      const centroid: [number, number, number] = [1, 2, 3]
      const normal: [number, number, number] = [0, 1, 0]
      const cs = coordinateSystemOnFace(centroid, normal)
      // Z direction should match the input normal (function doesn't normalize)
      expect(cs.zDir[0]).toBeCloseTo(normal[0], 5)
      expect(cs.zDir[1]).toBeCloseTo(normal[1], 5)
      expect(cs.zDir[2]).toBeCloseTo(normal[2], 5)
    })
  })

  describe('localToGlobal', () => {
    it('should transform 2D point to 3D in XY plane', () => {
      const cs = planeToCoordinateSystem('XY')
      const result = localToGlobal(cs, [5, 3])
      expect(result).toEqual([5, 3, 0])
    })

    it('should handle origin offset', () => {
      const cs = {
        origin: [10, 20, 30],
        xDir: [1, 0, 0],
        yDir: [0, 1, 0],
        zDir: [0, 0, 1]
      }
      const result = localToGlobal(cs, [5, 3])
      expect(result).toEqual([15, 23, 30])
    })

    it('should handle rotated coordinate system', () => {
      const cs = {
        origin: [0, 0, 0],
        xDir: [0, 1, 0],
        yDir: [-1, 0, 0],
        zDir: [0, 0, 1]
      }
      const result = localToGlobal(cs, [1, 0])
      expect(result[0]).toBeCloseTo(0)
      expect(result[1]).toBeCloseTo(1)
      expect(result[2]).toBeCloseTo(0)
    })

    it('should handle zero coordinates', () => {
      const cs = planeToCoordinateSystem('XY')
      const result = localToGlobal(cs, [0, 0])
      expect(result).toEqual([0, 0, 0])
    })

    it('should handle negative coordinates', () => {
      const cs = planeToCoordinateSystem('XY')
      const result = localToGlobal(cs, [-5, -3])
      expect(result).toEqual([-5, -3, 0])
    })
  })

  describe('localToGlobal3D', () => {
    it('should transform 3D point in standard coordinate system', () => {
      const cs = planeToCoordinateSystem('XY')
      const result = localToGlobal3D(cs, [5, 3, 2])
      expect(result).toEqual([5, 3, 2])
    })

    it('should handle origin offset in 3D', () => {
      const cs = {
        origin: [10, 20, 30],
        xDir: [1, 0, 0],
        yDir: [0, 1, 0],
        zDir: [0, 0, 1]
      }
      const result = localToGlobal3D(cs, [5, 3, 2])
      expect(result).toEqual([15, 23, 32])
    })

    it('should handle rotated 3D coordinate system', () => {
      const cs = {
        origin: [0, 0, 0],
        xDir: [1, 0, 0],
        yDir: [0, 0, 1],
        zDir: [0, -1, 0]
      }
      const result = localToGlobal3D(cs, [1, 1, 1])
      expect(result[0]).toBeCloseTo(1)
      expect(result[1]).toBeCloseTo(-1)
      expect(result[2]).toBeCloseTo(1)
    })
  })

  describe('getTransformMatrix', () => {
    it('should return column-major 4x4 matrix for XY plane', () => {
      const cs = planeToCoordinateSystem('XY')
      const matrix = getTransformMatrix(cs)
      expect(matrix.length).toBe(16)
      // Column-major order: xDir (4), yDir (4), zDir (4), origin+1 (4)
      expect(matrix).toEqual([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ])
    })

    it('should include origin in last column', () => {
      const cs = {
        origin: [10, 20, 30],
        xDir: [1, 0, 0],
        yDir: [0, 1, 0],
        zDir: [0, 0, 1]
      }
      const matrix = getTransformMatrix(cs)
      expect(matrix[12]).toBe(10)
      expect(matrix[13]).toBe(20)
      expect(matrix[14]).toBe(30)
      expect(matrix[15]).toBe(1)
    })
  })

  describe('vector math utilities', () => {
    describe('cross product', () => {
      it('should compute cross product of unit vectors', () => {
        const result = cross([1, 0, 0], [0, 1, 0])
        expect(result).toEqual([0, 0, 1])
      })

      it('should compute cross product in reverse order', () => {
        const result = cross([0, 1, 0], [1, 0, 0])
        expect(result).toEqual([0, 0, -1])
      })

      it('should return zero vector for parallel vectors', () => {
        const result = cross([1, 0, 0], [2, 0, 0])
        expect(result[0]).toBeCloseTo(0)
        expect(result[1]).toBeCloseTo(0)
        expect(result[2]).toBeCloseTo(0)
      })

      it('should compute arbitrary cross products', () => {
        const result = cross([1, 2, 3], [4, 5, 6])
        expect(result).toEqual([-3, 6, -3])
      })
    })

    describe('dot product', () => {
      it('should return 1 for parallel unit vectors', () => {
        expect(dot([1, 0, 0], [1, 0, 0])).toBe(1)
      })

      it('should return 0 for perpendicular vectors', () => {
        expect(dot([1, 0, 0], [0, 1, 0])).toBe(0)
      })

      it('should return -1 for opposite unit vectors', () => {
        expect(dot([1, 0, 0], [-1, 0, 0])).toBe(-1)
      })

      it('should compute arbitrary dot products', () => {
        expect(dot([1, 2, 3], [4, 5, 6])).toBe(32) // 1*4 + 2*5 + 3*6
      })
    })

    describe('length', () => {
      it('should return 1 for unit vectors', () => {
        expect(length([1, 0, 0])).toBe(1)
      })

      it('should return 0 for zero vector', () => {
        expect(length([0, 0, 0])).toBe(0)
      })

      it('should compute length of 3-4-5 triangle', () => {
        expect(length([3, 4, 0])).toBe(5)
      })

      it('should compute arbitrary lengths', () => {
        expect(length([1, 1, 1])).toBeCloseTo(Math.sqrt(3))
      })
    })

    describe('normalize', () => {
      it('should normalize to unit length', () => {
        const result = normalize([0, 0, 5])
        expect(result).toEqual([0, 0, 1])
      })

      it('should handle already normalized vectors', () => {
        const result = normalize([1, 0, 0])
        expect(result).toEqual([1, 0, 0])
      })

      it('should normalize arbitrary vectors', () => {
        const result = normalize([3, 4, 0])
        expect(result[0]).toBeCloseTo(0.6)
        expect(result[1]).toBeCloseTo(0.8)
        expect(result[2]).toBeCloseTo(0)
      })

      it('should return fallback for zero vector', () => {
        const result = normalize([0, 0, 0])
        expect(result).toEqual([1, 0, 0])
      })
    })

    describe('subtract', () => {
      it('should subtract two vectors', () => {
        const result = subtract([5, 10, 15], [1, 2, 3])
        expect(result).toEqual([4, 8, 12])
      })

      it('should handle zero vector', () => {
        const result = subtract([5, 10, 15], [0, 0, 0])
        expect(result).toEqual([5, 10, 15])
      })

      it('should handle negative results', () => {
        const result = subtract([1, 1, 1], [5, 5, 5])
        expect(result).toEqual([-4, -4, -4])
      })
    })
  })

  describe('integration scenarios', () => {
    it('should create valid transformation pipeline', () => {
      // Create a tilted coordinate system
      const cs = coordinateSystemOnFace(
        [0, 0, 0],
        [1, 0, 0] // Face normal pointing in X direction
      )

      // Transform local point to global
      const globalPoint = localToGlobal(cs, [10, 5])

      // Verify orthogonality of basis
      const dotXY = dot(cs.xDir, cs.yDir)
      const dotYZ = dot(cs.yDir, cs.zDir)
      expect(Math.abs(dotXY)).toBeLessThan(EPSILON)
      expect(Math.abs(dotYZ)).toBeLessThan(EPSILON)

      // Verify basis vectors are unit length
      expect(length(cs.xDir)).toBeCloseTo(1)
      expect(length(cs.yDir)).toBeCloseTo(1)
      expect(length(cs.zDir)).toBeCloseTo(1)

      // Point should be valid
      expect(Array.isArray(globalPoint)).toBe(true)
      expect(globalPoint.length).toBe(3)
    })

    it('should handle multiple coordinate system transformations', () => {
      const cs1 = planeToCoordinateSystem('XY')
      const cs2 = planeToCoordinateSystem('XZ')

      const p1 = localToGlobal(cs1, [10, 5])
      const p2 = localToGlobal(cs2, [10, 5])

      // Points should be different due to different coordinate systems
      expect(p1).not.toEqual(p2)
    })
  })
})
