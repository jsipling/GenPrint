/**
 * toBuilderCode - Convert GeoNode to executable builderCode string
 *
 * This provides backward compatibility with the existing generator infrastructure.
 * New code can use the geo API internally while still working with generators
 * that expect builderCode strings.
 *
 * The generated code is self-contained and can be executed in the worker
 * with just the Manifold module (M) and params available.
 */

import type { GeoNode } from './types'

/**
 * Convert a GeoNode to a builderCode string that can be executed in the worker.
 *
 * The generated code:
 * - Is a self-contained function that builds the geometry
 * - Uses only the M (Manifold module) variable available in the worker
 * - Handles memory management (deletes intermediate manifolds)
 * - Returns the final Manifold geometry
 *
 * @param node The GeoNode to convert
 * @returns A string of JavaScript code that, when executed with M available, returns a Manifold
 *
 * @example
 * ```typescript
 * const box = new Box({ width: 10, depth: 20, height: 5 })
 * const code = toBuilderCode(box.getNode())
 * // code can be passed to the worker as builderCode
 * ```
 */
export function toBuilderCode(node: GeoNode): string {
  // Serialize the node to JSON for embedding in the code
  const nodeJson = JSON.stringify(node)

  return `
    // GeoNode builder function - converts instruction graph to Manifold geometry
    function buildNode(node) {
      switch (node.type) {
        case 'primitive':
          return buildPrimitive(node);
        case 'transform':
          return buildTransform(node);
        case 'operation':
          return buildOperation(node);
        default:
          throw new Error('Unknown node type: ' + node.type);
      }
    }

    function buildPrimitive(node) {
      if (node.shape === 'box') {
        return M.Manifold.cube([node.width, node.depth, node.height], true);
      }
      if (node.shape === 'cylinder') {
        const r = node.diameter / 2;
        return M.Manifold.cylinder(node.height, r, r, 32, true);
      }
      throw new Error('Unknown primitive shape: ' + node.shape);
    }

    function buildTransform(node) {
      const child = buildNode(node.child);
      const m = node.matrix;

      // Convert row-major (our format) to column-major (Manifold format)
      // Our matrix: [r0c0, r0c1, r0c2, r0c3, r1c0, r1c1, r1c2, r1c3, ...]
      // Manifold:   [c0r0, c0r1, c0r2, c0r3, c1r0, c1r1, c1r2, c1r3, ...]
      const colMajor = [
        m[0], m[4], m[8], m[12],
        m[1], m[5], m[9], m[13],
        m[2], m[6], m[10], m[14],
        m[3], m[7], m[11], m[15]
      ];

      const result = child.transform(colMajor);
      child.delete();
      return result;
    }

    function buildOperation(node) {
      if (node.children.length === 0) {
        throw new Error('Operation requires at least one child');
      }

      const children = node.children.map(c => buildNode(c));

      if (node.op === 'union') {
        const result = M.Manifold.union(children);
        return result;
      }

      if (node.op === 'subtract') {
        if (children.length === 1) {
          return children[0];
        }
        let base = children[0];
        for (let i = 1; i < children.length; i++) {
          const next = base.subtract(children[i]);
          base.delete();
          children[i].delete();
          base = next;
        }
        return base;
      }

      if (node.op === 'intersect') {
        const result = M.Manifold.intersection(children);
        return result;
      }

      throw new Error('Unknown operation: ' + node.op);
    }

    // Build the geometry from the embedded node
    const geoNode = ${nodeJson};
    return buildNode(geoNode);
  `
}
