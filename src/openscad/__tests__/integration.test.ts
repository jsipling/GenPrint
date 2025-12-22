/**
 * OpenSCAD Transpiler Integration Tests
 *
 * End-to-end tests that verify OpenSCAD -> Manifold JavaScript -> actual Manifold execution.
 * These tests use real Manifold-3D WASM and verify geometry is correctly generated.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { transpileOpenSCAD } from '../Transpiler'
import { OpenSCADParseError, OpenSCADTranspileError } from '../errors'
import { MIN_WALL_THICKNESS, MIN_FEATURE_SIZE } from '../../generators/manifold/printingConstants'
import { createCQ } from '../../cadquery'

/**
 * Execute transpiled OpenSCAD code in a sandboxed context matching the worker.
 * This mirrors the executeUserBuilder function in manifold.worker.ts.
 */
function executeTranspiled(
  M: ManifoldToplevel,
  jsCode: string,
  params: Record<string, number | string | boolean> = {}
): Manifold {
  const cq = createCQ(M)

  try {
    // Create sandboxed function with same context as worker
    const fn = new Function(
      'M',
      'cq',
      'MIN_WALL_THICKNESS',
      'MIN_FEATURE_SIZE',
      'params',
      jsCode
    )

    const result = fn(M, cq, MIN_WALL_THICKNESS, MIN_FEATURE_SIZE, params)

    // Handle Workplane return values
    if (result && typeof result.val === 'function') {
      return result.val()
    }

    // Result should be a Manifold
    if (result && typeof result.getMesh === 'function') {
      return result
    }

    throw new Error('Builder must return a Manifold or Workplane')
  } finally {
    cq.dispose()
  }
}

