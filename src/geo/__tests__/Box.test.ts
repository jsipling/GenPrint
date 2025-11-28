import { describe, it, expect } from 'vitest'
import type { Vector3 } from '../types'
import { Box } from '../primitives/Box'

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

describe('Box', () => {
  describe('constructor', () => {
    it('creates a box with given dimensions', () => {
      const box = new Box({ width: 10, depth: 20, height: 30 })
      expect(box).toBeDefined()
    })
  })

  describe('getBaseNode()', () => {
    it('returns a primitive box GeoNode', () => {
      const box = new Box({ width: 10, depth: 20, height: 30 })
      const node = box.getBaseNode()

      expect(node.type).toBe('primitive')
      if (node.type === 'primitive') {
        expect(node.shape).toBe('box')
      }
    })

    it('includes correct dimensions', () => {
      const box = new Box({ width: 10, depth: 20, height: 30 })
      const node = box.getBaseNode()

      if (node.type === 'primitive' && node.shape === 'box') {
        expect(node.width).toBe(10)
        expect(node.depth).toBe(20)
        expect(node.height).toBe(30)
      } else {
        expect.fail('Expected primitive box node')
      }
    })

    it('handles unit cube', () => {
      const box = new Box({ width: 1, depth: 1, height: 1 })
      const node = box.getBaseNode()

      if (node.type === 'primitive' && node.shape === 'box') {
        expect(node.width).toBe(1)
        expect(node.depth).toBe(1)
        expect(node.height).toBe(1)
      } else {
        expect.fail('Expected primitive box node')
      }
    })
  })

  describe('getAnchorNames()', () => {
    it('returns all expected anchor names', () => {
      const box = new Box({ width: 10, depth: 20, height: 30 })
      const names = box.getAnchorNames()

      // Face centers
      expect(names).toContain('top')
      expect(names).toContain('bottom')
      expect(names).toContain('front')
      expect(names).toContain('back')
      expect(names).toContain('left')
      expect(names).toContain('right')

      // Center points
      expect(names).toContain('center')
      expect(names).toContain('centerTop')
      expect(names).toContain('centerBottom')

      // Corners
      expect(names).toContain('topFrontLeft')
      expect(names).toContain('topFrontRight')
      expect(names).toContain('topBackLeft')
      expect(names).toContain('topBackRight')
      expect(names).toContain('bottomFrontLeft')
      expect(names).toContain('bottomFrontRight')
      expect(names).toContain('bottomBackLeft')
      expect(names).toContain('bottomBackRight')
    })

    it('returns correct count of anchors', () => {
      const box = new Box({ width: 10, depth: 10, height: 10 })
      const names = box.getAnchorNames()
      // 6 faces + 3 centers + 8 corners = 17
      expect(names).toHaveLength(17)
    })
  })

  describe('getAnchor() - face center anchors', () => {
    const box = new Box({ width: 20, depth: 40, height: 60 })
    // Half dimensions: w=10, d=20, h=30

    it('top anchor at correct position', () => {
      const anchor = box.getAnchor('top')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 0, 30])
    })

    it('top anchor direction is +Z', () => {
      const anchor = box.getAnchor('top')
      expectVectorClose(anchor!.direction, [0, 0, 1])
    })

    it('bottom anchor at correct position', () => {
      const anchor = box.getAnchor('bottom')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 0, -30])
    })

    it('bottom anchor direction is -Z', () => {
      const anchor = box.getAnchor('bottom')
      expectVectorClose(anchor!.direction, [0, 0, -1])
    })

    it('front anchor at correct position', () => {
      const anchor = box.getAnchor('front')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, -20, 0])
    })

    it('front anchor direction is -Y', () => {
      const anchor = box.getAnchor('front')
      expectVectorClose(anchor!.direction, [0, -1, 0])
    })

    it('back anchor at correct position', () => {
      const anchor = box.getAnchor('back')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 20, 0])
    })

    it('back anchor direction is +Y', () => {
      const anchor = box.getAnchor('back')
      expectVectorClose(anchor!.direction, [0, 1, 0])
    })

    it('left anchor at correct position', () => {
      const anchor = box.getAnchor('left')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [-10, 0, 0])
    })

    it('left anchor direction is -X', () => {
      const anchor = box.getAnchor('left')
      expectVectorClose(anchor!.direction, [-1, 0, 0])
    })

    it('right anchor at correct position', () => {
      const anchor = box.getAnchor('right')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [10, 0, 0])
    })

    it('right anchor direction is +X', () => {
      const anchor = box.getAnchor('right')
      expectVectorClose(anchor!.direction, [1, 0, 0])
    })
  })

  describe('getAnchor() - center point anchors', () => {
    const box = new Box({ width: 20, depth: 40, height: 60 })
    // Half dimensions: w=10, d=20, h=30

    it('center anchor at origin', () => {
      const anchor = box.getAnchor('center')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 0, 0])
    })

    it('center anchor direction is +Z', () => {
      const anchor = box.getAnchor('center')
      expectVectorClose(anchor!.direction, [0, 0, 1])
    })

    it('centerTop anchor at top center', () => {
      const anchor = box.getAnchor('centerTop')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 0, 30])
    })

    it('centerBottom anchor at bottom center', () => {
      const anchor = box.getAnchor('centerBottom')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 0, -30])
    })
  })

  describe('getAnchor() - corner anchors', () => {
    const box = new Box({ width: 20, depth: 40, height: 60 })
    // Half dimensions: w=10, d=20, h=30

    describe('top corners', () => {
      it('topFrontLeft at correct position', () => {
        const anchor = box.getAnchor('topFrontLeft')
        expect(anchor).toBeDefined()
        expectVectorClose(anchor!.position, [-10, -20, 30])
      })

      it('topFrontLeft direction is +Z', () => {
        const anchor = box.getAnchor('topFrontLeft')
        expectVectorClose(anchor!.direction, [0, 0, 1])
      })

      it('topFrontRight at correct position', () => {
        const anchor = box.getAnchor('topFrontRight')
        expect(anchor).toBeDefined()
        expectVectorClose(anchor!.position, [10, -20, 30])
      })

      it('topBackLeft at correct position', () => {
        const anchor = box.getAnchor('topBackLeft')
        expect(anchor).toBeDefined()
        expectVectorClose(anchor!.position, [-10, 20, 30])
      })

      it('topBackRight at correct position', () => {
        const anchor = box.getAnchor('topBackRight')
        expect(anchor).toBeDefined()
        expectVectorClose(anchor!.position, [10, 20, 30])
      })
    })

    describe('bottom corners', () => {
      it('bottomFrontLeft at correct position', () => {
        const anchor = box.getAnchor('bottomFrontLeft')
        expect(anchor).toBeDefined()
        expectVectorClose(anchor!.position, [-10, -20, -30])
      })

      it('bottomFrontLeft direction is -Z', () => {
        const anchor = box.getAnchor('bottomFrontLeft')
        expectVectorClose(anchor!.direction, [0, 0, -1])
      })

      it('bottomFrontRight at correct position', () => {
        const anchor = box.getAnchor('bottomFrontRight')
        expect(anchor).toBeDefined()
        expectVectorClose(anchor!.position, [10, -20, -30])
      })

      it('bottomBackLeft at correct position', () => {
        const anchor = box.getAnchor('bottomBackLeft')
        expect(anchor).toBeDefined()
        expectVectorClose(anchor!.position, [-10, 20, -30])
      })

      it('bottomBackRight at correct position', () => {
        const anchor = box.getAnchor('bottomBackRight')
        expect(anchor).toBeDefined()
        expectVectorClose(anchor!.position, [10, 20, -30])
      })
    })
  })

  describe('getAnchor() - non-existent anchor', () => {
    it('returns undefined for unknown anchor name', () => {
      const box = new Box({ width: 10, depth: 10, height: 10 })
      expect(box.getAnchor('nonexistent')).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      const box = new Box({ width: 10, depth: 10, height: 10 })
      expect(box.getAnchor('')).toBeUndefined()
    })
  })

  describe('getNode()', () => {
    it('returns base node when no transformations applied', () => {
      const box = new Box({ width: 10, depth: 20, height: 30 })
      const node = box.getNode()

      expect(node.type).toBe('primitive')
      if (node.type === 'primitive' && node.shape === 'box') {
        expect(node.width).toBe(10)
        expect(node.depth).toBe(20)
        expect(node.height).toBe(30)
      }
    })
  })

  describe('anchor names match anchor objects', () => {
    it('each anchor name has matching anchor.name property', () => {
      const box = new Box({ width: 10, depth: 10, height: 10 })
      const names = box.getAnchorNames()

      for (const name of names) {
        const anchor = box.getAnchor(name)
        expect(anchor).toBeDefined()
        expect(anchor!.name).toBe(name)
      }
    })
  })

  describe('anchor directions are normalized', () => {
    it('all anchor directions are unit vectors', () => {
      const box = new Box({ width: 10, depth: 20, height: 30 })
      const names = box.getAnchorNames()

      for (const name of names) {
        const anchor = box.getAnchor(name)
        expect(anchor).toBeDefined()
        const len = Math.sqrt(
          anchor!.direction[0] ** 2 +
          anchor!.direction[1] ** 2 +
          anchor!.direction[2] ** 2
        )
        expectClose(len, 1)
      }
    })
  })
})
