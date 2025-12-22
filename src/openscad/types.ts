/**
 * OpenSCAD Transpiler Type Definitions
 *
 * This file contains all type definitions for the OpenSCAD parser and AST.
 * No runtime code - only TypeScript type definitions.
 */

// ============================================================================
// Position and Token Types
// ============================================================================

/**
 * Represents a position in the source code for error reporting
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * Represents a reference to a variable in OpenSCAD.
 * Used to allow parameter values to reference variables instead of being literal values.
 */
export interface VarRef {
  type: 'VarRef';
  name: string;
}

/**
 * Type guard to check if a value is a VarRef
 */
export function isVarRef(value: unknown): value is VarRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'name' in value &&
    (value as Record<string, unknown>).type === 'VarRef' &&
    typeof (value as Record<string, unknown>).name === 'string'
  );
}

/**
 * Token types supported by the OpenSCAD lexer
 */
export type TokenType =
  // Keywords
  | 'MODULE'
  | 'FUNCTION'
  | 'IF'
  | 'ELSE'
  | 'FOR'
  | 'LET'
  | 'EACH'
  | 'TRUE'
  | 'FALSE'
  | 'UNDEF'
  // Primitives (3D)
  | 'CUBE'
  | 'SPHERE'
  | 'CYLINDER'
  | 'POLYHEDRON'
  // Primitives (2D)
  | 'CIRCLE'
  | 'SQUARE'
  | 'POLYGON'
  | 'TEXT'
  // Transforms
  | 'TRANSLATE'
  | 'ROTATE'
  | 'SCALE'
  | 'RESIZE'
  | 'MIRROR'
  | 'MULTMATRIX'
  | 'COLOR'
  | 'OFFSET'
  | 'HULL'
  | 'MINKOWSKI'
  // Boolean operations
  | 'UNION'
  | 'DIFFERENCE'
  | 'INTERSECTION'
  // Extrude operations
  | 'LINEAR_EXTRUDE'
  | 'ROTATE_EXTRUDE'
  // Special variables
  | 'SPECIAL_VAR'  // $fn, $fa, $fs, $t, $vpr, $vpt, $vpd
  // Operators
  | 'PLUS'
  | 'MINUS'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'MODULO'
  | 'POWER'
  | 'EQUAL'
  | 'NOT_EQUAL'
  | 'LESS_THAN'
  | 'GREATER_THAN'
  | 'LESS_EQUAL'
  | 'GREATER_EQUAL'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'TERNARY'
  | 'QUESTION'
  | 'COLON'
  // Delimiters
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'SEMICOLON'
  | 'COMMA'
  | 'ASSIGN'
  | 'DOT'
  // Literals and identifiers
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'STRING'
  // Special tokens
  | 'COMMENT'
  | 'WHITESPACE'
  | 'EOF'
  | 'UNKNOWN';

/**
 * Represents a single token from the lexer
 */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

// ============================================================================
// Named Argument Types for Primitives
// ============================================================================

/**
 * Arguments for cube() primitive
 */
export interface CubeArgs {
  size?: number | [number, number, number];
  center?: boolean;
}

/**
 * Arguments for sphere() primitive
 */
export interface SphereArgs {
  r?: number;
  d?: number;
  $fn?: number;
  $fa?: number;
  $fs?: number;
}

/**
 * Arguments for cylinder() primitive
 */
export interface CylinderArgs {
  h?: number;
  r?: number;
  r1?: number;
  r2?: number;
  d?: number;
  d1?: number;
  d2?: number;
  center?: boolean;
  $fn?: number;
  $fa?: number;
  $fs?: number;
}

/**
 * Arguments for circle() primitive
 */
export interface CircleArgs {
  r?: number;
  d?: number;
  $fn?: number;
  $fa?: number;
  $fs?: number;
}

/**
 * Arguments for square() primitive
 */
export interface SquareArgs {
  size?: number | [number, number];
  center?: boolean;
}

/**
 * Arguments for polygon() primitive
 */
export interface PolygonArgs {
  points?: Array<[number, number]>;
  paths?: number[][];
  convexity?: number;
}

/**
 * Arguments for polyhedron() primitive
 */
export interface PolyhedronArgs {
  points?: Array<[number, number, number]>;
  faces?: number[][];
  triangles?: number[][];
  convexity?: number;
}

/**
 * Arguments for text() primitive
 */
export interface TextArgs {
  text?: string;
  size?: number;
  font?: string;
  halign?: 'left' | 'center' | 'right';
  valign?: 'top' | 'center' | 'baseline' | 'bottom';
  spacing?: number;
  direction?: 'ltr' | 'rtl' | 'ttb' | 'btt';
  language?: string;
  script?: string;
  $fn?: number;
}

/**
 * Arguments for translate() transform
 */
