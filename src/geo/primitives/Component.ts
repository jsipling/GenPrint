/**
 * Component - A shape wrapper with custom anchors
 *
 * Components enable defining reusable parts with semantic attachment points
 * that represent real-world features like mounting holes, ports, connectors, etc.
 *
 * @example
 * ```typescript
 * const piBoard = new Component({
 *   shape: new Box({ width: 85, depth: 56, height: 2 }),
 *   anchors: {
 *     usbPort: { position: [30, 0, 1], direction: [1, 0, 0] },
 *     mountingHole1: { position: [3.5, 3.5, 0], direction: [0, 0, -1] }
 *   }
 * });
 *
 * // Align a standoff to the mounting hole
 * standoff.align({
 *   self: 'top',
 *   target: piBoard,
 *   to: 'mountingHole1',
 *   mode: 'mate'
 * });
 * ```
 */

import { Shape, BooleanShape } from '../Shape'
import type { GeoNode, Anchor, Vector3 } from '../types'

/**
 * Definition for a custom anchor point
 */
export interface AnchorDefinition {
  /** Position in local coordinates */
  position: Vector3
  /** Outward-facing normal direction */
  direction: Vector3
}

/**
 * Parameters for creating a Component
 */
export interface ComponentParams {
  /** The underlying shape */
  shape: Shape
  /** Custom anchor definitions (name -> anchor) */
  anchors: Record<string, AnchorDefinition>
}

/**
 * Component wraps a shape and adds custom named anchors.
 *
 * Features:
 * - Preserves all anchors from the wrapped shape
 * - Custom anchors override base anchors with the same name
 * - Generates the same geometry as the wrapped shape
 * - Custom anchors transform correctly when the component is aligned
 */
export class Component extends Shape {
  private innerShape: Shape
  private customAnchors: Map<string, Anchor>

  constructor(params: ComponentParams) {
    super()
    this.innerShape = params.shape
    this.customAnchors = new Map()

    // Convert anchor definitions to full Anchor objects
    for (const [name, def] of Object.entries(params.anchors)) {
      this.customAnchors.set(name, {
        position: def.position,
        direction: def.direction,
        name
      })
    }
  }

  /**
   * Get the base GeoNode - delegates to the wrapped shape
   */
  getBaseNode(): GeoNode {
    return this.innerShape.getNode()
  }

  /**
   * Get all anchors - combines inner shape anchors with custom anchors.
   * Custom anchors override base anchors with the same name.
   */
  getBaseAnchors(): Map<string, Anchor> {
    // Start with inner shape's base anchors
    const innerAnchors = this.innerShape.getBaseAnchors()
    const anchors = new Map<string, Anchor>(innerAnchors)

    // Add/override with custom anchors
    for (const [name, anchor] of this.customAnchors) {
      anchors.set(name, anchor)
    }

    return anchors
  }

  /**
   * Create a new shape by subtracting another shape from this component
   */
  subtract(other: Shape): BooleanShape {
    return new BooleanShape('subtract', [this, other])
  }

  /**
   * Create a new shape by unioning another shape with this component
   */
  union(other: Shape): BooleanShape {
    return new BooleanShape('union', [this, other])
  }

  /**
   * Create a new shape by intersecting this component with another shape
   */
  intersect(other: Shape): BooleanShape {
    return new BooleanShape('intersect', [this, other])
  }
}
