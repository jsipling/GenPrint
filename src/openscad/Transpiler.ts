/**
 * OpenSCAD to Manifold JavaScript Transpiler
 *
 * Converts OpenSCAD AST to JavaScript code that uses the Manifold API.
 * The generated code expects an 'M' variable containing the Manifold module.
 */

import { parse } from './Parser'
import type {
  ProgramNode,
  ASTNode,
  PrimitiveCallNode,
  TransformNode,
  BooleanOpNode,
  ExtrudeNode,
  SpecialVarAssignNode,
  VarAssignNode,
  ArgValue,
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
  LinearExtrudeArgs,
  RotateExtrudeArgs,
} from './types'
import { isVarRef } from './types'
import { OpenSCADTranspileError } from './errors'

/**
 * Reserved variable names that cannot be used in OpenSCAD code.
 * These are runtime variables used by the transpiled JavaScript code.
 */
const RESERVED_NAMES = new Set([
  'params',              // User-provided parameters object
  'M',                   // Manifold module reference
  'cq',                  // CadQuery compatibility (if used)
  'MIN_WALL_THICKNESS',  // Design constraint constant
  'MIN_FEATURE_SIZE',    // Design constraint constant
])

/**
 * Options for the transpiler
 */
export interface TranspileOptions {
  /** Default number of segments for curved surfaces (default: 32) */
  defaultFn?: number
}

/**
 * Context for tracking state during transpilation
 */
interface TranspileContext {
  /** Current value of $fn */
  fn: number
  /** Counter for generating unique variable names */
  varCounter: number
  /** Lines of generated code */
  lines: string[]
  /** Variables that need to be deleted */
  toDelete: string[]
  /** Whether we're in a 2D context (inside extrusion) */
  is2D: boolean
  /** Map of variable names to their default values */
  variables: Map<string, ArgValue>
}

/**
 * Clamp $fn value to valid range [16, 128]
 */
function clampFn(fn: number): number {
  return Math.max(16, Math.min(128, fn))
}

/**
 * Format a number for output, handling floating point precision
 */
function formatNumber(n: number): string {
  // Handle very small numbers that should be zero
  if (Math.abs(n) < 1e-10) return '0'
  // Format with reasonable precision
  const formatted = n.toString()
  return formatted
}

/**
 * Format an array of numbers for output
 */
function formatArray(arr: number[]): string {
  return '[' + arr.map(formatNumber).join(', ') + ']'
}

/**
 * Generate a unique variable name
 */
function genVar(ctx: TranspileContext): string {
  return `_v${++ctx.varCounter}`
}

/**
 * Main transpiler class
 */
class Transpiler {
  private options: Required<TranspileOptions>

  constructor(options: TranspileOptions = {}) {
    this.options = {
      defaultFn: options.defaultFn ?? 32,
    }
  }

  /**
   * Transpile a ProgramNode to JavaScript code
   */
  transpile(ast: ProgramNode): string {
    const ctx: TranspileContext = {
      fn: this.options.defaultFn,
      varCounter: 0,
      lines: [],
      toDelete: [],
      is2D: false,
      variables: new Map(),
    }

    // Process all statements
    const results: string[] = []
    for (const node of ast.body) {
      const result = this.transpileNode(node, ctx)
      if (result) {
        results.push(result)
      }
    }

    // If no results, return minimal valid code
    if (results.length === 0) {
      return 'return undefined;'
    }

    // For multiple top-level results, combine with union
    let finalResult: string
    if (results.length === 1) {
      finalResult = results[0]!
    } else {
      // Combine multiple results with union
      const resultVar = genVar(ctx)
      ctx.lines.push(`const ${resultVar} = ${results[0]};`)

      for (let i = 1; i < results.length; i++) {
        const nextVar = genVar(ctx)
        const prevVar = i === 1 ? resultVar : `_v${ctx.varCounter - 1}`
        const currentResult = results[i]!
        ctx.lines.push(`const ${nextVar} = ${prevVar}.add(${currentResult});`)
        ctx.toDelete.push(prevVar)
        ctx.toDelete.push(currentResult.startsWith('_v') ? currentResult : '')
      }

      finalResult = `_v${ctx.varCounter}`
    }

    // Build final output
    let output = ctx.lines.join('\n')
    if (output) {
      output += '\n'
    }
    output += `return ${finalResult};`

    // Validate the generated code
    try {
      new Function('M', output)
    } catch (e) {
      throw new OpenSCADTranspileError(
        `Generated invalid JavaScript: ${(e as Error).message}`,
        ast
      )
    }

    return output
  }

