import { describe, it, expect } from 'vitest'
import type { GeoNode, Anchor, Matrix4x4, Vector3 } from '../types'
import { Shape, BooleanShape, isIdentity, transformAnchor } from '../Shape'
import { IDENTITY_MATRIX, translationMatrix } from '../math'

const EPSILON = 0.0001

// Helper to compare floating point numbers
function expectClose(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(EPSILON)
}

// Concrete test implementation of Shape
class TestShape extends Shape {
  constructor(
    private baseNode: GeoNode,
    private anchors: Map<string, Anchor> = new Map()
  ) {
    super()
  }

  getBaseNode(): GeoNode {
    return this.baseNode
  }

  getBaseAnchors(): Map<string, Anchor> {
    return this.anchors
  }
}

describe('Shape', () => {
  describe('isIdentity helper', () => {
    it('returns true for identity matrix', () => {
      expect(isIdentity(IDENTITY_MATRIX)).toBe(true)
    })

    it('returns false for translation matrix', () => {
      const m = translationMatrix(1, 0, 0)
      expect(isIdentity(m)).toBe(false)
    })

    it('returns false for non-identity matrix', () => {
      const m: Matrix4x4 = [
        2, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
      expect(isIdentity(m)).toBe(false)
    })
  })

  describe('transformAnchor helper', () => {
    it('returns same anchor when transformed by identity', () => {
      const anchor: Anchor = {
        position: [1, 2, 3],
        direction: [0, 0, 1],
        name: 'test'
      }
      const result = transformAnchor(anchor, IDENTITY_MATRIX)
      expect(result.position).toEqual([1, 2, 3])
      expect(result.direction).toEqual([0, 0, 1])
      expect(result.name).toBe('test')
    })

    it('translates anchor position', () => {
      const anchor: Anchor = {
        position: [0, 0, 0],
        direction: [0, 0, 1],
        name: 'test'
      }
      const m = translationMatrix(10, 20, 30)
      const result = transformAnchor(anchor, m)
      expectClose(result.position[0], 10)
      expectClose(result.position[1], 20)
      expectClose(result.position[2], 30)
    })

    it('does not translate direction', () => {
      const anchor: Anchor = {
        position: [0, 0, 0],
        direction: [1, 0, 0],
        name: 'test'
      }
      const m = translationMatrix(10, 20, 30)
      const result = transformAnchor(anchor, m)
      expectClose(result.direction[0], 1)
      expectClose(result.direction[1], 0)
      expectClose(result.direction[2], 0)
    })
  })

  describe('getNode()', () => {
    it('returns base node when transform is identity', () => {
      const baseNode: GeoNode = {
        type: 'primitive',
        shape: 'box',
        width: 10,
        depth: 20,
        height: 30
      }
      const shape = new TestShape(baseNode)
      const node = shape.getNode()
      expect(node).toEqual(baseNode)
    })

    it('wraps base node in transform when transform is not identity', () => {
      const baseNode: GeoNode = {
        type: 'primitive',
        shape: 'box',
        width: 10,
        depth: 20,
        height: 30
      }
      const anchors = new Map<string, Anchor>([
        ['center', { position: [0, 0, 0] as Vector3, direction: [0, 0, 1] as Vector3, name: 'center' }]
      ])

      const targetShape = new TestShape(
        { type: 'primitive', shape: 'box', width: 1, depth: 1, height: 1 },
        new Map<string, Anchor>([['top', { position: [0, 0, 10] as Vector3, direction: [0, 0, 1] as Vector3, name: 'top' }]])
      )

      const shape = new TestShape(baseNode, anchors)
      shape.align({ self: 'center', target: targetShape, to: 'top' })

      const node = shape.getNode()
      expect(node.type).toBe('transform')
      if (node.type === 'transform') {
        expect(node.child).toEqual(baseNode)
        expect(node.matrix).toBeDefined()
      }
    })
  })

  describe('getAnchor()', () => {
    it('returns undefined for non-existent anchor', () => {
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map()
      )
      expect(shape.getAnchor('nonexistent')).toBeUndefined()
    })

    it('returns anchor by name', () => {
      const anchor: Anchor = { position: [0, 0, 5], direction: [0, 0, 1], name: 'top' }
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map([['top', anchor]])
      )
      const result = shape.getAnchor('top')
      expect(result).toBeDefined()
      expect(result!.name).toBe('top')
    })

    it('returns transformed anchor after alignment', () => {
      const anchors = new Map<string, Anchor>([
        ['center', { position: [0, 0, 0], direction: [0, 0, 1], name: 'center' }]
      ])

      const targetAnchors = new Map<string, Anchor>([
        ['origin', { position: [10, 10, 10], direction: [0, 0, 1], name: 'origin' }]
      ])

      const targetShape = new TestShape(
        { type: 'primitive', shape: 'box', width: 1, depth: 1, height: 1 },
        targetAnchors
      )

      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        anchors
      )

      shape.align({ self: 'center', target: targetShape, to: 'origin' })

      const result = shape.getAnchor('center')
      expect(result).toBeDefined()
      expectClose(result!.position[0], 10)
      expectClose(result!.position[1], 10)
      expectClose(result!.position[2], 10)
    })
  })

  describe('getAnchorNames()', () => {
    it('returns empty array when no anchors', () => {
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map()
      )
      expect(shape.getAnchorNames()).toEqual([])
    })

    it('returns all anchor names', () => {
      const anchors = new Map<string, Anchor>([
        ['top', { position: [0, 0, 5], direction: [0, 0, 1], name: 'top' }],
        ['bottom', { position: [0, 0, -5], direction: [0, 0, -1], name: 'bottom' }],
        ['center', { position: [0, 0, 0], direction: [0, 0, 1], name: 'center' }]
      ])
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        anchors
      )
      const names = shape.getAnchorNames()
      expect(names).toContain('top')
      expect(names).toContain('bottom')
      expect(names).toContain('center')
      expect(names).toHaveLength(3)
    })
  })

  describe('align()', () => {
    it('throws error for unknown self anchor', () => {
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map()
      )
      const target = new TestShape(
        { type: 'primitive', shape: 'box', width: 1, depth: 1, height: 1 },
        new Map<string, Anchor>([['top', { position: [0, 0, 0] as Vector3, direction: [0, 0, 1] as Vector3, name: 'top' }]])
      )

      expect(() => shape.align({ self: 'unknown', target, to: 'top' }))
        .toThrow('Unknown anchor: unknown')
    })

    it('throws error for unknown target anchor', () => {
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map<string, Anchor>([['center', { position: [0, 0, 0] as Vector3, direction: [0, 0, 1] as Vector3, name: 'center' }]])
      )
      const target = new TestShape(
        { type: 'primitive', shape: 'box', width: 1, depth: 1, height: 1 },
        new Map()
      )

      expect(() => shape.align({ self: 'center', target, to: 'unknown' }))
        .toThrow('Unknown anchor: unknown')
    })

    it('returns this for chaining', () => {
      const anchors = new Map<string, Anchor>([
        ['center', { position: [0, 0, 0], direction: [0, 0, 1], name: 'center' }]
      ])
      const targetAnchors = new Map<string, Anchor>([
        ['origin', { position: [0, 0, 0], direction: [0, 0, 1], name: 'origin' }]
      ])

      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        anchors
      )
      const target = new TestShape(
        { type: 'primitive', shape: 'box', width: 1, depth: 1, height: 1 },
        targetAnchors
      )

      const result = shape.align({ self: 'center', target, to: 'origin' })
      expect(result).toBe(shape)
    })

    it('updates transform matrix', () => {
      const anchors = new Map<string, Anchor>([
        ['center', { position: [0, 0, 0], direction: [0, 0, 1], name: 'center' }]
      ])
      const targetAnchors = new Map<string, Anchor>([
        ['moved', { position: [100, 0, 0], direction: [0, 0, 1], name: 'moved' }]
      ])

      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        anchors
      )
      const target = new TestShape(
        { type: 'primitive', shape: 'box', width: 1, depth: 1, height: 1 },
        targetAnchors
      )

      shape.align({ self: 'center', target, to: 'moved' })

      const node = shape.getNode()
      expect(node.type).toBe('transform')
    })

    it('defaults to mate mode', () => {
      const selfAnchors = new Map<string, Anchor>([
        ['top', { position: [0, 0, 5], direction: [0, 0, 1], name: 'top' }]
      ])
      const targetAnchors = new Map<string, Anchor>([
        ['bottom', { position: [0, 0, 0], direction: [0, 0, -1], name: 'bottom' }]
      ])

      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        selfAnchors
      )
      const target = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        targetAnchors
      )

      shape.align({ self: 'top', target, to: 'bottom' })

      const alignedAnchor = shape.getAnchor('top')
      expect(alignedAnchor).toBeDefined()
      // Anchor should be at target position
      expectClose(alignedAnchor!.position[0], 0)
      expectClose(alignedAnchor!.position[1], 0)
      expectClose(alignedAnchor!.position[2], 0)
    })
  })

  describe('translate()', () => {
    it('returns this for chaining', () => {
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map()
      )

      const result = shape.translate(10, 20, 30)
      expect(result).toBe(shape)
    })

    it('moves shape by specified amount', () => {
      const anchors = new Map<string, Anchor>([
        ['center', { position: [0, 0, 0], direction: [0, 0, 1], name: 'center' }]
      ])
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        anchors
      )

      shape.translate(10, 20, 30)

      const anchor = shape.getAnchor('center')
      expect(anchor).toBeDefined()
      expectClose(anchor!.position[0], 10)
      expectClose(anchor!.position[1], 20)
      expectClose(anchor!.position[2], 30)
    })

    it('can chain with other transforms', () => {
      const anchors = new Map<string, Anchor>([
        ['center', { position: [0, 0, 0], direction: [0, 0, 1], name: 'center' }]
      ])
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        anchors
      )

      shape.translate(10, 0, 0).translate(0, 20, 0)

      const anchor = shape.getAnchor('center')
      expect(anchor).toBeDefined()
      expectClose(anchor!.position[0], 10)
      expectClose(anchor!.position[1], 20)
      expectClose(anchor!.position[2], 0)
    })
  })

  describe('rotate()', () => {
    it('returns this for chaining', () => {
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map()
      )

      const result = shape.rotate(0, 90, 0)
      expect(result).toBe(shape)
    })

    it('rotates shape by specified angles', () => {
      const anchors = new Map<string, Anchor>([
        ['front', { position: [0, 10, 0], direction: [0, 1, 0], name: 'front' }]
      ])
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 20, height: 10 },
        anchors
      )

      // Rotate 90 degrees around Z axis: Y becomes -X
      shape.rotate(0, 0, 90)

      const anchor = shape.getAnchor('front')
      expect(anchor).toBeDefined()
      expectClose(anchor!.position[0], -10)
      expectClose(anchor!.position[1], 0)
      expectClose(anchor!.position[2], 0)
    })

    it('can chain with other transforms', () => {
      const anchors = new Map<string, Anchor>([
        ['center', { position: [0, 0, 0], direction: [0, 0, 1], name: 'center' }]
      ])
      const shape = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        anchors
      )

      shape.translate(10, 0, 0).rotate(0, 90, 0)

      const anchor = shape.getAnchor('center')
      expect(anchor).toBeDefined()
      // After translate to (10,0,0), then rotate 90 around Y:
      // X becomes Z, Z becomes -X
      // So (10,0,0) becomes (0,0,-10)
      expectClose(anchor!.position[0], 0)
      expectClose(anchor!.position[1], 0)
      expectClose(anchor!.position[2], -10)
    })
  })

  describe('boolean operations', () => {
    describe('subtract()', () => {
      it('returns a BooleanShape', () => {
        const shape1 = new TestShape(
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
          new Map()
        )
        const shape2 = new TestShape(
          { type: 'primitive', shape: 'box', width: 5, depth: 5, height: 5 },
          new Map()
        )

        const result = shape1.subtract(shape2)
        expect(result).toBeInstanceOf(BooleanShape)
      })

      it('creates correct operation node', () => {
        const shape1 = new TestShape(
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
          new Map()
        )
        const shape2 = new TestShape(
          { type: 'primitive', shape: 'box', width: 5, depth: 5, height: 5 },
          new Map()
        )

        const result = shape1.subtract(shape2)
        const node = result.getNode()

        expect(node.type).toBe('operation')
        if (node.type === 'operation') {
          expect(node.op).toBe('subtract')
          expect(node.children).toHaveLength(2)
        }
      })
    })

    describe('union()', () => {
      it('returns a BooleanShape', () => {
        const shape1 = new TestShape(
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
          new Map()
        )
        const shape2 = new TestShape(
          { type: 'primitive', shape: 'box', width: 5, depth: 5, height: 5 },
          new Map()
        )

        const result = shape1.union(shape2)
        expect(result).toBeInstanceOf(BooleanShape)
      })

      it('creates correct operation node', () => {
        const shape1 = new TestShape(
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
          new Map()
        )
        const shape2 = new TestShape(
          { type: 'primitive', shape: 'box', width: 5, depth: 5, height: 5 },
          new Map()
        )

        const result = shape1.union(shape2)
        const node = result.getNode()

        expect(node.type).toBe('operation')
        if (node.type === 'operation') {
          expect(node.op).toBe('union')
          expect(node.children).toHaveLength(2)
        }
      })
    })

    describe('intersect()', () => {
      it('returns a BooleanShape', () => {
        const shape1 = new TestShape(
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
          new Map()
        )
        const shape2 = new TestShape(
          { type: 'primitive', shape: 'box', width: 5, depth: 5, height: 5 },
          new Map()
        )

        const result = shape1.intersect(shape2)
        expect(result).toBeInstanceOf(BooleanShape)
      })

      it('creates correct operation node', () => {
        const shape1 = new TestShape(
          { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
          new Map()
        )
        const shape2 = new TestShape(
          { type: 'primitive', shape: 'box', width: 5, depth: 5, height: 5 },
          new Map()
        )

        const result = shape1.intersect(shape2)
        const node = result.getNode()

        expect(node.type).toBe('operation')
        if (node.type === 'operation') {
          expect(node.op).toBe('intersect')
          expect(node.children).toHaveLength(2)
        }
      })
    })
  })
})

