/**
 * OpenSCAD Recursive Descent Parser
 *
 * Parses a token stream from the lexer into an Abstract Syntax Tree.
 * Supports a subset of OpenSCAD: primitives, transforms, boolean ops, extrusions.
 */

import { lex } from './Lexer'
import type {
  Token,
  TokenType,
  Position,
  ProgramNode,
  ASTNode,
  PrimitiveCallNode,
  TransformNode,
  BooleanOpNode,
  ExtrudeNode,
  SpecialVarAssignNode,
  CubeArgs,
  SphereArgs,
  CylinderArgs,
  CircleArgs,
  SquareArgs,
  PolygonArgs,
  TranslateArgs,
  RotateArgs,
  ScaleArgs,
  MirrorArgs,
  ColorArgs,
  LinearExtrudeArgs,
  RotateExtrudeArgs,
} from './types'
import { OpenSCADParseError } from './errors'

// Token type sets for categorization
const PRIMITIVE_TOKENS: TokenType[] = [
  'CUBE', 'SPHERE', 'CYLINDER', 'CIRCLE', 'SQUARE', 'POLYGON', 'POLYHEDRON', 'TEXT'
]

const TRANSFORM_TOKENS: TokenType[] = [
  'TRANSLATE', 'ROTATE', 'SCALE', 'MIRROR', 'COLOR', 'HULL', 'MINKOWSKI'
]

const BOOLEAN_TOKENS: TokenType[] = [
  'UNION', 'DIFFERENCE', 'INTERSECTION'
]

const EXTRUDE_TOKENS: TokenType[] = [
  'LINEAR_EXTRUDE', 'ROTATE_EXTRUDE'
]

const UNSUPPORTED_TOKENS: TokenType[] = [
  'FOR', 'IF', 'MODULE', 'FUNCTION'
]

/**
 * Parser class for OpenSCAD
 */
class Parser {
  private tokens: Token[]
  private pos: number = 0
  private maxIterations: number

  constructor(tokens: Token[]) {
    this.tokens = tokens
    // Set a maximum iteration count based on token count to prevent infinite loops
    this.maxIterations = tokens.length * 100
  }

  /**
   * Main parse entry point
   */
  parseProgram(): ProgramNode {
    const body: ASTNode[] = []
    let iterations = 0

    while (!this.isAtEnd()) {
      if (iterations++ > this.maxIterations) {
        throw this.error('Parser exceeded maximum iterations - possible infinite loop', [])
      }

      // Skip any stray semicolons
      if (this.check('SEMICOLON')) {
        this.advance()
        continue
      }

      const stmt = this.parseStatement()
      if (stmt) {
        body.push(stmt)
      }
    }

    return {
      nodeType: 'Program',
      body,
    }
  }

  /**
   * Parse a single statement
   */
  private parseStatement(): ASTNode | null {
    const token = this.peek()

    // Check for unsupported features first
    if (UNSUPPORTED_TOKENS.includes(token.type)) {
      throw this.errorUnsupported(token)
    }

    // Special variable assignment: $fn = 32;
    if (token.type === 'SPECIAL_VAR') {
      return this.parseSpecialVarAssign()
    }

    // Primitive call: cube(...);
    if (PRIMITIVE_TOKENS.includes(token.type)) {
      return this.parsePrimitive()
    }

    // Transform: translate(...) { ... }
    if (TRANSFORM_TOKENS.includes(token.type)) {
      return this.parseTransform()
    }

    // Boolean operation: union() { ... }
    if (BOOLEAN_TOKENS.includes(token.type)) {
      return this.parseBoolean()
    }

    // Extrusion: linear_extrude(...) { ... }
    if (EXTRUDE_TOKENS.includes(token.type)) {
      return this.parseExtrude()
    }

    // Identifier followed by = is a variable assignment (unsupported)
    if (token.type === 'IDENTIFIER') {
      const next = this.peekNext()
      if (next.type === 'ASSIGN') {
        throw new OpenSCADParseError(
          `Unsupported feature: variable assignment. Only special variables ($fn, $fa, $fs) are supported.`,
          token.line,
          token.column,
          token.value,
          []
        )
      }
      // Otherwise unknown identifier usage
      throw new OpenSCADParseError(
        `Unexpected identifier '${token.value}'. Expected a primitive, transform, boolean operation, or extrusion.`,
        token.line,
        token.column,
        token.value,
        ['cube', 'sphere', 'translate', 'union', 'difference', 'linear_extrude']
      )
    }

    // If we're at EOF, return null
    if (this.isAtEnd()) {
      return null
    }

    // Unknown token
    throw this.error(
      `Unexpected token '${token.value}'`,
      ['cube', 'sphere', 'translate', 'union', 'difference', 'linear_extrude']
    )
  }

