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
   * Handles VarRef for radius
   */
  private transpileSphere(args: SphereArgs, ctx: TranspileContext): string {
    const rawRadius = (args.r as ArgValue | undefined) ?? 1
    const radiusStr = this.formatArgValue(rawRadius, ctx)
    const segments = args.$fn !== undefined ? clampFn(args.$fn) : clampFn(ctx.fn)
    return `M.Manifold.sphere(${radiusStr}, ${segments})`
  }

  /**
   * Transpile cylinder primitive
   * Handles VarRef for h, r, r1, r2, and center
   */
  private transpileCylinder(args: CylinderArgs, ctx: TranspileContext): string {
    const rawHeight = (args.h as ArgValue | undefined) ?? 1
    const heightStr = this.formatArgValue(rawHeight, ctx)

    let r1Str: string
    let r2Str: string

    if (args.r !== undefined) {
      const rStr = this.formatArgValue(args.r as ArgValue, ctx)
      r1Str = r2Str = rStr
    } else {
      const rawR1 = (args.r1 as ArgValue | undefined) ?? 1
      r1Str = this.formatArgValue(rawR1, ctx)
      // For r2, default to r1 if not specified
      if (args.r2 !== undefined) {
        r2Str = this.formatArgValue(args.r2 as ArgValue, ctx)
      } else {
        r2Str = r1Str
      }
    }

    const rawCenter = (args.center as ArgValue | undefined) ?? false
    const centerStr = this.formatArgValue(rawCenter, ctx)
    const segments = args.$fn !== undefined ? clampFn(args.$fn) : clampFn(ctx.fn)

    return `M.Manifold.cylinder(${heightStr}, ${r1Str}, ${r2Str}, ${segments}, ${centerStr})`
  }

  /**
   * Transpile circle primitive (2D) to polygon points
   * Handles VarRef for radius - generates runtime code when needed
   */
  private transpileCircle(args: CircleArgs, ctx: TranspileContext): string {
    const rawRadius = (args.r as ArgValue | undefined) ?? 1
    const segments = args.$fn !== undefined ? clampFn(args.$fn) : clampFn(ctx.fn)

    // If radius is a VarRef, generate runtime code to compute polygon points
    if (isVarRef(rawRadius)) {
      const radiusStr = this.formatArgValue(rawRadius, ctx)
      // Generate JavaScript code that creates polygon points at runtime
      return `Array.from({length: ${segments}}, (_, i) => { const angle = (2 * Math.PI * i) / ${segments}; return [${radiusStr} * Math.cos(angle), ${radiusStr} * Math.sin(angle)]; })`
    }

    // Static case: generate polygon points at transpile time
    const radius = rawRadius as number
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
   * Handles VarRef for size and center - generates runtime code when needed
   */
  private transpileSquare(args: SquareArgs, ctx: TranspileContext): string {
    const rawSize = (args.size as ArgValue | undefined) ?? 1
    const rawCenter = (args.center as ArgValue | undefined) ?? false

    // Check if we have VarRef in size or center
    const hasVarRefSize = isVarRef(rawSize) || (Array.isArray(rawSize) && rawSize.some(el => isVarRef(el)))
    const hasVarRefCenter = isVarRef(rawCenter)

    if (hasVarRefSize || hasVarRefCenter) {
      // Generate runtime code to compute polygon points
      const sizeStr = this.formatArgValue(rawSize, ctx)
      const centerStr = this.formatArgValue(rawCenter, ctx)
      return `(function() { const s = ${sizeStr}; const center = ${centerStr}; const width = typeof s === 'number' ? s : s[0]; const height = typeof s === 'number' ? s : s[1]; if (center) { const hw = width / 2; const hh = height / 2; return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]; } else { return [[0, 0], [width, 0], [width, height], [0, height]]; } })()`
    }

    // Static case: generate polygon points at transpile time
    let width: number
    let height: number

    if (typeof rawSize === 'number') {
      width = height = rawSize
    } else if (Array.isArray(rawSize)) {
      [width, height] = rawSize as [number, number]
    } else {
      width = height = 1 // default
    }

    const center = rawCenter as boolean

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
   * Handles VarRef for transform vectors and angles
   */
  private getTransformCode(node: TransformNode, ctx: TranspileContext): string {
    switch (node.transform) {
      case 'translate': {
        const args = node.args as TranslateArgs
        const rawV = args.v as ArgValue

        // If the whole vector is a VarRef, generate runtime code to extend to 3D if needed
        if (isVarRef(rawV)) {
          const vStr = this.formatArgValue(rawV, ctx)
          return `.translate((function() { const v = ${vStr}; return v.length === 2 ? [v[0], v[1], 0] : v; })())`
        }

        // Array case - elements may be VarRef
        let v = rawV as ArgValue[]
        if (v.length === 2) {
          v = [...v, 0]
        }
        const vStr = this.formatArgValue(v, ctx)
        return `.translate(${vStr})`
      }
      case 'rotate': {
        const args = node.args as RotateArgs
        const rawA = args.a as ArgValue | undefined

        // If the whole angle/vector is a VarRef, generate runtime code
        if (isVarRef(rawA)) {
          const aStr = this.formatArgValue(rawA, ctx)
          return `.rotate((function() { const a = ${aStr}; return typeof a === 'number' ? [0, 0, a] : a; })())`
        }

        if (typeof rawA === 'number') {
          // Single angle is rotation around z-axis
          return `.rotate([0, 0, ${formatNumber(rawA)}])`
        } else if (!rawA) {
          return `.rotate([0, 0, 0])`
        }

        // Array case - elements may be VarRef
        const aStr = this.formatArgValue(rawA, ctx)
        return `.rotate(${aStr})`
      }
      case 'scale': {
        const args = node.args as ScaleArgs
        const rawV = args.v as ArgValue

        // If the whole value is a VarRef, generate runtime code
        if (isVarRef(rawV)) {
          const vStr = this.formatArgValue(rawV, ctx)
          return `.scale((function() { const v = ${vStr}; if (typeof v === 'number') return [v, v, v]; return v.length === 2 ? [v[0], v[1], 1] : v; })())`
        }

        if (typeof rawV === 'number') {
          return `.scale([${formatNumber(rawV)}, ${formatNumber(rawV)}, ${formatNumber(rawV)}])`
        }

        // Array case - elements may be VarRef
        let v = rawV as ArgValue[]
        if (v.length === 2) {
          v = [...v, 1]
        }
        const vStr = this.formatArgValue(v, ctx)
        return `.scale(${vStr})`
      }
      case 'mirror': {
        const args = node.args as MirrorArgs
        const rawV = args.v as ArgValue

        // If the whole vector is a VarRef, generate runtime code
        if (isVarRef(rawV)) {
          const vStr = this.formatArgValue(rawV, ctx)
          return `.mirror((function() { const v = ${vStr}; return v.length === 2 ? [v[0], v[1], 0] : v; })())`
        }

        // Array case - elements may be VarRef
        let v = rawV as ArgValue[]
        if (v.length === 2) {
          v = [...v, 0]
        }
        const vStr = this.formatArgValue(v, ctx)
        return `.mirror(${vStr})`
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
   * Handles VarRef for height, twist, scale, and center
   */
  private transpileLinearExtrude(
    args: LinearExtrudeArgs,
    polygonPoints: string,
    ctx: TranspileContext
  ): string {
    const rawHeight = (args.height as ArgValue | undefined) ?? 1
    const heightStr = this.formatArgValue(rawHeight, ctx)

    const nDivisions = args.slices ?? 0

    const rawTwist = (args.twist as ArgValue | undefined) ?? 0
    const twistStr = this.formatArgValue(rawTwist, ctx)

    // Handle scale - can be number, array, or VarRef
    const rawScale = args.scale as ArgValue | undefined
    let scaleStr: string
    if (rawScale === undefined) {
      scaleStr = '1'
    } else if (isVarRef(rawScale)) {
      // VarRef - generate runtime code to extract scalar from array if needed
      const paramStr = this.formatArgValue(rawScale, ctx)
      scaleStr = `(typeof (${paramStr}) === 'number' ? (${paramStr}) : (${paramStr})[0])`
    } else if (typeof rawScale === 'number') {
      scaleStr = formatNumber(rawScale)
    } else if (Array.isArray(rawScale)) {
      // Take first element if array
      const firstElement = rawScale[0] as ArgValue
      scaleStr = this.formatArgValue(firstElement, ctx)
    } else {
      scaleStr = '1'
    }

    const rawCenter = (args.center as ArgValue | undefined) ?? false
    const centerStr = this.formatArgValue(rawCenter, ctx)

    // M.Manifold.extrude(polygonPoints, height, nDivisions, twistDegrees, scaleTop, center)
    return `M.Manifold.extrude(${polygonPoints}, ${heightStr}, ${nDivisions}, ${twistStr}, ${scaleStr}, ${centerStr})`
  }

  /**
   * Transpile rotate_extrude
   * Handles VarRef for angle
   */
  private transpileRotateExtrude(
    args: RotateExtrudeArgs,
    polygonPoints: string,
    ctx: TranspileContext
  ): string {
    const rawAngle = (args.angle as ArgValue | undefined) ?? 360
    const angleStr = this.formatArgValue(rawAngle, ctx)
    const segments = args.$fn !== undefined ? clampFn(args.$fn) : clampFn(ctx.fn)

    // M.Manifold.revolve(polygonPoints, circularSegments, revolveDegrees)
    return `M.Manifold.revolve(${polygonPoints}, ${segments}, ${angleStr})`
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