describe('OpenSCAD Transpiler Integration', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  // ============================================================================
  // Cube Primitive Integration Tests
  // ============================================================================

  describe('cube primitive', () => {
    it('creates valid Manifold with correct bounding box for non-centered cube', () => {
      const openscad = 'cube([10, 20, 30]);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Non-centered cube should have min at origin
      expect(bbox.min[0]).toBeCloseTo(0, 5)
      expect(bbox.min[1]).toBeCloseTo(0, 5)
      expect(bbox.min[2]).toBeCloseTo(0, 5)
      expect(bbox.max[0]).toBeCloseTo(10, 5)
      expect(bbox.max[1]).toBeCloseTo(20, 5)
      expect(bbox.max[2]).toBeCloseTo(30, 5)

      manifold.delete()
    })

    it('creates valid Manifold with correct bounding box for centered cube', () => {
      const openscad = 'cube([10, 10, 10], center=true);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Centered cube should have symmetric bounds
      expect(bbox.min[0]).toBeCloseTo(-5, 5)
      expect(bbox.min[1]).toBeCloseTo(-5, 5)
      expect(bbox.min[2]).toBeCloseTo(-5, 5)
      expect(bbox.max[0]).toBeCloseTo(5, 5)
      expect(bbox.max[1]).toBeCloseTo(5, 5)
      expect(bbox.max[2]).toBeCloseTo(5, 5)

      manifold.delete()
    })

    it('creates valid mesh from cube', () => {
      const openscad = 'cube([10, 10, 10]);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      // A cube should have vertices and triangles
      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      manifold.delete()
    })
  })

  // ============================================================================
  // Sphere Primitive Integration Tests
  // ============================================================================

  describe('sphere primitive', () => {
    it('creates valid Manifold with correct bounding box', () => {
      const openscad = 'sphere(r=10);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Sphere is always centered, radius 10 means bounds from -10 to 10
      expect(bbox.min[0]).toBeCloseTo(-10, 5)
      expect(bbox.min[1]).toBeCloseTo(-10, 5)
      expect(bbox.min[2]).toBeCloseTo(-10, 5)
      expect(bbox.max[0]).toBeCloseTo(10, 5)
      expect(bbox.max[1]).toBeCloseTo(10, 5)
      expect(bbox.max[2]).toBeCloseTo(10, 5)

      manifold.delete()
    })
  })

  // ============================================================================
  // Cylinder Primitive Integration Tests
  // ============================================================================

  describe('cylinder primitive', () => {
    it('creates valid Manifold with correct bounding box for non-centered cylinder', () => {
      const openscad = 'cylinder(h=20, r=5);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Non-centered cylinder with r=5, h=20
      expect(bbox.min[0]).toBeCloseTo(-5, 5)
      expect(bbox.min[1]).toBeCloseTo(-5, 5)
      expect(bbox.min[2]).toBeCloseTo(0, 5)
      expect(bbox.max[0]).toBeCloseTo(5, 5)
      expect(bbox.max[1]).toBeCloseTo(5, 5)
      expect(bbox.max[2]).toBeCloseTo(20, 5)

      manifold.delete()
    })

    it('creates valid Manifold for cone (different top/bottom radii)', () => {
      const openscad = 'cylinder(h=20, r1=10, r2=5, center=true);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Centered cone with r1=10, r2=5, h=20
      // X/Y bounds should be based on larger radius (r1=10)
      expect(bbox.min[0]).toBeCloseTo(-10, 5)
      expect(bbox.min[1]).toBeCloseTo(-10, 5)
      expect(bbox.min[2]).toBeCloseTo(-10, 5)
      expect(bbox.max[0]).toBeCloseTo(10, 5)
      expect(bbox.max[1]).toBeCloseTo(10, 5)
      expect(bbox.max[2]).toBeCloseTo(10, 5)

      manifold.delete()
    })
  })

  // ============================================================================
  // Boolean Operations Integration Tests
  // ============================================================================

  describe('difference operation', () => {
    it('creates valid Manifold with hole', () => {
      const openscad = `
        difference() {
          cube([20, 20, 20], center=true);
          cylinder(h=30, r=5, center=true);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      // Should have valid mesh
      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      // Bounding box should still be the outer cube
      const bbox = manifold.boundingBox()
      expect(bbox.min[0]).toBeCloseTo(-10, 5)
      expect(bbox.max[0]).toBeCloseTo(10, 5)

      manifold.delete()
    })

    it('creates valid Manifold with multiple subtractions', () => {
      const openscad = `
        difference() {
          cube([30, 30, 10], center=true);
          translate([10, 0, 0]) cylinder(h=20, r=3, center=true);
          translate([-10, 0, 0]) cylinder(h=20, r=3, center=true);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      // Should have valid mesh with holes
      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      manifold.delete()
    })
  })

  describe('union operation', () => {
    it('creates valid Manifold from combined shapes', () => {
      const openscad = `
        union() {
          cube([10, 10, 10]);
          translate([15, 0, 0]) sphere(r=5);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Combined bounding box should span both objects
      expect(bbox.min[0]).toBeCloseTo(0, 5)  // cube starts at 0
      expect(bbox.max[0]).toBeCloseTo(20, 5) // sphere at 15 + radius 5 = 20

      manifold.delete()
    })
  })

  describe('intersection operation', () => {
    it('creates valid Manifold from intersected shapes', () => {
      const openscad = `
        intersection() {
          cube([10, 10, 10], center=true);
          sphere(r=7);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      // Should have valid mesh
      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      manifold.delete()
    })
  })

  // ============================================================================
  // Linear Extrude Integration Tests
  // ============================================================================

  describe('linear_extrude operation', () => {
    it('creates valid 3D from 2D square', () => {
      const openscad = 'linear_extrude(height=10) { square([20, 20], center=true); }'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Square extruded 10mm
      expect(bbox.min[0]).toBeCloseTo(-10, 5)
      expect(bbox.min[1]).toBeCloseTo(-10, 5)
      expect(bbox.min[2]).toBeCloseTo(0, 5)
      expect(bbox.max[0]).toBeCloseTo(10, 5)
      expect(bbox.max[1]).toBeCloseTo(10, 5)
      expect(bbox.max[2]).toBeCloseTo(10, 5)

      manifold.delete()
    })

    it('creates valid 3D from 2D circle', () => {
      const openscad = 'linear_extrude(height=15) { circle(r=5); }'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Circle with r=5 extruded 15mm
      expect(bbox.min[0]).toBeCloseTo(-5, 4)
      expect(bbox.min[1]).toBeCloseTo(-5, 4)
      expect(bbox.min[2]).toBeCloseTo(0, 5)
      expect(bbox.max[0]).toBeCloseTo(5, 4)
      expect(bbox.max[1]).toBeCloseTo(5, 4)
      expect(bbox.max[2]).toBeCloseTo(15, 5)

      manifold.delete()
    })

    it('creates valid 3D with twist', () => {
      const openscad = 'linear_extrude(height=20, twist=90) { square([10, 5], center=true); }'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      // Should have valid mesh
      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      manifold.delete()
    })

    it('creates valid 3D with scale', () => {
      const openscad = 'linear_extrude(height=20, scale=0.5) { square([10, 10], center=true); }'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // At base, square is 10x10, at top it's 5x5 (scale=0.5)
      expect(bbox.min[2]).toBeCloseTo(0, 5)
      expect(bbox.max[2]).toBeCloseTo(20, 5)

      manifold.delete()
    })

    it('creates valid 3D from polygon', () => {
      const openscad = `
        linear_extrude(height=5) {
          polygon(points=[[0,0], [10,0], [5,10]]);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      manifold.delete()
    })
  })

  // ============================================================================
  // Rotate Extrude Integration Tests
  // ============================================================================

  describe('rotate_extrude operation', () => {
    it('creates valid revolved solid from polygon', () => {
      // Create a revolved shape using polygon with X > 0 coordinates
      // Note: 2D transforms inside extrude are not yet supported,
      // so we define the polygon directly at the desired position
      const openscad = `
        rotate_extrude() {
          polygon(points=[[10, 0], [15, 0], [15, 5], [10, 5]]);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      // Should have valid mesh
      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      // Bounding box should be symmetric around Z axis
      const bbox = manifold.boundingBox()
      // Outer radius is 15, inner is 10
      expect(bbox.min[0]).toBeCloseTo(-15, 4)
      expect(bbox.max[0]).toBeCloseTo(15, 4)
      expect(bbox.min[1]).toBeCloseTo(-15, 4)
      expect(bbox.max[1]).toBeCloseTo(15, 4)

      manifold.delete()
    })

    it('creates valid partial revolution', () => {
      // Use polygon for shape offset from origin (2D transforms not yet supported)
      const openscad = `
        rotate_extrude(angle=180) {
          polygon(points=[[7, -3], [13, -3], [13, 3], [7, 3]]);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      // Should have valid mesh (half ring)
      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      manifold.delete()
    })

    it('creates valid full revolution from circle', () => {
      // Simple circle revolve (circle is centered at origin, results in sphere-like)
      const openscad = 'rotate_extrude() { circle(r=5); }'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      manifold.delete()
    })
  })

  // ============================================================================
  // Transform Integration Tests
  // ============================================================================

  describe('transform operations', () => {
    it('translates geometry correctly', () => {
      const openscad = 'translate([10, 20, 30]) cube([5, 5, 5]);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      expect(bbox.min[0]).toBeCloseTo(10, 5)
      expect(bbox.min[1]).toBeCloseTo(20, 5)
      expect(bbox.min[2]).toBeCloseTo(30, 5)
      expect(bbox.max[0]).toBeCloseTo(15, 5)
      expect(bbox.max[1]).toBeCloseTo(25, 5)
      expect(bbox.max[2]).toBeCloseTo(35, 5)

      manifold.delete()
    })

    it('rotates geometry correctly', () => {
      // Rotate a cube 90 degrees around Z axis
      const openscad = 'rotate([0, 0, 90]) cube([10, 5, 3]);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // After 90 degree Z rotation, X and Y dimensions swap
      // Original: [0,10] x [0,5] -> After rotation: [-5,0] x [0,10]
      expect(bbox.min[0]).toBeCloseTo(-5, 4)
      expect(bbox.max[0]).toBeCloseTo(0, 4)
      expect(bbox.min[1]).toBeCloseTo(0, 4)
      expect(bbox.max[1]).toBeCloseTo(10, 4)

      manifold.delete()
    })

    it('scales geometry correctly', () => {
      const openscad = 'scale([2, 3, 4]) cube([5, 5, 5]);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      expect(bbox.max[0]).toBeCloseTo(10, 5) // 5*2
      expect(bbox.max[1]).toBeCloseTo(15, 5) // 5*3
      expect(bbox.max[2]).toBeCloseTo(20, 5) // 5*4

      manifold.delete()
    })

    it('mirrors geometry correctly', () => {
      const openscad = 'mirror([1, 0, 0]) translate([5, 0, 0]) cube([10, 10, 10]);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Original would be [5,15], mirrored across X should be [-15,-5]
      expect(bbox.min[0]).toBeCloseTo(-15, 5)
      expect(bbox.max[0]).toBeCloseTo(-5, 5)

      manifold.delete()
    })

    it('applies chained transforms correctly', () => {
      const openscad = `
        translate([10, 0, 0])
          rotate([0, 0, 45])
            scale([2, 1, 1])
              cube([5, 5, 5], center=true);
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      // Should produce valid geometry
      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      manifold.delete()
    })
  })

  // ============================================================================
  // Complex Nested Examples
  // ============================================================================

  describe('complex nested examples', () => {
    it('produces valid geometry for nested booleans and transforms', () => {
      const openscad = `
        $fn = 32;
        difference() {
          union() {
            cube([20, 20, 10], center=true);
            translate([0, 0, 5])
              cylinder(h=10, r=8);
          }
          translate([0, 0, -1])
            cylinder(h=22, r=5);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      // Should have valid mesh
      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      // Verify bounding box is reasonable
      const bbox = manifold.boundingBox()
      expect(bbox.max[2]).toBeCloseTo(15, 5) // cube half + cylinder height

      manifold.delete()
    })

    it('produces valid geometry for multiple top-level statements', () => {
      const openscad = `
        cube([10, 10, 10]);
        translate([15, 0, 0]) sphere(r=5);
        translate([30, 0, 0]) cylinder(h=10, r=3);
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      // Should span all three objects
      expect(bbox.min[0]).toBeCloseTo(0, 5)   // cube starts at 0
      expect(bbox.max[0]).toBeCloseTo(33, 5)  // cylinder at 30 + radius 3

      manifold.delete()
    })

    it('produces valid geometry for extrude with simple 2D shape', () => {
      // Note: 2D booleans inside extrusions use only the first child currently
      // This tests simple extrusion which is fully supported
      const openscad = `
        linear_extrude(height=10) {
          square([20, 20], center=true);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const mesh = manifold.getMesh()

      expect(mesh.numVert).toBeGreaterThan(0)
      expect(mesh.numTri).toBeGreaterThan(0)

      const bbox = manifold.boundingBox()
      expect(bbox.min[0]).toBeCloseTo(-10, 5)
      expect(bbox.max[0]).toBeCloseTo(10, 5)
      expect(bbox.max[2]).toBeCloseTo(10, 5)

      manifold.delete()
    })
  })

  // ============================================================================
  // $fn and Segment Count Tests
  // ============================================================================

  describe('$fn affects segment count', () => {
    it('higher $fn produces more vertices in sphere', () => {
      // Low segment count
      const lowFnCode = transpileOpenSCAD('sphere(r=10, $fn=16);')
      const lowFnManifold = executeTranspiled(M, lowFnCode)
      const lowFnMesh = lowFnManifold.getMesh()
      const lowFnVertCount = lowFnMesh.numVert

      lowFnManifold.delete()

      // High segment count
      const highFnCode = transpileOpenSCAD('sphere(r=10, $fn=64);')
      const highFnManifold = executeTranspiled(M, highFnCode)
      const highFnMesh = highFnManifold.getMesh()
      const highFnVertCount = highFnMesh.numVert

      highFnManifold.delete()

      // Higher $fn should produce significantly more vertices
      expect(highFnVertCount).toBeGreaterThan(lowFnVertCount)
      // Roughly, vertex count scales with fn^2 for a sphere
      expect(highFnVertCount).toBeGreaterThan(lowFnVertCount * 2)
    })

    it('higher $fn produces more vertices in cylinder', () => {
      const lowFnCode = transpileOpenSCAD('cylinder(h=10, r=5, $fn=16);')
      const lowFnManifold = executeTranspiled(M, lowFnCode)
      const lowFnMesh = lowFnManifold.getMesh()
      const lowFnVertCount = lowFnMesh.numVert

      lowFnManifold.delete()

      const highFnCode = transpileOpenSCAD('cylinder(h=10, r=5, $fn=64);')
      const highFnManifold = executeTranspiled(M, highFnCode)
      const highFnMesh = highFnManifold.getMesh()
      const highFnVertCount = highFnMesh.numVert

      highFnManifold.delete()

      expect(highFnVertCount).toBeGreaterThan(lowFnVertCount)
    })

    it('global $fn assignment affects subsequent primitives', () => {
      // Without $fn assignment, default is 32
      const defaultFnCode = transpileOpenSCAD('sphere(r=10);')
      const defaultManifold = executeTranspiled(M, defaultFnCode)
      const defaultMesh = defaultManifold.getMesh()
      const defaultVertCount = defaultMesh.numVert

      defaultManifold.delete()

      // With $fn = 64
      const highFnCode = transpileOpenSCAD('$fn = 64; sphere(r=10);')
      const highFnManifold = executeTranspiled(M, highFnCode)
      const highFnMesh = highFnManifold.getMesh()
      const highFnVertCount = highFnMesh.numVert

      highFnManifold.delete()

      expect(highFnVertCount).toBeGreaterThan(defaultVertCount)
    })

    it('$fn affects circle in linear_extrude', () => {
      const lowFnCode = transpileOpenSCAD(`
        linear_extrude(height=5) {
          circle(r=10, $fn=6);
        }
      `)
      const lowFnManifold = executeTranspiled(M, lowFnCode)
      const lowFnMesh = lowFnManifold.getMesh()
      const lowFnTriCount = lowFnMesh.numTri

      lowFnManifold.delete()

      const highFnCode = transpileOpenSCAD(`
        linear_extrude(height=5) {
          circle(r=10, $fn=32);
        }
      `)
      const highFnManifold = executeTranspiled(M, highFnCode)
      const highFnMesh = highFnManifold.getMesh()
      const highFnTriCount = highFnMesh.numTri

      highFnManifold.delete()

      // Higher $fn should produce more triangles
      expect(highFnTriCount).toBeGreaterThan(lowFnTriCount)
    })
  })

  // ============================================================================
  // Error Context for AI Retry
  // ============================================================================

  describe('error context for AI retry', () => {
    it('parse error includes line and column information', () => {
      const badOpenscad = 'cube([10,10,10'  // Missing closing bracket

      expect(() => transpileOpenSCAD(badOpenscad)).toThrow(OpenSCADParseError)

      try {
        transpileOpenSCAD(badOpenscad)
      } catch (error) {
        expect(error).toBeInstanceOf(OpenSCADParseError)
        const parseError = error as OpenSCADParseError
        expect(typeof parseError.line).toBe('number')
        expect(typeof parseError.column).toBe('number')
        expect(parseError.line).toBeGreaterThan(0)
      }
    })

    it('parse error includes expected tokens for suggestions', () => {
      const badOpenscad = 'cube([10,10,10'

      try {
        transpileOpenSCAD(badOpenscad)
      } catch (error) {
        expect(error).toBeInstanceOf(OpenSCADParseError)
        const parseError = error as OpenSCADParseError
        expect(Array.isArray(parseError.expected)).toBe(true)
        expect(parseError.expected.length).toBeGreaterThan(0)
      }
    })

    it('parse error toRetryContext provides structured information', () => {
      const badOpenscad = 'cube([10,10,10'

      try {
        transpileOpenSCAD(badOpenscad)
      } catch (error) {
        expect(error).toBeInstanceOf(OpenSCADParseError)
        const parseError = error as OpenSCADParseError

        const retryContext = parseError.toRetryContext()
        expect(retryContext).toContain('line')
        expect(retryContext).toContain('column')
        expect(retryContext).toContain('Found')
        expect(retryContext).toContain('Expected')
      }
    })

    it('transpile error includes context for unsupported features', () => {
      const unsupportedOpenscad = 'hull() { cube(10); sphere(5); }'

      expect(() => transpileOpenSCAD(unsupportedOpenscad)).toThrow(OpenSCADTranspileError)

      try {
        transpileOpenSCAD(unsupportedOpenscad)
      } catch (error) {
        expect(error).toBeInstanceOf(OpenSCADTranspileError)
        const transpileError = error as OpenSCADTranspileError
        expect(transpileError.message).toContain('hull')
        expect(transpileError.message.toLowerCase()).toContain('not')
      }
    })
  })

  // ============================================================================
  // Worker Context Variables
  // ============================================================================

  describe('generated code uses only available worker context variables', () => {
    it('generated code references only M (Manifold module)', () => {
      const openscad = 'cube([10, 10, 10]);'
      const jsCode = transpileOpenSCAD(openscad)

      // Should reference M.Manifold
      expect(jsCode).toContain('M.Manifold')

      // Should not reference undefined variables
      expect(jsCode).not.toMatch(/\bwindow\b/)
      expect(jsCode).not.toMatch(/\bdocument\b/)
      expect(jsCode).not.toMatch(/\bglobal\b/)
      expect(jsCode).not.toMatch(/\brequire\b/)
      expect(jsCode).not.toMatch(/\bimport\b/)
    })

    it('generated code executes successfully in worker sandbox', () => {
      const openscad = `
        $fn = 48;
        difference() {
          cube([20, 20, 20], center=true);
          translate([0, 0, 5])
            cylinder(h=25, r=6, center=true);
        }
      `
      const jsCode = transpileOpenSCAD(openscad)

      // Should execute without error in our simulated sandbox
      expect(() => executeTranspiled(M, jsCode)).not.toThrow()

      const manifold = executeTranspiled(M, jsCode)
      expect(manifold).toBeDefined()
      expect(typeof manifold.getMesh).toBe('function')

      manifold.delete()
    })

    it('generated code works with params context variable', () => {
      // The transpiled code doesn't use params directly, but we verify
      // the execution context accepts params without issues
      const openscad = 'cube([10, 10, 10]);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode, { size: 10, height: 20 })
      expect(manifold).toBeDefined()

      manifold.delete()
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  // ============================================================================
  // Parametric Model Integration Tests
  // ============================================================================

  describe('parametric models with variables', () => {
    describe('default parameters', () => {
      it('model with default params produces correct geometry', () => {
        const openscad = `
          width = 50;
          cube([width, width, width]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        // Execute with empty params - should use default
        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // Cube should be 50x50x50
        expect(bbox.min[0]).toBeCloseTo(0, 5)
        expect(bbox.min[1]).toBeCloseTo(0, 5)
        expect(bbox.min[2]).toBeCloseTo(0, 5)
        expect(bbox.max[0]).toBeCloseTo(50, 5)
        expect(bbox.max[1]).toBeCloseTo(50, 5)
        expect(bbox.max[2]).toBeCloseTo(50, 5)

        manifold.delete()
      })

      it('sphere with default radius produces correct geometry', () => {
        const openscad = `
          radius = 10;
          sphere(r=radius);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // Sphere with radius 10 should span -10 to 10
        expect(bbox.min[0]).toBeCloseTo(-10, 5)
        expect(bbox.max[0]).toBeCloseTo(10, 5)

        manifold.delete()
      })

      it('cylinder with multiple default params produces correct geometry', () => {
        const openscad = `
          height = 20;
          radius = 5;
          cylinder(h=height, r=radius);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // Cylinder with h=20, r=5
        expect(bbox.min[0]).toBeCloseTo(-5, 5)
        expect(bbox.max[0]).toBeCloseTo(5, 5)
        expect(bbox.min[2]).toBeCloseTo(0, 5)
        expect(bbox.max[2]).toBeCloseTo(20, 5)

        manifold.delete()
      })
    })

    describe('custom parameters override defaults', () => {
      it('model with custom params overrides default values', () => {
        const openscad = `
          width = 50;
          cube([width, width, width]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        // Execute with custom params - should override default
        const manifold = executeTranspiled(M, jsCode, { width: 100 })
        const bbox = manifold.boundingBox()

        // Cube should now be 100x100x100
        expect(bbox.min[0]).toBeCloseTo(0, 5)
        expect(bbox.min[1]).toBeCloseTo(0, 5)
        expect(bbox.min[2]).toBeCloseTo(0, 5)
        expect(bbox.max[0]).toBeCloseTo(100, 5)
        expect(bbox.max[1]).toBeCloseTo(100, 5)
        expect(bbox.max[2]).toBeCloseTo(100, 5)

        manifold.delete()
      })

      it('sphere with custom radius overrides default', () => {
        const openscad = `
          radius = 10;
          sphere(r=radius);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { radius: 20 })
        const bbox = manifold.boundingBox()

        // Sphere with overridden radius 20
        expect(bbox.min[0]).toBeCloseTo(-20, 5)
        expect(bbox.max[0]).toBeCloseTo(20, 5)

        manifold.delete()
      })

      it('can override only some parameters while using defaults for others', () => {
        const openscad = `
          height = 20;
          radius = 5;
          cylinder(h=height, r=radius);
        `
        const jsCode = transpileOpenSCAD(openscad)

        // Override only height, keep radius default
        const manifold = executeTranspiled(M, jsCode, { height: 40 })
        const bbox = manifold.boundingBox()

        // Height should be 40 (overridden), radius should be 5 (default)
        expect(bbox.min[0]).toBeCloseTo(-5, 5)
        expect(bbox.max[0]).toBeCloseTo(5, 5)
        expect(bbox.max[2]).toBeCloseTo(40, 5)

        manifold.delete()
      })
    })

    describe('multiple variables in same model', () => {
      it('handles multiple independent variables', () => {
        const openscad = `
          width = 10;
          depth = 20;
          height = 30;
          cube([width, depth, height]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        expect(bbox.max[0]).toBeCloseTo(10, 5)
        expect(bbox.max[1]).toBeCloseTo(20, 5)
        expect(bbox.max[2]).toBeCloseTo(30, 5)

        manifold.delete()
      })

      it('handles overriding multiple variables', () => {
        const openscad = `
          width = 10;
          depth = 20;
          height = 30;
          cube([width, depth, height]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { width: 50, depth: 60, height: 70 })
        const bbox = manifold.boundingBox()

        expect(bbox.max[0]).toBeCloseTo(50, 5)
        expect(bbox.max[1]).toBeCloseTo(60, 5)
        expect(bbox.max[2]).toBeCloseTo(70, 5)

        manifold.delete()
      })

      it('handles cone with independent top and bottom radii', () => {
        const openscad = `
          height = 20;
          bottom_radius = 10;
          top_radius = 5;
          cylinder(h=height, r1=bottom_radius, r2=top_radius, center=true);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { bottom_radius: 15 })
        const bbox = manifold.boundingBox()

        // With bottom_radius=15 overridden, max X should be 15
        expect(bbox.max[0]).toBeCloseTo(15, 5)
        expect(bbox.max[2]).toBeCloseTo(10, 5) // half of default height=20

        manifold.delete()
      })
    })

    describe('variables in boolean operations', () => {
      it('difference operation with parametric dimensions', () => {
        const openscad = `
          outer_size = 20;
          hole_radius = 5;
          difference() {
            cube([outer_size, outer_size, outer_size], center=true);
            cylinder(h=30, r=hole_radius, center=true);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // Outer cube should define bounds
        expect(bbox.min[0]).toBeCloseTo(-10, 5)
        expect(bbox.max[0]).toBeCloseTo(10, 5)

        manifold.delete()
      })

      it('difference operation with overridden parameters', () => {
        const openscad = `
          outer_size = 20;
          hole_radius = 5;
          difference() {
            cube([outer_size, outer_size, outer_size], center=true);
            cylinder(h=30, r=hole_radius, center=true);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        // Override outer_size
        const manifold = executeTranspiled(M, jsCode, { outer_size: 40 })
        const bbox = manifold.boundingBox()

        // Outer cube should now be larger
        expect(bbox.min[0]).toBeCloseTo(-20, 5)
        expect(bbox.max[0]).toBeCloseTo(20, 5)

        manifold.delete()
      })

      it('union operation with parametric positions', () => {
        const openscad = `
          cube_size = 10;
          sphere_radius = 5;
          sphere_offset = 15;
          union() {
            cube([cube_size, cube_size, cube_size]);
            translate([sphere_offset, 0, 0]) sphere(r=sphere_radius);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // Union should span from cube to sphere
        expect(bbox.min[0]).toBeCloseTo(0, 5)
        expect(bbox.max[0]).toBeCloseTo(20, 5)  // 15 + 5

        manifold.delete()
      })

      it('union operation with overridden offset', () => {
        const openscad = `
          cube_size = 10;
          sphere_radius = 5;
          sphere_offset = 15;
          union() {
            cube([cube_size, cube_size, cube_size]);
            translate([sphere_offset, 0, 0]) sphere(r=sphere_radius);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { sphere_offset: 30 })
        const bbox = manifold.boundingBox()

        // Sphere should now be further away
        expect(bbox.max[0]).toBeCloseTo(35, 5)  // 30 + 5

        manifold.delete()
      })

      it('intersection operation with parametric overlapping shapes', () => {
        const openscad = `
          cube_size = 10;
          sphere_radius = 7;
          intersection() {
            cube([cube_size, cube_size, cube_size], center=true);
            sphere(r=sphere_radius);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const mesh = manifold.getMesh()

        // Should have valid mesh (intersection exists)
        expect(mesh.numVert).toBeGreaterThan(0)
        expect(mesh.numTri).toBeGreaterThan(0)

        manifold.delete()
      })
    })

    describe('variables in transforms', () => {
      it('translate with parametric offset vector', () => {
        const openscad = `
          x_offset = 10;
          y_offset = 20;
          z_offset = 30;
          translate([x_offset, y_offset, z_offset]) cube([5, 5, 5]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        expect(bbox.min[0]).toBeCloseTo(10, 5)
        expect(bbox.min[1]).toBeCloseTo(20, 5)
        expect(bbox.min[2]).toBeCloseTo(30, 5)

        manifold.delete()
      })

      it('translate with overridden offsets', () => {
        const openscad = `
          x_offset = 10;
          y_offset = 20;
          z_offset = 30;
          translate([x_offset, y_offset, z_offset]) cube([5, 5, 5]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { x_offset: 100, y_offset: 200 })
        const bbox = manifold.boundingBox()

        expect(bbox.min[0]).toBeCloseTo(100, 5)
        expect(bbox.min[1]).toBeCloseTo(200, 5)
        expect(bbox.min[2]).toBeCloseTo(30, 5)  // default

        manifold.delete()
      })

      it('scale with parametric factor', () => {
        const openscad = `
          scale_factor = 2;
          scale([scale_factor, scale_factor, scale_factor]) cube([5, 5, 5]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // 5 * 2 = 10
        expect(bbox.max[0]).toBeCloseTo(10, 5)
        expect(bbox.max[1]).toBeCloseTo(10, 5)
        expect(bbox.max[2]).toBeCloseTo(10, 5)

        manifold.delete()
      })

      it('scale with overridden factor', () => {
        const openscad = `
          scale_factor = 2;
          scale([scale_factor, scale_factor, scale_factor]) cube([5, 5, 5]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { scale_factor: 4 })
        const bbox = manifold.boundingBox()

        // 5 * 4 = 20
        expect(bbox.max[0]).toBeCloseTo(20, 5)
        expect(bbox.max[1]).toBeCloseTo(20, 5)
        expect(bbox.max[2]).toBeCloseTo(20, 5)

        manifold.delete()
      })

      it('rotate with parametric angle', () => {
        const openscad = `
          angle = 90;
          rotate([0, 0, angle]) cube([10, 5, 3]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // After 90 degree Z rotation, X and Y dimensions swap
        expect(bbox.min[0]).toBeCloseTo(-5, 4)
        expect(bbox.max[0]).toBeCloseTo(0, 4)
        expect(bbox.min[1]).toBeCloseTo(0, 4)
        expect(bbox.max[1]).toBeCloseTo(10, 4)

        manifold.delete()
      })

      it('chained transforms with parametric values', () => {
        const openscad = `
          x_pos = 10;
          angle = 45;
          translate([x_pos, 0, 0])
            rotate([0, 0, angle])
              cube([5, 5, 5], center=true);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const mesh = manifold.getMesh()

        // Should produce valid geometry
        expect(mesh.numVert).toBeGreaterThan(0)
        expect(mesh.numTri).toBeGreaterThan(0)

        manifold.delete()
      })
    })

    describe('variables in extrusions', () => {
      it('linear_extrude with parametric height', () => {
        const openscad = `
          height = 10;
          size = 20;
          linear_extrude(height=height) { square([size, size], center=true); }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        expect(bbox.min[0]).toBeCloseTo(-10, 5)
        expect(bbox.max[0]).toBeCloseTo(10, 5)
        expect(bbox.max[2]).toBeCloseTo(10, 5)

        manifold.delete()
      })

      it('linear_extrude with overridden height', () => {
        const openscad = `
          height = 10;
          size = 20;
          linear_extrude(height=height) { square([size, size], center=true); }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { height: 30 })
        const bbox = manifold.boundingBox()

        expect(bbox.max[2]).toBeCloseTo(30, 5)

        manifold.delete()
      })

      it('linear_extrude with parametric twist', () => {
        const openscad = `
          height = 20;
          twist = 90;
          linear_extrude(height=height, twist=twist) { square([10, 5], center=true); }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const mesh = manifold.getMesh()

        // Should produce valid twisted geometry
        expect(mesh.numVert).toBeGreaterThan(0)
        expect(mesh.numTri).toBeGreaterThan(0)

        manifold.delete()
      })

      it('linear_extrude with parametric scale', () => {
        const openscad = `
          height = 20;
          top_scale = 0.5;
          linear_extrude(height=height, scale=top_scale) { square([10, 10], center=true); }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // At base, square is 10x10 (-5 to 5), at top it's 5x5
        expect(bbox.min[2]).toBeCloseTo(0, 5)
        expect(bbox.max[2]).toBeCloseTo(20, 5)

        manifold.delete()
      })

      it('linear_extrude with parametric 2D shape radius', () => {
        const openscad = `
          height = 15;
          radius = 5;
          linear_extrude(height=height) { circle(r=radius); }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        expect(bbox.min[0]).toBeCloseTo(-5, 4)
        expect(bbox.max[0]).toBeCloseTo(5, 4)
        expect(bbox.max[2]).toBeCloseTo(15, 5)

        manifold.delete()
      })

      it('linear_extrude with overridden 2D shape radius', () => {
        const openscad = `
          height = 15;
          radius = 5;
          linear_extrude(height=height) { circle(r=radius); }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { radius: 10 })
        const bbox = manifold.boundingBox()

        expect(bbox.min[0]).toBeCloseTo(-10, 4)
        expect(bbox.max[0]).toBeCloseTo(10, 4)

        manifold.delete()
      })

      it('rotate_extrude with parametric angle', () => {
        const openscad = `
          angle = 180;
          rotate_extrude(angle=angle) {
            polygon(points=[[7, -3], [13, -3], [13, 3], [7, 3]]);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const mesh = manifold.getMesh()

        // Should produce valid partial revolution
        expect(mesh.numVert).toBeGreaterThan(0)
        expect(mesh.numTri).toBeGreaterThan(0)

        manifold.delete()
      })
    })

    describe('complex parametric models', () => {
      it('box with parametric dimensions', () => {
        // Note: OpenSCAD transpiler does not support arithmetic expressions like wall * 2
        // Use pre-computed inner dimensions instead
        const openscad = `
          outer_width = 30;
          outer_height = 20;
          inner_width = 26;
          inner_height = 20;
          wall_offset = 2;
          difference() {
            cube([outer_width, outer_width, outer_height], center=true);
            translate([0, 0, wall_offset])
              cube([inner_width, inner_width, inner_height], center=true);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // Outer dimensions should be 30x30x20 centered
        expect(bbox.min[0]).toBeCloseTo(-15, 5)
        expect(bbox.max[0]).toBeCloseTo(15, 5)
        expect(bbox.min[2]).toBeCloseTo(-10, 5)
        expect(bbox.max[2]).toBeCloseTo(10, 5)

        manifold.delete()
      })

      it('box with overridden dimensions', () => {
        const openscad = `
          outer_width = 30;
          outer_height = 20;
          inner_width = 26;
          inner_height = 20;
          wall_offset = 2;
          difference() {
            cube([outer_width, outer_width, outer_height], center=true);
            translate([0, 0, wall_offset])
              cube([inner_width, inner_width, inner_height], center=true);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        // Verify it runs with overridden parameters
        const manifold = executeTranspiled(M, jsCode, { outer_width: 50, inner_width: 40 })
        const bbox = manifold.boundingBox()

        // Outer dimensions should be 50x50x20 centered
        expect(bbox.min[0]).toBeCloseTo(-25, 5)
        expect(bbox.max[0]).toBeCloseTo(25, 5)

        manifold.delete()
      })

      it('extruded triangle with parametric height', () => {
        // Use literal values for polygon points since expressions not supported
        const openscad = `
          extrude_height = 5;
          linear_extrude(height=extrude_height) {
            polygon(points=[[0, 0], [10, 0], [5, 10]]);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        expect(bbox.max[2]).toBeCloseTo(5, 5)

        manifold.delete()
      })

      it('extruded triangle with overridden height', () => {
        const openscad = `
          extrude_height = 5;
          linear_extrude(height=extrude_height) {
            polygon(points=[[0, 0], [10, 0], [5, 10]]);
          }
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { extrude_height: 20 })
        const bbox = manifold.boundingBox()

        expect(bbox.max[2]).toBeCloseTo(20, 5)

        manifold.delete()
      })

      it('multiple parts with independent parameters', () => {
        // Note: Expressions like size/2 are not supported, use explicit values
        const openscad = `
          cube_size = 10;
          sphere_radius = 5;
          cylinder_radius = 2.5;
          spacing1 = 15;
          spacing2 = 30;
          cube([cube_size, cube_size, cube_size]);
          translate([spacing1, 0, 0]) sphere(r=sphere_radius);
          translate([spacing2, 0, 0]) cylinder(h=cube_size, r=cylinder_radius);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        // All three objects should be in the combined bounding box
        expect(bbox.min[0]).toBeCloseTo(0, 5)
        // Last object is at 30 with radius 2.5
        expect(bbox.max[0]).toBeCloseTo(32.5, 5)

        manifold.delete()
      })

      it('multiple parts with overridden parameters', () => {
        const openscad = `
          cube_size = 10;
          sphere_radius = 5;
          cylinder_radius = 2.5;
          spacing1 = 15;
          spacing2 = 30;
          cube([cube_size, cube_size, cube_size]);
          translate([spacing1, 0, 0]) sphere(r=sphere_radius);
          translate([spacing2, 0, 0]) cylinder(h=cube_size, r=cylinder_radius);
        `
        const jsCode = transpileOpenSCAD(openscad)

        const manifold = executeTranspiled(M, jsCode, { cube_size: 20, sphere_radius: 10, cylinder_radius: 5 })
        const bbox = manifold.boundingBox()

        // Cube is 20x20x20, sphere at 15 with r=10, cylinder at 30 with r=5
        expect(bbox.max[0]).toBeCloseTo(35, 5)
        expect(bbox.max[1]).toBeCloseTo(20, 5)
        expect(bbox.max[2]).toBeCloseTo(20, 5)

        manifold.delete()
      })
    })

    describe('generated code correctness', () => {
      it('generated code uses params lookup with nullish coalescing', () => {
        const openscad = `
          width = 50;
          cube([width, width, width]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        // Verify the generated code uses the expected pattern
        expect(jsCode).toContain("params['width']")
        expect(jsCode).toContain('??')
        expect(jsCode).toContain('50')
      })

      it('generated code handles undefined params gracefully', () => {
        const openscad = `
          size = 10;
          cube([size, size, size]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        // Execute with undefined passed explicitly
        const manifold = executeTranspiled(M, jsCode, {})
        const bbox = manifold.boundingBox()

        expect(bbox.max[0]).toBeCloseTo(10, 5)

        manifold.delete()
      })

      it('generated code respects numeric 0 as a valid override', () => {
        const openscad = `
          x_pos = 10;
          translate([x_pos, 0, 0]) cube([5, 5, 5]);
        `
        const jsCode = transpileOpenSCAD(openscad)

        // 0 should be a valid override, not fall back to default
        const manifold = executeTranspiled(M, jsCode, { x_pos: 0 })
        const bbox = manifold.boundingBox()

        expect(bbox.min[0]).toBeCloseTo(0, 5)
        expect(bbox.max[0]).toBeCloseTo(5, 5)

        manifold.delete()
      })
    })
  })

  describe('edge cases', () => {
    it('handles empty program gracefully', () => {
      const jsCode = transpileOpenSCAD('')
      expect(jsCode).toContain('return')
    })

    it('handles floating point precision', () => {
      const openscad = 'cube([1.5, 2.75, 3.125]);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      expect(bbox.max[0]).toBeCloseTo(1.5, 5)
      expect(bbox.max[1]).toBeCloseTo(2.75, 5)
      expect(bbox.max[2]).toBeCloseTo(3.125, 5)

      manifold.delete()
    })

    it('handles negative coordinates', () => {
      const openscad = 'translate([-10, -20, -30]) cube([5, 5, 5]);'
      const jsCode = transpileOpenSCAD(openscad)

      const manifold = executeTranspiled(M, jsCode)
      const bbox = manifold.boundingBox()

      expect(bbox.min[0]).toBeCloseTo(-10, 5)
      expect(bbox.min[1]).toBeCloseTo(-20, 5)
      expect(bbox.min[2]).toBeCloseTo(-30, 5)

      manifold.delete()
    })
  })
})