  // ============================================================================
  // Primitive Parsing
  // ============================================================================

  private parsePrimitive(): PrimitiveCallNode {
    const token = this.advance()
    const position = this.getPosition(token)
    const primitive = token.value.toLowerCase() as PrimitiveCallNode['primitive']

    this.expect('LPAREN', '(')
    const rawArgs = this.parseArgumentList()
    this.expect('RPAREN', ')')
    this.expect('SEMICOLON', ';')

    const args = this.buildPrimitiveArgs(primitive, rawArgs)

    return {
      nodeType: 'PrimitiveCall',
      primitive,
      args,
      position,
    }
  }

  private buildPrimitiveArgs(
    primitive: PrimitiveCallNode['primitive'],
    rawArgs: ParsedArgs
  ): PrimitiveCallNode['args'] {
    switch (primitive) {
      case 'cube':
        return this.buildCubeArgs(rawArgs)
      case 'sphere':
        return this.buildSphereArgs(rawArgs)
      case 'cylinder':
        return this.buildCylinderArgs(rawArgs)
      case 'circle':
        return this.buildCircleArgs(rawArgs)
      case 'square':
        return this.buildSquareArgs(rawArgs)
      case 'polygon':
        return this.buildPolygonArgs(rawArgs)
      default:
        return rawArgs.named as PrimitiveCallNode['args']
    }
  }

  private buildCubeArgs(rawArgs: ParsedArgs): CubeArgs {
    const args: CubeArgs = {}

    // Positional: first arg is size
    if (rawArgs.positional.length > 0) {
      args.size = rawArgs.positional[0] as number | [number, number, number]
    }

    // Named arguments
    if ('size' in rawArgs.named) {
      args.size = rawArgs.named.size as number | [number, number, number]
    }
    if ('center' in rawArgs.named) {
      args.center = rawArgs.named.center as boolean
    }

    return args
  }

  private buildSphereArgs(rawArgs: ParsedArgs): SphereArgs {
    const args: SphereArgs = {}

    // Positional: first arg is radius
    if (rawArgs.positional.length > 0) {
      args.r = rawArgs.positional[0] as number
    }

    // Named arguments
    if ('r' in rawArgs.named) {
      args.r = rawArgs.named.r as number
    }
    // Convert diameter to radius
    if ('d' in rawArgs.named) {
      args.r = (rawArgs.named.d as number) / 2
    }
    if ('$fn' in rawArgs.named) {
      args.$fn = rawArgs.named.$fn as number
    }
    if ('$fa' in rawArgs.named) {
      args.$fa = rawArgs.named.$fa as number
    }
    if ('$fs' in rawArgs.named) {
      args.$fs = rawArgs.named.$fs as number
    }

    return args
  }

  private buildCylinderArgs(rawArgs: ParsedArgs): CylinderArgs {
    const args: CylinderArgs = {}

    // Named arguments
    if ('h' in rawArgs.named) {
      args.h = rawArgs.named.h as number
    }
    if ('r' in rawArgs.named) {
      args.r = rawArgs.named.r as number
    }
    if ('r1' in rawArgs.named) {
      args.r1 = rawArgs.named.r1 as number
    }
    if ('r2' in rawArgs.named) {
      args.r2 = rawArgs.named.r2 as number
    }
    // Convert diameter to radius
    if ('d' in rawArgs.named) {
      args.r = (rawArgs.named.d as number) / 2
    }
    // Convert d1/d2 to r1/r2
    if ('d1' in rawArgs.named) {
      args.r1 = (rawArgs.named.d1 as number) / 2
    }
    if ('d2' in rawArgs.named) {
      args.r2 = (rawArgs.named.d2 as number) / 2
    }
    if ('center' in rawArgs.named) {
      args.center = rawArgs.named.center as boolean
    }
    if ('$fn' in rawArgs.named) {
      args.$fn = rawArgs.named.$fn as number
    }
    if ('$fa' in rawArgs.named) {
      args.$fa = rawArgs.named.$fa as number
    }
    if ('$fs' in rawArgs.named) {
      args.$fs = rawArgs.named.$fs as number
    }

    return args
  }

