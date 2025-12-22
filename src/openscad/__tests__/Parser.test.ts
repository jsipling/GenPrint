import { describe, it, expect } from 'vitest'
import { parse } from '../Parser'
import type {
  PrimitiveCallNode,
  TransformNode,
  BooleanOpNode,
  ExtrudeNode,
  SpecialVarAssignNode,
  VarAssignNode,
  CubeArgs,
  SphereArgs,
  CylinderArgs,
  CircleArgs,
  SquareArgs,
  PolygonArgs,
  LinearExtrudeArgs,
  RotateExtrudeArgs,
  TranslateArgs,
  RotateArgs,
} from '../types'
import { OpenSCADParseError } from '../errors'

/**
 * Helper function to assert a node is a PrimitiveCallNode
 */
function assertPrimitive(
  node: unknown,
  primitive: PrimitiveCallNode['primitive']
): asserts node is PrimitiveCallNode {
  expect(node).toBeDefined()
  expect((node as PrimitiveCallNode).nodeType).toBe('PrimitiveCall')
  expect((node as PrimitiveCallNode).primitive).toBe(primitive)
}

/**
 * Helper function to assert a node is a TransformNode
 */
function assertTransform(
  node: unknown,
  transform: TransformNode['transform']
): asserts node is TransformNode {
  expect(node).toBeDefined()
  expect((node as TransformNode).nodeType).toBe('Transform')
  expect((node as TransformNode).transform).toBe(transform)
}

/**
 * Helper function to assert a node is a BooleanOpNode
 */
function assertBooleanOp(
  node: unknown,
  operation: BooleanOpNode['operation']
): asserts node is BooleanOpNode {
  expect(node).toBeDefined()
  expect((node as BooleanOpNode).nodeType).toBe('BooleanOp')
  expect((node as BooleanOpNode).operation).toBe(operation)
}

/**
 * Helper function to assert a node is an ExtrudeNode
 */
function assertExtrude(
  node: unknown,
  extrude: ExtrudeNode['extrude']
): asserts node is ExtrudeNode {
  expect(node).toBeDefined()
  expect((node as ExtrudeNode).nodeType).toBe('Extrude')
  expect((node as ExtrudeNode).extrude).toBe(extrude)
}

/**
 * Helper function to assert a node is a SpecialVarAssignNode
 */
function assertSpecialVarAssign(
  node: unknown,
  variable: string
): asserts node is SpecialVarAssignNode {
  expect(node).toBeDefined()
  expect((node as SpecialVarAssignNode).nodeType).toBe('SpecialVarAssign')
  expect((node as SpecialVarAssignNode).variable).toBe(variable)
}

/**
 * Helper function to assert a node is a VarAssignNode
 */
function assertVarAssign(
  node: unknown,
  name: string
): asserts node is VarAssignNode {
  expect(node).toBeDefined()
  expect((node as VarAssignNode).nodeType).toBe('VarAssign')
  expect((node as VarAssignNode).name).toBe(name)
}

