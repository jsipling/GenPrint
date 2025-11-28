/**
 * Core type definitions for the LLM-Native Geometry Library
 */

/** 3D vector as tuple [x, y, z] */
export type Vector3 = [number, number, number];

/**
 * 4x4 transformation matrix (row-major order)
 *
 * Layout:
 * [m0,  m1,  m2,  m3,   // row 0: rotation/scale X + translation X
 *  m4,  m5,  m6,  m7,   // row 1: rotation/scale Y + translation Y
 *  m8,  m9,  m10, m11,  // row 2: rotation/scale Z + translation Z
 *  m12, m13, m14, m15]  // row 3: perspective (usually [0,0,0,1])
 */
export type Matrix4x4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

/**
 * Anchor - attachment point on a shape
 *
 * Anchors define positions and orientations for connecting shapes.
 * The direction vector indicates the "outward" normal at that point.
 */
export interface Anchor {
  /** Position in local coordinates */
  position: Vector3;
  /** Outward-facing normal direction (unit vector) */
  direction: Vector3;
  /** Unique name for this anchor */
  name: string;
}

/**
 * Alignment modes for connecting shapes
 *
 * - 'mate': Anchors face each other (directions oppose)
 * - 'flush': Anchors face same direction (directions align)
 */
export type AlignMode = 'mate' | 'flush';

/**
 * Options for aligning one shape to another
 */
export interface AlignOptions {
  /** Anchor name on the shape being aligned */
  self: string;
  /** Reference shape to align to */
  target: Shape;
  /** Anchor name on the target shape */
  to: string;
  /** Alignment mode (default: 'mate') */
  mode?: AlignMode;
  /** Optional offset from aligned position */
  offset?: { x?: number; y?: number; z?: number };
}

/**
 * GeoNode - Instruction graph intermediate representation
 *
 * Discriminated union representing geometry operations.
 * This IR can be serialized, analyzed, or compiled to various backends.
 */
export type GeoNode =
  | { type: 'primitive'; shape: 'box'; width: number; depth: number; height: number }
  | { type: 'primitive'; shape: 'cylinder'; diameter: number; height: number }
  | { type: 'operation'; op: 'union' | 'subtract' | 'intersect'; children: GeoNode[] }
  | { type: 'transform'; child: GeoNode; matrix: Matrix4x4 };

/**
 * Shape interface - the primary abstraction for geometry
 *
 * Shapes are immutable and can provide their GeoNode representation
 * and anchor points for alignment operations.
 */
export interface Shape {
  /** Get the GeoNode IR representation of this shape */
  getNode(): GeoNode;
  /** Get a named anchor point, or undefined if not found */
  getAnchor(name: string): Anchor | undefined;
}