  private buildCircleArgs(rawArgs: ParsedArgs): CircleArgs {
    const args: CircleArgs = {}

    // Positional: first arg is radius
    if (rawArgs.positional.length > 0) {
      args.r = rawArgs.positional[0] as number
    }

    // Named arguments
    if ('r' in rawArgs.named) {
      args.r = rawArgs.named.r as number
    }
    // Convert diameter to radius
    if ('d' in rawArgs.named) {
      args.r = (rawArgs.named.d as number) / 2
    }
    if ('$fn' in rawArgs.named) {
      args.$fn = rawArgs.named.$fn as number
    }
    if ('$fa' in rawArgs.named) {
      args.$fa = rawArgs.named.$fa as number
    }
    if ('$fs' in rawArgs.named) {
      args.$fs = rawArgs.named.$fs as number
    }

    return args
  }

  private buildSquareArgs(rawArgs: ParsedArgs): SquareArgs {
    const args: SquareArgs = {}

    // Positional: first arg is size
    if (rawArgs.positional.length > 0) {
      args.size = rawArgs.positional[0] as number | [number, number]
    }

    // Named arguments
    if ('size' in rawArgs.named) {
      args.size = rawArgs.named.size as number | [number, number]
    }
    if ('center' in rawArgs.named) {
      args.center = rawArgs.named.center as boolean
    }

    return args
  }

  private buildPolygonArgs(rawArgs: ParsedArgs): PolygonArgs {
    const args: PolygonArgs = {}

    // Positional: first arg is points
    if (rawArgs.positional.length > 0) {
      args.points = rawArgs.positional[0] as Array<[number, number]>
    }

    // Named arguments
    if ('points' in rawArgs.named) {
      args.points = rawArgs.named.points as Array<[number, number]>
    }
    if ('paths' in rawArgs.named) {
      args.paths = rawArgs.named.paths as number[][]
    }
    if ('convexity' in rawArgs.named) {
      args.convexity = rawArgs.named.convexity as number
    }

    return args
  }

  // ============================================================================
  // Transform Parsing
  // ============================================================================

  private parseTransform(): TransformNode {
    const token = this.advance()
    const position = this.getPosition(token)
    const transform = token.value.toLowerCase() as TransformNode['transform']

    this.expect('LPAREN', '(')
    const rawArgs = this.parseArgumentList()
    this.expect('RPAREN', ')')

    const children = this.parseChildren()
    const args = this.buildTransformArgs(transform, rawArgs)

    return {
      nodeType: 'Transform',
      transform,
      args,
      children,
      position,
    }
  }

  private buildTransformArgs(
    transform: TransformNode['transform'],
    rawArgs: ParsedArgs
  ): TransformNode['args'] {
    switch (transform) {
      case 'translate':
        return this.buildTranslateArgs(rawArgs)
      case 'rotate':
        return this.buildRotateArgs(rawArgs)
      case 'scale':
        return this.buildScaleArgs(rawArgs)
      case 'mirror':
        return this.buildMirrorArgs(rawArgs)
      case 'color':
        return this.buildColorArgs(rawArgs)
      case 'hull':
      case 'minkowski':
        return {} // No arguments for hull/minkowski
      default:
        return rawArgs.named
    }
  }

  private buildTranslateArgs(rawArgs: ParsedArgs): TranslateArgs {
    let v: TranslateArgs['v']

    // Positional: first arg is vector
    if (rawArgs.positional.length > 0) {
      v = rawArgs.positional[0] as TranslateArgs['v']
    }

    // Named argument
    if ('v' in rawArgs.named) {
      v = rawArgs.named.v as TranslateArgs['v']
    }

    return { v: v! }
  }

