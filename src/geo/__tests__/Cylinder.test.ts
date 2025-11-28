import { describe, it, expect } from 'vitest'
import type { Vector3 } from '../types'
import { Cylinder } from '../primitives/Cylinder'

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

describe('Cylinder', () => {
  describe('constructor', () => {
    it('creates a cylinder with given dimensions', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      expect(cyl).toBeDefined()
    })
  })

  describe('getBaseNode()', () => {
    it('returns a primitive cylinder GeoNode', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      const node = cyl.getBaseNode()

      expect(node.type).toBe('primitive')
      if (node.type === 'primitive') {
        expect(node.shape).toBe('cylinder')
      }
    })

    it('includes correct dimensions', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      const node = cyl.getBaseNode()

      if (node.type === 'primitive' && node.shape === 'cylinder') {
        expect(node.diameter).toBe(10)
        expect(node.height).toBe(20)
      } else {
        expect.fail('Expected primitive cylinder node')
      }
    })

    it('handles unit cylinder', () => {
      const cyl = new Cylinder({ diameter: 1, height: 1 })
      const node = cyl.getBaseNode()

      if (node.type === 'primitive' && node.shape === 'cylinder') {
        expect(node.diameter).toBe(1)
        expect(node.height).toBe(1)
      } else {
        expect.fail('Expected primitive cylinder node')
      }
    })
  })

  describe('getAnchorNames()', () => {
    it('returns all expected anchor names', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      const names = cyl.getAnchorNames()

      // Circular face centers
      expect(names).toContain('top')
      expect(names).toContain('bottom')

      // Center
      expect(names).toContain('center')

      // Cardinal points on circumference
      expect(names).toContain('front')
      expect(names).toContain('back')
      expect(names).toContain('left')
      expect(names).toContain('right')
    })

    it('returns correct count of anchors', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      const names = cyl.getAnchorNames()
      // 2 circular faces + 1 center + 4 cardinal = 7
      expect(names).toHaveLength(7)
    })
  })

  describe('getAnchor() - circular face centers', () => {
    const cyl = new Cylinder({ diameter: 20, height: 40 })
    // radius = 10, half-height = 20

    it('top anchor at correct position', () => {
      const anchor = cyl.getAnchor('top')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 0, 20])
    })

    it('top anchor direction is +Z', () => {
      const anchor = cyl.getAnchor('top')
      expectVectorClose(anchor!.direction, [0, 0, 1])
    })

    it('bottom anchor at correct position', () => {
      const anchor = cyl.getAnchor('bottom')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 0, -20])
    })

    it('bottom anchor direction is -Z', () => {
      const anchor = cyl.getAnchor('bottom')
      expectVectorClose(anchor!.direction, [0, 0, -1])
    })
  })

  describe('getAnchor() - center anchor', () => {
    const cyl = new Cylinder({ diameter: 20, height: 40 })

    it('center anchor at origin', () => {
      const anchor = cyl.getAnchor('center')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 0, 0])
    })

    it('center anchor direction is +Z', () => {
      const anchor = cyl.getAnchor('center')
      expectVectorClose(anchor!.direction, [0, 0, 1])
    })
  })

  describe('getAnchor() - cardinal circumference anchors', () => {
    const cyl = new Cylinder({ diameter: 20, height: 40 })
    // radius = 10, anchors at mid-height (z=0)

    it('front anchor at -Y on circumference', () => {
      const anchor = cyl.getAnchor('front')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, -10, 0])
    })

    it('front anchor direction is -Y (outward)', () => {
      const anchor = cyl.getAnchor('front')
      expectVectorClose(anchor!.direction, [0, -1, 0])
    })

    it('back anchor at +Y on circumference', () => {
      const anchor = cyl.getAnchor('back')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [0, 10, 0])
    })

    it('back anchor direction is +Y (outward)', () => {
      const anchor = cyl.getAnchor('back')
      expectVectorClose(anchor!.direction, [0, 1, 0])
    })

    it('left anchor at -X on circumference', () => {
      const anchor = cyl.getAnchor('left')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [-10, 0, 0])
    })

    it('left anchor direction is -X (outward)', () => {
      const anchor = cyl.getAnchor('left')
      expectVectorClose(anchor!.direction, [-1, 0, 0])
    })

    it('right anchor at +X on circumference', () => {
      const anchor = cyl.getAnchor('right')
      expect(anchor).toBeDefined()
      expectVectorClose(anchor!.position, [10, 0, 0])
    })

    it('right anchor direction is +X (outward)', () => {
      const anchor = cyl.getAnchor('right')
      expectVectorClose(anchor!.direction, [1, 0, 0])
    })
  })

  describe('getAnchor() - non-existent anchor', () => {
    it('returns undefined for unknown anchor name', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      expect(cyl.getAnchor('nonexistent')).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      expect(cyl.getAnchor('')).toBeUndefined()
    })
  })

  describe('getNode()', () => {
    it('returns base node when no transformations applied', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      const node = cyl.getNode()

      expect(node.type).toBe('primitive')
      if (node.type === 'primitive' && node.shape === 'cylinder') {
        expect(node.diameter).toBe(10)
        expect(node.height).toBe(20)
      }
    })
  })

  describe('anchor names match anchor objects', () => {
    it('each anchor name has matching anchor.name property', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      const names = cyl.getAnchorNames()

      for (const name of names) {
        const anchor = cyl.getAnchor(name)
        expect(anchor).toBeDefined()
        expect(anchor!.name).toBe(name)
      }
    })
  })

  describe('anchor directions are normalized', () => {
    it('all anchor directions are unit vectors', () => {
      const cyl = new Cylinder({ diameter: 10, height: 20 })
      const names = cyl.getAnchorNames()

      for (const name of names) {
        const anchor = cyl.getAnchor(name)
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

  describe('cardinal anchors on circumference', () => {
    it('front/back/left/right are at radius distance from center', () => {
      const diameter = 30
      const cyl = new Cylinder({ diameter, height: 20 })
      const radius = diameter / 2

      const cardinals = ['front', 'back', 'left', 'right']
      for (const name of cardinals) {
        const anchor = cyl.getAnchor(name)
        expect(anchor).toBeDefined()

        // Distance from origin should equal radius
        const dist = Math.sqrt(
          anchor!.position[0] ** 2 +
          anchor!.position[1] ** 2
        )
        expectClose(dist, radius)

        // Z should be 0 (mid-height)
        expectClose(anchor!.position[2], 0)
      }
    })
  })
})