  /**
   * Transpile a single AST node
   */
  private transpileNode(node: ASTNode, ctx: TranspileContext): string | null {
    switch (node.nodeType) {
      case 'PrimitiveCall':
        return this.transpilePrimitive(node, ctx)
      case 'Transform':
        return this.transpileTransform(node, ctx)
      case 'BooleanOp':
        return this.transpileBoolean(node, ctx)
      case 'Extrude':
        return this.transpileExtrude(node, ctx)
      case 'SpecialVarAssign':
        this.handleSpecialVarAssign(node, ctx)
        return null
      case 'VarAssign':
        this.handleVarAssign(node, ctx)
        return null
      default:
        throw new OpenSCADTranspileError(
          `Unsupported node type: ${(node as ASTNode).nodeType}`,
          node
        )
    }
  }

  /**
   * Handle special variable assignment ($fn, $fa, $fs)
   */
  private handleSpecialVarAssign(
    node: SpecialVarAssignNode,
    ctx: TranspileContext
  ): void {
    if (node.variable === '$fn' && typeof node.value === 'number') {
      ctx.fn = clampFn(node.value)
    }
    // $fa and $fs are not supported in Manifold, ignore them
  }

  /**
   * Handle regular variable assignment (width = 50, etc.)
   * Stores the variable name and its default value in the context.
   * Throws OpenSCADTranspileError if the variable name is reserved.
   * Logs a warning if the variable is being redefined.
   */
  private handleVarAssign(
    node: VarAssignNode,
    ctx: TranspileContext
  ): void {
    // Check for reserved variable names
    if (RESERVED_NAMES.has(node.name)) {
      throw new OpenSCADTranspileError(
        `Variable name '${node.name}' is reserved and cannot be used. Reserved names: ${Array.from(RESERVED_NAMES).join(', ')}`,
        node
      )
    }

    // Warn if variable is being redefined
    if (ctx.variables.has(node.name)) {
      console.warn(
        `OpenSCAD transpiler: Variable '${node.name}' is being redefined. Previous value will be overwritten.`
      )
    }

    ctx.variables.set(node.name, node.value)
  }

  /**
   * Format an argument value for output in JavaScript code.
   * Handles numbers, booleans, strings, VarRef, and arrays.
   * For VarRef, generates a params lookup with nullish coalescing fallback.
   *
   * @param value - The argument value to format
   * @param ctx - The transpile context with variable defaults
   * @returns JavaScript code string representing the value
   * @throws OpenSCADTranspileError if a VarRef references an unknown variable
   */
  private formatArgValue(value: ArgValue, ctx: TranspileContext): string {
    // Handle VarRef - generate params lookup with default fallback
    if (isVarRef(value)) {
      const defaultValue = ctx.variables.get(value.name)
      if (defaultValue === undefined) {
        throw new OpenSCADTranspileError(
          `Unknown variable: ${value.name}`,
          value
        )
      }
      // Recursively format the default value
      const formattedDefault = this.formatArgValue(defaultValue, ctx)
      return `(params['${value.name}'] ?? ${formattedDefault})`
    }

    // Handle arrays
    if (Array.isArray(value)) {
      const formattedElements = value.map(el => this.formatArgValue(el, ctx))
      return `[${formattedElements.join(', ')}]`
    }

    // Handle primitives
    if (typeof value === 'number') {
      return formatNumber(value)
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }

    if (typeof value === 'string') {
      // Escape the string and wrap in quotes
      return JSON.stringify(value)
    }

    // Fallback - should never happen with proper typing
    throw new OpenSCADTranspileError(
      `Unsupported value type: ${typeof value}`,
      value
    )
  }

