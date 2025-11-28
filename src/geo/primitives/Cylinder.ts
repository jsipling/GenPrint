/**
 * Cylinder primitive - a cylinder centered at origin along Z axis
 *
 * Dimensions:
 * - diameter: Full diameter (NOT radius)
 * - height: Height along Z axis
 */

import { Shape } from '../Shape';
import type { GeoNode, Anchor } from '../types';

export interface CylinderParams {
  /** Diameter of the cylinder */
  diameter: number;
  /** Height along Z axis */
  height: number;
}

/**
 * Cylinder - A cylindrical primitive
 *
 * Centered at origin with:
 * - Circular cross-section in XY plane with given diameter
 * - Z extent from -height/2 to +height/2
 *
 * Anchors:
 * - Face centers: top, bottom
 * - Center: center (at origin)
 * - Cardinal points on circumference at mid-height: front, back, left, right
 */
export class Cylinder extends Shape {
  private anchors: Map<string, Anchor>;

  constructor(private params: CylinderParams) {
    super();
    this.anchors = this.createAnchors();
  }

  getBaseNode(): GeoNode {
    return {
      type: 'primitive',
      shape: 'cylinder',
      diameter: this.params.diameter,
      height: this.params.height
    };
  }

  getBaseAnchors(): Map<string, Anchor> {
    return this.anchors;
  }

  private createAnchors(): Map<string, Anchor> {
    const r = this.params.diameter / 2;
    const h = this.params.height / 2;

    return new Map<string, Anchor>([
      // Circular face centers
      ['top', { position: [0, 0, h], direction: [0, 0, 1], name: 'top' }],
      ['bottom', { position: [0, 0, -h], direction: [0, 0, -1], name: 'bottom' }],

      // Center
      ['center', { position: [0, 0, 0], direction: [0, 0, 1], name: 'center' }],

      // Cardinal points on circumference at mid-height (z=0)
      // Direction is outward radial normal
      ['front', { position: [0, -r, 0], direction: [0, -1, 0], name: 'front' }],
      ['back', { position: [0, r, 0], direction: [0, 1, 0], name: 'back' }],
      ['left', { position: [-r, 0, 0], direction: [-1, 0, 0], name: 'left' }],
      ['right', { position: [r, 0, 0], direction: [1, 0, 0], name: 'right' }],
    ]);
  }
}
