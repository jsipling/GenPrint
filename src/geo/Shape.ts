/**
 * Shape - Abstract base class for all geometry shapes
 *
 * Provides the foundation for anchor-based alignment and boolean operations.
 */

import type { GeoNode, Anchor, AlignOptions, Matrix4x4 } from './types';
import {
  calculateAlignmentTransform,
  IDENTITY_MATRIX,
  multiplyMatrices,
  transformPoint,
  transformDirection
} from './math';

const EPSILON = 0.0001;

/**
 * Check if a matrix is the identity matrix
 */
export function isIdentity(m: Matrix4x4): boolean {
  return (
    Math.abs(m[0] - 1) < EPSILON &&
    Math.abs(m[1]) < EPSILON &&
    Math.abs(m[2]) < EPSILON &&
    Math.abs(m[3]) < EPSILON &&
    Math.abs(m[4]) < EPSILON &&
    Math.abs(m[5] - 1) < EPSILON &&
    Math.abs(m[6]) < EPSILON &&
    Math.abs(m[7]) < EPSILON &&
    Math.abs(m[8]) < EPSILON &&
    Math.abs(m[9]) < EPSILON &&
    Math.abs(m[10] - 1) < EPSILON &&
    Math.abs(m[11]) < EPSILON &&
    Math.abs(m[12]) < EPSILON &&
    Math.abs(m[13]) < EPSILON &&
    Math.abs(m[14]) < EPSILON &&
    Math.abs(m[15] - 1) < EPSILON
  );
}

/**
 * Transform an anchor's position and direction by a matrix
 */
export function transformAnchor(anchor: Anchor, matrix: Matrix4x4): Anchor {
  return {
    position: transformPoint(anchor.position, matrix),
    direction: transformDirection(anchor.direction, matrix),
    name: anchor.name
  };
}

/**
 * Abstract base class for geometric shapes
 *
 * Shapes maintain their own transformation state and provide:
 * - Named anchors for semantic alignment
 * - Anchor-based positioning via align()
 * - Boolean operations (union, subtract, intersect)
 */
export abstract class Shape {
  protected transform: Matrix4x4 = IDENTITY_MATRIX;

  /**
   * Get the base GeoNode representation of this shape (without transform)
   * Each primitive implements this to return its specific geometry definition
   */
  abstract getBaseNode(): GeoNode;

  /**
   * Get the base anchors for this shape (without transform applied)
   * Each primitive implements this to define its attachment points
   */
  abstract getBaseAnchors(): Map<string, Anchor>;

  /**
   * Get the transformed GeoNode representation
   * Returns the base node if no transform is applied, otherwise wraps in transform node
   */
  getNode(): GeoNode {
    const baseNode = this.getBaseNode();
    if (isIdentity(this.transform)) {
      return baseNode;
    }
    return { type: 'transform', child: baseNode, matrix: this.transform };
  }

  /**
   * Get an anchor by name (with current transform applied)
   * Returns undefined if anchor doesn't exist
   */
  getAnchor(name: string): Anchor | undefined {
    const base = this.getBaseAnchors().get(name);
    if (!base) return undefined;
    return transformAnchor(base, this.transform);
  }

  /**
   * Get all available anchor names for this shape
   */
  getAnchorNames(): string[] {
    return Array.from(this.getBaseAnchors().keys());
  }

  /**
   * Align this shape to another shape using named anchors
   *
   * @param options.self - Name of anchor on this shape
   * @param options.target - The shape to align to
   * @param options.to - Name of anchor on the target shape
   * @param options.mode - 'mate' (facing each other) or 'flush' (same direction), default 'mate'
   * @param options.offset - Optional offset from aligned position
   * @returns this for chaining
   * @throws Error if anchor names don't exist
   */
  align(options: AlignOptions): this {
    const selfAnchor = this.getAnchor(options.self);
    if (!selfAnchor) {
      throw new Error(`Unknown anchor: ${options.self}`);
    }

    const targetAnchor = options.target.getAnchor(options.to);
    if (!targetAnchor) {
      throw new Error(`Unknown anchor: ${options.to}`);
    }

    const alignTransform = calculateAlignmentTransform(
      selfAnchor,
      targetAnchor,
      options.mode ?? 'mate',
      options.offset
    );

    this.transform = multiplyMatrices(alignTransform, this.transform);
    return this;
  }

  /**
   * Create a new shape by subtracting another shape from this one
   * Does not mutate either shape
   */
  subtract(other: Shape): BooleanShape {
    return new BooleanShape('subtract', [this, other]);
  }

  /**
   * Create a new shape by unioning another shape with this one
   * Does not mutate either shape
   */
  union(other: Shape): BooleanShape {
    return new BooleanShape('union', [this, other]);
  }

  /**
   * Create a new shape by intersecting this shape with another
   * Does not mutate either shape
   */
  intersect(other: Shape): BooleanShape {
    return new BooleanShape('intersect', [this, other]);
  }
}

/**
 * BooleanShape - Result of boolean operations between shapes
 *
 * Inherits anchors from the first child shape.
 * Can be further combined with additional boolean operations.
 */
export class BooleanShape extends Shape {
  constructor(
    private op: 'union' | 'subtract' | 'intersect',
    private children: Shape[]
  ) {
    super();
  }

  getBaseNode(): GeoNode {
    return {
      type: 'operation',
      op: this.op,
      children: this.children.map(c => c.getNode())
    };
  }

  getBaseAnchors(): Map<string, Anchor> {
    // Boolean shapes inherit anchors from first child
    return this.children[0]?.getBaseAnchors() ?? new Map();
  }

  // Override boolean operations to allow chaining
  subtract(other: Shape): BooleanShape {
    return new BooleanShape('subtract', [this, other]);
  }

  union(other: Shape): BooleanShape {
    return new BooleanShape('union', [this, other]);
  }

  intersect(other: Shape): BooleanShape {
    return new BooleanShape('intersect', [this, other]);
  }
}
