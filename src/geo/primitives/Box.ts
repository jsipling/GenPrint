/**
 * Box primitive - a rectangular prism centered at origin
 *
 * Dimensions:
 * - width: X dimension
 * - depth: Y dimension
 * - height: Z dimension
 */

import { Shape } from '../Shape';
import type { GeoNode, Anchor } from '../types';

export interface BoxParams {
  /** Width along X axis */
  width: number;
  /** Depth along Y axis */
  depth: number;
  /** Height along Z axis */
  height: number;
}

/**
 * Box - A rectangular prism primitive
 *
 * Centered at origin with:
 * - X extent from -width/2 to +width/2
 * - Y extent from -depth/2 to +depth/2
 * - Z extent from -height/2 to +height/2
 *
 * Anchors:
 * - Face centers: top, bottom, front, back, left, right
 * - Center points: center, centerTop, centerBottom
 * - 8 corners: topFrontLeft, topFrontRight, topBackLeft, topBackRight,
 *              bottomFrontLeft, bottomFrontRight, bottomBackLeft, bottomBackRight
 */
export class Box extends Shape {
  private anchors: Map<string, Anchor>;

  constructor(private params: BoxParams) {
    super();
    this.anchors = this.createAnchors();
  }

  getBaseNode(): GeoNode {
    return {
      type: 'primitive',
      shape: 'box',
      width: this.params.width,
      depth: this.params.depth,
      height: this.params.height
    };
  }

  getBaseAnchors(): Map<string, Anchor> {
    return this.anchors;
  }

  private createAnchors(): Map<string, Anchor> {
    const { width, depth, height } = this.params;
    const w = width / 2;
    const d = depth / 2;
    const h = height / 2;

    return new Map<string, Anchor>([
      // Face centers with outward normals
      ['top', { position: [0, 0, h], direction: [0, 0, 1], name: 'top' }],
      ['bottom', { position: [0, 0, -h], direction: [0, 0, -1], name: 'bottom' }],
      ['front', { position: [0, -d, 0], direction: [0, -1, 0], name: 'front' }],
      ['back', { position: [0, d, 0], direction: [0, 1, 0], name: 'back' }],
      ['left', { position: [-w, 0, 0], direction: [-1, 0, 0], name: 'left' }],
      ['right', { position: [w, 0, 0], direction: [1, 0, 0], name: 'right' }],

      // Center points
      ['center', { position: [0, 0, 0], direction: [0, 0, 1], name: 'center' }],
      ['centerTop', { position: [0, 0, h], direction: [0, 0, 1], name: 'centerTop' }],
      ['centerBottom', { position: [0, 0, -h], direction: [0, 0, -1], name: 'centerBottom' }],

      // Top corners (z = +h, direction = +Z)
      ['topFrontLeft', { position: [-w, -d, h], direction: [0, 0, 1], name: 'topFrontLeft' }],
      ['topFrontRight', { position: [w, -d, h], direction: [0, 0, 1], name: 'topFrontRight' }],
      ['topBackLeft', { position: [-w, d, h], direction: [0, 0, 1], name: 'topBackLeft' }],
      ['topBackRight', { position: [w, d, h], direction: [0, 0, 1], name: 'topBackRight' }],

      // Bottom corners (z = -h, direction = -Z)
      ['bottomFrontLeft', { position: [-w, -d, -h], direction: [0, 0, -1], name: 'bottomFrontLeft' }],
      ['bottomFrontRight', { position: [w, -d, -h], direction: [0, 0, -1], name: 'bottomFrontRight' }],
      ['bottomBackLeft', { position: [-w, d, -h], direction: [0, 0, -1], name: 'bottomBackLeft' }],
      ['bottomBackRight', { position: [w, d, -h], direction: [0, 0, -1], name: 'bottomBackRight' }],
    ]);
  }
}
