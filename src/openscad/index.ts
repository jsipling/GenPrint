/**
 * OpenSCAD Transpiler - Public API
 *
 * This module exports the public API for transpiling OpenSCAD code to
 * JavaScript code that uses the Manifold API.
 *
 * @example
 * ```typescript
 * import { transpileOpenSCAD, parse, OpenSCADParseError, TranspileOptions } from './openscad'
 *
 * // Basic usage
 * const jsCode = transpileOpenSCAD('cube([10, 10, 10]);')
 *
 * // With options
 * const jsCode = transpileOpenSCAD('sphere(5);', { defaultFn: 64 })
 *
 * // Advanced: parse only
 * const ast = parse('cube(10);')
 * ```
 */

// Main transpiler function
export { transpileOpenSCAD } from './Transpiler'
export type { TranspileOptions } from './Transpiler'

// Parser for advanced usage
export { parse } from './Parser'

// Error types
export {
  OpenSCADError,
  OpenSCADLexError,
  OpenSCADParseError,
  OpenSCADTranspileError,
} from './errors'

// Key AST types for type-checking
export type {
  // Core AST types
  ASTNode,
  ProgramNode,
  Position,

  // Statement node types
  PrimitiveCallNode,
  TransformNode,
  BooleanOpNode,
  ExtrudeNode,
  SpecialVarAssignNode,
  ModuleDefNode,
  ModuleCallNode,
  FunctionDefNode,
  ParameterNode,
  AssignmentNode,
  ForLoopNode,
  IfStatementNode,

  // Expression node types
  ExpressionNode,
  NumberLiteralNode,
  StringLiteralNode,
  BooleanLiteralNode,
  ArrayLiteralNode,
  IdentifierNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
  TernaryExpressionNode,
  FunctionCallNode,
  MemberExpressionNode,
  IndexExpressionNode,

  // Token types (useful for tooling)
  Token,
  TokenType,
} from './types'
