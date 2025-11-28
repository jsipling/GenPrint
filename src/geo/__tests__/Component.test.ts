/**
 * Tests for Component - wraps shapes with custom anchors
 *
 * Components enable defining reusable parts with semantic attachment points
 * like mounting holes, ports, connectors, etc.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { Component } from '../primitives/Component'
import { Box } from '../primitives/Box'
import { Cylinder } from '../primitives/Cylinder'
import { Compiler } from '../Compiler'
import { expectValid, expectDimensions } from '../../test/geometryHelpers'

describe('Component', () => {
  let M: ManifoldToplevel
  let compiler: Compiler

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
    compiler = new Compiler(M)
  })

  describe('custom anchors', () => {
    it('wraps a shape with custom anchors', () => {
      const boardShape = new Box({ width: 85, depth: 56, height: 2 })

      const piBoard = new Component({
        shape: boardShape,
        anchors: {
          usbPort: { position: [30, 0, 1], direction: [1, 0, 0] },
          hdmiPort: { position: [20, -28, 1], direction: [0, -1, 0] },
          mountingHole1: { position: [3.5, 3.5, 0], direction: [0, 0, -1] },
          mountingHole2: { position: [61.5, 3.5, 0], direction: [0, 0, -1] }
        }
      })

      // Should have custom anchors
      const usb = piBoard.getAnchor('usbPort')
      expect(usb).toBeDefined()
      expect(usb!.position).toEqual([30, 0, 1])
      expect(usb!.direction).toEqual([1, 0, 0])

      const hdmi = piBoard.getAnchor('hdmiPort')
      expect(hdmi).toBeDefined()
      expect(hdmi!.position).toEqual([20, -28, 1])

      const mount1 = piBoard.getAnchor('mountingHole1')
      expect(mount1).toBeDefined()
      expect(mount1!.position).toEqual([3.5, 3.5, 0])
      expect(mount1!.direction).toEqual([0, 0, -1])
    })

    it('preserves base shape anchors', () => {
      const boardShape = new Box({ width: 85, depth: 56, height: 2 })

      const piBoard = new Component({
        shape: boardShape,
        anchors: {
          mountingHole: { position: [3.5, 3.5, 0], direction: [0, 0, -1] }
        }
      })

      // Should have base shape anchors
      const top = piBoard.getAnchor('top')
      expect(top).toBeDefined()
      expect(top!.position).toEqual([0, 0, 1]) // Half height of 2mm box

      const center = piBoard.getAnchor('center')
      expect(center).toBeDefined()
      expect(center!.position).toEqual([0, 0, 0])

      const bottom = piBoard.getAnchor('bottom')
      expect(bottom).toBeDefined()
      expect(bottom!.position).toEqual([0, 0, -1])
    })

    it('custom anchors override base anchors with same name', () => {
      const box = new Box({ width: 10, depth: 10, height: 10 })

      // Override the 'top' anchor with a custom position
      const customBox = new Component({
        shape: box,
        anchors: {
          top: { position: [2, 2, 5], direction: [0, 0, 1] }
        }
      })

      const top = customBox.getAnchor('top')
      expect(top).toBeDefined()
      expect(top!.position).toEqual([2, 2, 5]) // Custom position, not [0, 0, 5]
    })
  })

  describe('geometry generation', () => {
    it('generates same geometry as wrapped shape', () => {
      const boardShape = new Box({ width: 85, depth: 56, height: 2 })
      const piBoard = new Component({
        shape: boardShape,
        anchors: {
          mountingHole: { position: [3.5, 3.5, 0], direction: [0, 0, -1] }
        }
      })

      const shapeResult = compiler.compile(boardShape.getNode())
      const componentResult = compiler.compile(piBoard.getNode())

      // Should have identical geometry
      expect(componentResult.volume()).toBeCloseTo(shapeResult.volume(), 6)

      const shapeBbox = shapeResult.boundingBox()
      const componentBbox = componentResult.boundingBox()
      expect(componentBbox.min).toEqual(shapeBbox.min)
      expect(componentBbox.max).toEqual(shapeBbox.max)

      shapeResult.delete()
      componentResult.delete()
    })

    it('compiles to valid manifold', () => {
      const enclosure = new Component({
        shape: new Box({ width: 100, depth: 60, height: 25 }),
        anchors: {
          ventSlot: { position: [40, 0, 12.5], direction: [1, 0, 0] },
          mountPoint: { position: [-45, -25, -12.5], direction: [0, 0, -1] }
        }
      })

      const result = compiler.compile(enclosure.getNode())
      expectValid(result)
      expectDimensions(result, { width: 100, depth: 60, height: 25 })

      result.delete()
    })
  })

  describe('alignment with custom anchors', () => {
    it('can align other shapes to custom anchors', () => {
      const boardShape = new Box({ width: 85, depth: 56, height: 2 })

      const piBoard = new Component({
        shape: boardShape,
        anchors: {
          mountingHole: { position: [3.5, 3.5, -1], direction: [0, 0, -1] }
        }
      })

      // Align a standoff to the mounting hole
      const standoff = new Cylinder({ diameter: 6, height: 5 })
      standoff.align({
        self: 'top',
        target: piBoard,
        to: 'mountingHole',
        mode: 'mate'
      })

      // Standoff top should be at mounting hole position (z = -1 for 2mm board centered)
      const standoffTop = standoff.getAnchor('top')
      expect(standoffTop).toBeDefined()
      expect(standoffTop!.position[2]).toBeCloseTo(-1, 1)
    })

    it('can align component to other shapes', () => {
      const basePlate = new Box({ width: 120, depth: 80, height: 3 })

      const boardShape = new Box({ width: 85, depth: 56, height: 2 })
      const piBoard = new Component({
        shape: boardShape,
        anchors: {
          mountingHole: { position: [3.5, 3.5, -1], direction: [0, 0, -1] }
        }
      })

      // Align piBoard's bottom to basePlate's top
      piBoard.align({
        self: 'bottom',
        target: basePlate,
        to: 'top',
        mode: 'mate'
      })

      // piBoard should now be sitting on top of basePlate
      const boardBottom = piBoard.getAnchor('bottom')
      expect(boardBottom).toBeDefined()
      expect(boardBottom!.position[2]).toBeCloseTo(1.5, 1) // Top of 3mm plate

      // Compile and verify geometry is valid
      const assembly = basePlate.union(piBoard)
      const result = compiler.compile(assembly.getNode())
      expectValid(result)

      // Total height should be 3 + 2 = 5mm
      const bbox = result.boundingBox()
      const height = bbox.max[2] - bbox.min[2]
      expect(height).toBeCloseTo(5, 1)

      result.delete()
    })

    it('transforms custom anchors when component is aligned', () => {
      const baseBox = new Box({ width: 50, depth: 50, height: 10 })
      const partShape = new Box({ width: 20, depth: 20, height: 5 })

      const part = new Component({
        shape: partShape,
        anchors: {
          port: { position: [10, 0, 0], direction: [1, 0, 0] } // On right side, at center height
        }
      })

      // Align part on top of baseBox
      part.align({
        self: 'bottom',
        target: baseBox,
        to: 'top',
        mode: 'mate'
      })

      // Check that custom anchor transformed correctly
      const port = part.getAnchor('port')
      expect(port).toBeDefined()
      // X and Y should be same
      expect(port!.position[0]).toBeCloseTo(10, 1)
      expect(port!.position[1]).toBeCloseTo(0, 1)
      // Z: base top is at 5, part bottom was at -2.5, now at 5
      // Part center is now at 5 + 2.5 = 7.5, port was at z=0 relative to center
      expect(port!.position[2]).toBeCloseTo(7.5, 1)
    })
  })

  describe('boolean operations', () => {
    it('can subtract from component', () => {
      const enclosure = new Component({
        shape: new Box({ width: 80, depth: 60, height: 20 }),
        anchors: {
          ventSlot: { position: [35, 0, 0], direction: [1, 0, 0] }
        }
      })

      const hole = new Cylinder({ diameter: 10, height: 30 })
      hole.align({ self: 'center', target: enclosure, to: 'center' })

      const part = enclosure.subtract(hole)
      const result = compiler.compile(part.getNode())

      expectValid(result)

      // Volume should be enclosure minus hole
      const enclosureVol = 80 * 60 * 20
      const holeVol = Math.PI * 25 * 20 // Through 20mm
      const expectedVol = enclosureVol - holeVol
      expect(Math.abs(result.volume() - expectedVol) / expectedVol).toBeLessThan(0.02)

      result.delete()
    })

    it('can union with component', () => {
      const bracket = new Component({
        shape: new Box({ width: 30, depth: 20, height: 5 }),
        anchors: {
          mountPoint: { position: [0, 0, -2.5], direction: [0, 0, -1] }
        }
      })

      const post = new Cylinder({ diameter: 8, height: 15 })
      post.align({
        self: 'bottom',
        target: bracket,
        to: 'top',
        mode: 'mate'
      })

      const assembly = bracket.union(post)
      const result = compiler.compile(assembly.getNode())

      expectValid(result)

      // Total height should be 5 + 15 = 20mm
      const bbox = result.boundingBox()
      const height = bbox.max[2] - bbox.min[2]
      expect(height).toBeCloseTo(20, 1)

      result.delete()
    })
  })

  describe('getAnchorNames', () => {
    it('returns all anchor names including custom ones', () => {
      const box = new Box({ width: 10, depth: 10, height: 10 })
      const component = new Component({
        shape: box,
        anchors: {
          customA: { position: [1, 2, 3], direction: [1, 0, 0] },
          customB: { position: [4, 5, 6], direction: [0, 1, 0] }
        }
      })

      const names = component.getAnchorNames()

      // Should include custom anchors
      expect(names).toContain('customA')
      expect(names).toContain('customB')

      // Should include base shape anchors
      expect(names).toContain('top')
      expect(names).toContain('bottom')
      expect(names).toContain('center')
    })
  })

  describe('edge cases', () => {
    it('handles empty anchors object', () => {
      const box = new Box({ width: 10, depth: 10, height: 10 })
      const component = new Component({
        shape: box,
        anchors: {}
      })

      // Should still have base shape anchors
      const top = component.getAnchor('top')
      expect(top).toBeDefined()

      // Should compile correctly
      const result = compiler.compile(component.getNode())
      expectValid(result)
      result.delete()
    })

    it('handles complex inner shapes', () => {
      // Create a component from a boolean result
      const outerBox = new Box({ width: 40, depth: 40, height: 10 })
      const innerHole = new Cylinder({ diameter: 20, height: 15 })
      innerHole.align({ self: 'center', target: outerBox, to: 'center' })
      const hollowBox = outerBox.subtract(innerHole)

      const component = new Component({
        shape: hollowBox,
        anchors: {
          centerHole: { position: [0, 0, 5], direction: [0, 0, 1] }
        }
      })

      const centerHole = component.getAnchor('centerHole')
      expect(centerHole).toBeDefined()
      expect(centerHole!.position).toEqual([0, 0, 5])

      const result = compiler.compile(component.getNode())
      expectValid(result)
      result.delete()
    })
  })
})
