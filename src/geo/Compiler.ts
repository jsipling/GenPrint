/**
 * Compiler - Compiles GeoNode trees to Manifold geometry
 *
 * The compiler traverses a GeoNode instruction graph and produces
 * Manifold geometry. Memory management is handled internally.
 */

import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import type { GeoNode, Matrix4x4 } from './types'

export interface CompilerOptions {
  /** Number of segments for circular geometry (default: 32) */
  circularSegments?: number
}

/**
 * Compiles GeoNode trees to Manifold geometry
 *
 * Usage:
 * ```typescript
 * const compiler = new Compiler(manifoldModule)
 * const manifold = compiler.compile(shape.getNode())
 * // Use manifold...
 * manifold.delete() // Caller is responsible for cleanup
 * ```
 */
export class Compiler {
  private M: ManifoldToplevel
  private segments: number

  constructor(manifold: ManifoldToplevel, options: CompilerOptions = {}) {
    this.M = manifold
    this.segments = options.circularSegments ?? 32
  }

  /**
   * Compile a GeoNode tree to a Manifold geometry
   *
   * The caller is responsible for calling .delete() on the returned Manifold
   * when done to free WASM memory.
   */
  compile(node: GeoNode): Manifold {
    return this.compileNode(node)
  }

  private compileNode(node: GeoNode): Manifold {
    switch (node.type) {
      case 'primitive':
        return this.compilePrimitive(node)
      case 'operation':
        return this.compileOperation(node)
      case 'transform':
        return this.compileTransform(node)
    }
  }

  private compilePrimitive(node: GeoNode & { type: 'primitive' }): Manifold {
    if (node.shape === 'box') {
      // Manifold.cube([width, depth, height], centered: true)
      return this.M.Manifold.cube([node.width, node.depth, node.height], true)
    }
    if (node.shape === 'cylinder') {
      // Manifold.cylinder(height, radiusLow, radiusHigh, circularSegments, center)
      const radius = node.diameter / 2
      return this.M.Manifold.cylinder(node.height, radius, radius, this.segments, true)
    }
    throw new Error(`Unknown primitive: ${(node as { shape: string }).shape}`)
  }

  private compileOperation(node: GeoNode & { type: 'operation' }): Manifold {
    if (node.children.length === 0) {
      throw new Error('Operation requires at least one child')
    }

    // Compile all children first
    const children = node.children.map(c => this.compileNode(c))

    let result: Manifold

    switch (node.op) {
      case 'union':
        // Use batch union for efficiency
        result = this.M.Manifold.union(children)
        break

      case 'subtract': {
        // First child is base, rest are tools
        if (children.length === 1) {
          return children[0]!
        }
        const base = children[0]!
        const tools = children.slice(1)
        result = base.subtract(tools[0]!)
        base.delete()
        tools[0]!.delete()
        // Handle additional tools sequentially
        for (let i = 1; i < tools.length; i++) {
          const prev = result
          result = result.subtract(tools[i]!)
          prev.delete()
          tools[i]!.delete()
        }
        break
      }

      case 'intersect':
        result = this.M.Manifold.intersection(children)
        break

      default:
        throw new Error(`Unknown operation: ${(node as { op: string }).op}`)
    }

    return result
  }

  private compileTransform(node: GeoNode & { type: 'transform' }): Manifold {
    const child = this.compileNode(node.child)

    // Convert our Matrix4x4 (row-major) to Manifold's column-major Mat4
    const manifoldMatrix = this.rowMajorToColumnMajor(node.matrix)

    const result = child.transform(manifoldMatrix)
    child.delete() // Clean up intermediate

    return result
  }

  /**
   * Convert row-major 4x4 matrix to column-major 4x4 matrix (transpose)
   *
   * Our Matrix4x4 (row-major):
   * [r0c0, r0c1, r0c2, r0c3,   // row 0
   *  r1c0, r1c1, r1c2, r1c3,   // row 1
   *  r2c0, r2c1, r2c2, r2c3,   // row 2
   *  r3c0, r3c1, r3c2, r3c3]   // row 3
   *
   * Manifold expects column-major (OpenGL style):
   * [c0r0, c0r1, c0r2, c0r3,   // column 0
   *  c1r0, c1r1, c1r2, c1r3,   // column 1
   *  c2r0, c2r1, c2r2, c2r3,   // column 2
   *  c3r0, c3r1, c3r2, c3r3]   // column 3 (translation)
   *
   * This is equivalent to transposing the matrix.
   */
  private rowMajorToColumnMajor(m: Matrix4x4): Matrix4x4 {
    return [
      m[0], m[4], m[8], m[12],   // column 0
      m[1], m[5], m[9], m[13],   // column 1
      m[2], m[6], m[10], m[14],  // column 2
      m[3], m[7], m[11], m[15]   // column 3 (translation)
    ]
  }
}