export interface TranslateArgs {
  v: [number, number, number] | [number, number];
}

/**
 * Arguments for rotate() transform
 */
export interface RotateArgs {
  a?: number | [number, number, number];
  v?: [number, number, number];
}

/**
 * Arguments for scale() transform
 */
export interface ScaleArgs {
  v: [number, number, number] | [number, number] | number;
}

/**
 * Arguments for resize() transform
 */
export interface ResizeArgs {
  newsize: [number, number, number] | [number, number];
  auto?: boolean | [boolean, boolean, boolean];
}

/**
 * Arguments for mirror() transform
 */
export interface MirrorArgs {
  v: [number, number, number] | [number, number];
}

/**
 * Arguments for multmatrix() transform
 */
export interface MultmatrixArgs {
  m: number[][];
}

/**
 * Arguments for color() transform
 */
export interface ColorArgs {
  c?: string | [number, number, number] | [number, number, number, number];
  alpha?: number;
}

/**
 * Arguments for offset() transform (2D)
 */
export interface OffsetArgs {
  r?: number;
  delta?: number;
  chamfer?: boolean;
}

/**
 * Arguments for linear_extrude() operation
 */
export interface LinearExtrudeArgs {
  height?: number;
  center?: boolean;
  convexity?: number;
  twist?: number;
  slices?: number;
  scale?: number | [number, number];
  $fn?: number;
}

/**
 * Arguments for rotate_extrude() operation
 */
export interface RotateExtrudeArgs {
  angle?: number;
  convexity?: number;
  $fn?: number;
  $fa?: number;
  $fs?: number;
}

/**
 * Union type of all primitive argument types
 */
export type PrimitiveArgs =
  | CubeArgs
  | SphereArgs
  | CylinderArgs
  | CircleArgs
  | SquareArgs
  | PolygonArgs
  | PolyhedronArgs
  | TextArgs;

/**
 * Union type of all transform argument types
 */
export type TransformArgs =
  | TranslateArgs
  | RotateArgs
  | ScaleArgs
  | ResizeArgs
  | MirrorArgs
  | MultmatrixArgs
  | ColorArgs
  | OffsetArgs;

/**
 * Union type of all extrude argument types
 */
export type ExtrudeArgs =
  | LinearExtrudeArgs
  | RotateExtrudeArgs;

// ============================================================================
// AST Node Types
// ============================================================================

/**
 * Base interface for all AST nodes
 */
export interface BaseASTNode {
  nodeType: string;
  position?: Position;
}

/**
 * Root program node containing all top-level statements
 */
export interface ProgramNode extends BaseASTNode {
  nodeType: 'Program';
  body: ASTNode[];
}

/**
 * Primitive shape call (cube, sphere, cylinder, etc.)
 */
export interface PrimitiveCallNode extends BaseASTNode {
  nodeType: 'PrimitiveCall';
  primitive: 'cube' | 'sphere' | 'cylinder' | 'circle' | 'square' | 'polygon' | 'polyhedron' | 'text';
  args: PrimitiveArgs;
}

/**
 * Transform operation (translate, rotate, scale, etc.)
 */
export interface TransformNode extends BaseASTNode {
  nodeType: 'Transform';
  transform: 'translate' | 'rotate' | 'scale' | 'resize' | 'mirror' | 'multmatrix' | 'color' | 'offset' | 'hull' | 'minkowski';
  args: TransformArgs | Record<string, unknown>;
  children: ASTNode[];
}

/**
 * Boolean operation (union, difference, intersection)
 */
export interface BooleanOpNode extends BaseASTNode {
  nodeType: 'BooleanOp';
  operation: 'union' | 'difference' | 'intersection';
  children: ASTNode[];
}

/**
 * Extrude operation (linear_extrude, rotate_extrude)
 */
export interface ExtrudeNode extends BaseASTNode {
  nodeType: 'Extrude';
  extrude: 'linear_extrude' | 'rotate_extrude';
  args: ExtrudeArgs;
  children: ASTNode[];
}

/**
 * Special variable assignment ($fn, $fa, $fs, etc.)
 */
export interface SpecialVarAssignNode extends BaseASTNode {
  nodeType: 'SpecialVarAssign';
  variable: string;  // $fn, $fa, $fs, $t, $vpr, $vpt, $vpd
  value: number | [number, number, number];
}

/**
 * Represents argument values that can be passed to OpenSCAD functions.
 * Includes literals (numbers, booleans, strings), variable references, and arrays.
 */
export type ArgValue = number | boolean | string | VarRef | ArgValue[];

/**
 * Regular variable assignment (width = 50, dims = [10, 20, 30], etc.)
 * Value is a simple ArgValue type (number, boolean, string, VarRef, or nested arrays)
 */
export type VarAssignValue = ArgValue;