  private buildRotateArgs(rawArgs: ParsedArgs): RotateArgs {
    const args: RotateArgs = {}

    // Positional: first arg is angle
    if (rawArgs.positional.length > 0) {
      args.a = rawArgs.positional[0] as number | [number, number, number]
    }

    // Named arguments
    if ('a' in rawArgs.named) {
      args.a = rawArgs.named.a as number | [number, number, number]
    }
    if ('v' in rawArgs.named) {
      args.v = rawArgs.named.v as [number, number, number]
    }

    return args
  }

  private buildScaleArgs(rawArgs: ParsedArgs): ScaleArgs {
    let v: ScaleArgs['v']

    // Positional: first arg is scale vector
    if (rawArgs.positional.length > 0) {
      v = rawArgs.positional[0] as ScaleArgs['v']
    }

    // Named argument
    if ('v' in rawArgs.named) {
      v = rawArgs.named.v as ScaleArgs['v']
    }

    return { v: v! }
  }

  private buildMirrorArgs(rawArgs: ParsedArgs): MirrorArgs {
    let v: MirrorArgs['v']

    // Positional: first arg is mirror vector
    if (rawArgs.positional.length > 0) {
      v = rawArgs.positional[0] as MirrorArgs['v']
    }

    // Named argument
    if ('v' in rawArgs.named) {
      v = rawArgs.named.v as MirrorArgs['v']
    }

    return { v: v! }
  }

  private buildColorArgs(rawArgs: ParsedArgs): ColorArgs {
    const args: ColorArgs = {}

    // Positional: first arg is color
    if (rawArgs.positional.length > 0) {
      args.c = rawArgs.positional[0] as ColorArgs['c']
    }

    // Named arguments
    if ('c' in rawArgs.named) {
      args.c = rawArgs.named.c as ColorArgs['c']
    }
    if ('alpha' in rawArgs.named) {
      args.alpha = rawArgs.named.alpha as number
    }

    return args
  }

  // ============================================================================
  // Boolean Operation Parsing
  // ============================================================================

  private parseBoolean(): BooleanOpNode {
    const token = this.advance()
    const position = this.getPosition(token)
    const operation = token.value.toLowerCase() as BooleanOpNode['operation']

    this.expect('LPAREN', '(')
    // Boolean ops don't have arguments, but we still consume any that might be there
    this.parseArgumentList()
    this.expect('RPAREN', ')')

    const children = this.parseChildren()

    return {
      nodeType: 'BooleanOp',
      operation,
      children,
      position,
    }
  }

  // ============================================================================
  // Extrusion Parsing
  // ============================================================================

  private parseExtrude(): ExtrudeNode {
    const token = this.advance()
    const position = this.getPosition(token)
    const extrude = token.value.toLowerCase() as ExtrudeNode['extrude']

    this.expect('LPAREN', '(')
    const rawArgs = this.parseArgumentList()
    this.expect('RPAREN', ')')

    const children = this.parseChildren()
    const args = this.buildExtrudeArgs(extrude, rawArgs)

    return {
      nodeType: 'Extrude',
      extrude,
      args,
      children,
      position,
    }
  }

  private buildExtrudeArgs(
    extrude: ExtrudeNode['extrude'],
    rawArgs: ParsedArgs
  ): ExtrudeNode['args'] {
    switch (extrude) {
      case 'linear_extrude':
        return this.buildLinearExtrudeArgs(rawArgs)
      case 'rotate_extrude':
        return this.buildRotateExtrudeArgs(rawArgs)
      default:
        return rawArgs.named as ExtrudeNode['args']
    }
  }

  private buildLinearExtrudeArgs(rawArgs: ParsedArgs): LinearExtrudeArgs {
    const args: LinearExtrudeArgs = {}

    // Positional: first arg is height
    if (rawArgs.positional.length > 0) {
      args.height = rawArgs.positional[0] as number
    }

    // Named arguments
    if ('height' in rawArgs.named) {
      args.height = rawArgs.named.height as number
    }
    if ('center' in rawArgs.named) {
      args.center = rawArgs.named.center as boolean
    }
    if ('convexity' in rawArgs.named) {
      args.convexity = rawArgs.named.convexity as number
    }
    if ('twist' in rawArgs.named) {
      args.twist = rawArgs.named.twist as number
    }
    if ('slices' in rawArgs.named) {
      args.slices = rawArgs.named.slices as number
    }
    if ('scale' in rawArgs.named) {
      args.scale = rawArgs.named.scale as number | [number, number]
    }
    if ('$fn' in rawArgs.named) {
      args.$fn = rawArgs.named.$fn as number
    }

    return args
  }