  /**
   * Transpile a primitive node
   */
  private transpilePrimitive(
    node: PrimitiveCallNode,
    ctx: TranspileContext
  ): string {
    switch (node.primitive) {
      case 'cube':
        return this.transpileCube(node.args as CubeArgs, ctx)
      case 'sphere':
        return this.transpileSphere(node.args as SphereArgs, ctx)
      case 'cylinder':
        return this.transpileCylinder(node.args as CylinderArgs, ctx)
      case 'circle':
        return this.transpileCircle(node.args as CircleArgs, ctx)
      case 'square':
        return this.transpileSquare(node.args as SquareArgs, ctx)
      case 'polygon':
        return this.transpilePolygon(node.args as PolygonArgs, ctx)
      default:
        throw new OpenSCADTranspileError(
          `Unsupported primitive: ${node.primitive}`,
          node
        )
    }
  }

  /**
   * Transpile cube primitive
   */
  private transpileCube(args: CubeArgs, ctx: TranspileContext): string {
    // Handle size argument which could be number, array, or VarRef
    const rawSize = args.size as ArgValue | undefined

    let sizeStr: string
    if (rawSize === undefined) {
      // Default size
      sizeStr = '[1, 1, 1]'
    } else if (isVarRef(rawSize)) {
      // VarRef - generate params lookup, expand to 3D array at runtime
      const paramLookup = this.formatArgValue(rawSize, ctx)
      // Generate code that handles both scalar and array at runtime
      sizeStr = `(typeof (${paramLookup}) === 'number' ? [(${paramLookup}), (${paramLookup}), (${paramLookup})] : (${paramLookup}))`
    } else if (typeof rawSize === 'number') {
      // Scalar number - expand to 3D array
      sizeStr = `[${formatNumber(rawSize)}, ${formatNumber(rawSize)}, ${formatNumber(rawSize)}]`
    } else if (Array.isArray(rawSize)) {
      // Array - could contain VarRefs
      const formattedElements = (rawSize as ArgValue[]).map(el =>
        this.formatArgValue(el, ctx)
      )
      sizeStr = `[${formattedElements.join(', ')}]`
    } else {
      sizeStr = '[1, 1, 1]'
    }

    // Handle center argument which could be boolean or VarRef
    const rawCenter = args.center as ArgValue | undefined
    let centerStr: string
    if (rawCenter === undefined) {
      centerStr = 'false'
    } else if (isVarRef(rawCenter)) {
      centerStr = this.formatArgValue(rawCenter, ctx)
    } else {
      centerStr = rawCenter ? 'true' : 'false'
    }

    return `M.Manifold.cube(${sizeStr}, ${centerStr})`
  }

  /**
   * Transpile sphere primitive
   */
  private transpileSphere(args: SphereArgs, ctx: TranspileContext): string {
    const radius = args.r ?? 1
    const segments = args.$fn !== undefined ? clampFn(args.$fn) : clampFn(ctx.fn)
    return `M.Manifold.sphere(${formatNumber(radius)}, ${segments})`
  }

  /**
   * Transpile cylinder primitive
   */
  private transpileCylinder(args: CylinderArgs, ctx: TranspileContext): string {
    const height = args.h ?? 1
    let r1: number
    let r2: number

    if (args.r !== undefined) {
      r1 = r2 = args.r
    } else {
      r1 = args.r1 ?? 1
      r2 = args.r2 ?? r1
    }

    const center = args.center ?? false
    const segments = args.$fn !== undefined ? clampFn(args.$fn) : clampFn(ctx.fn)

    return `M.Manifold.cylinder(${formatNumber(height)}, ${formatNumber(r1)}, ${formatNumber(r2)}, ${segments}, ${center})`
  }

