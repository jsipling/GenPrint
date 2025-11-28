import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../../../test/manifoldSetup'
import { expectValid, expectDimensions, expectBoundingBox } from '../../../../test/geometryHelpers'
import { Shape } from '../Shape'
import { createPrimitives } from '../primitives'
import { createOperations } from '../operations'
import type { Primitives } from '../primitives'
import type { Operations } from '../operations'

describe('Shape', () => {
  let M: ManifoldToplevel
  let p: Primitives
  let ops: Operations

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 16)
    p = createPrimitives(M)
    ops = createOperations(M)
  })

  describe('construction', () => {
    it('wraps a Manifold correctly', () => {
      const cube = M.Manifold.cube([10, 10, 10], true)
      const shape = new Shape(M, cube)

      expect(shape.getVolume()).toBeCloseTo(1000, 0)
      shape.delete()
    })
  })

  describe('CSG operations', () => {
    it('add() unions two overlapping shapes', () => {
      const cube1 = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const cube2 = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(5, 0, 0))

      const result = cube1.add(cube2)

      expectValid(result.build())
      // Combined width should be 15 (10 + 5 overlap)
      expectDimensions(result.build(), { width: 15, depth: 10, height: 10 })
      result.delete()
    })

    it('add() unions two touching shapes (bounding boxes adjacent)', () => {
      // Two cubes that touch at a face but don't overlap
      const cube1 = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const cube2 = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(10, 0, 0)) // adjacent

      const result = cube1.add(cube2)

      expectValid(result.build())
      expectDimensions(result.build(), { width: 20, depth: 10, height: 10 })
      result.delete()
    })

    it('add() throws for disconnected shapes by default', () => {
      const cube1 = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const cube2 = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(50, 0, 0)) // far apart

      expect(() => cube1.add(cube2)).toThrow(/does not connect/i)
    })

    it('add() error message suggests overlapWith and connectTo', () => {
      const cube1 = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const cube2 = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(50, 0, 0))

      try {
        cube1.add(cube2)
        expect.fail('Should have thrown')
      } catch (e) {
        const message = (e as Error).message
        expect(message).toContain('overlapWith')
        expect(message).toContain('connectTo')
        expect(message).toContain('skipConnectionCheck')
      }
    })

    it('add() allows disconnected shapes with skipConnectionCheck option', () => {
      const cube1 = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const cube2 = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(50, 0, 0))

      const result = cube1.add(cube2, { skipConnectionCheck: true })

      // Use skipConnectivityCheck on build since we intentionally created disconnected geometry
      expect(result.getVolume()).toBeCloseTo(2000, 0)
      result.delete()
    })

    it('subtract() creates difference', () => {
      const outer = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      const inner = new Shape(M, M.Manifold.cube([10, 10, 10], true))

      const result = outer.subtract(inner)

      // Check positive volume (valid geometry)
      // Note: Genus may be -1 for geometry with internal cavities, which is valid
      expect(result.getVolume()).toBeGreaterThan(0)
      // Volume should be 8000 - 1000 = 7000
      expect(result.getVolume()).toBeCloseTo(7000, 0)
      result.delete()
    })

    it('intersect() creates intersection', () => {
      const cube1 = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const cube2 = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(5, 0, 0))

      const result = cube1.intersect(cube2)

      expectValid(result.build())
      // Intersection should be 5x10x10 = 500
      expect(result.getVolume()).toBeCloseTo(500, 0)
      result.delete()
    })
  })

  describe('transforms', () => {
    it('translate() moves the shape', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const moved = cube.translate(20, 30, 40)

      expectBoundingBox(moved.build(), {
        minX: 15, maxX: 25,
        minY: 25, maxY: 35,
        minZ: 35, maxZ: 45
      })
      moved.delete()
    })

    it('rotate() rotates the shape', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 20, 5], true))
      const rotated = cube.rotate(0, 0, 90)

      // After 90 degree Z rotation, width and depth should swap
      expectDimensions(rotated.build(), { width: 20, depth: 10, height: 5 })
      rotated.delete()
    })

    it('scale() scales uniformly with single argument', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const scaled = cube.scale(2)

      expectDimensions(scaled.build(), { width: 20, depth: 20, height: 20 })
      scaled.delete()
    })

    it('scale() scales per-axis with three arguments', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const scaled = cube.scale(1, 2, 3)

      expectDimensions(scaled.build(), { width: 10, depth: 20, height: 30 })
      scaled.delete()
    })

    it('scale() with two arguments scales X independently and Y/Z uniformly', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const scaled = cube.scale(2, 3) // x=2, y=3, z=3

      expectDimensions(scaled.build(), { width: 20, depth: 30, height: 30 })
      scaled.delete()
    })

    it('mirror() mirrors across an axis', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], false).translate(5, 0, 0))
      const mirrored = cube.mirror('x')

      expectBoundingBox(mirrored.build(), {
        minX: -15, maxX: -5
      })
      mirrored.delete()
    })
  })

  describe('patterns', () => {
    it('linearPattern() creates array along axis', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], true))
      const pattern = cube.linearPattern(3, 10, 'x')

      // For disjoint geometry, check volume instead of genus
      expect(pattern.getVolume()).toBeCloseTo(3 * 125, 0) // 3 cubes of 5x5x5
      // 3 cubes spaced 10mm apart: spans from -2.5 to 22.5 = 25mm
      // Use skipConnectivityCheck since this pattern intentionally creates disjoint copies
      expectDimensions(pattern.build({ skipConnectivityCheck: true }), { width: 25 })
      pattern.delete()
    })

    it('circularPattern() creates rotational array', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], false).translate(10, 0, 0))
      const pattern = cube.circularPattern(4, 'z')

      // For disjoint geometry, check volume instead of genus
      expect(pattern.getVolume()).toBeCloseTo(4 * 125, 0) // 4 cubes of 5x5x5
      // 4 cubes at 90 degree intervals around Z axis
      // Should span roughly -15 to 15 in both X and Y
      const bbox = pattern.getBoundingBox()
      expect(bbox.max[0]).toBeGreaterThan(10)
      expect(bbox.max[1]).toBeGreaterThan(10)
      pattern.delete()
    })

    it('linearPattern() with count 1 returns clone with same geometry (consumes original)', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const originalVolume = cube.getVolume()
      const pattern = cube.linearPattern(1, 20, 'x')

      // Returns clone with same volume (original is consumed)
      expect(pattern.getVolume()).toBeCloseTo(originalVolume, 0)
      pattern.delete()
    })

    it('linearPattern() with count 0 returns clone with same geometry (consumes original)', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const originalVolume = cube.getVolume()
      const pattern = cube.linearPattern(0, 20, 'x')

      // Returns clone with same volume (original is consumed)
      expect(pattern.getVolume()).toBeCloseTo(originalVolume, 0)
      pattern.delete()
    })

    it('circularPattern() with count 1 returns clone with same geometry (consumes original)', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], false).translate(10, 0, 0))
      const originalVolume = cube.getVolume()
      const pattern = cube.circularPattern(1, 'z')

      // Returns clone with same volume (original is consumed)
      expect(pattern.getVolume()).toBeCloseTo(originalVolume, 0)
      pattern.delete()
    })

    it('circularPattern() with count 0 returns clone with same geometry (consumes original)', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], false).translate(10, 0, 0))
      const originalVolume = cube.getVolume()
      const pattern = cube.circularPattern(0, 'z')

      // Returns clone with same volume (original is consumed)
      expect(pattern.getVolume()).toBeCloseTo(originalVolume, 0)
      pattern.delete()
    })

    it('linearPattern() with zero spacing clamps to minimum spacing', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], true))
      const pattern = cube.linearPattern(3, 0, 'x')

      // With clamped spacing (MIN_SMALL_FEATURE = 1.5mm), 5mm cubes will still overlap
      // but volume should be greater than a single cube (125) and less than 3x (375)
      expect(pattern.getVolume()).toBeGreaterThan(125) // More than single cube
      expect(pattern.getVolume()).toBeLessThan(375) // Less than 3 separate cubes
      pattern.delete()
    })

    it('linearPattern() with negative spacing clamps to minimum spacing', () => {
      const cube = new Shape(M, M.Manifold.cube([5, 5, 5], true))
      const pattern = cube.linearPattern(3, -10, 'x')

      // Should still produce valid geometry with positive spacing
      expect(pattern.getVolume()).toBeGreaterThan(125) // More than single cube
      pattern.delete()
    })
  })

  describe('utilities', () => {
    it('clone() creates independent copy', () => {
      const original = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const clone = original.clone()

      expect(clone.getVolume()).toBeCloseTo(original.getVolume(), 0)

      // Original should still work after clone
      original.delete()
      expect(clone.getVolume()).toBeCloseTo(1000, 0)
      clone.delete()
    })

    it('getBoundingBox() returns correct bounds', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 20, 30], true))
      const bbox = cube.getBoundingBox()

      expect(bbox.min[0]).toBeCloseTo(-5, 1)
      expect(bbox.max[0]).toBeCloseTo(5, 1)
      expect(bbox.min[1]).toBeCloseTo(-10, 1)
      expect(bbox.max[1]).toBeCloseTo(10, 1)
      expect(bbox.min[2]).toBeCloseTo(-15, 1)
      expect(bbox.max[2]).toBeCloseTo(15, 1)
      cube.delete()
    })

    it('getVolume() returns correct volume', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      expect(cube.getVolume()).toBeCloseTo(1000, 0)
      cube.delete()
    })

    it('getSurfaceArea() returns correct area', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      // 6 faces * 100 = 600
      expect(cube.getSurfaceArea()).toBeCloseTo(600, 0)
      cube.delete()
    })

    it('isValid() returns true for valid geometry', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      expect(cube.isValid()).toBe(true)
      cube.delete()
    })
  })

  describe('chaining', () => {
    it('supports fluent chaining of operations', () => {
      const result = new Shape(M, M.Manifold.cube([20, 20, 10], true))
        .subtract(new Shape(M, M.Manifold.cylinder(12, 5, 5, 16).translate(0, 0, -1)))
        .translate(0, 0, 5)
        .rotate(0, 0, 45)

      expectValid(result.build())
      result.delete()
    })
  })

  describe('build() ownership contract', () => {
    it('build() returns the raw Manifold for final output', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const manifold = shape.build()

      // build() returns a valid Manifold
      expect(manifold).toBeDefined()
      expect(manifold.volume()).toBeCloseTo(1000, 0)

      // Cleanup - caller is responsible after build()
      manifold.delete()
    })

    it('_getManifold() is an alias for build()', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const manifold = shape._getManifold()

      expect(manifold).toBeDefined()
      expect(manifold.volume()).toBeCloseTo(1000, 0)

      manifold.delete()
    })
  })

  describe('mirrorUnion', () => {
    it('mirrorUnion("x") creates symmetric copy across YZ plane', () => {
      // Cube offset to one side
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(15, 0, 0))
      const result = cube.mirrorUnion('x')

      // For disjoint geometry, check volume instead of genus (disjoint = genus -1)
      expect(result.getVolume()).toBeCloseTo(2000, 0)
      // Bounding box should span from -20 to 20 in X
      // Use skipConnectivityCheck since shape doesn't cross mirror plane (intentionally disjoint)
      expectBoundingBox(result.build({ skipConnectivityCheck: true }), { minX: -20, maxX: 20 })
      result.delete()
    })

    it('mirrorUnion("y") creates symmetric copy across XZ plane', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(0, 15, 0))
      const result = cube.mirrorUnion('y')

      // For disjoint geometry, check volume instead of genus
      expect(result.getVolume()).toBeCloseTo(2000, 0)
      // Use skipConnectivityCheck since shape doesn't cross mirror plane (intentionally disjoint)
      expectBoundingBox(result.build({ skipConnectivityCheck: true }), { minY: -20, maxY: 20 })
      result.delete()
    })

    it('mirrorUnion("z") creates symmetric copy across XY plane', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(0, 0, 15))
      const result = cube.mirrorUnion('z')

      // For disjoint geometry, check volume instead of genus
      expect(result.getVolume()).toBeCloseTo(2000, 0)
      // Use skipConnectivityCheck since shape doesn't cross mirror plane (intentionally disjoint)
      expectBoundingBox(result.build({ skipConnectivityCheck: true }), { minZ: -20, maxZ: 20 })
      result.delete()
    })

    it('mirrorUnion with offset separates mirrored parts', () => {
      // Cube at origin
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const result = cube.mirrorUnion('x', { offset: 30 })

      // For disjoint geometry, check volume instead of genus
      // Two cubes: original at +15, mirrored at -15
      expect(result.getVolume()).toBeCloseTo(2000, 0)
      result.delete()
    })

    it('mirrorUnion with shape crossing mirror plane merges geometry', () => {
      // Cube at origin spans across mirror plane
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const result = cube.mirrorUnion('x')

      expectValid(result.build())
      // Volume should still be 1000 since the shape overlaps with itself
      expect(result.getVolume()).toBeCloseTo(1000, 0)
      result.delete()
    })
  })

  describe('coordinate frames', () => {
    it('inFrame() applies frame transform to shape', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const frame = { translate: [20, 0, 0] as [number, number, number] }
      const result = cube.inFrame(frame)

      expectBoundingBox(result.build(), { minX: 15, maxX: 25 })
      result.delete()
    })

    it('inFrame() with rotation applies rotation', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 20, 5], true))
      const frame = { rotate: [0, 0, 90] as [number, number, number] }
      const result = cube.inFrame(frame)

      // After 90 degree Z rotation, width and depth swap
      expectDimensions(result.build(), { width: 20, depth: 10, height: 5 })
      result.delete()
    })

    it('inFrame() applies rotation before translation', () => {
      // Small cube at origin
      const cube = new Shape(M, M.Manifold.cube([2, 2, 2], true))
      // Rotate 90 around Z, then translate 10 in X
      const frame = {
        rotate: [0, 0, 90] as [number, number, number],
        translate: [10, 0, 0] as [number, number, number]
      }
      const result = cube.inFrame(frame)

      // Should be centered at (10, 0, 0)
      expectBoundingBox(result.build(), { minX: 9, maxX: 11, minY: -1, maxY: 1 })
      result.delete()
    })

    it('inFrame() with combined transforms for V-engine bank', () => {
      // Simulate V-engine: rotate 45 degrees around X, then translate up
      const piston = new Shape(M, M.Manifold.cylinder(20, 5, 5, 16))
      const leftBankFrame = {
        rotate: [45, 0, 0] as [number, number, number],
        translate: [0, 0, 50] as [number, number, number]
      }
      const result = piston.inFrame(leftBankFrame)

      expectValid(result.build())
      // The cylinder should be tilted and elevated
      const bbox = result.getBoundingBox()
      expect(bbox.max[2]).toBeGreaterThan(50) // Elevated
      result.delete()
    })
  })

  describe('snapTo', () => {
    it('places shape flush against top surface', () => {
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
      const bolt = new Shape(M, M.Manifold.cylinder(10, 3, 3, 16))

      const snapped = bolt.snapTo(base, {
        surface: 'top',
        at: [0, 0]
      })

      // Bolt bottom should be at top of base (z=5)
      const bbox = snapped.getBoundingBox()
      expect(bbox.min[2]).toBeCloseTo(5, 1)

      base.delete()
      snapped.delete()
    })

    it('places shape flush against bottom surface', () => {
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
      const bolt = new Shape(M, M.Manifold.cylinder(10, 3, 3, 16))

      const snapped = bolt.snapTo(base, {
        surface: 'bottom',
        at: [0, 0]
      })

      // Bolt top should be at bottom of base (z=-5)
      const bbox = snapped.getBoundingBox()
      expect(bbox.max[2]).toBeCloseTo(-5, 1)

      base.delete()
      snapped.delete()
    })

    it('places shape at specified position on surface', () => {
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
      const bolt = new Shape(M, M.Manifold.cylinder(10, 3, 3, 16))

      const snapped = bolt.snapTo(base, {
        surface: 'top',
        at: [5, 5]
      })

      // Bolt should be centered at x=5, y=5
      const bbox = snapped.getBoundingBox()
      const centerX = (bbox.min[0] + bbox.max[0]) / 2
      const centerY = (bbox.min[1] + bbox.max[1]) / 2
      expect(centerX).toBeCloseTo(5, 1)
      expect(centerY).toBeCloseTo(5, 1)

      base.delete()
      snapped.delete()
    })

    it('penetrate positive embeds shape into target', () => {
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
      const pin = new Shape(M, M.Manifold.cylinder(5, 2, 2, 16))

      const snapped = pin.snapTo(base, {
        surface: 'top',
        at: [0, 0],
        penetrate: 2
      })

      // Pin bottom should be 2mm into surface (z = 5 - 2 = 3)
      const bbox = snapped.getBoundingBox()
      expect(bbox.min[2]).toBeCloseTo(3, 1)

      base.delete()
      snapped.delete()
    })

    it('penetrate negative creates gap', () => {
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
      const washer = new Shape(M, M.Manifold.cylinder(1, 5, 5, 16))

      const snapped = washer.snapTo(base, {
        surface: 'top',
        at: [0, 0],
        penetrate: -0.5
      })

      // Washer bottom should be 0.5mm above surface (z = 5 + 0.5 = 5.5)
      const bbox = snapped.getBoundingBox()
      expect(bbox.min[2]).toBeCloseTo(5.5, 1)

      base.delete()
      snapped.delete()
    })

    it('snaps to right surface', () => {
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
      const post = new Shape(M, M.Manifold.cylinder(8, 2, 2, 16))

      const snapped = post.snapTo(base, {
        surface: 'right',
        at: [0, 0]
      })

      // Post should be flush against right face (x=10)
      const bbox = snapped.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(10, 1)

      base.delete()
      snapped.delete()
    })

    it('snaps to left surface', () => {
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
      const post = new Shape(M, M.Manifold.cylinder(8, 2, 2, 16))

      const snapped = post.snapTo(base, {
        surface: 'left',
        at: [0, 0]
      })

      // Post should be flush against left face (x=-10)
      const bbox = snapped.getBoundingBox()
      expect(bbox.max[0]).toBeCloseTo(-10, 1)

      base.delete()
      snapped.delete()
    })

    it('preserves name through snapTo', () => {
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
      const bolt = new Shape(M, M.Manifold.cylinder(10, 3, 3, 16)).name('myBolt')

      const snapped = bolt.snapTo(base, {
        surface: 'top',
        at: [0, 0]
      })

      expect(snapped.getName()).toBe('myBolt')

      base.delete()
      snapped.delete()
    })

    it('preserves attach points through snapTo', () => {
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
      const bolt = new Shape(M, M.Manifold.cylinder(10, 3, 3, 16))
        .definePoint('tip', [0, 0, 5])

      const snapped = bolt.snapTo(base, {
        surface: 'top',
        at: [0, 0]
      })

      const tipPoint = snapped.getPoint('tip')
      expect(tipPoint).toBeDefined()

      base.delete()
      snapped.delete()
    })
  })

  describe('connectTo', () => {
    it('positions shape to overlap target from -x direction', () => {
      const target = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      const pipe = new Shape(M, M.Manifold.cylinder(30, 5, 5, 16))

      const connected = pipe.connectTo(target, {
        overlap: 2,
        direction: '-x'
      })

      // Cylinder should be positioned so its right end overlaps into target by 2mm
      // Target's left face is at x=-10, so pipe's right end should be at x=-10+2=-8
      const bbox = connected.getBoundingBox()
      expect(bbox.max[0]).toBeCloseTo(-8, 1)
      // Pipe length is 30, center is at z=15 for cylinder, so extends from -15 to 15 in Z when rotated
      expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(30, 1) // Length along X after align

      target.delete()
      connected.delete()
    })

    it('positions shape to overlap target from +x direction', () => {
      const target = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      const pipe = new Shape(M, M.Manifold.cylinder(30, 5, 5, 16))

      const connected = pipe.connectTo(target, {
        overlap: 2,
        direction: '+x'
      })

      // Pipe's left end should be at target's right face + overlap
      // Target's right face is at x=10, so pipe's left end should be at x=10-2=8
      const bbox = connected.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(8, 1)

      target.delete()
      connected.delete()
    })

    it('positions shape to overlap target from -z direction', () => {
      const target = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      const pipe = new Shape(M, M.Manifold.cylinder(30, 5, 5, 16))

      const connected = pipe.connectTo(target, {
        overlap: 3,
        direction: '-z'
      })

      // Pipe extends from target's bottom face (-10) with 3mm overlap
      const bbox = connected.getBoundingBox()
      // Cylinder is already aligned along Z, so top should be at -10+3=-7
      expect(bbox.max[2]).toBeCloseTo(-7, 1)

      target.delete()
      connected.delete()
    })

    it('positions at specified location on target', () => {
      const target = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      const pipe = new Shape(M, M.Manifold.cylinder(30, 5, 5, 16))

      const connected = pipe.connectTo(target, {
        overlap: 2,
        direction: '-x',
        at: [0, 5, 5] // Offset from center
      })

      // Pipe should be centered at y=5, z=5
      const bbox = connected.getBoundingBox()
      const centerY = (bbox.min[1] + bbox.max[1]) / 2
      const centerZ = (bbox.min[2] + bbox.max[2]) / 2
      expect(centerY).toBeCloseTo(5, 1)
      expect(centerZ).toBeCloseTo(5, 1)

      target.delete()
      connected.delete()
    })

    it('connectTo without alignAxis keeps original orientation for Z direction', () => {
      const target = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      const pipe = new Shape(M, M.Manifold.cylinder(30, 5, 5, 16)) // Z-oriented

      const connected = pipe.connectTo(target, {
        overlap: 2,
        direction: '-z'
      })

      // Pipe should stay Z-oriented (height along Z)
      const bbox = connected.getBoundingBox()
      const zDim = bbox.max[2] - bbox.min[2]
      expect(zDim).toBeCloseTo(30, 1) // Length is 30

      target.delete()
      connected.delete()
    })

    it('alignAxis rotates shape to align with direction', () => {
      const target = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      // Cylinder starts with height along Z
      const pipe = new Shape(M, M.Manifold.cylinder(30, 5, 5, 16))

      const connected = pipe.connectTo(target, {
        overlap: 2,
        direction: '-x',
        alignAxis: 'length' // Align length (Z) to be along X
      })

      // After alignment, X dimension should be ~30 (the length)
      const bbox = connected.getBoundingBox()
      const xDim = bbox.max[0] - bbox.min[0]
      expect(xDim).toBeCloseTo(30, 1)

      target.delete()
      connected.delete()
    })

    it('preserves attach points through connectTo', () => {
      const target = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      const pipe = new Shape(M, M.Manifold.cylinder(30, 5, 5, 16))
        .definePoint('tip', [0, 0, 15])

      const connected = pipe.connectTo(target, {
        overlap: 2,
        direction: '-z'
      })

      // Tip point should be transformed
      const tipPoint = connected.getPoint('tip')
      expect(tipPoint).toBeDefined()

      target.delete()
      connected.delete()
    })

    it('preserves name through connectTo', () => {
      const target = new Shape(M, M.Manifold.cube([20, 20, 20], true))
      const pipe = new Shape(M, M.Manifold.cylinder(30, 5, 5, 16)).name('myPipe')

      const connected = pipe.connectTo(target, {
        overlap: 2,
        direction: '-x'
      })

      expect(connected.getName()).toBe('myPipe')

      target.delete()
      connected.delete()
    })
  })

  describe('overlap verification', () => {
    it('overlaps() returns true for intersecting shapes', () => {
      const a = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const b = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(5, 0, 0))
      expect(a.clone().overlaps(b.clone())).toBe(true)
      a.delete()
      b.delete()
    })

    it('overlaps() returns false for disjoint shapes', () => {
      const a = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const b = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(20, 0, 0))
      expect(a.clone().overlaps(b.clone())).toBe(false)
      a.delete()
      b.delete()
    })

    it('overlaps() respects minVolume threshold', () => {
      // Two cubes with small overlap
      const a = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const b = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(9.5, 0, 0))
      // Overlap is 0.5 * 10 * 10 = 50 mm³
      expect(a.clone().overlaps(b.clone(), { minVolume: 10 })).toBe(true)
      expect(a.clone().overlaps(b.clone(), { minVolume: 100 })).toBe(false)
      a.delete()
      b.delete()
    })

    it('overlaps() uses default minVolume of 0.001', () => {
      const a = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const b = new Shape(M, M.Manifold.cube([10, 10, 10], true).translate(5, 0, 0))
      // With default threshold, should detect overlap
      expect(a.clone().overlaps(b.clone())).toBe(true)
      a.delete()
      b.delete()
    })

    it('overlaps() does not consume input shapes', () => {
      const a = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const b = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      a.overlaps(b)
      // Both shapes should still be usable
      expect(a.getVolume()).toBeCloseTo(1000, 0)
      expect(b.getVolume()).toBeCloseTo(1000, 0)
      a.delete()
      b.delete()
    })

    it('assertConnected() passes for single connected body', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      expect(() => shape.assertConnected()).not.toThrow()
      shape.delete()
    })

    it('assertConnected() throws for disconnected geometry', () => {
      // Create two disjoint cubes using union
      const cube1 = M.Manifold.cube([5, 5, 5], true)
      const cube2 = M.Manifold.cube([5, 5, 5], true).translate(20, 0, 0)
      const disjoint = M.Manifold.union([cube1, cube2])
      cube1.delete()
      cube2.delete()

      const shape = new Shape(M, disjoint)
      expect(() => shape.assertConnected()).toThrow(/disconnected/i)
      shape.delete()
    })

    it('assertConnected() returns self for chaining when connected', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      const result = shape.assertConnected()
      expect(result).toBe(shape)
      shape.delete()
    })
  })

  describe('named parts', () => {
    it('name() sets shape name', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true)).name('myPart')
      expect(shape.getName()).toBe('myPart')
      shape.delete()
    })

    it('getName() returns undefined for unnamed shapes', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      expect(shape.getName()).toBeUndefined()
      shape.delete()
    })

    it('name is preserved through translate', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .name('myPart')
        .translate(5, 0, 0)
      expect(shape.getName()).toBe('myPart')
      shape.delete()
    })

    it('name is preserved through rotate', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .name('myPart')
        .rotate(45, 0, 0)
      expect(shape.getName()).toBe('myPart')
      shape.delete()
    })

    it('name is preserved through scale', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .name('myPart')
        .scale(2)
      expect(shape.getName()).toBe('myPart')
      shape.delete()
    })

    it('name is preserved through mirror', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .name('myPart')
        .mirror('x')
      expect(shape.getName()).toBe('myPart')
      shape.delete()
    })

    it('name is preserved through inFrame', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .name('myPart')
        .inFrame({ translate: [5, 0, 0] })
      expect(shape.getName()).toBe('myPart')
      shape.delete()
    })

    it('name is preserved through polar', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .name('myPart')
        .polar(45, 10)
      expect(shape.getName()).toBe('myPart')
      shape.delete()
    })

    it('name is preserved through cylindrical', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .name('myPart')
        .cylindrical(45, 10, 5)
      expect(shape.getName()).toBe('myPart')
      shape.delete()
    })

    it('name can be changed', () => {
      const shape = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .name('first')
        .name('second')
      expect(shape.getName()).toBe('second')
      shape.delete()
    })

    it('clone preserves name', () => {
      const original = new Shape(M, M.Manifold.cube([10, 10, 10], true)).name('myPart')
      const cloned = original.clone()
      expect(cloned.getName()).toBe('myPart')
      original.delete()
      cloned.delete()
    })
  })

  describe('polar positioning', () => {
    it('polar() positions in XZ plane by default', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true)).polar(90, 10)
      const bbox = part.getBoundingBox()
      // At 90 degrees in XZ plane: x = 10*sin(90) = 10, z = 10*cos(90) = 0
      expect(bbox.min[0] + bbox.max[0]).toBeCloseTo(20, 0) // Centered at x=10
      expect(bbox.min[2] + bbox.max[2]).toBeCloseTo(0, 0)  // Centered at z=0
      part.delete()
    })

    it('polar() at 0 degrees positions along Z axis', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true)).polar(0, 10)
      const bbox = part.getBoundingBox()
      // At 0 degrees in XZ plane: x = 10*sin(0) = 0, z = 10*cos(0) = 10
      expect(bbox.min[0] + bbox.max[0]).toBeCloseTo(0, 0)  // Centered at x=0
      expect(bbox.min[2] + bbox.max[2]).toBeCloseTo(20, 0) // Centered at z=10
      part.delete()
    })

    it('polar() positions in XY plane when specified', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true)).polar(90, 10, 'xy')
      const bbox = part.getBoundingBox()
      // At 90 degrees in XY plane: x = 10*cos(90) = 0, y = 10*sin(90) = 10
      expect(bbox.min[0] + bbox.max[0]).toBeCloseTo(0, 0)  // Centered at x=0
      expect(bbox.min[1] + bbox.max[1]).toBeCloseTo(20, 0) // Centered at y=10
      part.delete()
    })

    it('polar() positions in YZ plane when specified', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true)).polar(90, 10, 'yz')
      const bbox = part.getBoundingBox()
      // At 90 degrees in YZ plane: y = 10*cos(90) = 0, z = 10*sin(90) = 10
      expect(bbox.min[1] + bbox.max[1]).toBeCloseTo(0, 0)  // Centered at y=0
      expect(bbox.min[2] + bbox.max[2]).toBeCloseTo(20, 0) // Centered at z=10
      part.delete()
    })

    it('polar() preserves attach points', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true))
        .definePoint('center', [0, 0, 0])
        .polar(90, 10)
      // Point should be at x=10, z=0
      const point = part.getPoint('center')!
      expect(point[0]).toBeCloseTo(10, 1)
      expect(point[2]).toBeCloseTo(0, 1)
      part.delete()
    })
  })

  describe('cylindrical positioning', () => {
    it('cylindrical() positions with height along Y by default', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true)).cylindrical(0, 10, 5)
      const bbox = part.getBoundingBox()
      // At 0 degrees, Y-axis cylindrical: x = 10*sin(0) = 0, y = 5, z = 10*cos(0) = 10
      expect(bbox.min[0] + bbox.max[0]).toBeCloseTo(0, 0)  // Centered at x=0
      expect(bbox.min[1] + bbox.max[1]).toBeCloseTo(10, 0) // Centered at y=5 (height)
      expect(bbox.min[2] + bbox.max[2]).toBeCloseTo(20, 0) // Centered at z=10 (radius)
      part.delete()
    })

    it('cylindrical() at 90 degrees positions in XZ plane', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true)).cylindrical(90, 10, 5)
      const bbox = part.getBoundingBox()
      // At 90 degrees, Y-axis cylindrical: x = 10*sin(90) = 10, y = 5, z = 10*cos(90) = 0
      expect(bbox.min[0] + bbox.max[0]).toBeCloseTo(20, 0) // Centered at x=10
      expect(bbox.min[1] + bbox.max[1]).toBeCloseTo(10, 0) // Centered at y=5 (height)
      expect(bbox.min[2] + bbox.max[2]).toBeCloseTo(0, 0)  // Centered at z=0
      part.delete()
    })

    it('cylindrical() with axis z positions in XY plane', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true)).cylindrical(0, 10, 5, { axis: 'z' })
      const bbox = part.getBoundingBox()
      // At 0 degrees, Z-axis cylindrical: x = 10*cos(0) = 10, y = 10*sin(0) = 0, z = 5
      expect(bbox.min[0] + bbox.max[0]).toBeCloseTo(20, 0) // Centered at x=10
      expect(bbox.min[1] + bbox.max[1]).toBeCloseTo(0, 0)  // Centered at y=0
      expect(bbox.min[2] + bbox.max[2]).toBeCloseTo(10, 0) // Centered at z=5 (height)
      part.delete()
    })

    it('cylindrical() with axis x positions in YZ plane', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true)).cylindrical(0, 10, 5, { axis: 'x' })
      const bbox = part.getBoundingBox()
      // At 0 degrees, X-axis cylindrical: x = 5 (height), y = 10*cos(0) = 10, z = 10*sin(0) = 0
      expect(bbox.min[0] + bbox.max[0]).toBeCloseTo(10, 0) // Centered at x=5 (height)
      expect(bbox.min[1] + bbox.max[1]).toBeCloseTo(20, 0) // Centered at y=10
      expect(bbox.min[2] + bbox.max[2]).toBeCloseTo(0, 0)  // Centered at z=0
      part.delete()
    })

    it('cylindrical() chains with other transforms', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true))
        .cylindrical(45, 20, 10)
        .rotate(0, 45, 0)

      expectValid(part.build())
      part.delete()
    })

    it('cylindrical() preserves attach points', () => {
      const part = new Shape(M, M.Manifold.cube([2, 2, 2], true))
        .definePoint('center', [0, 0, 0])
        .cylindrical(90, 10, 5)
      // Point should be at x=10, y=5, z=0
      const point = part.getPoint('center')!
      expect(point[0]).toBeCloseTo(10, 1)
      expect(point[1]).toBeCloseTo(5, 1)
      expect(point[2]).toBeCloseTo(0, 1)
      part.delete()
    })
  })

  describe('attach points', () => {
    it('definePoint() stores named attachment point', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .definePoint('top', [0, 0, 5])
        .definePoint('bottom', [0, 0, -5])

      expect(cube.getPoint('top')).toEqual([0, 0, 5])
      expect(cube.getPoint('bottom')).toEqual([0, 0, -5])
      cube.delete()
    })

    it('getPoint() returns undefined for non-existent point', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
      expect(cube.getPoint('nonexistent')).toBeUndefined()
      cube.delete()
    })

    it('attachment points are preserved through transforms', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .definePoint('corner', [5, 5, 5])
        .translate(10, 0, 0)

      // Point should be transformed along with geometry
      expect(cube.getPoint('corner')).toEqual([15, 5, 5])
      cube.delete()
    })

    it('attachment points are preserved through rotation', () => {
      const cube = new Shape(M, M.Manifold.cube([10, 10, 10], true))
        .definePoint('tip', [5, 0, 0])
        .rotate(0, 0, 90)

      // After 90 degree Z rotation, [5, 0, 0] becomes [0, 5, 0]
      const point = cube.getPoint('tip')!
      expect(point[0]).toBeCloseTo(0, 1)
      expect(point[1]).toBeCloseTo(5, 1)
      expect(point[2]).toBeCloseTo(0, 1)
      cube.delete()
    })

    it('alignTo() positions shape by matching points', () => {
      // Base with a point at top
      const base = new Shape(M, M.Manifold.cube([20, 20, 10], true))
        .definePoint('mountPoint', [0, 0, 5])

      // Part with point at bottom
      const part = new Shape(M, M.Manifold.cube([5, 5, 5], true))
        .definePoint('attachPoint', [0, 0, -2.5])

      // Align part's attachPoint to base's mountPoint
      const alignedPart = part.alignTo(base, 'attachPoint', 'mountPoint')

      // Part should be positioned so its attachPoint is at [0, 0, 5]
      // Since attachPoint is at bottom of 5mm cube, center should be at [0, 0, 7.5]
      expectBoundingBox(alignedPart.build(), {
        minZ: 5, maxZ: 10 // Part spans from z=5 to z=10
      })

      base.delete()
      alignedPart.delete()
    })
  })

  describe('assertConnected with part diagnostics', () => {
    it('assertConnected() passes silently when all parts connected', () => {
      const part1 = p.box(10, 10, 10).name('partA')
      const part2 = p.box(10, 10, 10).translate(5, 0, 0).name('partB')
      const result = ops.union(part1, part2)

      expect(() => result.assertConnected()).not.toThrow()
      result.delete()
    })

    it('assertConnected() lists single disconnected part by name', () => {
      const connected = p.box(10, 10, 10).name('connected')
      const disconnected = p.box(10, 10, 10).translate(50, 0, 0).name('disconnected')
      // Use skipConnectionCheck to create intentionally disconnected geometry for testing assertConnected
      const result = ops.union(connected, disconnected, { skipConnectionCheck: true })

      expect(() => result.assertConnected()).toThrow(/disconnected/i)
      result.delete()
    })

    it('assertConnected() lists multiple disconnected parts', () => {
      const main = p.box(10, 10, 10).name('main')
      const disc1 = p.box(5, 5, 5).translate(50, 0, 0).name('floating1')
      const disc2 = p.box(5, 5, 5).translate(-50, 0, 0).name('floating2')
      // Use skipConnectionCheck to create intentionally disconnected geometry for testing assertConnected
      const result = ops.union(main, disc1, disc2, { skipConnectionCheck: true })

      try {
        result.assertConnected()
        expect.fail('Should have thrown')
      } catch (e) {
        const message = (e as Error).message
        expect(message).toContain('floating1')
        expect(message).toContain('floating2')
        expect(message).not.toContain('main')
      }
      result.delete()
    })

    it('assertConnected() shows placeholder for parts without names', () => {
      const named = p.box(10, 10, 10).name('namedPart')
      const unnamed = p.box(5, 5, 5).translate(50, 0, 0) // no name
      // Use skipConnectionCheck to create intentionally disconnected geometry for testing assertConnected
      const result = ops.union(named, unnamed, { skipConnectionCheck: true })

      expect(() => result.assertConnected()).toThrow(/<part \d+>/)
      result.delete()
    })

    it('assertConnected() error message includes component count and disconnected parts', () => {
      const main = p.box(10, 10, 10).name('main')
      const disc = p.box(5, 5, 5).translate(50, 0, 0).name('floating')
      // Use skipConnectionCheck to create intentionally disconnected geometry for testing assertConnected
      const result = ops.union(main, disc, { skipConnectionCheck: true })

      expect(() => result.assertConnected()).toThrow(/2 disconnected components/)
      result.delete()
    })

    it('assertConnected() error message suggests skipConnectivityCheck for intentional disconnection', () => {
      const main = p.box(10, 10, 10).name('main')
      const disc = p.box(5, 5, 5).translate(50, 0, 0).name('floating')
      // Use skipConnectionCheck to create intentionally disconnected geometry for testing assertConnected
      const result = ops.union(main, disc, { skipConnectionCheck: true })

      expect(() => result.assertConnected()).toThrow(/skipConnectivityCheck/)
      result.delete()
    })
  })

  describe('overlapWith', () => {
    describe('explicit direction', () => {
      it('overlapWith shifts shape to achieve overlap in +x direction', () => {
        const target = p.box(20, 20, 20) // centered at origin
        const part = p.box(10, 10, 10).translate(20, 0, 0) // outside right face

        const result = part.overlapWith(target, 2, '+x')

        // Target right face at x=10, part left face should be at x=10-2=8
        const bbox = result.getBoundingBox()
        expect(bbox.min[0]).toBeCloseTo(8, 1)

        target.delete()
        result.delete()
      })

      it('overlapWith shifts shape to achieve overlap in -x direction', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(-20, 0, 0) // outside left face

        const result = part.overlapWith(target, 2, '-x')

        // Target left face at x=-10, part right face should be at x=-10+2=-8
        const bbox = result.getBoundingBox()
        expect(bbox.max[0]).toBeCloseTo(-8, 1)

        target.delete()
        result.delete()
      })

      it('overlapWith shifts shape to achieve overlap in +y direction', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(0, 20, 0) // outside front face

        const result = part.overlapWith(target, 2, '+y')

        // Target front face at y=10, part back face should be at y=10-2=8
        const bbox = result.getBoundingBox()
        expect(bbox.min[1]).toBeCloseTo(8, 1)

        target.delete()
        result.delete()
      })

      it('overlapWith shifts shape to achieve overlap in -z direction', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(0, 0, -20) // below target

        const result = part.overlapWith(target, 2, '-z')

        // Target bottom face at z=-10, part top face should be at z=-10+2=-8
        const bbox = result.getBoundingBox()
        expect(bbox.max[2]).toBeCloseTo(-8, 1)

        target.delete()
        result.delete()
      })

      it('overlapWith does not consume target', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(20, 0, 0)

        part.overlapWith(target, 2, '+x')

        // Target should still be usable
        expect(target.getVolume()).toBeCloseTo(8000, 0)
        target.delete()
      })

      it('overlapWith returns chainable Shape', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(20, 0, 0)

        const result = part
          .overlapWith(target, 2, '+x')
          .name('overlappedPart')
          .translate(0, 5, 0)

        expect(result.getName()).toBe('overlappedPart')
        target.delete()
        result.delete()
      })

      it('overlapWith preserves existing shape name', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(20, 0, 0).name('myPart')

        const result = part.overlapWith(target, 2, '+x')

        expect(result.getName()).toBe('myPart')
        target.delete()
        result.delete()
      })

      it('overlapWith no shift when already overlapping enough', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(8, 0, 0) // already overlaps by 2mm

        const partClone = part.clone()
        const originalBbox = partClone.getBoundingBox()
        partClone.delete()

        const result = part.overlapWith(target, 2, '+x')

        const bbox = result.getBoundingBox()
        expect(bbox.min[0]).toBeCloseTo(originalBbox.min[0], 1)

        target.delete()
        result.delete()
      })
    })

    describe('auto-direction', () => {
      it('auto-detects +x direction when part is to the right of target', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(20, 0, 0) // clearly to the right

        const result = part.overlapWith(target, 2) // no direction specified

        const bbox = result.getBoundingBox()
        expect(bbox.min[0]).toBeCloseTo(8, 1)

        target.delete()
        result.delete()
      })

      it('auto-detects -z direction when part is below target', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(0, 0, -20) // clearly below

        const result = part.overlapWith(target, 2)

        const bbox = result.getBoundingBox()
        expect(bbox.max[2]).toBeCloseTo(-8, 1)

        target.delete()
        result.delete()
      })

      it('auto-detects -y direction when part is behind target', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(0, -20, 0) // clearly behind

        const result = part.overlapWith(target, 2)

        const bbox = result.getBoundingBox()
        expect(bbox.max[1]).toBeCloseTo(-8, 1)

        target.delete()
        result.delete()
      })

      it('throws on ambiguous position (equidistant faces)', () => {
        const target = p.box(20, 20, 20)
        // Part positioned at corner - equidistant from right and front faces
        const part = p.box(10, 10, 10).translate(15, 15, 0)

        expect(() => part.overlapWith(target, 2)).toThrow(/ambiguous/i)

        target.delete()
        part.delete()
      })

      it('ambiguous error suggests explicit directions', () => {
        const target = p.box(20, 20, 20)
        const part = p.box(10, 10, 10).translate(15, 15, 0)

        try {
          part.overlapWith(target, 2)
          expect.fail('Should have thrown')
        } catch (e) {
          const message = (e as Error).message
          expect(message).toMatch(/\+x|\-x|\+y|\-y|\+z|\-z/)
        }

        target.delete()
        part.delete()
      })

      it('explicit direction overrides auto-detection', () => {
        const target = p.box(20, 20, 20)
        // Part clearly to the right, but we force -y
        const part = p.box(10, 10, 10).translate(20, -20, 0)

        const result = part.overlapWith(target, 2, '-y')

        const bbox = result.getBoundingBox()
        expect(bbox.max[1]).toBeCloseTo(-8, 1)

        target.delete()
        result.delete()
      })
    })
  })

  describe('build() connectivity validation', () => {
    it('build() succeeds for overlapping geometry', () => {
      const part1 = p.box(10, 10, 10)
      const part2 = p.box(10, 10, 10).translate(5, 0, 0) // overlapping

      const result = part1.add(part2)
      expect(() => result.build()).not.toThrow()
      result.delete()
    })

    it('build() succeeds for touching geometry (parts share a surface)', () => {
      // Two boxes that touch at a face but don't overlap
      const part1 = p.box(10, 10, 10).name('left')
      const part2 = p.box(10, 10, 10).translate(10, 0, 0).name('right') // adjacent, sharing YZ face

      const result = ops.union(part1, part2)
      expect(() => result.build()).not.toThrow()
      result.delete()
    })

    it('build() throws for disconnected geometry by default', () => {
      const part1 = p.box(10, 10, 10).name('a')
      const part2 = p.box(10, 10, 10).translate(50, 0, 0).name('b') // far apart, not touching
      // Use skipConnectionCheck at union time to test build() validation
      const result = ops.union(part1, part2, { skipConnectionCheck: true })

      expect(() => result.build()).toThrow(/disconnected/i)
      result.delete()
    })

    it('build() allows disconnected geometry with skipConnectivityCheck option', () => {
      const part1 = p.box(10, 10, 10)
      const part2 = p.box(10, 10, 10).translate(50, 0, 0) // not touching
      // Use skipConnectionCheck at add time to test build() with skip option
      const result = part1.add(part2, { skipConnectionCheck: true })

      expect(() => result.build({ skipConnectivityCheck: true })).not.toThrow()
      result.delete()
    })

    it('build() returns the manifold when connected', () => {
      const shape = p.box(10, 10, 10)
      const manifold = shape.build()

      expect(manifold).toBeDefined()
      expect(manifold.volume()).toBeGreaterThan(0)
      shape.delete()
    })

    it('build() returns the manifold when skip option used', () => {
      const part1 = p.box(10, 10, 10)
      const part2 = p.box(10, 10, 10).translate(50, 0, 0)
      // Use skipConnectionCheck at add time to test build() with skip option
      const result = part1.add(part2, { skipConnectionCheck: true })
      const manifold = result.build({ skipConnectivityCheck: true })

      expect(manifold).toBeDefined()
      expect(manifold.volume()).toBeGreaterThan(0)
      result.delete()
    })

    it('build() error includes component count', () => {
      const part1 = p.box(10, 10, 10)
      const part2 = p.box(10, 10, 10).translate(50, 0, 0)
      // Use skipConnectionCheck at add time to test build() error message
      const result = part1.add(part2, { skipConnectionCheck: true })

      expect(() => result.build()).toThrow(/2 disconnected components/)
      result.delete()
    })
  })

  describe('consumption safety', () => {
    it('throws when accessing consumed shape after add()', () => {
      const a = p.box(10, 10, 10)
      const b = p.box(10, 10, 10)
      a.add(b) // consumes both a and b

      expect(() => a.translate(1, 0, 0)).toThrow(/consumed.*add/i)
    })

    it('throws when accessing consumed shape after subtract()', () => {
      const a = p.box(10, 10, 10)
      const b = p.box(5, 5, 5)
      a.subtract(b)

      expect(() => b.translate(1, 0, 0)).toThrow(/consumed.*subtract/i)
    })

    it('throws when accessing consumed shape after translate()', () => {
      const a = p.box(10, 10, 10)
      a.translate(1, 0, 0)

      expect(() => a.translate(2, 0, 0)).toThrow(/consumed.*translate/i)
    })

    it('error message includes shape name when named', () => {
      const named = p.box(10, 10, 10).name('myBlock')
      named.translate(1, 0, 0)

      expect(() => named.getVolume()).toThrow(/myBlock.*consumed/i)
    })

    it('error message includes consumedBy operation', () => {
      const a = p.box(10, 10, 10)
      const b = p.box(10, 10, 10)
      a.add(b)

      try {
        a.getBoundingBox()
        expect.fail('Should have thrown')
      } catch (e) {
        expect((e as Error).message).toContain('add()')
      }
    })

    it('clone() creates non-consumed copy', () => {
      const a = p.box(10, 10, 10)
      const cloned = a.clone()
      a.translate(1, 0, 0) // consumes a

      // Clone should still be usable
      expect(cloned.getVolume()).toBeCloseTo(1000, 0)
      cloned.delete()
    })

    it('clone() does not consume original', () => {
      const a = p.box(10, 10, 10)
      a.clone()

      // Original should still be usable
      expect(a.getVolume()).toBeCloseTo(1000, 0)
      a.delete()
    })

    it('error message suggests clone() for reuse', () => {
      const a = p.box(10, 10, 10)
      a.translate(1, 0, 0)

      expect(() => a.getVolume()).toThrow(/clone\(\)/i)
    })

    it('isConsumed() returns false for fresh shape', () => {
      const a = p.box(10, 10, 10)
      expect(a.isConsumed()).toBe(false)
      a.delete()
    })

    it('isConsumed() returns true after operation', () => {
      const a = p.box(10, 10, 10)
      a.translate(1, 0, 0)
      expect(a.isConsumed()).toBe(true)
    })

    it('all transforms check consumed state', () => {
      const shape = p.box(10, 10, 10)
      shape.translate(1, 0, 0) // consume

      expect(() => shape.rotate(45)).toThrow(/consumed/i)
      expect(() => shape.scale(2)).toThrow(/consumed/i)
      expect(() => shape.mirror('x')).toThrow(/consumed/i)
      expect(() => shape.inFrame({ translate: [1, 0, 0] })).toThrow(/consumed/i)
      expect(() => shape.polar(45, 10)).toThrow(/consumed/i)
      expect(() => shape.cylindrical(45, 10, 5)).toThrow(/consumed/i)
    })

    it('CSG operations check consumed state', () => {
      const a = p.box(10, 10, 10)
      const b = p.box(10, 10, 10)
      a.translate(1, 0, 0) // consume a

      expect(() => a.add(b)).toThrow(/consumed/i)
      b.delete()
    })

    it('utility methods check consumed state', () => {
      const shape = p.box(10, 10, 10)
      shape.translate(1, 0, 0)

      expect(() => shape.getVolume()).toThrow(/consumed/i)
      expect(() => shape.getSurfaceArea()).toThrow(/consumed/i)
      expect(() => shape.getBoundingBox()).toThrow(/consumed/i)
      expect(() => shape.isValid()).toThrow(/consumed/i)
      expect(() => shape.build()).toThrow(/consumed/i)
    })

    it('pattern operations check consumed state', () => {
      const shape = p.box(10, 10, 10)
      shape.translate(1, 0, 0)

      expect(() => shape.linearPattern(3, 20)).toThrow(/consumed/i)
      expect(() => shape.circularPattern(4)).toThrow(/consumed/i)
    })
  })

  describe('align helper', () => {
    it('align("center", "center", "bottom") centers XY and places bottom at Z=0', () => {
      // Create a box that starts at a random position
      const box = p.box(10, 20, 30, false).translate(5, 5, 5) // not centered
      const aligned = box.align('center', 'center', 'bottom')

      const bbox = aligned.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(-5, 1)  // centered in X
      expect(bbox.max[0]).toBeCloseTo(5, 1)
      expect(bbox.min[1]).toBeCloseTo(-10, 1) // centered in Y
      expect(bbox.max[1]).toBeCloseTo(10, 1)
      expect(bbox.min[2]).toBeCloseTo(0, 1)   // bottom at Z=0
      expect(bbox.max[2]).toBeCloseTo(30, 1)

      aligned.delete()
    })

    it('align("left", "front", "bottom") places at origin corner', () => {
      const box = p.box(10, 20, 30) // centered
      const aligned = box.align('left', 'front', 'bottom')

      const bbox = aligned.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(0, 1)   // left at X=0
      expect(bbox.min[1]).toBeCloseTo(0, 1)   // front at Y=0
      expect(bbox.min[2]).toBeCloseTo(0, 1)   // bottom at Z=0

      aligned.delete()
    })

    it('align("right", "back", "top") places at opposite corner', () => {
      const box = p.box(10, 20, 30) // centered
      const aligned = box.align('right', 'back', 'top')

      const bbox = aligned.getBoundingBox()
      expect(bbox.max[0]).toBeCloseTo(0, 1)   // right at X=0
      expect(bbox.max[1]).toBeCloseTo(0, 1)   // back at Y=0
      expect(bbox.max[2]).toBeCloseTo(0, 1)   // top at Z=0

      aligned.delete()
    })

    it('align("none", "none", "none") returns unchanged shape', () => {
      const box = p.box(10, 20, 30) // centered at origin
      const originalBbox = box.clone().getBoundingBox()
      const aligned = box.align('none', 'none', 'none')

      const bbox = aligned.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(originalBbox.min[0], 1)
      expect(bbox.max[0]).toBeCloseTo(originalBbox.max[0], 1)
      expect(bbox.min[1]).toBeCloseTo(originalBbox.min[1], 1)
      expect(bbox.max[1]).toBeCloseTo(originalBbox.max[1], 1)
      expect(bbox.min[2]).toBeCloseTo(originalBbox.min[2], 1)
      expect(bbox.max[2]).toBeCloseTo(originalBbox.max[2], 1)

      aligned.delete()
    })

    it('align preserves name', () => {
      const box = p.box(10, 10, 10).name('myBox')
      const aligned = box.align('center', 'center', 'bottom')

      expect(aligned.getName()).toBe('myBox')
      aligned.delete()
    })

    it('alignTo aligns face-to-face with target', () => {
      const target = p.box(20, 20, 10) // centered at origin, Z from -5 to 5
      const part = p.box(10, 10, 5)    // centered at origin, Z from -2.5 to 2.5

      // Align part's bottom face to target's bottom face (same Z level)
      const aligned = part.alignTo(target, 'center', 'center', 'bottom')

      const bbox = aligned.getBoundingBox()
      expect(bbox.min[2]).toBeCloseTo(-5, 1) // part bottom at target bottom

      target.delete()
      aligned.delete()
    })

    it('alignTo with none keeps that axis unchanged', () => {
      const target = p.box(20, 20, 10).translate(50, 50, 0)
      const part = p.box(10, 10, 5)

      const aligned = part.alignTo(target, 'none', 'none', 'bottom')

      const bbox = aligned.getBoundingBox()
      // X and Y unchanged (centered at origin)
      expect(bbox.min[0]).toBeCloseTo(-5, 1)
      expect(bbox.min[1]).toBeCloseTo(-5, 1)
      // Z aligned to target's bottom
      expect(bbox.min[2]).toBeCloseTo(-5, 1)

      target.delete()
      aligned.delete()
    })

    it('alignTo does not consume target', () => {
      const target = p.box(20, 20, 10)
      const part = p.box(10, 10, 5)

      part.alignTo(target, 'center', 'center', 'bottom')

      expect(target.getVolume()).toBeCloseTo(4000, 0)
      target.delete()
    })
  })

  describe('hull operation', () => {
    it('hull() creates convex hull of two shapes', () => {
      // Two small spheres separated by distance
      const sphere1 = p.sphere(5).translate(0, 0, 0)
      const sphere2 = p.sphere(5).translate(20, 0, 0)

      const hulled = ops.hull(sphere1, sphere2)

      expectValid(hulled.build())
      // Hull should span from -5 to 25 in X (sphere centers + radii)
      const bbox = hulled.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(-5, 1)
      expect(bbox.max[0]).toBeCloseTo(25, 1)

      hulled.delete()
    })

    it('hull() of overlapping shapes creates single body', () => {
      const box1 = p.box(10, 10, 10)
      const box2 = p.box(10, 10, 10).translate(5, 0, 0)

      const hulled = ops.hull(box1, box2)

      expectValid(hulled.build())
      hulled.delete()
    })

    it('hull() consumes input shapes', () => {
      const a = p.box(10, 10, 10)
      const b = p.box(10, 10, 10).translate(20, 0, 0)

      ops.hull(a, b)

      expect(a.isConsumed()).toBe(true)
      expect(b.isConsumed()).toBe(true)
    })

    it('hull() with single shape returns convex hull of that shape', () => {
      // L-shape has concave corner
      const lShape = p.box(10, 10, 5).add(p.box(10, 10, 5).translate(0, 10, 0))

      const hulled = ops.hull(lShape)

      expectValid(hulled.build())
      // Hull should fill in the concave corner
      hulled.delete()
    })

    it('hull() creates smooth transition for mount', () => {
      const base = p.cylinder(5, 10)
      const top = p.cylinder(5, 10).translate(20, 0, 10)

      const mount = ops.hull(base, top)

      expectValid(mount.build())
      mount.delete()
    })
  })

  describe('chamfer operations', () => {
    it('chamferTop() creates cylinder with angled top edge', () => {
      const cyl = p.cylinder(20, 10)
      const chamfered = cyl.chamferTop(2)

      expectValid(chamfered.build())
      // Volume should be less than original cylinder
      expect(chamfered.getVolume()).toBeLessThan(Math.PI * 100 * 20)
      chamfered.delete()
    })

    it('chamferBottom() creates cylinder with angled bottom edge', () => {
      const cyl = p.cylinder(20, 10)
      const chamfered = cyl.chamferBottom(2)

      expectValid(chamfered.build())
      expect(chamfered.getVolume()).toBeLessThan(Math.PI * 100 * 20)
      chamfered.delete()
    })

    it('chamferBoth() creates cylinder with both edges angled', () => {
      const cyl = p.cylinder(20, 10)
      const chamfered = cyl.chamferBoth(2)

      expectValid(chamfered.build())
      // Should lose more volume than single chamfer
      expect(chamfered.getVolume()).toBeLessThan(Math.PI * 100 * 20)
      chamfered.delete()
    })

    it('chamfer(0) returns unchanged shape', () => {
      const cyl = p.cylinder(20, 10)
      const originalVolume = cyl.clone().getVolume()
      const chamfered = cyl.chamferTop(0)

      expect(chamfered.getVolume()).toBeCloseTo(originalVolume, 0)
      chamfered.delete()
    })

    it('chamfer consumes original shape', () => {
      const cyl = p.cylinder(20, 10)
      cyl.chamferTop(2)

      expect(cyl.isConsumed()).toBe(true)
    })

    it('chamferTopEdges() chamfers box top edges', () => {
      const box = p.box(20, 20, 10)
      const chamfered = box.chamferTopEdges(2)

      expectValid(chamfered.build())
      // Volume should be less than original box
      expect(chamfered.getVolume()).toBeLessThan(20 * 20 * 10)
      chamfered.delete()
    })

    it('chamferTopEdges(0) returns unchanged shape', () => {
      const box = p.box(20, 20, 10)
      const originalVolume = box.clone().getVolume()
      const chamfered = box.chamferTopEdges(0)

      expect(chamfered.getVolume()).toBeCloseTo(originalVolume, 0)
      chamfered.delete()
    })
  })

  describe('fillet operations', () => {
    it('filletTop() creates cylinder with rounded top edge', () => {
      const cyl = p.cylinder(20, 10)
      const filleted = cyl.filletTop(2)

      expectValid(filleted.build())
      // Volume should be less than original (fillet removes material)
      expect(filleted.getVolume()).toBeLessThan(Math.PI * 100 * 20)
      filleted.delete()
    })

    it('filletBottom() creates cylinder with rounded bottom edge', () => {
      const cyl = p.cylinder(20, 10)
      const filleted = cyl.filletBottom(2)

      expectValid(filleted.build())
      expect(filleted.getVolume()).toBeLessThan(Math.PI * 100 * 20)
      filleted.delete()
    })

    it('filletBoth() creates cylinder with both edges rounded', () => {
      const cyl = p.cylinder(20, 10)
      const filleted = cyl.filletBoth(2)

      expectValid(filleted.build())
      filleted.delete()
    })

    it('fillet(0) returns unchanged shape', () => {
      const cyl = p.cylinder(20, 10)
      const originalVolume = cyl.clone().getVolume()
      const filleted = cyl.filletTop(0)

      expect(filleted.getVolume()).toBeCloseTo(originalVolume, 0)
      filleted.delete()
    })

    it('fillet consumes original shape', () => {
      const cyl = p.cylinder(20, 10)
      cyl.filletTop(2)

      expect(cyl.isConsumed()).toBe(true)
    })

    it('fillet with custom segments', () => {
      const cyl = p.cylinder(20, 10)
      const filleted = cyl.filletTop(2, 16)

      expectValid(filleted.build())
      filleted.delete()
    })
  })

  describe('inspect and debug', () => {
    it('inspect() returns this for chaining', () => {
      const shape = p.box(10, 10, 10)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = shape.inspect('testBox')

      expect(result).toBe(shape)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
      shape.delete()
    })

    it('inspect() logs volume and bounding box', () => {
      const shape = p.box(10, 10, 10)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      shape.inspect('myBox')

      const logCall = consoleSpy.mock.calls[0]?.[0] as string
      expect(logCall).toContain('[myBox]')
      expect(logCall).toContain('Volume:')
      expect(logCall).toContain('BBox:')
      expect(logCall).toContain('Valid:')

      consoleSpy.mockRestore()
      shape.delete()
    })

    it('inspect() without label uses [Shape]', () => {
      const shape = p.box(10, 10, 10)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      shape.inspect()

      const logCall = consoleSpy.mock.calls[0]?.[0] as string
      expect(logCall).toContain('[Shape]')

      consoleSpy.mockRestore()
      shape.delete()
    })

    it('debug() returns this for chaining', () => {
      const shape = p.box(10, 10, 10)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = shape.debug('test-debug')

      expect(result).toBe(shape)

      consoleSpy.mockRestore()
      shape.delete()
    })

    it('inspect() checks consumed state', () => {
      const shape = p.box(10, 10, 10)
      shape.translate(1, 0, 0)

      expect(() => shape.inspect()).toThrow(/consumed/i)
    })

    it('debug() checks consumed state', () => {
      const shape = p.box(10, 10, 10)
      shape.translate(1, 0, 0)

      expect(() => shape.debug('test')).toThrow(/consumed/i)
    })
  })

  describe('color', () => {
    it('color() sets RGB color from tuple', () => {
      const shape = p.box(10, 10, 10)
      const colored = shape.color([1, 0, 0])

      expect(colored.getColor()).toEqual([1, 0, 0])
      colored.delete()
    })

    it('color() sets RGBA color from tuple', () => {
      const shape = p.box(10, 10, 10)
      const colored = shape.color([1, 0, 0, 0.5])

      expect(colored.getColor()).toEqual([1, 0, 0, 0.5])
      colored.delete()
    })

    it('color() parses hex string', () => {
      const shape = p.box(10, 10, 10)
      const colored = shape.color('#ff0000')

      const c = colored.getColor()!
      expect(c[0]).toBeCloseTo(1, 2)
      expect(c[1]).toBeCloseTo(0, 2)
      expect(c[2]).toBeCloseTo(0, 2)
      colored.delete()
    })

    it('color() parses hex string with alpha', () => {
      const shape = p.box(10, 10, 10)
      const colored = shape.color('#ff000080')

      const c = colored.getColor()!
      expect(c.length).toBe(4)
      expect(c[0]).toBeCloseTo(1, 2)
      expect(c[3]).toBeCloseTo(0.5, 1)
      colored.delete()
    })

    it('color() throws on invalid hex', () => {
      const shape = p.box(10, 10, 10)
      expect(() => shape.color('#fff')).toThrow(/Invalid hex/)
      shape.delete()
    })

    it('color() consumes original shape', () => {
      const shape = p.box(10, 10, 10)
      shape.color([1, 0, 0])

      expect(shape.isConsumed()).toBe(true)
    })

    it('getColor() returns undefined for uncolored shape', () => {
      const shape = p.box(10, 10, 10)
      expect(shape.getColor()).toBeUndefined()
      shape.delete()
    })

    it('color preserves geometry', () => {
      const original = p.box(10, 10, 10)
      const originalVolume = original.clone().getVolume()
      const colored = original.color([1, 0, 0])

      expect(colored.getVolume()).toBeCloseTo(originalVolume, 0)
      colored.delete()
    })
  })

  describe('relative positioning', () => {
    describe('above()', () => {
      it('positions shape directly above target (touching)', () => {
        const base = p.box(20, 20, 10) // 10 tall, centered at z=0 means top at z=5
        const lid = p.box(20, 20, 3).above(base) // 3 tall lid

        const bbox = lid.getBoundingBox()
        // Lid bottom should be at base top (z=5)
        expect(bbox.min[2]).toBeCloseTo(5, 1)
        // Lid top should be at z=5+3=8
        expect(bbox.max[2]).toBeCloseTo(8, 1)

        base.delete()
        lid.delete()
      })

      it('centers horizontally on target by default', () => {
        const base = p.box(30, 30, 10)
        const lid = p.box(10, 10, 5).above(base)

        const lidBbox = lid.getBoundingBox()
        // Should be centered at X=0, Y=0
        expect((lidBbox.min[0] + lidBbox.max[0]) / 2).toBeCloseTo(0, 1)
        expect((lidBbox.min[1] + lidBbox.max[1]) / 2).toBeCloseTo(0, 1)

        base.delete()
        lid.delete()
      })

      it('does not consume target', () => {
        const base = p.box(20, 20, 10)
        p.box(10, 10, 5).above(base)

        expect(base.isConsumed()).toBe(false)
        base.delete()
      })
    })

    describe('below()', () => {
      it('positions shape directly below target (touching)', () => {
        const top = p.box(20, 20, 10) // centered at z=0 means bottom at z=-5
        const bottom = p.box(20, 20, 3).below(top) // 3 tall

        const bbox = bottom.getBoundingBox()
        // Bottom top should be at top bottom (z=-5)
        expect(bbox.max[2]).toBeCloseTo(-5, 1)
        // Bottom bottom should be at z=-5-3=-8
        expect(bbox.min[2]).toBeCloseTo(-8, 1)

        top.delete()
        bottom.delete()
      })
    })

    describe('leftOf()', () => {
      it('positions shape to the left of target (touching)', () => {
        const right = p.box(20, 20, 10) // centered at x=0 means left at x=-10
        const left = p.box(5, 20, 10).leftOf(right)

        const bbox = left.getBoundingBox()
        // Left right edge should be at right left edge (x=-10)
        expect(bbox.max[0]).toBeCloseTo(-10, 1)

        right.delete()
        left.delete()
      })
    })

    describe('rightOf()', () => {
      it('positions shape to the right of target (touching)', () => {
        const left = p.box(20, 20, 10) // centered at x=0 means right at x=10
        const right = p.box(5, 20, 10).rightOf(left)

        const bbox = right.getBoundingBox()
        // Right left edge should be at left right edge (x=10)
        expect(bbox.min[0]).toBeCloseTo(10, 1)

        left.delete()
        right.delete()
      })
    })

    describe('inFrontOf()', () => {
      it('positions shape in front of target (touching, -Y)', () => {
        const back = p.box(20, 20, 10) // centered at y=0 means front at y=-10
        const front = p.box(20, 5, 10).inFrontOf(back)

        const bbox = front.getBoundingBox()
        // Front back edge should be at back front edge (y=-10)
        expect(bbox.max[1]).toBeCloseTo(-10, 1)

        back.delete()
        front.delete()
      })
    })

    describe('behind()', () => {
      it('positions shape behind target (touching, +Y)', () => {
        const front = p.box(20, 20, 10) // centered at y=0 means back at y=10
        const back = p.box(20, 5, 10).behind(front)

        const bbox = back.getBoundingBox()
        // Back front edge should be at front back edge (y=10)
        expect(bbox.min[1]).toBeCloseTo(10, 1)

        front.delete()
        back.delete()
      })
    })

    describe('offset()', () => {
      it('offsets shape position (alias for translate)', () => {
        const shape = p.box(10, 10, 10)
        const moved = shape.offset(5, 10, 15)

        const bbox = moved.getBoundingBox()
        // Original was centered at origin, so center should now be at (5, 10, 15)
        expect((bbox.min[0] + bbox.max[0]) / 2).toBeCloseTo(5, 1)
        expect((bbox.min[1] + bbox.max[1]) / 2).toBeCloseTo(10, 1)
        expect((bbox.min[2] + bbox.max[2]) / 2).toBeCloseTo(15, 1)

        moved.delete()
      })
    })

    describe('combined positioning', () => {
      it('positions lid on box with gap', () => {
        const boxBase = p.box(100, 100, 50) // top at z=25
        const lid = p.box(100, 100, 3).above(boxBase).offset(0, 0, 1) // 1mm gap

        const lidBbox = lid.getBoundingBox()
        // Lid bottom should be 1mm above base top (z=25+1=26)
        expect(lidBbox.min[2]).toBeCloseTo(26, 1)

        boxBase.delete()
        lid.delete()
      })

      it('positions hinge parts using above then offset', () => {
        const base = p.box(100, 80, 5).align('center', 'center', 'bottom') // bottom at z=0, top at z=5
        // Position hinge on top of base, then offset Y to back edge
        // Cylinder rotated 90° around X has Y extent of ±1.5 (height/2)
        const hinge = p.cylinder(3, 5).rotate(90, 0, 0).above(base).offset(0, 40, 0)

        const hingeBbox = hinge.getBoundingBox()
        // After offset(0, 40, 0), the Y center is at 40, so min Y is 40 - 1.5 = 38.5
        expect(hingeBbox.min[1]).toBeCloseTo(38.5, 1)
        // Z should be on top of base (z=5)
        expect(hingeBbox.min[2]).toBeCloseTo(5, 1)

        base.delete()
        hinge.delete()
      })
    })
  })
})