  private buildRotateExtrudeArgs(rawArgs: ParsedArgs): RotateExtrudeArgs {
    const args: RotateExtrudeArgs = {}

    // Named arguments
    if ('angle' in rawArgs.named) {
      args.angle = rawArgs.named.angle as number
    }
    if ('convexity' in rawArgs.named) {
      args.convexity = rawArgs.named.convexity as number
    }
    if ('$fn' in rawArgs.named) {
      args.$fn = rawArgs.named.$fn as number
    }
    if ('$fa' in rawArgs.named) {
      args.$fa = rawArgs.named.$fa as number
    }
    if ('$fs' in rawArgs.named) {
      args.$fs = rawArgs.named.$fs as number
    }

    return args
  }

  // ============================================================================
  // Special Variable Assignment Parsing
  // ============================================================================

  private parseSpecialVarAssign(): SpecialVarAssignNode {
    const token = this.advance()
    const position = this.getPosition(token)
    const variable = token.value

    this.expect('ASSIGN', '=')
    const value = this.parseValue()
    this.expect('SEMICOLON', ';')

    return {
      nodeType: 'SpecialVarAssign',
      variable,
      value: value as number | [number, number, number],
      position,
    }
  }

  // ============================================================================
  // Children Block Parsing
  // ============================================================================

  private parseChildren(): ASTNode[] {
    const children: ASTNode[] = []

    // Check if we have a block
    if (this.check('LBRACE')) {
      this.advance() // consume {

      while (!this.check('RBRACE') && !this.isAtEnd()) {
        // Skip stray semicolons
        if (this.check('SEMICOLON')) {
          this.advance()
          continue
        }

        const child = this.parseChildStatement()
        if (child) {
          children.push(child)
        }
      }

      this.expect('RBRACE', '}')

      // Optional trailing semicolon after block
      if (this.check('SEMICOLON')) {
        this.advance()
      }
    } else {
      // Single child statement (no braces)
      const child = this.parseChildStatement()
      if (child) {
        children.push(child)
      }
    }

    return children
  }

  private parseChildStatement(): ASTNode | null {
    const token = this.peek()

    // Check for unsupported features
    if (UNSUPPORTED_TOKENS.includes(token.type)) {
      throw this.errorUnsupported(token)
    }

    // Primitive call
    if (PRIMITIVE_TOKENS.includes(token.type)) {
      return this.parsePrimitive()
    }

    // Transform
    if (TRANSFORM_TOKENS.includes(token.type)) {
      return this.parseTransform()
    }

    // Boolean operation
    if (BOOLEAN_TOKENS.includes(token.type)) {
      return this.parseBoolean()
    }

    // Extrusion
    if (EXTRUDE_TOKENS.includes(token.type)) {
      return this.parseExtrude()
    }

    // We shouldn't get here during normal parsing
    if (this.isAtEnd() || this.check('RBRACE')) {
      return null
    }

    throw this.error(
      `Unexpected token '${token.value}' in children block`,
      ['cube', 'sphere', 'translate', 'union', 'difference', 'linear_extrude', '}']
    )
  }

  // ============================================================================
  // Argument List Parsing
  // ============================================================================

  private parseArgumentList(): ParsedArgs {
    const positional: ArgValue[] = []
    const named: Record<string, ArgValue> = {}

    if (this.check('RPAREN')) {
      return { positional, named }
    }

    do {
      const arg = this.parseArgument()
      if (arg.name) {
        named[arg.name] = arg.value
      } else {
        positional.push(arg.value)
      }
    } while (this.match('COMMA'))

    return { positional, named }
  }

