import { describe, it, expect } from 'vitest'
import type { Vector3 } from '../types'
import { Box } from '../primitives/Box'
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

describe('alignment integration tests', () => {
  describe('Box-to-Box alignment', () => {
    describe('mate mode (default)', () => {
      it('stacks box on top of another box', () => {
        // Base box: 10x10x10 centered at origin
        // Top face at z=5
        const baseBox = new Box({ width: 10, depth: 10, height: 10 })

        // Upper box: 8x8x6 to be stacked
        // Bottom face at z=-3 before alignment
        const upperBox = new Box({ width: 8, depth: 8, height: 6 })

        // Align upperBox's bottom to baseBox's top (mate mode)
        upperBox.align({
          self: 'bottom',
          target: baseBox,
          to: 'top'
        })

        // After alignment:
        // - upperBox's bottom anchor should be at baseBox's top position (0, 0, 5)
        const bottomAnchor = upperBox.getAnchor('bottom')
        expect(bottomAnchor).toBeDefined()
        expectVectorClose(bottomAnchor!.position, [0, 0, 5])

        // - upperBox's center should now be at (0, 0, 8) since height is 6
        const centerAnchor = upperBox.getAnchor('center')
        expect(centerAnchor).toBeDefined()
        expectVectorClose(centerAnchor!.position, [0, 0, 8])

        // - upperBox's top should be at (0, 0, 11)
        const topAnchor = upperBox.getAnchor('top')
        expect(topAnchor).toBeDefined()
        expectVectorClose(topAnchor!.position, [0, 0, 11])
      })

      it('attaches box to side of another box', () => {
        // Base box at origin
        const baseBox = new Box({ width: 10, depth: 10, height: 10 })
        // Right face at x=5

        // Side box to attach
        const sideBox = new Box({ width: 6, depth: 10, height: 10 })
        // Left face at x=-3 before alignment

        // Align sideBox's left to baseBox's right
        sideBox.align({
          self: 'left',
          target: baseBox,
          to: 'right'
        })

        // After alignment:
        // - sideBox's left anchor should be at baseBox's right position (5, 0, 0)
        const leftAnchor = sideBox.getAnchor('left')
        expect(leftAnchor).toBeDefined()
        expectVectorClose(leftAnchor!.position, [5, 0, 0])

        // - sideBox's center should be at (8, 0, 0)
        const centerAnchor = sideBox.getAnchor('center')
        expect(centerAnchor).toBeDefined()
        expectVectorClose(centerAnchor!.position, [8, 0, 0])
      })

      it('positions box in front of another box', () => {
        const backBox = new Box({ width: 10, depth: 10, height: 10 })
        // Front face at y=-5

        const frontBox = new Box({ width: 10, depth: 8, height: 10 })
        // Back face at y=4 before alignment

        // Align frontBox's back to backBox's front
        frontBox.align({
          self: 'back',
          target: backBox,
          to: 'front'
        })

        const backAnchor = frontBox.getAnchor('back')
        expect(backAnchor).toBeDefined()
        expectVectorClose(backAnchor!.position, [0, -5, 0])

        const centerAnchor = frontBox.getAnchor('center')
        expect(centerAnchor).toBeDefined()
        expectVectorClose(centerAnchor!.position, [0, -9, 0])
      })
    })

    describe('flush mode', () => {
      it('aligns two boxes top faces flush', () => {
        const box1 = new Box({ width: 10, depth: 10, height: 20 })
        // Top at z=10

        const box2 = new Box({ width: 8, depth: 8, height: 10 })
        // Top at z=5 before alignment

        // Align box2's top flush with box1's top
        box2.align({
          self: 'top',
          target: box1,
          to: 'top',
          mode: 'flush'
        })

        // box2's top should be at same position as box1's top
        const box2Top = box2.getAnchor('top')
        expect(box2Top).toBeDefined()
        expectVectorClose(box2Top!.position, [0, 0, 10])

        // box2's direction should be same as box1's top direction
        expectVectorClose(box2Top!.direction, [0, 0, 1])
      })

      it('aligns box front flush with another box front', () => {
        const box1 = new Box({ width: 10, depth: 20, height: 10 })
        // Front at y=-10

        const box2 = new Box({ width: 10, depth: 8, height: 10 })
        // Front at y=-4 before alignment

        box2.align({
          self: 'front',
          target: box1,
          to: 'front',
          mode: 'flush'
        })

        const box2Front = box2.getAnchor('front')
        expect(box2Front).toBeDefined()
        expectVectorClose(box2Front!.position, [0, -10, 0])
      })
    })
  })

  describe('Box-to-Cylinder alignment', () => {
    it('places box on top of cylinder', () => {
      const cyl = new Cylinder({ diameter: 20, height: 30 })
      // Top at z=15

      const box = new Box({ width: 10, depth: 10, height: 5 })
      // Bottom at z=-2.5 before alignment

      box.align({
        self: 'bottom',
        target: cyl,
        to: 'top'
      })

      const boxBottom = box.getAnchor('bottom')
      expect(boxBottom).toBeDefined()
      expectVectorClose(boxBottom!.position, [0, 0, 15])

      const boxCenter = box.getAnchor('center')
      expect(boxCenter).toBeDefined()
      expectVectorClose(boxCenter!.position, [0, 0, 17.5])
    })

    it('aligns box to side of cylinder', () => {
      const cyl = new Cylinder({ diameter: 20, height: 30 })
      // Right anchor at x=10

      const box = new Box({ width: 6, depth: 10, height: 10 })

      box.align({
        self: 'left',
        target: cyl,
        to: 'right'
      })

      const boxLeft = box.getAnchor('left')
      expect(boxLeft).toBeDefined()
      expectVectorClose(boxLeft!.position, [10, 0, 0])
    })
  })

  describe('Cylinder-to-Box alignment', () => {
    it('places cylinder on top of box', () => {
      const box = new Box({ width: 30, depth: 30, height: 10 })
      // Top at z=5

      const cyl = new Cylinder({ diameter: 10, height: 20 })
      // Bottom at z=-10 before alignment

      cyl.align({
        self: 'bottom',
        target: box,
        to: 'top'
      })

      const cylBottom = cyl.getAnchor('bottom')
      expect(cylBottom).toBeDefined()
      expectVectorClose(cylBottom!.position, [0, 0, 5])

      const cylTop = cyl.getAnchor('top')
      expect(cylTop).toBeDefined()
      expectVectorClose(cylTop!.position, [0, 0, 25])
    })
  })

  describe('Cylinder-to-Cylinder alignment', () => {
    it('stacks cylinders', () => {
      const baseCyl = new Cylinder({ diameter: 20, height: 30 })
      // Top at z=15

      const topCyl = new Cylinder({ diameter: 10, height: 20 })
      // Bottom at z=-10 before alignment

      topCyl.align({
        self: 'bottom',
        target: baseCyl,
        to: 'top'
      })

      const topCylBottom = topCyl.getAnchor('bottom')
      expect(topCylBottom).toBeDefined()
      expectVectorClose(topCylBottom!.position, [0, 0, 15])

      const topCylTop = topCyl.getAnchor('top')
      expect(topCylTop).toBeDefined()
      expectVectorClose(topCylTop!.position, [0, 0, 35])
    })
  })

  describe('offset application', () => {
    it('applies z offset when stacking', () => {
      const baseBox = new Box({ width: 10, depth: 10, height: 10 })
      // Top at z=5

      const upperBox = new Box({ width: 8, depth: 8, height: 6 })

      // Stack with 2mm gap
      upperBox.align({
        self: 'bottom',
        target: baseBox,
        to: 'top',
        offset: { z: 2 }
      })

      const bottomAnchor = upperBox.getAnchor('bottom')
      expect(bottomAnchor).toBeDefined()
      expectVectorClose(bottomAnchor!.position, [0, 0, 7]) // 5 + 2

      const centerAnchor = upperBox.getAnchor('center')
      expect(centerAnchor).toBeDefined()
      expectVectorClose(centerAnchor!.position, [0, 0, 10]) // 7 + 3
    })

    it('applies x offset when attaching to side', () => {
      const baseBox = new Box({ width: 10, depth: 10, height: 10 })
      // Right at x=5

      const sideBox = new Box({ width: 6, depth: 10, height: 10 })

      // Attach with 1mm gap
      sideBox.align({
        self: 'left',
        target: baseBox,
        to: 'right',
        offset: { x: 1 }
      })

      const leftAnchor = sideBox.getAnchor('left')
      expect(leftAnchor).toBeDefined()
      expectVectorClose(leftAnchor!.position, [6, 0, 0]) // 5 + 1
    })

    it('applies combined offset', () => {
      const baseBox = new Box({ width: 10, depth: 10, height: 10 })

      const upperBox = new Box({ width: 8, depth: 8, height: 6 })

      upperBox.align({
        self: 'bottom',
        target: baseBox,
        to: 'top',
        offset: { x: 2, y: 3, z: 1 }
      })

      const bottomAnchor = upperBox.getAnchor('bottom')
      expect(bottomAnchor).toBeDefined()
      expectVectorClose(bottomAnchor!.position, [2, 3, 6]) // top at 5, + offsets
    })
  })

  describe('corner alignment', () => {
    it('aligns box corner to another box corner', () => {
      const box1 = new Box({ width: 10, depth: 10, height: 10 })
      // topFrontRight at (5, -5, 5)

      const box2 = new Box({ width: 6, depth: 6, height: 6 })
      // bottomBackLeft at (-3, 3, -3) before alignment

      box2.align({
        self: 'bottomBackLeft',
        target: box1,
        to: 'topFrontRight'
      })

      const alignedCorner = box2.getAnchor('bottomBackLeft')
      expect(alignedCorner).toBeDefined()
      expectVectorClose(alignedCorner!.position, [5, -5, 5])

      // Verify other corners moved correctly
      const oppositeCorner = box2.getAnchor('topFrontRight')
      expect(oppositeCorner).toBeDefined()
      expectVectorClose(oppositeCorner!.position, [11, -11, 11])
    })
  })

  describe('GeoNode structure after alignment', () => {
    it('wraps base node in transform node', () => {
      const baseBox = new Box({ width: 10, depth: 10, height: 10 })
      const upperBox = new Box({ width: 8, depth: 8, height: 6 })

      upperBox.align({
        self: 'bottom',
        target: baseBox,
        to: 'top'
      })

      const node = upperBox.getNode()
      expect(node.type).toBe('transform')

      if (node.type === 'transform') {
        expect(node.child.type).toBe('primitive')
        if (node.child.type === 'primitive') {
          expect(node.child.shape).toBe('box')
        }
        expect(node.matrix).toBeDefined()
        expect(node.matrix).toHaveLength(16)
      }
    })

    it('base box without alignment has no transform wrapper', () => {
      const box = new Box({ width: 10, depth: 10, height: 10 })
      const node = box.getNode()

      expect(node.type).toBe('primitive')
      if (node.type === 'primitive') {
        expect(node.shape).toBe('box')
      }
    })
  })

  describe('chaining alignments', () => {
    it('supports chaining due to returning this', () => {
      const box1 = new Box({ width: 10, depth: 10, height: 10 })
      const box2 = new Box({ width: 10, depth: 10, height: 10 })
      const box3 = new Box({ width: 8, depth: 8, height: 6 })

      // box2 on top of box1
      box2.align({
        self: 'bottom',
        target: box1,
        to: 'top'
      })

      // box3 on top of box2
      box3.align({
        self: 'bottom',
        target: box2,
        to: 'top'
      })

      // box1 top at z=5, box2 top at z=15, box3 bottom at z=15, box3 top at z=21
      const box3Top = box3.getAnchor('top')
      expect(box3Top).toBeDefined()
      expectVectorClose(box3Top!.position, [0, 0, 21])
    })
  })

  describe('boolean operations with alignment', () => {
    it('creates hole using aligned cylinder', () => {
      const box = new Box({ width: 20, depth: 20, height: 10 })
      const hole = new Cylinder({ diameter: 8, height: 12 })

      hole.align({
        self: 'center',
        target: box,
        to: 'center'
      })

      const result = box.subtract(hole)
      const node = result.getNode()

      expect(node.type).toBe('operation')
      if (node.type === 'operation') {
        expect(node.op).toBe('subtract')
        expect(node.children).toHaveLength(2)
      }
    })

    it('unions aligned shapes', () => {
      const box = new Box({ width: 20, depth: 20, height: 10 })
      const pillar = new Cylinder({ diameter: 10, height: 20 })

      pillar.align({
        self: 'bottom',
        target: box,
        to: 'top'
      })

      const result = box.union(pillar)
      const node = result.getNode()

      expect(node.type).toBe('operation')
      if (node.type === 'operation') {
        expect(node.op).toBe('union')
      }
    })
  })
})