  /**
   * Transpile circle primitive (2D) to polygon points
   */
  private transpileCircle(args: CircleArgs, ctx: TranspileContext): string {
    const radius = args.r ?? 1
    const segments = args.$fn !== undefined ? clampFn(args.$fn) : clampFn(ctx.fn)

    // Generate polygon points for circle
    const points: [number, number][] = []
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI * i) / segments
      points.push([
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      ])
    }

    return this.formatPolygonPoints(points)
  }

  /**
   * Transpile square primitive (2D) to polygon points
   */
  private transpileSquare(args: SquareArgs, _ctx: TranspileContext): string {
    let width: number
    let height: number

    if (typeof args.size === 'number') {
      width = height = args.size
    } else if (Array.isArray(args.size)) {
      [width, height] = args.size
    } else {
      width = height = 1 // default
    }

    const center = args.center ?? false

    let points: [number, number][]
    if (center) {
      const hw = width / 2
      const hh = height / 2
      points = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ]
    } else {
      points = [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ]
    }

    return this.formatPolygonPoints(points)
  }

  /**
   * Transpile polygon primitive (2D) to polygon points
   * Handles VarRef values in points array
   */
  private transpilePolygon(args: PolygonArgs, ctx: TranspileContext): string {
    const rawPoints = (args.points ?? []) as ArgValue[]
    return this.formatPolygonPointsWithVarRef(rawPoints, ctx)
  }

  /**
   * Format polygon points for Manifold.extrude, handling VarRef values
   */
  private formatPolygonPointsWithVarRef(
    points: ArgValue[],
    ctx: TranspileContext
  ): string {
    const formatted = points.map(point => {
      if (Array.isArray(point)) {
        // It's a point [x, y] - elements may be numbers or VarRef
        const formattedElements = point.map(el => this.formatArgValue(el, ctx))
        return `[${formattedElements.join(', ')}]`
      } else if (isVarRef(point)) {
        // The whole point is a variable reference
        return this.formatArgValue(point, ctx)
      } else {
        // Fallback - shouldn't happen with proper input
        return this.formatArgValue(point, ctx)
      }
    })
    return `[${formatted.join(', ')}]`
  }

  /**
   * Format polygon points for Manifold.extrude (legacy method for static points)
   */
  private formatPolygonPoints(points: [number, number][]): string {
    const formatted = points
      .map(([x, y]) => `[${formatNumber(x)}, ${formatNumber(y)}]`)
      .join(', ')
    return `[${formatted}]`
  }

  /**
   * Transpile a transform node
   */
  private transpileTransform(node: TransformNode, ctx: TranspileContext): string {
    // First, transpile all children
    const childResults: string[] = []
    for (const child of node.children) {
      const result = this.transpileNode(child, ctx)
      if (result) {
        childResults.push(result)
      }
    }

    if (childResults.length === 0) {
      throw new OpenSCADTranspileError(
        `Transform ${node.transform} has no children`,
        node
      )
    }

    // Combine children if multiple
    let combined: string
    if (childResults.length === 1) {
      combined = childResults[0]!
    } else {
      // Store first child
      const firstVar = genVar(ctx)
      ctx.lines.push(`const ${firstVar} = ${childResults[0]};`)

      let currentVar = firstVar
      for (let i = 1; i < childResults.length; i++) {
        const nextVar = genVar(ctx)
        ctx.lines.push(`const ${nextVar} = ${currentVar}.add(${childResults[i]!});`)
        ctx.lines.push(`${currentVar}.delete();`)
        currentVar = nextVar
      }

      combined = currentVar
    }

    // Apply the transform
    const transformCode = this.getTransformCode(node, ctx)

    // If no transform code (e.g., color), return source unchanged
    // Avoids creating assignment that references a deleted object
    if (!transformCode) {
      return combined
    }

    const resultVar = genVar(ctx)

    // Store the combined value if it's a complex expression
    const needsStorage = !combined.startsWith('_v')
    const sourceVar = needsStorage ? genVar(ctx) : combined

    if (needsStorage) {
      ctx.lines.push(`const ${sourceVar} = ${combined};`)
    }

    ctx.lines.push(`const ${resultVar} = ${sourceVar}${transformCode};`)
    ctx.lines.push(`${sourceVar}.delete();`)

    return resultVar
  }

  /**
   * Get the transform method call code
   */
  private getTransformCode(node: TransformNode, _ctx: TranspileContext): string {
    switch (node.transform) {
      case 'translate': {
        const args = node.args as TranslateArgs
        let v = args.v
        // Extend 2D vector to 3D
        if (v.length === 2) {
          v = [v[0], v[1], 0]
        }
        return `.translate(${formatArray(v as number[])})`
      }
      case 'rotate': {
        const args = node.args as RotateArgs
        let a = args.a
        if (typeof a === 'number') {
          // Single angle is rotation around z-axis
          a = [0, 0, a]
        } else if (!a) {
          a = [0, 0, 0]
        }
        return `.rotate(${formatArray(a as number[])})`
      }
      case 'scale': {
        const args = node.args as ScaleArgs
        let v = args.v
        if (typeof v === 'number') {
          v = [v, v, v]
        } else if (v.length === 2) {
          v = [v[0], v[1], 1]
        }
        return `.scale(${formatArray(v as number[])})`
      }
      case 'mirror': {
        const args = node.args as MirrorArgs
        let v = args.v
        if (v.length === 2) {
          v = [v[0], v[1], 0]
        }
        return `.mirror(${formatArray(v as number[])})`
      }
      case 'color':
        // Color is not supported in Manifold, return identity transform
        return ''
      case 'hull':
      case 'minkowski':
        throw new OpenSCADTranspileError(
          `Transform ${node.transform} is not yet supported`,
          node
        )
      default:
        throw new OpenSCADTranspileError(
          `Unknown transform: ${node.transform}`,
          node
        )
    }
  }

  /**
   * Transpile a boolean operation node
   */
  private transpileBoolean(node: BooleanOpNode, ctx: TranspileContext): string {
    // Transpile all children
    const childResults: string[] = []
    for (const child of node.children) {
      const result = this.transpileNode(child, ctx)
      if (result) {
        childResults.push(result)
      }
    }

    // Handle empty boolean operations
    if (childResults.length === 0) {
      // Return a placeholder that produces valid JS
      return 'undefined'
    }

    if (childResults.length === 1) {
      return childResults[0]!
    }

    // Get the boolean operation method
    const method = this.getBooleanMethod(node.operation)

    // Store first child
    const firstVar = genVar(ctx)
    ctx.lines.push(`const ${firstVar} = ${childResults[0]};`)

    let currentVar = firstVar
    for (let i = 1; i < childResults.length; i++) {
      const nextVar = genVar(ctx)
      const childVar = genVar(ctx)

      // Store the child result
      ctx.lines.push(`const ${childVar} = ${childResults[i]};`)
      ctx.lines.push(`const ${nextVar} = ${currentVar}.${method}(${childVar});`)
      ctx.lines.push(`${currentVar}.delete();`)
      ctx.lines.push(`${childVar}.delete();`)

      currentVar = nextVar
    }

    return currentVar
  }

  /**
   * Get the Manifold method for a boolean operation
   */
  private getBooleanMethod(operation: BooleanOpNode['operation']): string {
    switch (operation) {
      case 'union':
        return 'add'
      case 'difference':
        return 'subtract'
      case 'intersection':
        return 'intersect'
    }
  }

  /**
   * Transpile an extrude node
   */
  private transpileExtrude(node: ExtrudeNode, ctx: TranspileContext): string {
    // Set 2D context for children
    const was2D = ctx.is2D
    ctx.is2D = true

    // Transpile children (2D shapes)
    const childResults: string[] = []
    for (const child of node.children) {
      const result = this.transpileNode(child, ctx)
      if (result) {
        childResults.push(result)
      }
    }

    ctx.is2D = was2D

    if (childResults.length === 0) {
      throw new OpenSCADTranspileError(
        `Extrusion ${node.extrude} has no children`,
        node
      )
    }

    // For 2D boolean operations in extrusions, we need special handling
    // The children should return polygon point arrays
    // For now, we support single 2D shapes; complex 2D booleans need special handling

    // Combine 2D shapes if multiple (simplified: just use first)
    // A more complete implementation would handle 2D boolean operations
    const polygonPoints = childResults[0]!

    switch (node.extrude) {
      case 'linear_extrude':
        return this.transpileLinearExtrude(
          node.args as LinearExtrudeArgs,
          polygonPoints,
          ctx
        )
      case 'rotate_extrude':
        return this.transpileRotateExtrude(
          node.args as RotateExtrudeArgs,
          polygonPoints,
          ctx
        )
      default:
        throw new OpenSCADTranspileError(
          `Unknown extrusion type: ${node.extrude}`,
          node
        )
    }
  }

  /**
   * Transpile linear_extrude
   */
  private transpileLinearExtrude(
    args: LinearExtrudeArgs,
    polygonPoints: string,
    _ctx: TranspileContext
  ): string {
    const height = args.height ?? 1
    const nDivisions = args.slices ?? 0
    const twist = args.twist ?? 0
    const scale = typeof args.scale === 'number'
      ? args.scale
      : Array.isArray(args.scale)
        ? args.scale[0]
        : 1
    const center = args.center ?? false

    // M.Manifold.extrude(polygonPoints, height, nDivisions, twistDegrees, scaleTop, center)
    return `M.Manifold.extrude(${polygonPoints}, ${formatNumber(height)}, ${nDivisions}, ${formatNumber(twist)}, ${formatNumber(scale)}, ${center})`
  }

  /**
   * Transpile rotate_extrude
   */
  private transpileRotateExtrude(
    args: RotateExtrudeArgs,
    polygonPoints: string,
    ctx: TranspileContext
  ): string {
    const angle = args.angle ?? 360
    const segments = args.$fn !== undefined ? clampFn(args.$fn) : clampFn(ctx.fn)

    // M.Manifold.revolve(polygonPoints, circularSegments, revolveDegrees)
    return `M.Manifold.revolve(${polygonPoints}, ${segments}, ${formatNumber(angle)})`
  }
}

/**
 * Transpile an OpenSCAD AST or source string to JavaScript code
 *
 * @param input - Either a ProgramNode AST or a source string
 * @param options - Transpilation options
 * @returns JavaScript code that uses the Manifold API via the M variable
 * @throws OpenSCADTranspileError if transpilation fails
 * @throws OpenSCADParseError if parsing fails (when input is a string)
 */
export function transpile(
  input: ProgramNode | string,
  options?: TranspileOptions
): string {
  const ast = typeof input === 'string' ? parse(input) : input
  const transpiler = new Transpiler(options)
  return transpiler.transpile(ast)
}

/**
 * Convenience function to parse and transpile OpenSCAD source code
 *
 * @param source - The OpenSCAD source code
 * @param options - Transpilation options
 * @returns JavaScript code that uses the Manifold API via the M variable
 * @throws OpenSCADParseError if parsing fails
 * @throws OpenSCADTranspileError if transpilation fails
 */
export function transpileOpenSCAD(
  source: string,
  options?: TranspileOptions
): string {
  return transpile(source, options)
}
