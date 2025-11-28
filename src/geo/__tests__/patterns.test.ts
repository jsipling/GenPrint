import { describe, it, expect } from 'vitest'
import type { Vector3 } from '../types'
import { shape } from '../index'
import { linearPattern, circularPattern } from '../patterns'

const EPSILON = 0.0001

// Helper to compare floating point numbers
function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(EPSILON)
}

// Helper to extract translation from a transform matrix (row-major)
function getTranslation(matrix: number[]): Vector3 {
  return [matrix[3]!, matrix[7]!, matrix[11]!]
}

describe('linearPattern', () => {
  it('creates specified number of copies', () => {
    const box = shape.box({ width: 10, depth: 10, height: 10 })
    const pattern = linearPattern(box, 5, 20, 'x')
    const node = pattern.getNode()

    expect(node.type).toBe('operation')
    if (node.type === 'operation') {
      expect(node.op).toBe('union')
      expect(node.children).toHaveLength(5)
    }
  })

  it('spaces copies along X axis', () => {
    const box = shape.box({ width: 10, depth: 10, height: 10 })
    const pattern = linearPattern(box, 3, 25, 'x')
    const node = pattern.getNode()

    if (node.type !== 'operation') throw new Error('Expected operation')

    // Check translations: 0, 25, 50
    const child0 = node.children[0]!
    const child1 = node.children[1]!
    const child2 = node.children[2]!

    // First copy should be at origin (no transform or identity)
    if (child0.type === 'transform') {
      const t = getTranslation(child0.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 0)
      expectClose(t[2], 0)
    }

    // Second copy at x=25
    expect(child1.type).toBe('transform')
    if (child1.type === 'transform') {
      const t = getTranslation(child1.matrix as number[])
      expectClose(t[0], 25)
      expectClose(t[1], 0)
      expectClose(t[2], 0)
    }

    // Third copy at x=50
    expect(child2.type).toBe('transform')
    if (child2.type === 'transform') {
      const t = getTranslation(child2.matrix as number[])
      expectClose(t[0], 50)
      expectClose(t[1], 0)
      expectClose(t[2], 0)
    }
  })

  it('spaces copies along Y axis', () => {
    const box = shape.box({ width: 10, depth: 10, height: 10 })
    const pattern = linearPattern(box, 3, 15, 'y')
    const node = pattern.getNode()

    if (node.type !== 'operation') throw new Error('Expected operation')

    const child1 = node.children[1]!
    const child2 = node.children[2]!

    // Second copy at y=15
    expect(child1.type).toBe('transform')
    if (child1.type === 'transform') {
      const t = getTranslation(child1.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 15)
      expectClose(t[2], 0)
    }

    // Third copy at y=30
    expect(child2.type).toBe('transform')
    if (child2.type === 'transform') {
      const t = getTranslation(child2.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 30)
      expectClose(t[2], 0)
    }
  })

  it('spaces copies along Z axis', () => {
    const box = shape.box({ width: 10, depth: 10, height: 10 })
    const pattern = linearPattern(box, 3, 20, 'z')
    const node = pattern.getNode()

    if (node.type !== 'operation') throw new Error('Expected operation')

    const child1 = node.children[1]!
    const child2 = node.children[2]!

    // Second copy at z=20
    expect(child1.type).toBe('transform')
    if (child1.type === 'transform') {
      const t = getTranslation(child1.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 0)
      expectClose(t[2], 20)
    }

    // Third copy at z=40
    expect(child2.type).toBe('transform')
    if (child2.type === 'transform') {
      const t = getTranslation(child2.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 0)
      expectClose(t[2], 40)
    }
  })

  it('handles count of 1', () => {
    const box = shape.box({ width: 10, depth: 10, height: 10 })
    const pattern = linearPattern(box, 1, 20, 'x')
    const node = pattern.getNode()

    expect(node.type).toBe('operation')
    if (node.type === 'operation') {
      expect(node.children).toHaveLength(1)
    }
  })

  it('preserves shape transforms', () => {
    const box = shape.box({ width: 10, depth: 10, height: 10 })
    box.translate(5, 5, 5)
    const pattern = linearPattern(box, 2, 20, 'x')
    const node = pattern.getNode()

    if (node.type !== 'operation') throw new Error('Expected operation')

    // Both children should have transforms
    // First copy: shape's original transform (translated to 5,5,5)
    // Second copy: shape's transform + pattern offset (translated to 25,5,5)
    const child0 = node.children[0]!
    const child1 = node.children[1]!

    expect(child0.type).toBe('transform')
    expect(child1.type).toBe('transform')

    if (child0.type === 'transform' && child1.type === 'transform') {
      const t0 = getTranslation(child0.matrix as number[])
      const t1 = getTranslation(child1.matrix as number[])

      expectClose(t0[0], 5)
      expectClose(t0[1], 5)
      expectClose(t0[2], 5)

      expectClose(t1[0], 25)
      expectClose(t1[1], 5)
      expectClose(t1[2], 5)
    }
  })
})