describe('Parser', () => {
  // ============================================================================
  // Basic Program Structure
  // ============================================================================

  describe('basic program structure', () => {
    it('should parse empty input to empty program', () => {
      const result = parse('')
      expect(result.nodeType).toBe('Program')
      expect(result.body).toHaveLength(0)
    })

    it('should parse whitespace-only input to empty program', () => {
      const result = parse('   \n\t  ')
      expect(result.nodeType).toBe('Program')
      expect(result.body).toHaveLength(0)
    })

    it('should parse comment-only input to empty program', () => {
      const result = parse('// just a comment')
      expect(result.nodeType).toBe('Program')
      expect(result.body).toHaveLength(0)
    })
  })

  // ============================================================================
  // Cube Primitive Tests
  // ============================================================================

  describe('cube primitive', () => {
    it('should parse cube([10,20,30]) - positional array argument', () => {
      const result = parse('cube([10,20,30]);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cube')
      const cube = result.body[0] as PrimitiveCallNode
      const args = cube.args as CubeArgs
      expect(args.size).toEqual([10, 20, 30])
    })

    it('should parse cube([10,20,30], center=true) - with named argument', () => {
      const result = parse('cube([10,20,30], center=true);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cube')
      const cube = result.body[0] as PrimitiveCallNode
      const args = cube.args as CubeArgs
      expect(args.size).toEqual([10, 20, 30])
      expect(args.center).toBe(true)
    })

    it('should parse cube(10) - single number shorthand', () => {
      const result = parse('cube(10);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cube')
      const cube = result.body[0] as PrimitiveCallNode
      const args = cube.args as CubeArgs
      expect(args.size).toBe(10)
    })

    it('should parse cube(size=10)', () => {
      const result = parse('cube(size=10);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cube')
      const cube = result.body[0] as PrimitiveCallNode
      const args = cube.args as CubeArgs
      expect(args.size).toBe(10)
    })

    it('should parse cube(size=[5,10,15], center=false)', () => {
      const result = parse('cube(size=[5,10,15], center=false);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cube')
      const cube = result.body[0] as PrimitiveCallNode
      const args = cube.args as CubeArgs
      expect(args.size).toEqual([5, 10, 15])
      expect(args.center).toBe(false)
    })
  })

  // ============================================================================
  // Sphere Primitive Tests
  // ============================================================================

  describe('sphere primitive', () => {
    it('should parse sphere(r=5) - named radius', () => {
      const result = parse('sphere(r=5);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'sphere')
      const sphere = result.body[0] as PrimitiveCallNode
      const args = sphere.args as SphereArgs
      expect(args.r).toBe(5)
    })

    it('should parse sphere(d=10) - diameter (converted to radius)', () => {
      const result = parse('sphere(d=10);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'sphere')
      const sphere = result.body[0] as PrimitiveCallNode
      const args = sphere.args as SphereArgs
      // Parser should either store d or convert to r
      // The acceptance criteria says "converted to radius", so we expect r=5
      expect(args.r).toBe(5)
    })

    it('should parse sphere(5) - positional radius', () => {
      const result = parse('sphere(5);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'sphere')
      const sphere = result.body[0] as PrimitiveCallNode
      const args = sphere.args as SphereArgs
      expect(args.r).toBe(5)
    })

    it('should parse sphere with $fn parameter', () => {
      const result = parse('sphere(r=5, $fn=64);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'sphere')
      const sphere = result.body[0] as PrimitiveCallNode
      const args = sphere.args as SphereArgs
      expect(args.r).toBe(5)
      expect(args.$fn).toBe(64)
    })
  })

  // ============================================================================
  // Cylinder Primitive Tests
  // ============================================================================

  describe('cylinder primitive', () => {
    it('should parse cylinder(h=10, r=5) - basic cylinder', () => {
      const result = parse('cylinder(h=10, r=5);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cylinder')
      const cyl = result.body[0] as PrimitiveCallNode
      const args = cyl.args as CylinderArgs
      expect(args.h).toBe(10)
      expect(args.r).toBe(5)
    })

    it('should parse cylinder(h=10, r1=5, r2=3) - cone', () => {
      const result = parse('cylinder(h=10, r1=5, r2=3);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cylinder')
      const cyl = result.body[0] as PrimitiveCallNode
      const args = cyl.args as CylinderArgs
      expect(args.h).toBe(10)
      expect(args.r1).toBe(5)
      expect(args.r2).toBe(3)
    })

    it('should parse cylinder(h=10, d=10) - diameter form', () => {
      const result = parse('cylinder(h=10, d=10);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cylinder')
      const cyl = result.body[0] as PrimitiveCallNode
      const args = cyl.args as CylinderArgs
      expect(args.h).toBe(10)
      // Diameter should be converted to radius
      expect(args.r).toBe(5)
    })

    it('should parse cylinder(h=10, d1=10, d2=6) - diameter cone form', () => {
      const result = parse('cylinder(h=10, d1=10, d2=6);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cylinder')
      const cyl = result.body[0] as PrimitiveCallNode
      const args = cyl.args as CylinderArgs
      expect(args.h).toBe(10)
      // Diameters should be converted to radii
      expect(args.r1).toBe(5)
      expect(args.r2).toBe(3)
    })

    it('should parse cylinder with center=true', () => {
      const result = parse('cylinder(h=10, r=5, center=true);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cylinder')
      const cyl = result.body[0] as PrimitiveCallNode
      const args = cyl.args as CylinderArgs
      expect(args.center).toBe(true)
    })

    it('should parse cylinder with $fn', () => {
      const result = parse('cylinder(h=10, r=5, $fn=32);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cylinder')
      const cyl = result.body[0] as PrimitiveCallNode
      const args = cyl.args as CylinderArgs
      expect(args.$fn).toBe(32)
    })
  })

  // ============================================================================
  // 2D Primitive Tests
  // ============================================================================

  describe('2D primitives', () => {
    it('should parse circle(r=5)', () => {
      const result = parse('circle(r=5);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'circle')
      const circle = result.body[0] as PrimitiveCallNode
      const args = circle.args as CircleArgs
      expect(args.r).toBe(5)
    })

    it('should parse circle(d=10) - diameter form', () => {
      const result = parse('circle(d=10);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'circle')
      const circle = result.body[0] as PrimitiveCallNode
      const args = circle.args as CircleArgs
      // Diameter should be converted to radius
      expect(args.r).toBe(5)
    })

    it('should parse circle(5) - positional radius', () => {
      const result = parse('circle(5);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'circle')
      const circle = result.body[0] as PrimitiveCallNode
      const args = circle.args as CircleArgs
      expect(args.r).toBe(5)
    })

    it('should parse square([10,20])', () => {
      const result = parse('square([10,20]);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'square')
      const square = result.body[0] as PrimitiveCallNode
      const args = square.args as SquareArgs
      expect(args.size).toEqual([10, 20])
    })

    it('should parse square(10) - single number shorthand', () => {
      const result = parse('square(10);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'square')
      const square = result.body[0] as PrimitiveCallNode
      const args = square.args as SquareArgs
      expect(args.size).toBe(10)
    })

    it('should parse square([10,20], center=true)', () => {
      const result = parse('square([10,20], center=true);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'square')
      const square = result.body[0] as PrimitiveCallNode
      const args = square.args as SquareArgs
      expect(args.size).toEqual([10, 20])
      expect(args.center).toBe(true)
    })

    it('should parse polygon(points=[[0,0],[10,0],[5,10]])', () => {
      const result = parse('polygon(points=[[0,0],[10,0],[5,10]]);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'polygon')
      const polygon = result.body[0] as PrimitiveCallNode
      const args = polygon.args as PolygonArgs
      expect(args.points).toEqual([
        [0, 0],
        [10, 0],
        [5, 10],
      ])
    })

    it('should parse polygon with positional points', () => {
      const result = parse('polygon([[0,0],[10,0],[5,10]]);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'polygon')
      const polygon = result.body[0] as PrimitiveCallNode
      const args = polygon.args as PolygonArgs
      expect(args.points).toEqual([
        [0, 0],
        [10, 0],
        [5, 10],
      ])
    })

    it('should parse polygon with paths', () => {
      const result = parse('polygon(points=[[0,0],[10,0],[10,10],[0,10]], paths=[[0,1,2,3]]);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'polygon')
      const polygon = result.body[0] as PrimitiveCallNode
      const args = polygon.args as PolygonArgs
      expect(args.points).toEqual([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ])
      expect(args.paths).toEqual([[0, 1, 2, 3]])
    })
  })

  // ============================================================================
  // Transform Tests
  // ============================================================================

  describe('transforms', () => {
    it('should parse translate([1,2,3]) { cube([10,10,10]); }', () => {
      const result = parse('translate([1,2,3]) { cube([10,10,10]); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'translate')
      const translate = result.body[0] as TransformNode
      const args = translate.args as TranslateArgs
      expect(args.v).toEqual([1, 2, 3])
      expect(translate.children).toHaveLength(1)
      assertPrimitive(translate.children[0], 'cube')
    })

    it('should parse translate with v= named argument', () => {
      const result = parse('translate(v=[1,2,3]) { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'translate')
      const translate = result.body[0] as TransformNode
      const args = translate.args as TranslateArgs
      expect(args.v).toEqual([1, 2, 3])
    })

    it('should parse chained transforms: translate(...) rotate(...) { ... }', () => {
      const result = parse('translate([1,2,3]) rotate([45,0,0]) { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'translate')
      const translate = result.body[0] as TransformNode
      expect(translate.children).toHaveLength(1)
      assertTransform(translate.children[0], 'rotate')
      const rotate = translate.children[0] as TransformNode
      const rotateArgs = rotate.args as RotateArgs
      expect(rotateArgs.a).toEqual([45, 0, 0])
      expect(rotate.children).toHaveLength(1)
      assertPrimitive(rotate.children[0], 'cube')
    })

    it('should parse translate with single child (no braces)', () => {
      const result = parse('translate([1,2,3]) cube(10);')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'translate')
      const translate = result.body[0] as TransformNode
      expect(translate.children).toHaveLength(1)
      assertPrimitive(translate.children[0], 'cube')
    })

    it('should parse rotate with angle', () => {
      const result = parse('rotate(45) { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'rotate')
      const rotate = result.body[0] as TransformNode
      const args = rotate.args as RotateArgs
      expect(args.a).toBe(45)
    })

    it('should parse rotate with angle and vector', () => {
      const result = parse('rotate(a=45, v=[0,0,1]) { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'rotate')
      const rotate = result.body[0] as TransformNode
      const args = rotate.args as RotateArgs
      expect(args.a).toBe(45)
      expect(args.v).toEqual([0, 0, 1])
    })

    it('should parse scale transform', () => {
      const result = parse('scale([2,2,2]) { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'scale')
    })

    it('should parse mirror transform', () => {
      const result = parse('mirror([1,0,0]) { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'mirror')
    })

    it('should parse color transform with string', () => {
      const result = parse('color("red") { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'color')
    })

    it('should parse color transform with RGB array', () => {
      const result = parse('color([1,0,0]) { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'color')
    })
  })

  // ============================================================================
  // Boolean Operation Tests
  // ============================================================================

  describe('boolean operations', () => {
    it('should parse union() { cube(...); sphere(...); }', () => {
      const result = parse('union() { cube(10); sphere(5); }')
      expect(result.body).toHaveLength(1)
      assertBooleanOp(result.body[0], 'union')
      const union = result.body[0] as BooleanOpNode
      expect(union.children).toHaveLength(2)
      assertPrimitive(union.children[0], 'cube')
      assertPrimitive(union.children[1], 'sphere')
    })

    it('should parse difference() { ... } with multiple children', () => {
      const result = parse('difference() { cube(20); sphere(12); cylinder(h=30, r=5); }')
      expect(result.body).toHaveLength(1)
      assertBooleanOp(result.body[0], 'difference')
      const diff = result.body[0] as BooleanOpNode
      expect(diff.children).toHaveLength(3)
      assertPrimitive(diff.children[0], 'cube')
      assertPrimitive(diff.children[1], 'sphere')
      assertPrimitive(diff.children[2], 'cylinder')
    })

    it('should parse intersection()', () => {
      const result = parse('intersection() { cube(10); sphere(7); }')
      expect(result.body).toHaveLength(1)
      assertBooleanOp(result.body[0], 'intersection')
      const intersection = result.body[0] as BooleanOpNode
      expect(intersection.children).toHaveLength(2)
    })

    it('should parse nested booleans: union() { difference() { ... } ... }', () => {
      const result = parse('union() { difference() { cube(20); sphere(12); } cylinder(h=30, r=5); }')
      expect(result.body).toHaveLength(1)
      assertBooleanOp(result.body[0], 'union')
      const union = result.body[0] as BooleanOpNode
      expect(union.children).toHaveLength(2)
      assertBooleanOp(union.children[0], 'difference')
      assertPrimitive(union.children[1], 'cylinder')
      const diff = union.children[0] as BooleanOpNode
      expect(diff.children).toHaveLength(2)
      assertPrimitive(diff.children[0], 'cube')
      assertPrimitive(diff.children[1], 'sphere')
    })

    it('should parse deeply nested booleans', () => {
      const result = parse(`
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
      expect(result.body).toHaveLength(1)
      assertBooleanOp(result.body[0], 'difference')
      const diff = result.body[0] as BooleanOpNode
      expect(diff.children).toHaveLength(2)
      assertBooleanOp(diff.children[0], 'union')
      assertTransform(diff.children[1], 'translate')
    })
  })

  // ============================================================================
  // Extrusion Tests
  // ============================================================================

  describe('extrusions', () => {
    it('should parse linear_extrude(height=10) { square([5,5]); }', () => {
      const result = parse('linear_extrude(height=10) { square([5,5]); }')
      expect(result.body).toHaveLength(1)
      assertExtrude(result.body[0], 'linear_extrude')
      const extrude = result.body[0] as ExtrudeNode
      const args = extrude.args as LinearExtrudeArgs
      expect(args.height).toBe(10)
      expect(extrude.children).toHaveLength(1)
      assertPrimitive(extrude.children[0], 'square')
    })

    it('should parse linear_extrude(height=10, twist=45, scale=0.5)', () => {
      const result = parse('linear_extrude(height=10, twist=45, scale=0.5) { circle(5); }')
      expect(result.body).toHaveLength(1)
      assertExtrude(result.body[0], 'linear_extrude')
      const extrude = result.body[0] as ExtrudeNode
      const args = extrude.args as LinearExtrudeArgs
      expect(args.height).toBe(10)
      expect(args.twist).toBe(45)
      expect(args.scale).toBe(0.5)
    })

    it('should parse linear_extrude with positional height', () => {
      const result = parse('linear_extrude(10) { square(5); }')
      expect(result.body).toHaveLength(1)
      assertExtrude(result.body[0], 'linear_extrude')
      const extrude = result.body[0] as ExtrudeNode
      const args = extrude.args as LinearExtrudeArgs
      expect(args.height).toBe(10)
    })

    it('should parse linear_extrude with center', () => {
      const result = parse('linear_extrude(height=10, center=true) { square(5); }')
      expect(result.body).toHaveLength(1)
      assertExtrude(result.body[0], 'linear_extrude')
      const extrude = result.body[0] as ExtrudeNode
      const args = extrude.args as LinearExtrudeArgs
      expect(args.center).toBe(true)
    })

    it('should parse rotate_extrude(angle=360, $fn=64)', () => {
      const result = parse('rotate_extrude(angle=360, $fn=64) { square([5,10]); }')
      expect(result.body).toHaveLength(1)
      assertExtrude(result.body[0], 'rotate_extrude')
      const extrude = result.body[0] as ExtrudeNode
      const args = extrude.args as RotateExtrudeArgs
      expect(args.angle).toBe(360)
      expect(args.$fn).toBe(64)
    })

    it('should parse rotate_extrude() with no arguments', () => {
      const result = parse('rotate_extrude() { circle(5); }')
      expect(result.body).toHaveLength(1)
      assertExtrude(result.body[0], 'rotate_extrude')
    })

    it('should parse linear_extrude with single child (no braces)', () => {
      const result = parse('linear_extrude(10) circle(5);')
      expect(result.body).toHaveLength(1)
      assertExtrude(result.body[0], 'linear_extrude')
      const extrude = result.body[0] as ExtrudeNode
      expect(extrude.children).toHaveLength(1)
      assertPrimitive(extrude.children[0], 'circle')
    })
  })

  // ============================================================================
  // Special Variable Assignment Tests
  // ============================================================================

  describe('special variable assignments', () => {
    it('should parse $fn = 32;', () => {
      const result = parse('$fn = 32;')
      expect(result.body).toHaveLength(1)
      assertSpecialVarAssign(result.body[0], '$fn')
      const assign = result.body[0] as SpecialVarAssignNode
      expect(assign.value).toBe(32)
    })

    it('should parse $fa = 1;', () => {
      const result = parse('$fa = 1;')
      expect(result.body).toHaveLength(1)
      assertSpecialVarAssign(result.body[0], '$fa')
      const assign = result.body[0] as SpecialVarAssignNode
      expect(assign.value).toBe(1)
    })

    it('should parse $fs = 0.5;', () => {
      const result = parse('$fs = 0.5;')
      expect(result.body).toHaveLength(1)
      assertSpecialVarAssign(result.body[0], '$fs')
      const assign = result.body[0] as SpecialVarAssignNode
      expect(assign.value).toBe(0.5)
    })

    it('should parse special variable followed by primitives', () => {
      const result = parse('$fn = 64; sphere(10);')
      expect(result.body).toHaveLength(2)
      assertSpecialVarAssign(result.body[0], '$fn')
      assertPrimitive(result.body[1], 'sphere')
    })
  })

  // ============================================================================
  // Variable Assignment Tests
  // ============================================================================

  describe('variable assignments', () => {
    it('should parse width = 50; producing VarAssignNode with name=width, value=50', () => {
      const result = parse('width = 50;')
      expect(result.body).toHaveLength(1)
      assertVarAssign(result.body[0], 'width')
      const assign = result.body[0] as VarAssignNode
      expect(assign.value).toBe(50)
    })

    it('should parse two variable assignments: width = 50; height = 30;', () => {
      const result = parse('width = 50;\nheight = 30;')
      expect(result.body).toHaveLength(2)
      assertVarAssign(result.body[0], 'width')
      assertVarAssign(result.body[1], 'height')
      const width = result.body[0] as VarAssignNode
      const height = result.body[1] as VarAssignNode
      expect(width.value).toBe(50)
      expect(height.value).toBe(30)
    })

    it('should parse dims = [10, 20, 30]; producing VarAssignNode with array value', () => {
      const result = parse('dims = [10, 20, 30];')
      expect(result.body).toHaveLength(1)
      assertVarAssign(result.body[0], 'dims')
      const assign = result.body[0] as VarAssignNode
      expect(assign.value).toEqual([10, 20, 30])
    })

    it('should parse centered = true; producing VarAssignNode with boolean value', () => {
      const result = parse('centered = true;')
      expect(result.body).toHaveLength(1)
      assertVarAssign(result.body[0], 'centered')
      const assign = result.body[0] as VarAssignNode
      expect(assign.value).toBe(true)
    })

    it('should parse centered = false; producing VarAssignNode with boolean value', () => {
      const result = parse('centered = false;')
      expect(result.body).toHaveLength(1)
      assertVarAssign(result.body[0], 'centered')
      const assign = result.body[0] as VarAssignNode
      expect(assign.value).toBe(false)
    })

    it('should parse name = "box"; producing VarAssignNode with string value', () => {
      const result = parse('name = "box";')
      expect(result.body).toHaveLength(1)
      assertVarAssign(result.body[0], 'name')
      const assign = result.body[0] as VarAssignNode
      expect(assign.value).toBe('box')
    })

    it('should parse variable assignment followed by primitive: width = 50; cube(10);', () => {
      const result = parse('width = 50;\ncube(10);')
      expect(result.body).toHaveLength(2)
      assertVarAssign(result.body[0], 'width')
      assertPrimitive(result.body[1], 'cube')
      const assign = result.body[0] as VarAssignNode
      expect(assign.value).toBe(50)
    })

    it('should track position on VarAssignNode', () => {
      const result = parse('width = 50;')
      expect(result.body[0]!.position).toBeDefined()
      expect(result.body[0]!.position?.line).toBe(1)
      expect(result.body[0]!.position?.column).toBe(1)
    })

    it('should track position on VarAssignNode on later lines', () => {
      const result = parse('\n\nwidth = 50;')
      expect(result.body[0]!.position).toBeDefined()
      expect(result.body[0]!.position?.line).toBe(3)
      expect(result.body[0]!.position?.column).toBe(1)
    })

    it('should parse negative number values', () => {
      const result = parse('my_offset = -10;')
      expect(result.body).toHaveLength(1)
      assertVarAssign(result.body[0], 'my_offset')
      const assign = result.body[0] as VarAssignNode
      expect(assign.value).toBe(-10)
    })

    it('should parse floating point values', () => {
      const result = parse('scale_factor = 0.5;')
      expect(result.body).toHaveLength(1)
      assertVarAssign(result.body[0], 'scale_factor')
      const assign = result.body[0] as VarAssignNode
      expect(assign.value).toBe(0.5)
    })

    it('should parse nested arrays', () => {
      const result = parse('points = [[0, 0], [10, 0], [5, 10]];')
      expect(result.body).toHaveLength(1)
      assertVarAssign(result.body[0], 'points')
      const assign = result.body[0] as VarAssignNode
      expect(assign.value).toEqual([[0, 0], [10, 0], [5, 10]])
    })
  })

  // ============================================================================
  // Semicolon Handling Tests
  // ============================================================================

  describe('semicolon handling', () => {
    it('should require semicolon after primitives', () => {
      expect(() => parse('cube(10) sphere(5);')).toThrow(OpenSCADParseError)
    })

    it('should parse semicolon after primitive', () => {
      const result = parse('cube(10);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cube')
    })

    it('should allow optional semicolon after block-style boolean', () => {
      const result = parse('union() { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertBooleanOp(result.body[0], 'union')
    })

    it('should allow semicolon after block-style boolean', () => {
      const result = parse('union() { cube(10); };')
      expect(result.body).toHaveLength(1)
      assertBooleanOp(result.body[0], 'union')
    })

    it('should allow optional semicolon after transform with block', () => {
      const result = parse('translate([1,2,3]) { cube(10); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'translate')
    })

    it('should require semicolon after transform with single child', () => {
      expect(() => parse('translate([1,2,3]) cube(10) sphere(5);')).toThrow(OpenSCADParseError)
    })

    it('should parse multiple primitives with semicolons', () => {
      const result = parse('cube(10); sphere(5); cylinder(h=10, r=5);')
      expect(result.body).toHaveLength(3)
      assertPrimitive(result.body[0], 'cube')
      assertPrimitive(result.body[1], 'sphere')
      assertPrimitive(result.body[2], 'cylinder')
    })
  })

  // ============================================================================
  // Unsupported Feature Error Tests
  // ============================================================================

  describe('unsupported features', () => {
    it('should throw error for unsupported for loop with position info', () => {
      try {
        parse('for (i = [0:10]) cube(i);')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.line).toBe(1)
        expect(error.column).toBe(1)
        expect(error.message).toContain('for')
      }
    })

    it('should throw error for unsupported if statement with position info', () => {
      try {
        parse('if (x > 0) cube(x);')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.line).toBe(1)
        expect(error.column).toBe(1)
        expect(error.message).toContain('if')
      }
    })

    it('should throw error for unsupported module definition', () => {
      try {
        parse('module myShape() { cube(10); }')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.line).toBe(1)
        expect(error.column).toBe(1)
        expect(error.message).toContain('module')
      }
    }
    )

    // Note: variable assignment is now supported - see 'variable assignments' test section

    it('should throw error for unsupported function definition', () => {
      try {
        parse('function double(x) = x * 2;')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.message).toContain('function')
      }
    })

    it('should report correct position for unsupported feature on line 2', () => {
      try {
        parse('cube(10);\nfor (i = [0:5]) sphere(i);')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.line).toBe(2)
        expect(error.column).toBe(1)
      }
    })
  })

  // ============================================================================
  // Syntax Error Tests
  // ============================================================================

  describe('syntax errors', () => {
    it('should throw error for missing closing brace with position', () => {
      try {
        parse('union() { cube(10);')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.line).toBeGreaterThan(0)
        expect(error.column).toBeGreaterThan(0)
        expect(error.expected).toBeDefined()
        expect(error.expected.length).toBeGreaterThan(0)
      }
    })

    it('should throw error for missing closing parenthesis with position', () => {
      try {
        parse('cube(10;')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.line).toBeGreaterThan(0)
        expect(error.column).toBeGreaterThan(0)
        expect(error.expected).toBeDefined()
      }
    })

    it('should throw error for missing closing bracket with position', () => {
      try {
        parse('cube([10,20,30;')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.line).toBeGreaterThan(0)
        expect(error.column).toBeGreaterThan(0)
      }
    })

    it('should provide helpful token description in expected field', () => {
      try {
        parse('cube(10;')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        // The expected field should contain helpful descriptions, not just raw token names
        // Examples of good: ")", "closing parenthesis", ","
        // Examples of bad: "RPAREN", "COMMA" (raw token types)
        expect(error.expected).toBeDefined()
        expect(Array.isArray(error.expected)).toBe(true)
        // At minimum, expected should contain something that helps the user
        expect(error.expected.some((exp) => exp.includes(')') || exp.includes('parenthesis') || exp.includes(','))).toBe(true)
      }
    })

    it('should throw error for unexpected token', () => {
      try {
        parse('cube 10;')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.found).toBeDefined()
      }
    })

    it('should throw error for invalid argument syntax', () => {
      try {
        parse('cube(size = = 10);')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
      }
    })

    it('should include found token in error', () => {
      try {
        parse('cube(;')
        expect.fail('Expected OpenSCADParseError to be thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(OpenSCADParseError)
        const error = e as OpenSCADParseError
        expect(error.found).toBe(';')
      }
    })
  })

  // ============================================================================
  // Position Tracking Tests
  // ============================================================================

  describe('position tracking', () => {
    it('should track position for primitives', () => {
      const result = parse('cube(10);')
      expect(result.body[0]!.position).toBeDefined()
      expect(result.body[0]!.position?.line).toBe(1)
      expect(result.body[0]!.position?.column).toBe(1)
    })

    it('should track position for primitives on later lines', () => {
      const result = parse('\n\ncube(10);')
      expect(result.body[0]!.position).toBeDefined()
      expect(result.body[0]!.position?.line).toBe(3)
      expect(result.body[0]!.position?.column).toBe(1)
    })

    it('should track position for transforms', () => {
      const result = parse('translate([1,2,3]) { cube(10); }')
      expect(result.body[0]!.position).toBeDefined()
      expect(result.body[0]!.position?.line).toBe(1)
      expect(result.body[0]!.position?.column).toBe(1)
    })

    it('should track position for boolean operations', () => {
      const result = parse('  union() { cube(10); }')
      expect(result.body[0]!.position).toBeDefined()
      expect(result.body[0]!.position?.line).toBe(1)
      expect(result.body[0]!.position?.column).toBe(3)
    })

    it('should track position for extrusions', () => {
      const result = parse('linear_extrude(10) { circle(5); }')
      expect(result.body[0]!.position).toBeDefined()
      expect(result.body[0]!.position?.line).toBe(1)
      expect(result.body[0]!.position?.column).toBe(1)
    })
  })

  // ============================================================================
  // Complex Examples Tests
  // ============================================================================

  describe('complex examples', () => {
    it('should parse a complete model with multiple operations', () => {
      const code = `
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
      `
      const result = parse(code)
      expect(result.body).toHaveLength(2)
      assertSpecialVarAssign(result.body[0], '$fn')
      assertBooleanOp(result.body[1], 'difference')
    })

    it('should parse linear_extrude with complex 2D shape', () => {
      const code = `
        linear_extrude(height=20, twist=90, scale=0.5) {
          difference() {
            square([10, 10], center=true);
            circle(r=3);
          }
        }
      `
      const result = parse(code)
      expect(result.body).toHaveLength(1)
      assertExtrude(result.body[0], 'linear_extrude')
      const extrude = result.body[0] as ExtrudeNode
      expect(extrude.children).toHaveLength(1)
      assertBooleanOp(extrude.children[0], 'difference')
    })

    it('should parse multiple top-level statements', () => {
      const code = `
        $fn = 32;
        cube(10);
        translate([20, 0, 0]) sphere(5);
        union() {
          cylinder(h=10, r=3);
          cube([5, 5, 10]);
        }
      `
      const result = parse(code)
      expect(result.body).toHaveLength(4)
      assertSpecialVarAssign(result.body[0], '$fn')
      assertPrimitive(result.body[1], 'cube')
      assertTransform(result.body[2], 'translate')
      assertBooleanOp(result.body[3], 'union')
    })

    it('should parse hull transform', () => {
      const result = parse('hull() { sphere(5); translate([10,0,0]) sphere(5); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'hull')
      const hull = result.body[0] as TransformNode
      expect(hull.children).toHaveLength(2)
    })

    it('should parse minkowski transform', () => {
      const result = parse('minkowski() { cube(10); sphere(1); }')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'minkowski')
      const minkowski = result.body[0] as TransformNode
      expect(minkowski.children).toHaveLength(2)
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle floating point numbers', () => {
      const result = parse('cube([1.5, 2.75, 3.125]);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cube')
      const cube = result.body[0] as PrimitiveCallNode
      const args = cube.args as CubeArgs
      expect(args.size).toEqual([1.5, 2.75, 3.125])
    })

    it('should handle negative numbers', () => {
      const result = parse('translate([-5, -10, -15]) cube(10);')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'translate')
      const translate = result.body[0] as TransformNode
      const args = translate.args as TranslateArgs
      expect(args.v).toEqual([-5, -10, -15])
    })

    it('should handle scientific notation', () => {
      const result = parse('sphere(r=1e-3);')
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'sphere')
      const sphere = result.body[0] as PrimitiveCallNode
      const args = sphere.args as SphereArgs
      expect(args.r).toBe(0.001)
    })

    it('should handle comments between statements', () => {
      const code = `
        cube(10); // this is a cube
        /* a sphere */
        sphere(5);
      `
      const result = parse(code)
      expect(result.body).toHaveLength(2)
      assertPrimitive(result.body[0], 'cube')
      assertPrimitive(result.body[1], 'sphere')
    })

    it('should handle empty blocks', () => {
      const result = parse('union() { }')
      expect(result.body).toHaveLength(1)
      assertBooleanOp(result.body[0], 'union')
      const union = result.body[0] as BooleanOpNode
      expect(union.children).toHaveLength(0)
    })

    it('should handle 2D vectors for translate', () => {
      const result = parse('translate([5, 10]) square(10);')
      expect(result.body).toHaveLength(1)
      assertTransform(result.body[0], 'translate')
      const translate = result.body[0] as TransformNode
      const args = translate.args as TranslateArgs
      expect(args.v).toEqual([5, 10])
    })

    it('should handle whitespace-heavy input', () => {
      const result = parse(`
        cube  (
          [  10  ,  20  ,  30  ]
        )  ;
      `)
      expect(result.body).toHaveLength(1)
      assertPrimitive(result.body[0], 'cube')
      const cube = result.body[0] as PrimitiveCallNode
      const args = cube.args as CubeArgs
      expect(args.size).toEqual([10, 20, 30])
    })
  })
})