export interface VarAssignNode extends BaseASTNode {
  nodeType: 'VarAssign';
  name: string;
  value: VarAssignValue;
}

/**
 * Module definition
 */
export interface ModuleDefNode extends BaseASTNode {
  nodeType: 'ModuleDef';
  name: string;
  parameters: ParameterNode[];
  body: ASTNode[];
}

/**
 * Module call
 */
export interface ModuleCallNode extends BaseASTNode {
  nodeType: 'ModuleCall';
  name: string;
  args: Record<string, unknown>;
  children: ASTNode[];
}

/**
 * Function definition
 */
export interface FunctionDefNode extends BaseASTNode {
  nodeType: 'FunctionDef';
  name: string;
  parameters: ParameterNode[];
  expression: ExpressionNode;
}

/**
 * Parameter in module/function definition
 */
export interface ParameterNode extends BaseASTNode {
  nodeType: 'Parameter';
  name: string;
  defaultValue?: ExpressionNode;
}

/**
 * Variable assignment
 */
export interface AssignmentNode extends BaseASTNode {
  nodeType: 'Assignment';
  name: string;
  value: ExpressionNode;
}

/**
 * For loop
 */
export interface ForLoopNode extends BaseASTNode {
  nodeType: 'ForLoop';
  iterator: string;
  range: ExpressionNode;
  body: ASTNode[];
}

/**
 * If statement
 */
export interface IfStatementNode extends BaseASTNode {
  nodeType: 'IfStatement';
  condition: ExpressionNode;
  thenBranch: ASTNode[];
  elseBranch?: ASTNode[];
}

/**
 * Expression types
 */
export type ExpressionNode =
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | ArrayLiteralNode
  | IdentifierNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | TernaryExpressionNode
  | FunctionCallNode
  | MemberExpressionNode
  | IndexExpressionNode;

/**
 * Number literal
 */
export interface NumberLiteralNode extends BaseASTNode {
  nodeType: 'NumberLiteral';
  value: number;
}

/**
 * String literal
 */
export interface StringLiteralNode extends BaseASTNode {
  nodeType: 'StringLiteral';
  value: string;
}

/**
 * Boolean literal
 */
export interface BooleanLiteralNode extends BaseASTNode {
  nodeType: 'BooleanLiteral';
  value: boolean;
}

/**
 * Array literal
 */
export interface ArrayLiteralNode extends BaseASTNode {
  nodeType: 'ArrayLiteral';
  elements: ExpressionNode[];
}

/**
 * Identifier reference
 */
export interface IdentifierNode extends BaseASTNode {
  nodeType: 'Identifier';
  name: string;
}

/**
 * Binary expression (arithmetic, comparison, logical)
 */
export interface BinaryExpressionNode extends BaseASTNode {
  nodeType: 'BinaryExpression';
  operator: '+' | '-' | '*' | '/' | '%' | '^' | '==' | '!=' | '<' | '>' | '<=' | '>=' | '&&' | '||';
  left: ExpressionNode;
  right: ExpressionNode;
}

/**
 * Unary expression (negation, logical not)
 */
export interface UnaryExpressionNode extends BaseASTNode {
  nodeType: 'UnaryExpression';
  operator: '-' | '!';
  operand: ExpressionNode;
}

/**
 * Ternary conditional expression
 */
export interface TernaryExpressionNode extends BaseASTNode {
  nodeType: 'TernaryExpression';
  condition: ExpressionNode;
  trueExpr: ExpressionNode;
  falseExpr: ExpressionNode;
}

/**
 * Function call expression
 */
export interface FunctionCallNode extends BaseASTNode {
  nodeType: 'FunctionCall';
  name: string;
  args: Record<string, ExpressionNode>;
}

/**
 * Member access expression (e.g., obj.property)
 */
export interface MemberExpressionNode extends BaseASTNode {
  nodeType: 'MemberExpression';
  object: ExpressionNode;
  property: string;
}

/**
 * Index access expression (e.g., array[index])
 */
export interface IndexExpressionNode extends BaseASTNode {
  nodeType: 'IndexExpression';
  object: ExpressionNode;
  index: ExpressionNode;
}

/**
 * Discriminated union of all AST node types
 */
export type ASTNode =
  | ProgramNode
  | PrimitiveCallNode
  | TransformNode
  | BooleanOpNode
  | ExtrudeNode
  | SpecialVarAssignNode
  | VarAssignNode
  | ModuleDefNode
  | ModuleCallNode
  | FunctionDefNode
  | ParameterNode
  | AssignmentNode
  | ForLoopNode
  | IfStatementNode
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | ArrayLiteralNode
  | IdentifierNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | TernaryExpressionNode
  | FunctionCallNode
  | MemberExpressionNode
  | IndexExpressionNode;
