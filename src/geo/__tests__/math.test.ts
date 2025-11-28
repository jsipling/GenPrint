import { describe, it, expect } from 'vitest'
import type { Vector3, Anchor } from '../types'
import {
  IDENTITY_MATRIX,
  translationMatrix,
  rotationMatrix,
  multiplyMatrices,
  transformPoint,
  transformDirection,
  alignVectors,
  calculateAlignmentTransform,
  normalizeVector,
  dotProduct,
  crossProduct,
  vectorLength,
  negateVector
} from '../math'

const EPSILON = 0.0001

// Helper to compare floating point numbers
function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(EPSILON)
}

// Helper to compare vectors
function expectVectorClose(actual: Vector3, expected: Vector3) {
  expectClose(actual[0], expected[0])
  expectClose(actual[1], expected[1])
  expectClose(actual[2], expected[2])
}

describe('math', () => {
  describe('IDENTITY_MATRIX', () => {
    it('is a valid identity matrix', () => {
      expect(IDENTITY_MATRIX).toEqual([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ])
    })
  })

  describe('vector operations', () => {
    describe('vectorLength', () => {
      it('returns correct length for unit vectors', () => {
        expectClose(vectorLength([1, 0, 0]), 1)
        expectClose(vectorLength([0, 1, 0]), 1)
        expectClose(vectorLength([0, 0, 1]), 1)
      })

      it('returns correct length for arbitrary vectors', () => {
        expectClose(vectorLength([3, 4, 0]), 5)
        expectClose(vectorLength([1, 1, 1]), Math.sqrt(3))
      })

      it('returns 0 for zero vector', () => {
        expectClose(vectorLength([0, 0, 0]), 0)
      })
    })

    describe('normalizeVector', () => {
      it('normalizes unit vectors to themselves', () => {
        expectVectorClose(normalizeVector([1, 0, 0]), [1, 0, 0])
        expectVectorClose(normalizeVector([0, 1, 0]), [0, 1, 0])
        expectVectorClose(normalizeVector([0, 0, 1]), [0, 0, 1])
      })

      it('normalizes arbitrary vectors', () => {
        const result = normalizeVector([3, 0, 0])
        expectVectorClose(result, [1, 0, 0])
      })

      it('normalizes diagonal vectors', () => {
        const len = 1 / Math.sqrt(3)
        expectVectorClose(normalizeVector([1, 1, 1]), [len, len, len])
      })

      it('handles negative vectors', () => {
        expectVectorClose(normalizeVector([-1, 0, 0]), [-1, 0, 0])
      })
    })

    describe('dotProduct', () => {
      it('returns 1 for parallel unit vectors', () => {
        expectClose(dotProduct([1, 0, 0], [1, 0, 0]), 1)
      })

      it('returns -1 for antiparallel unit vectors', () => {
        expectClose(dotProduct([1, 0, 0], [-1, 0, 0]), -1)
      })

      it('returns 0 for perpendicular vectors', () => {
        expectClose(dotProduct([1, 0, 0], [0, 1, 0]), 0)
        expectClose(dotProduct([1, 0, 0], [0, 0, 1]), 0)
        expectClose(dotProduct([0, 1, 0], [0, 0, 1]), 0)
      })

      it('computes correct dot product for arbitrary vectors', () => {
        expectClose(dotProduct([1, 2, 3], [4, 5, 6]), 32)
      })
    })

    describe('crossProduct', () => {
      it('computes X cross Y = Z', () => {
        expectVectorClose(crossProduct([1, 0, 0], [0, 1, 0]), [0, 0, 1])
      })

      it('computes Y cross Z = X', () => {
        expectVectorClose(crossProduct([0, 1, 0], [0, 0, 1]), [1, 0, 0])
      })

      it('computes Z cross X = Y', () => {
        expectVectorClose(crossProduct([0, 0, 1], [1, 0, 0]), [0, 1, 0])
      })

      it('is anticommutative', () => {
        const a: Vector3 = [1, 2, 3]
        const b: Vector3 = [4, 5, 6]
        const ab = crossProduct(a, b)
        const ba = crossProduct(b, a)
        expectVectorClose(ab, [-ba[0], -ba[1], -ba[2]])
      })

      it('returns zero for parallel vectors', () => {
        expectVectorClose(crossProduct([1, 0, 0], [2, 0, 0]), [0, 0, 0])
      })
    })

    describe('negateVector', () => {
      it('negates positive vectors', () => {
        expectVectorClose(negateVector([1, 2, 3]), [-1, -2, -3])
      })

      it('negates negative vectors', () => {
        expectVectorClose(negateVector([-1, -2, -3]), [1, 2, 3])
      })

      it('returns zero for zero vector', () => {
        expectVectorClose(negateVector([0, 0, 0]), [0, 0, 0])
      })
    })
  })

  describe('translationMatrix', () => {
    it('creates identity when translation is zero', () => {
      const m = translationMatrix(0, 0, 0)
      expect(m).toEqual(IDENTITY_MATRIX)
    })

    it('translates point (0,0,0) to (1,2,3)', () => {
      const m = translationMatrix(1, 2, 3)
      const result = transformPoint([0, 0, 0], m)
      expectVectorClose(result, [1, 2, 3])
    })

    it('translates arbitrary point correctly', () => {
      const m = translationMatrix(10, 20, 30)
      const result = transformPoint([1, 2, 3], m)
      expectVectorClose(result, [11, 22, 33])
    })

    it('handles negative translations', () => {
      const m = translationMatrix(-5, -10, -15)
      const result = transformPoint([5, 10, 15], m)
      expectVectorClose(result, [0, 0, 0])
    })
  })

  describe('rotationMatrix', () => {
    describe('rotation around Z axis', () => {
      it('rotates (1,0,0) by 90 degrees to (0,1,0)', () => {
        const m = rotationMatrix(0, 0, 90)
        const result = transformPoint([1, 0, 0], m)
        expectVectorClose(result, [0, 1, 0])
      })

      it('rotates (1,0,0) by 180 degrees to (-1,0,0)', () => {
        const m = rotationMatrix(0, 0, 180)
        const result = transformPoint([1, 0, 0], m)
        expectVectorClose(result, [-1, 0, 0])
      })

      it('rotates (0,1,0) by 90 degrees to (-1,0,0)', () => {
        const m = rotationMatrix(0, 0, 90)
        const result = transformPoint([0, 1, 0], m)
        expectVectorClose(result, [-1, 0, 0])
      })
    })

    describe('rotation around Y axis', () => {
      it('rotates (1,0,0) by 90 degrees to (0,0,-1)', () => {
        const m = rotationMatrix(0, 90, 0)
        const result = transformPoint([1, 0, 0], m)
        expectVectorClose(result, [0, 0, -1])
      })

      it('rotates (0,0,1) by 90 degrees to (1,0,0)', () => {
        const m = rotationMatrix(0, 90, 0)
        const result = transformPoint([0, 0, 1], m)
        expectVectorClose(result, [1, 0, 0])
      })
    })

    describe('rotation around X axis', () => {
      it('rotates (0,1,0) by 90 degrees to (0,0,1)', () => {
        const m = rotationMatrix(90, 0, 0)
        const result = transformPoint([0, 1, 0], m)
        expectVectorClose(result, [0, 0, 1])
      })

      it('rotates (0,0,1) by 90 degrees to (0,-1,0)', () => {
        const m = rotationMatrix(90, 0, 0)
        const result = transformPoint([0, 0, 1], m)
        expectVectorClose(result, [0, -1, 0])
      })
    })

    it('applies identity rotation for 0 degrees', () => {
      const m = rotationMatrix(0, 0, 0)
      expect(m).toEqual(IDENTITY_MATRIX)
    })

    it('handles combined rotations', () => {
      // 90 degrees around X, then point should transform accordingly
      const m = rotationMatrix(90, 0, 0)
      const result = transformPoint([0, 1, 0], m)
      expectVectorClose(result, [0, 0, 1])
    })
  })

  describe('multiplyMatrices', () => {
    it('multiplying by identity returns same matrix', () => {
      const m = translationMatrix(1, 2, 3)
      const result = multiplyMatrices(m, IDENTITY_MATRIX)
      expect(result).toEqual(m)
    })

    it('identity times any matrix returns that matrix', () => {
      const m = translationMatrix(1, 2, 3)
      const result = multiplyMatrices(IDENTITY_MATRIX, m)
      expect(result).toEqual(m)
    })

    it('combines translations correctly', () => {
      const t1 = translationMatrix(1, 0, 0)
      const t2 = translationMatrix(0, 2, 0)
      const combined = multiplyMatrices(t2, t1)
      const result = transformPoint([0, 0, 0], combined)
      expectVectorClose(result, [1, 2, 0])
    })

    it('order matters for non-commutative operations', () => {
      const rot = rotationMatrix(0, 0, 90)
      const trans = translationMatrix(1, 0, 0)

      // Rotate then translate
      const rt = multiplyMatrices(trans, rot)
      const result1 = transformPoint([1, 0, 0], rt)

      // Translate then rotate
      const tr = multiplyMatrices(rot, trans)
      const result2 = transformPoint([1, 0, 0], tr)

      // Results should be different
      expect(Math.abs(result1[0] - result2[0]) > EPSILON ||
             Math.abs(result1[1] - result2[1]) > EPSILON).toBe(true)
    })
  })

  describe('transformPoint', () => {
    it('identity matrix preserves point', () => {
      const result = transformPoint([1, 2, 3], IDENTITY_MATRIX)
      expectVectorClose(result, [1, 2, 3])
    })

    it('applies translation', () => {
      const m = translationMatrix(10, 20, 30)
      const result = transformPoint([1, 2, 3], m)
      expectVectorClose(result, [11, 22, 33])
    })

    it('applies rotation', () => {
      const m = rotationMatrix(0, 0, 90)
      const result = transformPoint([1, 0, 0], m)
      expectVectorClose(result, [0, 1, 0])
    })

    it('applies combined transformation', () => {
      const rot = rotationMatrix(0, 0, 90)
      const trans = translationMatrix(0, 0, 5)
      const combined = multiplyMatrices(trans, rot)
      const result = transformPoint([1, 0, 0], combined)
      expectVectorClose(result, [0, 1, 5])
    })
  })

  describe('transformDirection', () => {
    it('identity matrix preserves direction', () => {
      const result = transformDirection([1, 0, 0], IDENTITY_MATRIX)
      expectVectorClose(result, [1, 0, 0])
    })

    it('ignores translation', () => {
      const m = translationMatrix(100, 200, 300)
      const result = transformDirection([1, 0, 0], m)
      expectVectorClose(result, [1, 0, 0])
    })

    it('applies rotation', () => {
      const m = rotationMatrix(0, 0, 90)
      const result = transformDirection([1, 0, 0], m)
      expectVectorClose(result, [0, 1, 0])
    })

    it('ignores translation but applies rotation', () => {
      const rot = rotationMatrix(0, 0, 90)
      const trans = translationMatrix(100, 200, 300)
      const combined = multiplyMatrices(trans, rot)
      const result = transformDirection([1, 0, 0], combined)
      expectVectorClose(result, [0, 1, 0])
    })
  })

  describe('alignVectors', () => {
    it('returns identity when vectors are already aligned', () => {
      const m = alignVectors([0, 0, 1], [0, 0, 1])
      const result = transformDirection([0, 0, 1], m)
      expectVectorClose(result, [0, 0, 1])
    })

    it('aligns (0,0,1) to (0,0,-1) with 180 degree rotation', () => {
      const m = alignVectors([0, 0, 1], [0, 0, -1])
      const result = transformDirection([0, 0, 1], m)
      expectVectorClose(result, [0, 0, -1])
    })

    it('aligns (0,0,1) to (1,0,0)', () => {
      const m = alignVectors([0, 0, 1], [1, 0, 0])
      const result = transformDirection([0, 0, 1], m)
      expectVectorClose(result, [1, 0, 0])
    })

    it('aligns (1,0,0) to (0,1,0)', () => {
      const m = alignVectors([1, 0, 0], [0, 1, 0])
      const result = transformDirection([1, 0, 0], m)
      expectVectorClose(result, [0, 1, 0])
    })

    it('aligns (0,1,0) to (0,0,1)', () => {
      const m = alignVectors([0, 1, 0], [0, 0, 1])
      const result = transformDirection([0, 1, 0], m)
      expectVectorClose(result, [0, 0, 1])
    })

    it('handles arbitrary vectors', () => {
      const from: Vector3 = normalizeVector([1, 1, 0])
      const to: Vector3 = normalizeVector([0, 1, 1])
      const m = alignVectors(from, to)
      const result = transformDirection(from, m)
      expectVectorClose(result, to)
    })
  })

  describe('calculateAlignmentTransform', () => {
    describe('mate mode', () => {
      it('positions anchors at same point with opposing directions', () => {
        const selfAnchor: Anchor = {
          position: [0, 0, 5],
          direction: [0, 0, 1],
          name: 'top'
        }

        const targetAnchor: Anchor = {
          position: [10, 10, 0],
          direction: [0, 0, 1],
          name: 'bottom'
        }

        const m = calculateAlignmentTransform(selfAnchor, targetAnchor, 'mate')

        // Transform the self anchor position
        const newPosition = transformPoint(selfAnchor.position, m)
        expectVectorClose(newPosition, targetAnchor.position)

        // Transform the self anchor direction - should oppose target direction
        const newDirection = transformDirection(selfAnchor.direction, m)
        expectVectorClose(newDirection, negateVector(targetAnchor.direction))
      })

      it('works with different directions', () => {
        const selfAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [1, 0, 0],
          name: 'right'
        }

        const targetAnchor: Anchor = {
          position: [5, 5, 5],
          direction: [0, 1, 0],
          name: 'front'
        }

        const m = calculateAlignmentTransform(selfAnchor, targetAnchor, 'mate')

        const newPosition = transformPoint(selfAnchor.position, m)
        expectVectorClose(newPosition, targetAnchor.position)

        const newDirection = transformDirection(selfAnchor.direction, m)
        expectVectorClose(newDirection, negateVector(targetAnchor.direction))
      })
    })

    describe('flush mode', () => {
      it('positions anchors at same point with same directions', () => {
        const selfAnchor: Anchor = {
          position: [0, 0, 5],
          direction: [0, 0, 1],
          name: 'top'
        }

        const targetAnchor: Anchor = {
          position: [10, 10, 0],
          direction: [0, 0, 1],
          name: 'top'
        }

        const m = calculateAlignmentTransform(selfAnchor, targetAnchor, 'flush')

        const newPosition = transformPoint(selfAnchor.position, m)
        expectVectorClose(newPosition, targetAnchor.position)

        const newDirection = transformDirection(selfAnchor.direction, m)
        expectVectorClose(newDirection, targetAnchor.direction)
      })

      it('works when aligning different axis directions', () => {
        const selfAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [0, 0, 1],
          name: 'up'
        }

        const targetAnchor: Anchor = {
          position: [5, 0, 0],
          direction: [1, 0, 0],
          name: 'right'
        }

        const m = calculateAlignmentTransform(selfAnchor, targetAnchor, 'flush')

        const newDirection = transformDirection(selfAnchor.direction, m)
        expectVectorClose(newDirection, targetAnchor.direction)
      })
    })

    describe('offset', () => {
      it('applies x offset correctly', () => {
        const selfAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [0, 0, 1],
          name: 'center'
        }

        const targetAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [0, 0, 1],
          name: 'center'
        }

        const m = calculateAlignmentTransform(selfAnchor, targetAnchor, 'mate', { x: 10 })
        const newPosition = transformPoint(selfAnchor.position, m)
        expectVectorClose(newPosition, [10, 0, 0])
      })

      it('applies y offset correctly', () => {
        const selfAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [0, 0, 1],
          name: 'center'
        }

        const targetAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [0, 0, 1],
          name: 'center'
        }

        const m = calculateAlignmentTransform(selfAnchor, targetAnchor, 'mate', { y: 20 })
        const newPosition = transformPoint(selfAnchor.position, m)
        expectVectorClose(newPosition, [0, 20, 0])
      })

      it('applies z offset correctly', () => {
        const selfAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [0, 0, 1],
          name: 'center'
        }

        const targetAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [0, 0, 1],
          name: 'center'
        }

        const m = calculateAlignmentTransform(selfAnchor, targetAnchor, 'mate', { z: 30 })
        const newPosition = transformPoint(selfAnchor.position, m)
        expectVectorClose(newPosition, [0, 0, 30])
      })

      it('applies combined offset correctly', () => {
        const selfAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [0, 0, 1],
          name: 'center'
        }

        const targetAnchor: Anchor = {
          position: [0, 0, 0],
          direction: [0, 0, 1],
          name: 'center'
        }

        const m = calculateAlignmentTransform(selfAnchor, targetAnchor, 'mate', { x: 5, y: 10, z: 15 })
        const newPosition = transformPoint(selfAnchor.position, m)
        expectVectorClose(newPosition, [5, 10, 15])
      })

      it('combines offset with alignment', () => {
        const selfAnchor: Anchor = {
          position: [0, 0, 5],
          direction: [0, 0, 1],
          name: 'top'
        }

        const targetAnchor: Anchor = {
          position: [10, 10, 0],
          direction: [0, 0, 1],
          name: 'bottom'
        }

        const m = calculateAlignmentTransform(selfAnchor, targetAnchor, 'mate', { z: 2 })
        const newPosition = transformPoint(selfAnchor.position, m)
        // Should be at target position + offset
        expectVectorClose(newPosition, [10, 10, 2])
      })
    })
  })
})