describe('circularPattern', () => {
  it('creates specified number of copies', () => {
    const box = shape.box({ width: 5, depth: 5, height: 10 })
    const pattern = circularPattern(box, 6, 30, 'z')
    const node = pattern.getNode()

    expect(node.type).toBe('operation')
    if (node.type === 'operation') {
      expect(node.op).toBe('union')
      expect(node.children).toHaveLength(6)
    }
  })

  it('arranges copies in circle around Z axis', () => {
    const box = shape.box({ width: 5, depth: 5, height: 10 })
    const pattern = circularPattern(box, 4, 20, 'z')
    const node = pattern.getNode()

    if (node.type !== 'operation') throw new Error('Expected operation')

    // 4 copies at 0, 90, 180, 270 degrees around Z axis at radius 20
    // Positions: (20,0,0), (0,20,0), (-20,0,0), (0,-20,0)
    const child0 = node.children[0]!
    const child1 = node.children[1]!
    const child2 = node.children[2]!
    const child3 = node.children[3]!

    expect(child0.type).toBe('transform')
    expect(child1.type).toBe('transform')
    expect(child2.type).toBe('transform')
    expect(child3.type).toBe('transform')

    if (child0.type === 'transform') {
      const t = getTranslation(child0.matrix as number[])
      expectClose(t[0], 20)
      expectClose(t[1], 0)
      expectClose(t[2], 0)
    }

    if (child1.type === 'transform') {
      const t = getTranslation(child1.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 20)
      expectClose(t[2], 0)
    }

    if (child2.type === 'transform') {
      const t = getTranslation(child2.matrix as number[])
      expectClose(t[0], -20)
      expectClose(t[1], 0)
      expectClose(t[2], 0)
    }

    if (child3.type === 'transform') {
      const t = getTranslation(child3.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], -20)
      expectClose(t[2], 0)
    }
  })

  it('arranges copies in circle around Y axis', () => {
    const box = shape.box({ width: 5, depth: 5, height: 10 })
    const pattern = circularPattern(box, 4, 15, 'y')
    const node = pattern.getNode()

    if (node.type !== 'operation') throw new Error('Expected operation')

    // 4 copies at 0, 90, 180, 270 degrees around Y axis at radius 15
    // Circle is in XZ plane: (15,0,0), (0,0,15), (-15,0,0), (0,0,-15)
    const child0 = node.children[0]!
    const child1 = node.children[1]!
    const child2 = node.children[2]!
    const child3 = node.children[3]!

    if (child0.type === 'transform') {
      const t = getTranslation(child0.matrix as number[])
      expectClose(t[0], 15)
      expectClose(t[1], 0)
      expectClose(t[2], 0)
    }

    if (child1.type === 'transform') {
      const t = getTranslation(child1.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 0)
      expectClose(t[2], 15)
    }

    if (child2.type === 'transform') {
      const t = getTranslation(child2.matrix as number[])
      expectClose(t[0], -15)
      expectClose(t[1], 0)
      expectClose(t[2], 0)
    }

    if (child3.type === 'transform') {
      const t = getTranslation(child3.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 0)
      expectClose(t[2], -15)
    }
  })

  it('arranges copies in circle around X axis', () => {
    const box = shape.box({ width: 5, depth: 5, height: 10 })
    const pattern = circularPattern(box, 4, 10, 'x')
    const node = pattern.getNode()

    if (node.type !== 'operation') throw new Error('Expected operation')

    // 4 copies at 0, 90, 180, 270 degrees around X axis at radius 10
    // Circle is in YZ plane: (0,10,0), (0,0,10), (0,-10,0), (0,0,-10)
    const child0 = node.children[0]!
    const child1 = node.children[1]!
    const child2 = node.children[2]!
    const child3 = node.children[3]!

    if (child0.type === 'transform') {
      const t = getTranslation(child0.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 10)
      expectClose(t[2], 0)
    }

    if (child1.type === 'transform') {
      const t = getTranslation(child1.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 0)
      expectClose(t[2], 10)
    }

    if (child2.type === 'transform') {
      const t = getTranslation(child2.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], -10)
      expectClose(t[2], 0)
    }

    if (child3.type === 'transform') {
      const t = getTranslation(child3.matrix as number[])
      expectClose(t[0], 0)
      expectClose(t[1], 0)
      expectClose(t[2], -10)
    }
  })

  it('handles count of 1', () => {
    const box = shape.box({ width: 5, depth: 5, height: 10 })
    const pattern = circularPattern(box, 1, 20, 'z')
    const node = pattern.getNode()

    expect(node.type).toBe('operation')
    if (node.type === 'operation') {
      expect(node.children).toHaveLength(1)
    }
  })

  it('preserves shape transforms', () => {
    const box = shape.box({ width: 5, depth: 5, height: 10 })
    box.translate(0, 0, 5) // Move up 5
    const pattern = circularPattern(box, 2, 20, 'z')
    const node = pattern.getNode()

    if (node.type !== 'operation') throw new Error('Expected operation')

    // Two copies at 0 and 180 degrees, both at z=5
    const child0 = node.children[0]!
    const child1 = node.children[1]!

    if (child0.type === 'transform') {
      const t = getTranslation(child0.matrix as number[])
      expectClose(t[0], 20)
      expectClose(t[1], 0)
      expectClose(t[2], 5)
    }

    if (child1.type === 'transform') {
      const t = getTranslation(child1.matrix as number[])
      expectClose(t[0], -20)
      expectClose(t[1], 0)
      expectClose(t[2], 5)
    }
  })
})