  private parseArgument(): { name: string | null; value: ArgValue } {
    // Check for named argument: name = value
    // This can be an IDENTIFIER, SPECIAL_VAR, or even a keyword like 'scale'
    // when used as argument name (e.g., linear_extrude(height=10, scale=0.5))
    const token = this.peek()
    const next = this.peekNext()

    if (next.type === 'ASSIGN') {
      // Any token that looks like a valid name followed by = is a named argument
      const validNameTypes: TokenType[] = [
        'IDENTIFIER', 'SPECIAL_VAR',
        // Keywords that can also be argument names
        'SCALE', 'COLOR', 'OFFSET', 'TEXT'
      ]

      if (validNameTypes.includes(token.type)) {
        this.advance() // consume name token
        this.advance() // consume =
        const value = this.parseValue()
        return { name: token.value, value }
      }
    }

    // Positional argument
    const value = this.parseValue()
    return { name: null, value }
  }

  private parseValue(): ArgValue {
    const token = this.peek()

    // Array: [...]
    if (token.type === 'LBRACKET') {
      return this.parseArray()
    }

    // Number (including negative)
    if (token.type === 'NUMBER') {
      this.advance()
      return parseFloat(token.value)
    }

    // Negative number
    if (token.type === 'MINUS') {
      this.advance()
      const numToken = this.expect('NUMBER', 'number')
      return -parseFloat(numToken.value)
    }

    // Boolean
    if (token.type === 'TRUE') {
      this.advance()
      return true
    }
    if (token.type === 'FALSE') {
      this.advance()
      return false
    }

    // String
    if (token.type === 'STRING') {
      this.advance()
      return token.value
    }

    throw this.error(
      `Expected a value, found '${token.value}'`,
      ['number', 'array', 'true', 'false', 'string']
    )
  }

  private parseArray(): ArgValue[] {
    this.expect('LBRACKET', '[')
    const elements: ArgValue[] = []

    if (!this.check('RBRACKET')) {
      do {
        const value = this.parseValue()
        elements.push(value)
      } while (this.match('COMMA'))
    }

    this.expect('RBRACKET', ']')
    return elements
  }

  // ============================================================================
  // Token Helpers
  // ============================================================================

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private peekNext(): Token {
    if (this.pos + 1 >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1] // EOF
    }
    return this.tokens[this.pos + 1]
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.pos++
    }
    return this.tokens[this.pos - 1]
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false
    return this.peek().type === type
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance()
      return true
    }
    return false
  }

  private expect(type: TokenType, description: string): Token {
    if (this.check(type)) {
      return this.advance()
    }
    throw this.error(
      `Expected '${description}'`,
      [description]
    )
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EOF'
  }

  private getPosition(token: Token): Position {
    return {
      line: token.line,
      column: token.column,
    }
  }

  // ============================================================================
  // Error Helpers
  // ============================================================================

  private error(message: string, expected: string[]): OpenSCADParseError {
    const token = this.peek()
    return new OpenSCADParseError(
      message,
      token.line,
      token.column,
      token.value || token.type,
      expected
    )
  }

  private errorUnsupported(token: Token): OpenSCADParseError {
    const feature = token.value.toLowerCase()
    const messages: Record<string, string> = {
      for: 'Unsupported feature: for loops are not supported. Consider unrolling the loop or using a different approach.',
      if: 'Unsupported feature: if statements are not supported. Consider using separate models for each case.',
      module: 'Unsupported feature: module definitions are not supported. Inline the module contents directly.',
      function: 'Unsupported feature: function definitions are not supported.',
    }

    return new OpenSCADParseError(
      messages[feature] || `Unsupported feature: ${feature}`,
      token.line,
      token.column,
      token.value,
      []
    )
  }
}

// Type for parsed arguments
interface ParsedArgs {
  positional: ArgValue[]
  named: Record<string, ArgValue>
}

type ArgValue = number | boolean | string | ArgValue[]

/**
 * Parse OpenSCAD source code into an AST
 *
 * @param source - The OpenSCAD source code to parse
 * @returns A ProgramNode representing the parsed program
 * @throws OpenSCADParseError if parsing fails
 */
export function parse(source: string): ProgramNode {
  const tokens = lex(source)
  const parser = new Parser(tokens)
  return parser.parseProgram()
}
