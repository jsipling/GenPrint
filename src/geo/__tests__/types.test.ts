import { describe, it, expect } from 'vitest'
import type { GeoNode, Vector3, Matrix4x4, Anchor, AlignMode, AlignOptions, Shape } from '../types'

describe('types', () => {
  describe('Vector3', () => {
    it('is a tuple of three numbers', () => {
      const v: Vector3 = [1, 2, 3]
      expect(v).toHaveLength(3)
      expect(v[0]).toBe(1)
      expect(v[1]).toBe(2)
      expect(v[2]).toBe(3)
    })
  })

  describe('Matrix4x4', () => {
    it('is a tuple of 16 numbers', () => {
      const m: Matrix4x4 = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
      expect(m).toHaveLength(16)
    })
  })

  describe('Anchor', () => {
    it('has position, direction, and name', () => {
      const anchor: Anchor = {
        position: [0, 0, 0],
        direction: [0, 0, 1],
        name: 'top'
      }
      expect(anchor.position).toEqual([0, 0, 0])
      expect(anchor.direction).toEqual([0, 0, 1])
      expect(anchor.name).toBe('top')
    })
  })

  describe('AlignMode', () => {
    it('accepts mate or flush', () => {
      const mate: AlignMode = 'mate'
      const flush: AlignMode = 'flush'
      expect(mate).toBe('mate')
      expect(flush).toBe('flush')
    })
  })

  describe('GeoNode discriminated union', () => {
    it('discriminates box primitive', () => {
      const node: GeoNode = {
        type: 'primitive',
        shape: 'box',
        width: 10,
        depth: 20,
        height: 30
      }

      if (node.type === 'primitive' && node.shape === 'box') {
        expect(node.width).toBe(10)
        expect(node.depth).toBe(20)
        expect(node.height).toBe(30)
      } else {
        expect.fail('Type narrowing should work')
      }
    })

    it('discriminates cylinder primitive', () => {
      const node: GeoNode = {
        type: 'primitive',
        shape: 'cylinder',
        diameter: 10,
        height: 20
      }

      if (node.type === 'primitive' && node.shape === 'cylinder') {
        expect(node.diameter).toBe(10)
        expect(node.height).toBe(20)
      } else {
        expect.fail('Type narrowing should work')
      }
    })

    it('discriminates operation nodes', () => {
      const boxNode: GeoNode = {
        type: 'primitive',
        shape: 'box',
        width: 10,
        depth: 10,
        height: 10
      }

      const unionNode: GeoNode = {
        type: 'operation',
        op: 'union',
        children: [boxNode, boxNode]
      }

      if (unionNode.type === 'operation') {
        expect(unionNode.op).toBe('union')
        expect(unionNode.children).toHaveLength(2)
      } else {
        expect.fail('Type narrowing should work')
      }
    })

    it('discriminates subtract operation', () => {
      const node: GeoNode = {
        type: 'operation',
        op: 'subtract',
        children: []
      }

      if (node.type === 'operation') {
        expect(node.op).toBe('subtract')
      } else {
        expect.fail('Type narrowing should work')
      }
    })

    it('discriminates intersect operation', () => {
      const node: GeoNode = {
        type: 'operation',
        op: 'intersect',
        children: []
      }

      if (node.type === 'operation') {
        expect(node.op).toBe('intersect')
      } else {
        expect.fail('Type narrowing should work')
      }
    })

    it('discriminates transform nodes', () => {
      const boxNode: GeoNode = {
        type: 'primitive',
        shape: 'box',
        width: 10,
        depth: 10,
        height: 10
      }

      const identityMatrix: Matrix4x4 = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]

      const transformNode: GeoNode = {
        type: 'transform',
        child: boxNode,
        matrix: identityMatrix
      }

      if (transformNode.type === 'transform') {
        expect(transformNode.matrix).toEqual(identityMatrix)
        expect(transformNode.child).toBe(boxNode)
      } else {
        expect.fail('Type narrowing should work')
      }
    })
  })

  describe('AlignOptions', () => {
    it('has required fields', () => {
      // Create a mock Shape for testing
      const mockShape: Shape = {
        getNode: () => ({
          type: 'primitive',
          shape: 'box',
          width: 10,
          depth: 10,
          height: 10
        }),
        getAnchor: () => undefined
      }

      const options: AlignOptions = {
        self: 'top',
        target: mockShape,
        to: 'bottom'
      }

      expect(options.self).toBe('top')
      expect(options.target).toBe(mockShape)
      expect(options.to).toBe('bottom')
    })

    it('accepts optional mode and offset', () => {
      const mockShape: Shape = {
        getNode: () => ({
          type: 'primitive',
          shape: 'box',
          width: 10,
          depth: 10,
          height: 10
        }),
        getAnchor: () => undefined
      }

      const options: AlignOptions = {
        self: 'top',
        target: mockShape,
        to: 'bottom',
        mode: 'flush',
        offset: { x: 1, y: 2, z: 3 }
      }

      expect(options.mode).toBe('flush')
      expect(options.offset).toEqual({ x: 1, y: 2, z: 3 })
    })

    it('allows partial offset', () => {
      const mockShape: Shape = {
        getNode: () => ({
          type: 'primitive',
          shape: 'box',
          width: 10,
          depth: 10,
          height: 10
        }),
        getAnchor: () => undefined
      }

      const options: AlignOptions = {
        self: 'top',
        target: mockShape,
        to: 'bottom',
        offset: { z: 5 }
      }

      expect(options.offset?.x).toBeUndefined()
      expect(options.offset?.y).toBeUndefined()
      expect(options.offset?.z).toBe(5)
    })
  })

  describe('Shape interface', () => {
    it('has getNode method returning GeoNode', () => {
      const shape: Shape = {
        getNode: () => ({
          type: 'primitive',
          shape: 'box',
          width: 10,
          depth: 10,
          height: 10
        }),
        getAnchor: () => undefined
      }

      const node = shape.getNode()
      expect(node.type).toBe('primitive')
    })

    it('has getAnchor method returning Anchor or undefined', () => {
      const testAnchor: Anchor = {
        position: [0, 0, 5],
        direction: [0, 0, 1],
        name: 'top'
      }

      const shape: Shape = {
        getNode: () => ({
          type: 'primitive',
          shape: 'box',
          width: 10,
          depth: 10,
          height: 10
        }),
        getAnchor: (name: string) => name === 'top' ? testAnchor : undefined
      }

      expect(shape.getAnchor('top')).toEqual(testAnchor)
      expect(shape.getAnchor('nonexistent')).toBeUndefined()
    })
  })
})
