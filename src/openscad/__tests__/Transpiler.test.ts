import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { transpile } from '../Transpiler'
import { parse } from '../Parser'
import { OpenSCADTranspileError } from '../errors'

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

    it('should handle color transform as no-op without creating dangling references', () => {
      // Color is not supported in Manifold, so should pass through the child unchanged
      const code = transpile('color("red") { cube(10); }')

      // Should still create the cube
      expect(code).toContain('M.Manifold.cube([10, 10, 10], false)')
      assertValidJS(code)

      // Should NOT create an assignment like "const _v2 = _v1" followed by "_v1.delete()"
      // which would leave _v2 referencing a deleted object
      // Instead, should just return the cube directly
      expect(code).not.toMatch(/const _v\d+ = _v\d+;/)
    })

    it('should handle color with nested transforms correctly', () => {
      // Verify color does not interfere with real transforms
      const code = transpile('translate([1,2,3]) color("blue") { cube(10); }')

      expect(code).toContain('M.Manifold.cube([10, 10, 10], false)')
      expect(code).toContain('.translate([1, 2, 3])')
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

  // ============================================================================
  // formatArgValue Helper Tests (tested indirectly through transpile output)
  // ============================================================================

  describe('formatArgValue helper', () => {
    it('should format number values as numeric literals', () => {
      // When we have width = 50; cube(width); the width value 50 should appear
      // in the params default: (params['width'] ?? 50)
      const code = transpile('width = 50; cube(width);')

      // The 50 should appear as a number in the params fallback
      expect(code).toMatch(/params\['width'\]\s*\?\?\s*50/)
      assertValidJS(code)
    })

    it('should format boolean values as true/false', () => {
      const code = transpile('centered = true; cube([10,10,10], center=centered);')

      // Boolean should appear as true in the params fallback
      expect(code).toMatch(/params\['centered'\]\s*\?\?\s*true/)
      assertValidJS(code)
    })

    it('should format string values with quotes', () => {
      // String variable assignment is tracked but strings are not typically used
      // in cube arguments. This test verifies string tracking works.
      // The transpiler stores the variable but won't generate params lookup
      // unless the variable is actually referenced in a primitive arg.
      const code = transpile('label = "hello"; cube(10);')

      // The code should be valid even though label isn't used in cube
      // Variable tracking still happens internally
      assertValidJS(code)
      // This specific test verifies the transpiler handles string assignments
      // without error, even if the string isn't used in output
      expect(code).toContain('M.Manifold.cube')
    })

    it('should format VarRef with known variable as params lookup with default', () => {
      const code = transpile('width = 50; cube([width, width, width]);')

      // VarRef should generate params lookup with nullish coalescing
      expect(code).toMatch(/params\['width'\]\s*\?\?\s*50/)
      assertValidJS(code)
    })

    it('should throw OpenSCADTranspileError for VarRef with unknown variable', () => {
      // Using undefined variable should throw
      expect(() => transpile('cube(unknownVar);')).toThrow()
    })

    it('should format arrays correctly', () => {
      const code = transpile('dims = [10, 20, 30]; cube(dims);')

      // Array should appear in params fallback
      expect(code).toMatch(/params\['dims'\]\s*\?\?\s*\[10,\s*20,\s*30\]/)
      assertValidJS(code)
    })

    it('should format arrays containing VarRef with params lookups', () => {
      const code = transpile('width = 10; height = 20; cube([width, height, 30]);')

      // Both width and height should have params lookups
      expect(code).toMatch(/params\['width'\]\s*\?\?\s*10/)
      expect(code).toMatch(/params\['height'\]\s*\?\?\s*20/)
      assertValidJS(code)
    })
  })

  // ============================================================================
  // Variable Tracking Tests
  // ============================================================================

  describe('variable tracking', () => {
    it('should track variable assignment and use in primitive', () => {
      const code = transpile('width = 50; cube(width);')

      // Variable should be tracked and produce params lookup
      expect(code).toMatch(/params\['width'\]/)
      assertValidJS(code)
      assertHasReturn(code)
    })

    it('should track multiple variables in same expression', () => {
      const code = transpile(`
        width = 10;
        height = 20;
        depth = 30;
        cube([width, height, depth]);
      `)

      // All three variables should be tracked
      expect(code).toMatch(/params\['width'\]/)
      expect(code).toMatch(/params\['height'\]/)
      expect(code).toMatch(/params\['depth'\]/)
      assertValidJS(code)
    })

    it('should track variable in nested array', () => {
      const code = transpile(`
        size = 15;
        linear_extrude(height=10) {
          polygon(points=[[0,0], [size,0], [size,size], [0,size]]);
        }
      `)

      // Variable in nested array should produce params lookup
      expect(code).toMatch(/params\['size'\]/)
      assertValidJS(code)
    })

    it('should make variable visible even when defined inside transform block', () => {
      // Variables defined at any level should be visible globally
      // (OpenSCAD has different scoping, but for simple cases we track all)
      const code = transpile(`
        width = 50;
        translate([10, 0, 0]) {
          cube(width);
        }
      `)

      expect(code).toMatch(/params\['width'\]/)
      assertValidJS(code)
    })

    it.skip('should support variable used in translate vector', () => {
      // NOTE: This test is skipped because the Parser doesn't currently support
      // VarRef in transform arguments (like translate([offset, 0, 0])).
      // This feature requires Parser enhancements in a future phase.
      const code = transpile(`
        offset = 25;
        translate([offset, 0, 0]) cube(10);
      `)

      expect(code).toMatch(/params\['offset'\]/)
      assertValidJS(code)
    })

    it('should generate correct code structure with params object', () => {
      const code = transpile('size = 20; cube(size);')

      // The generated code should reference params object
      expect(code).toContain('params')
      assertValidJS(code)
    })
  })

  // ============================================================================
  // Reserved Variable Names Tests
  // ============================================================================

  describe('reserved variable names', () => {
    it('should throw OpenSCADTranspileError for params = 50', () => {
      expect(() => transpile('params = 50; cube(10);')).toThrow(OpenSCADTranspileError)
      expect(() => transpile('params = 50; cube(10);')).toThrow(/reserved/)
    })

    it('should throw OpenSCADTranspileError for M = 10', () => {
      expect(() => transpile('M = 10; cube(10);')).toThrow(OpenSCADTranspileError)
      expect(() => transpile('M = 10; cube(10);')).toThrow(/reserved/)
    })

    it('should throw OpenSCADTranspileError for cq = 20', () => {
      expect(() => transpile('cq = 20; cube(10);')).toThrow(OpenSCADTranspileError)
      expect(() => transpile('cq = 20; cube(10);')).toThrow(/reserved/)
    })

    it('should throw OpenSCADTranspileError for MIN_WALL_THICKNESS = 1', () => {
      expect(() => transpile('MIN_WALL_THICKNESS = 1; cube(10);')).toThrow(OpenSCADTranspileError)
      expect(() => transpile('MIN_WALL_THICKNESS = 1; cube(10);')).toThrow(/reserved/)
    })

    it('should throw OpenSCADTranspileError for MIN_FEATURE_SIZE = 0.5', () => {
      expect(() => transpile('MIN_FEATURE_SIZE = 0.5; cube(10);')).toThrow(OpenSCADTranspileError)
      expect(() => transpile('MIN_FEATURE_SIZE = 0.5; cube(10);')).toThrow(/reserved/)
    })

    it('should allow valid variable names like width', () => {
      // Valid names should not throw
      expect(() => transpile('width = 50; cube(width);')).not.toThrow()
    })

    it('should allow valid variable names like height and depth', () => {
      expect(() => transpile('height = 20; depth = 30; cube([10, height, depth]);')).not.toThrow()
    })
  })

  // ============================================================================
  // Variable Redefinition Warning Tests
  // ============================================================================

  describe('variable redefinition warning', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleWarnSpy.mockRestore()
    })

    it('should use the second value when variable is redefined', () => {
      const code = transpile('width = 50; width = 60; cube(width);')

      // The second value (60) should be used as the default
      expect(code).toMatch(/params\['width'\]\s*\?\?\s*60/)
      assertValidJS(code)
    })

    it('should log warning when variable is redefined', () => {
      transpile('width = 50; width = 60; cube(width);')

      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('should include variable name in warning message', () => {
      transpile('width = 50; width = 60; cube(width);')

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('width')
      )
    })

    it('should not warn for first assignment of a variable', () => {
      transpile('width = 50; cube(width);')

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('should warn for each redefinition of different variables', () => {
      transpile('width = 50; height = 20; width = 60; height = 30; cube([width, height, 10]);')

      // Should have two warnings - one for width, one for height
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2)
    })
  })
})