describe('BooleanShape', () => {
  describe('getBaseNode()', () => {
    it('creates operation node with correct structure', () => {
      const shape1 = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map()
      )
      const shape2 = new TestShape(
        { type: 'primitive', shape: 'cylinder', diameter: 5, height: 10 },
        new Map()
      )

      const boolShape = shape1.subtract(shape2)
      const node = boolShape.getNode()

      expect(node.type).toBe('operation')
      if (node.type === 'operation') {
        expect(node.op).toBe('subtract')
        expect(node.children).toHaveLength(2)
        expect(node.children[0]!.type).toBe('primitive')
        expect(node.children[1]!.type).toBe('primitive')
      }
    })
  })

  describe('getBaseAnchors()', () => {
    it('inherits anchors from first child', () => {
      const anchors = new Map<string, Anchor>([
        ['top', { position: [0, 0, 5] as Vector3, direction: [0, 0, 1] as Vector3, name: 'top' }],
        ['bottom', { position: [0, 0, -5] as Vector3, direction: [0, 0, -1] as Vector3, name: 'bottom' }]
      ])
      const shape1 = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        anchors
      )
      const shape2 = new TestShape(
        { type: 'primitive', shape: 'cylinder', diameter: 5, height: 10 },
        new Map<string, Anchor>([['center', { position: [0, 0, 0] as Vector3, direction: [0, 0, 1] as Vector3, name: 'center' }]])
      )

      const boolShape = shape1.subtract(shape2)
      const boolAnchors = boolShape.getAnchorNames()

      expect(boolAnchors).toContain('top')
      expect(boolAnchors).toContain('bottom')
      expect(boolAnchors).not.toContain('center')
    })

    it('returns empty map when no children', () => {
      // Create BooleanShape directly with empty children (edge case)
      const boolShape = new BooleanShape('union', [])
      expect(boolShape.getAnchorNames()).toEqual([])
    })
  })

  describe('chaining boolean operations', () => {
    it('can chain subtract operations', () => {
      const shape1 = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map()
      )
      const shape2 = new TestShape(
        { type: 'primitive', shape: 'cylinder', diameter: 3, height: 10 },
        new Map()
      )
      const shape3 = new TestShape(
        { type: 'primitive', shape: 'cylinder', diameter: 2, height: 10 },
        new Map()
      )

      const result = shape1.subtract(shape2).subtract(shape3)
      const node = result.getNode()

      expect(node.type).toBe('operation')
      if (node.type === 'operation') {
        expect(node.op).toBe('subtract')
        expect(node.children).toHaveLength(2)
        // First child is the previous BooleanShape result
        expect(node.children[0]!.type).toBe('operation')
      }
    })

    it('can chain union operations', () => {
      const shape1 = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map()
      )
      const shape2 = new TestShape(
        { type: 'primitive', shape: 'box', width: 5, depth: 5, height: 5 },
        new Map()
      )
      const shape3 = new TestShape(
        { type: 'primitive', shape: 'box', width: 3, depth: 3, height: 3 },
        new Map()
      )

      const result = shape1.union(shape2).union(shape3)
      const node = result.getNode()

      expect(node.type).toBe('operation')
      if (node.type === 'operation') {
        expect(node.op).toBe('union')
        expect(node.children).toHaveLength(2)
      }
    })

    it('can mix different boolean operations', () => {
      const shape1 = new TestShape(
        { type: 'primitive', shape: 'box', width: 10, depth: 10, height: 10 },
        new Map()
      )
      const shape2 = new TestShape(
        { type: 'primitive', shape: 'cylinder', diameter: 3, height: 10 },
        new Map()
      )
      const shape3 = new TestShape(
        { type: 'primitive', shape: 'box', width: 2, depth: 2, height: 15 },
        new Map()
      )

      // (box - cylinder) union box
      const result = shape1.subtract(shape2).union(shape3)
      const node = result.getNode()

      expect(node.type).toBe('operation')
      if (node.type === 'operation') {
        expect(node.op).toBe('union')
        expect(node.children[0]!.type).toBe('operation')
        const firstChild = node.children[0]!
        if (firstChild.type === 'operation') {
          expect(firstChild.op).toBe('subtract')
        }
      }
    })
  })
})
