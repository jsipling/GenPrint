import { describe, it, expect, beforeEach } from 'vitest'
import { transpile } from '../Transpiler'
import { parse } from '../Parser'
import type { ProgramNode } from '../types'

/**
 * Transpiler Tests
 *
 * Tests for the OpenSCAD to Manifold JavaScript transpiler.
 * These tests follow TDD approach - tests are written first, before implementation.
 *
 * The transpile function should accept either:
 * - A ProgramNode (parsed AST)
 * - A source string (which will be parsed internally)
 *
 * And return valid JavaScript code that uses the Manifold API through the M variable.
 */

describe('Transpiler', () => {
  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Verifies the output is valid JavaScript by parsing it with Function constructor
   */
  function assertValidJS(code: string): void {
    expect(() => new Function('M', code)).not.toThrow()
  }

  /**
   * Verifies the output only uses the M variable (no undefined references)
   */
  function assertOnlyUsesM(code: string): void {
    // The code should only reference M (Manifold module) and standard JS constructs
    // This is a simplified check - we verify it can be parsed as a function body with M param
    assertValidJS(code)
  }

  /**
   * Verifies the output includes a return statement
   */
  function assertHasReturn(code: string): void {
    expect(code).toMatch(/\breturn\b/)
  }

  // ============================================================================
  // Cube Primitive Tests
  // ============================================================================

  describe('cube primitive', () => {
    it('should transpile cube([10,20,30], center=true) -> M.Manifold.cube([10,20,30], true)', () => {
      const code = transpile('cube([10,20,30], center=true);')

      expect(code).toContain('M.Manifold.cube([10, 20, 30], true)')
      assertValidJS(code)
      assertHasReturn(code)
    })

    it('should transpile cube(10) -> M.Manifold.cube([10,10,10], false) (expand shorthand)', () => {
      const code = transpile('cube(10);')

      // Single number should be expanded to [size, size, size]
      expect(code).toContain('M.Manifold.cube([10, 10, 10], false)')
      assertValidJS(code)
    })

    it('should transpile cube([5,10,15]) with default center=false', () => {
      const code = transpile('cube([5,10,15]);')

      expect(code).toContain('M.Manifold.cube([5, 10, 15], false)')
      assertValidJS(code)
    })

    it('should transpile cube(size=[10,20,30], center=false)', () => {
      const code = transpile('cube(size=[10,20,30], center=false);')

      expect(code).toContain('M.Manifold.cube([10, 20, 30], false)')
      assertValidJS(code)
    })
  })

  // ============================================================================
  // Sphere Primitive Tests
  // ============================================================================

  describe('sphere primitive', () => {
    it('should transpile sphere(r=5, $fn=48) -> M.Manifold.sphere(5, 48)', () => {
      const code = transpile('sphere(r=5, $fn=48);')

      expect(code).toContain('M.Manifold.sphere(5, 48)')
      assertValidJS(code)
    })

    it('should transpile sphere(r=5) with default 32 segments', () => {
      const code = transpile('sphere(r=5);')

      // Without $fn, should use default 32 segments
      expect(code).toContain('M.Manifold.sphere(5, 32)')
      assertValidJS(code)
    })

    it('should transpile sphere(5) positional radius with default segments', () => {
      const code = transpile('sphere(5);')

      expect(code).toContain('M.Manifold.sphere(5, 32)')
      assertValidJS(code)
    })

    it('should transpile sphere(d=10) converting diameter to radius', () => {
      const code = transpile('sphere(d=10);')

      // d=10 means r=5
      expect(code).toContain('M.Manifold.sphere(5, 32)')
      assertValidJS(code)
    })
  })

  // ============================================================================
  // Cylinder Primitive Tests
  // ============================================================================

  describe('cylinder primitive', () => {
    it('should transpile cylinder(h=10, r=5) -> M.Manifold.cylinder(10, 5, 5, 32, false)', () => {
      const code = transpile('cylinder(h=10, r=5);')

      // cylinder(height, bottomRadius, topRadius, segments, center)
      expect(code).toContain('M.Manifold.cylinder(10, 5, 5, 32, false)')
      assertValidJS(code)
    })

    it('should transpile cylinder(h=10, r1=5, r2=3, center=true) -> correct Manifold call', () => {
      const code = transpile('cylinder(h=10, r1=5, r2=3, center=true);')

      // Cone with different radii, centered
      expect(code).toContain('M.Manifold.cylinder(10, 5, 3, 32, true)')
      assertValidJS(code)
    })

    it('should transpile cylinder(h=10, d=10) -> radius = 5 (d/2)', () => {
      const code = transpile('cylinder(h=10, d=10);')

      // d=10 means r=5, so bottomRadius=5, topRadius=5
      expect(code).toContain('M.Manifold.cylinder(10, 5, 5, 32, false)')
      assertValidJS(code)
    })

    it('should transpile cylinder with d1 and d2', () => {
      const code = transpile('cylinder(h=10, d1=10, d2=6);')

      // d1=10 means r1=5, d2=6 means r2=3
      expect(code).toContain('M.Manifold.cylinder(10, 5, 3, 32, false)')
      assertValidJS(code)
    })

    it('should transpile cylinder with $fn', () => {
      const code = transpile('cylinder(h=10, r=5, $fn=64);')

      expect(code).toContain('M.Manifold.cylinder(10, 5, 5, 64, false)')
      assertValidJS(code)
    })
  })

  // ============================================================================
  // Transform Tests
  // ============================================================================

  describe('transforms', () => {
    it('should transpile translate([1,2,3]) { cube([10,10,10]); } -> .translate([1,2,3])', () => {
      const code = transpile('translate([1,2,3]) { cube([10,10,10]); }')

      // Should create cube, then translate it
      expect(code).toContain('M.Manifold.cube([10, 10, 10], false)')
      expect(code).toContain('.translate([1, 2, 3])')
      assertValidJS(code)
    })

    it('should transpile rotate([0,0,45]) { ... } -> .rotate([0,0,45])', () => {
      const code = transpile('rotate([0,0,45]) { cube(10); }')

      expect(code).toContain('.rotate([0, 0, 45])')
      assertValidJS(code)
    })

    it('should transpile scale(2) { ... } -> .scale([2,2,2]) (expand scalar)', () => {
      const code = transpile('scale(2) { cube(10); }')

      // Scalar scale should be expanded to [2, 2, 2]
      expect(code).toContain('.scale([2, 2, 2])')
      assertValidJS(code)
    })

    it('should transpile scale([2,3,4]) { ... } -> .scale([2,3,4])', () => {
      const code = transpile('scale([2,3,4]) { cube(10); }')

      expect(code).toContain('.scale([2, 3, 4])')
      assertValidJS(code)
    })

    it('should transpile mirror([1,0,0]) { ... } -> .mirror([1,0,0])', () => {
      const code = transpile('mirror([1,0,0]) { cube(10); }')

      expect(code).toContain('.mirror([1, 0, 0])')
      assertValidJS(code)
    })

    it('should apply chained transforms in correct order (outer-to-inner)', () => {
      // translate -> rotate -> cube
      // In OpenSCAD, transforms apply from outside in
      // So: translate([1,2,3]) rotate([0,0,45]) cube(10);
      // means: create cube, rotate it, then translate the result
      const code = transpile('translate([1,2,3]) rotate([0,0,45]) { cube(10); }')

      // The cube should be created first, then rotated, then translated
      // The transforms should be applied in order: rotate first, then translate
      // Verify both transforms are present
      expect(code).toContain('.rotate([0, 0, 45])')
      expect(code).toContain('.translate([1, 2, 3])')
      assertValidJS(code)

      // The order in the code should be: cube -> rotate -> translate
      const rotateIndex = code.indexOf('.rotate')
      const translateIndex = code.indexOf('.translate')
      expect(rotateIndex).toBeLessThan(translateIndex)
    })

    it('should handle single child without braces', () => {
      const code = transpile('translate([5,0,0]) cube(10);')

      expect(code).toContain('M.Manifold.cube')
      expect(code).toContain('.translate([5, 0, 0])')
      assertValidJS(code)
    })
  })

  // ============================================================================
  // Boolean Operation Tests
  // ============================================================================

  describe('boolean operations', () => {
    it('should transpile union() { a; b; } -> uses .add() or M.Manifold.union([...])', () => {
      const code = transpile('union() { cube(10); sphere(5); }')

      // Should use either .add() or M.Manifold.union([])
      expect(code.includes('.add(') || code.includes('M.Manifold.union(')).toBe(true)
      assertValidJS(code)
    })

    it('should transpile difference() { a; b; c; } -> a.subtract(b).subtract(c)', () => {
      const code = transpile('difference() { cube(20); sphere(10); cylinder(h=30, r=5); }')

      // First child is the base, subsequent children are subtracted sequentially
      expect(code).toContain('.subtract(')
      assertValidJS(code)
    })

    it('should transpile intersection() { a; b; } -> a.intersect(b)', () => {
      const code = transpile('intersection() { cube(10); sphere(7); }')

      expect(code).toContain('.intersect(')
      assertValidJS(code)
    })

    it('should generate correct temp variables for nested booleans', () => {
      const code = transpile(`
        union() {
          difference() { cube(20); sphere(12); }
          cylinder(h=30, r=5);
        }
      `)

      // Nested booleans should create temporary variables
      // The code should be parseable and valid
      assertValidJS(code)
      assertHasReturn(code)

      // Should have multiple operations
      expect(code).toContain('.subtract(')
      expect(code.includes('.add(') || code.includes('M.Manifold.union(')).toBe(true)
    })

    it('should handle deeply nested booleans correctly', () => {
      const code = transpile(`
        difference() {
          union() {
            cube(10);
            intersection() {
              sphere(8);
              cylinder(h=20, r=5);
            }
          }
          translate([5,5,5]) cube(5);
        }
      `)

      assertValidJS(code)
      assertHasReturn(code)
    })
  })

  // ============================================================================
  // Extrusion Tests
  // ============================================================================

  describe('extrusions', () => {
    it('should transpile linear_extrude(height=10) { square([5,5]); } -> M.Manifold.extrude(...)', () => {
      const code = transpile('linear_extrude(height=10) { square([5,5]); }')

      // Should use M.Manifold.extrude with the 2D shape converted to polygon
      expect(code).toContain('M.Manifold.extrude')
      assertValidJS(code)
    })

    it('should transpile linear_extrude(height=10, twist=45) -> correct twistDegrees param', () => {
      const code = transpile('linear_extrude(height=10, twist=45) { circle(5); }')

      // The extrude call should include twist parameter
      expect(code).toContain('M.Manifold.extrude')
      // twist should be passed (as twistDegrees or similar)
      expect(code).toMatch(/twist|45/)
      assertValidJS(code)
    })

    it('should transpile rotate_extrude(angle=180, $fn=64) -> M.Manifold.revolve(...)', () => {
      const code = transpile('rotate_extrude(angle=180, $fn=64) { square([5,10]); }')

      expect(code).toContain('M.Manifold.revolve')
      assertValidJS(code)
    })

    it('should transpile rotate_extrude() with default angle=360', () => {
      const code = transpile('rotate_extrude() { circle(5); }')

      expect(code).toContain('M.Manifold.revolve')
      assertValidJS(code)
    })
  })

  // ============================================================================
  // 2D Shape Conversion Tests
  // ============================================================================

  describe('2D shape conversion', () => {
    it('should convert circle to polygon array', () => {
      const code = transpile('linear_extrude(height=10) { circle(r=5); }')

      // Circle should be converted to a polygon representation
      // The code should generate points for the polygon
      assertValidJS(code)
      expect(code).toContain('M.Manifold.extrude')
    })

    it('should convert square to polygon array', () => {
      const code = transpile('linear_extrude(height=10) { square([10,20]); }')

      // Square should be converted to a polygon with 4 corners
      assertValidJS(code)
      expect(code).toContain('M.Manifold.extrude')
    })

    it('should convert polygon to polygon array', () => {
      const code = transpile('linear_extrude(height=10) { polygon(points=[[0,0],[10,0],[5,10]]); }')

      // Polygon points should be passed through to extrude
      assertValidJS(code)
      expect(code).toContain('M.Manifold.extrude')
    })

    it('should handle circle with $fn for polygon resolution', () => {
      const code = transpile('linear_extrude(height=10) { circle(r=5, $fn=6); }')

      // Circle with $fn=6 should create a hexagon
      assertValidJS(code)
      expect(code).toContain('M.Manifold.extrude')
    })
  })

  // ============================================================================
  // Special Variable Tests ($fn)
  // ============================================================================

  describe('special variables ($fn)', () => {
    it('should apply $fn = 64 to subsequent primitives', () => {
      const code = transpile('$fn = 64; sphere(5);')

      // The sphere after $fn assignment should use 64 segments
      expect(code).toContain('M.Manifold.sphere(5, 64)')
      assertValidJS(code)
    })

    it('should apply $fn to cylinder', () => {
      const code = transpile('$fn = 48; cylinder(h=10, r=5);')

      expect(code).toContain('M.Manifold.cylinder(10, 5, 5, 48, false)')
      assertValidJS(code)
    })

    it('should clamp $fn to minimum 16', () => {
      const code = transpile('$fn = 4; sphere(5);')

      // $fn should be clamped to at least 16
      expect(code).toContain('M.Manifold.sphere(5, 16)')
      assertValidJS(code)
    })

    it('should clamp $fn to maximum 128', () => {
      const code = transpile('$fn = 256; sphere(5);')

      // $fn should be clamped to at most 128
      expect(code).toContain('M.Manifold.sphere(5, 128)')
      assertValidJS(code)
    })

    it('should allow $fn within valid range (16-128)', () => {
      const code = transpile('$fn = 64; sphere(5);')

      expect(code).toContain('M.Manifold.sphere(5, 64)')
      assertValidJS(code)
    })

    it('should apply $fn to multiple subsequent primitives', () => {
      const code = transpile('$fn = 64; sphere(5); cylinder(h=10, r=3);')

      expect(code).toContain('M.Manifold.sphere(5, 64)')
      expect(code).toContain('M.Manifold.cylinder(10, 3, 3, 64, false)')
      assertValidJS(code)
    })

    it('should allow inline $fn to override global', () => {
      const code = transpile('$fn = 64; sphere(r=5, $fn=32);')

      // Inline $fn should override the global setting
      expect(code).toContain('M.Manifold.sphere(5, 32)')
      assertValidJS(code)
    })
  })

  // ============================================================================
  // Output Format Tests
  // ============================================================================

  describe('output format', () => {
    it('should include return statement', () => {
      const code = transpile('cube(10);')

      assertHasReturn(code)
    })

    it('should produce valid JavaScript (parseable by new Function())', () => {
      const code = transpile('cube(10);')

      assertValidJS(code)
    })

    it('should only use M variable (no undefined references)', () => {
      const code = transpile(`
        union() {
          cube(10);
          translate([15,0,0]) sphere(5);
        }
      `)

      assertOnlyUsesM(code)
    })

    it('should produce code that can be executed as a function body', () => {
      const code = transpile('cube(10);')

      // Should be able to create a function from the code
      const fn = new Function('M', code)
      expect(typeof fn).toBe('function')
    })
  })

  // ============================================================================
  // Complex Examples Tests
  // ============================================================================

  describe('complex examples', () => {
    it('should transpile a complete model with multiple operations', () => {
      const code = transpile(`
        $fn = 64;
        difference() {
          union() {
            cube([20, 20, 10], center=true);
            translate([0, 0, 5])
              cylinder(h=10, r=8);
          }
          translate([0, 0, -1])
            cylinder(h=22, r=5);
        }
      `)

      assertValidJS(code)
      assertHasReturn(code)
      expect(code).toContain('M.Manifold.cube')
      expect(code).toContain('M.Manifold.cylinder')
      expect(code).toContain('.translate')
      expect(code).toContain('.subtract(')
    })

    it('should transpile linear_extrude with complex 2D shape', () => {
      const code = transpile(`
        linear_extrude(height=20, twist=90) {
          difference() {
            square([10, 10], center=true);
            circle(r=3);
          }
        }
      `)

      assertValidJS(code)
      assertHasReturn(code)
      expect(code).toContain('M.Manifold.extrude')
    })

    it('should transpile multiple top-level statements', () => {
      const code = transpile(`
        $fn = 32;
        cube(10);
        translate([20, 0, 0]) sphere(5);
        union() {
          cylinder(h=10, r=3);
          cube([5, 5, 10]);
        }
      `)

      assertValidJS(code)
      assertHasReturn(code)
    })
  })

  // ============================================================================
  // Input Format Tests
  // ============================================================================

  describe('input formats', () => {
    it('should accept source string as input', () => {
      const code = transpile('cube(10);')

      expect(typeof code).toBe('string')
      assertValidJS(code)
    })

    it('should accept ProgramNode as input', () => {
      const ast = parse('cube(10);')
      const code = transpile(ast)

      expect(typeof code).toBe('string')
      assertValidJS(code)
    })

    it('should produce identical output for string and AST input', () => {
      const source = 'cube([10,20,30], center=true);'
      const ast = parse(source)

      const codeFromString = transpile(source)
      const codeFromAST = transpile(ast)

      expect(codeFromString).toBe(codeFromAST)
    })
  })

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty union', () => {
      const code = transpile('union() { }')

      // Empty union should produce valid code
      assertValidJS(code)
    })

    it('should handle floating point numbers', () => {
      const code = transpile('cube([1.5, 2.75, 3.125]);')

      expect(code).toContain('[1.5, 2.75, 3.125]')
      assertValidJS(code)
    })

    it('should handle negative numbers', () => {
      const code = transpile('translate([-5, -10, -15]) cube(10);')

      expect(code).toContain('[-5, -10, -15]')
      assertValidJS(code)
    })

    it('should handle multiple transforms on single primitive', () => {
      const code = transpile('translate([1,0,0]) rotate([0,0,45]) scale([2,2,2]) cube(10);')

      assertValidJS(code)
      expect(code).toContain('.translate')
      expect(code).toContain('.rotate')
      expect(code).toContain('.scale')
    })

    it('should handle 2D vector for translate', () => {
      const code = transpile('translate([5, 10]) square(10);')

      // 2D translate should be extended to 3D with z=0
      assertValidJS(code)
    })
  })

  // ============================================================================
  // Memory Management Tests
  // ============================================================================

  describe('memory management', () => {
    it('should generate delete calls for intermediate manifolds', () => {
      const code = transpile('translate([1,2,3]) { cube(10); }')

      // Intermediate manifolds should be deleted
      // The pattern should be: create, transform, delete original
      expect(code).toContain('.delete()')
      assertValidJS(code)
    })

    it('should not delete the final result', () => {
      const code = transpile('cube(10);')

      // The returned manifold should not be deleted
      // Count delete calls vs manifold creations
      const deleteCount = (code.match(/\.delete\(\)/g) || []).length
      const cubeCount = (code.match(/M\.Manifold\.cube/g) || []).length

      // For a simple cube with no transforms, there should be no deletes
      // because the cube is returned directly
      expect(deleteCount).toBeLessThan(cubeCount)
    })

    it('should properly clean up in boolean operations', () => {
      const code = transpile('union() { cube(10); sphere(5); }')

      // Boolean operations should delete the operands after combining
      expect(code).toContain('.delete()')
      assertValidJS(code)
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should propagate parse errors for invalid syntax', () => {
      expect(() => transpile('cube(10')).toThrow()
    })

    it('should handle empty input', () => {
      const code = transpile('')

      // Empty input should produce valid (if minimal) code
      assertValidJS(code)
    })

    it('should handle whitespace-only input', () => {
      const code = transpile('   \n\t  ')

      assertValidJS(code)
    })
  })
})
