/**
 * Pattern utilities for creating repeated geometry arrangements
 *
 * These functions create copies of shapes arranged in linear or circular patterns,
 * returning a union of all copies as a single Shape.
 */

import { Shape } from './Shape'
import type { GeoNode, Anchor } from './types'
import { translationMatrix, multiplyMatrices } from './math'

/**
 * PatternShape - Result of pattern operations
 *
 * Wraps multiple transformed copies of a shape into a union.
 * Does not provide anchors since patterns represent multiple instances.
 */
class PatternShape extends Shape {
  constructor(private nodes: GeoNode[]) {
    super()
  }

  getBaseNode(): GeoNode {
    return { type: 'operation', op: 'union', children: this.nodes }
  }

  getBaseAnchors(): Map<string, Anchor> {
    // Patterns don't have anchors - they represent multiple instances
    return new Map()
  }
}

/**
 * Create copies of a shape arranged in a line
 *
 * @param shape - The shape to copy
 * @param count - Number of copies to create
 * @param spacing - Distance between each copy
 * @param direction - Axis to arrange copies along ('x', 'y', or 'z')
 * @returns A Shape containing the union of all copies
 *
 * @example
 * ```typescript
 * const post = shape.cylinder({ diameter: 10, height: 50 })
 * const fence = linearPattern(post, 5, 20, 'x')
 * // Creates 5 posts spaced 20mm apart along X axis
 * ```
 */
export function linearPattern(
  shape: Shape,
  count: number,
  spacing: number,
  direction: 'x' | 'y' | 'z'
): Shape {
  const nodes: GeoNode[] = []
  const baseNode = shape.getNode()

  for (let i = 0; i < count; i++) {
    const offset = i * spacing

    // Calculate translation based on direction
    let tx = 0, ty = 0, tz = 0
    switch (direction) {
      case 'x':
        tx = offset
        break
      case 'y':
        ty = offset
        break
      case 'z':
        tz = offset
        break
    }

    // Apply pattern translation to the shape's node
    const patternTransform = translationMatrix(tx, ty, tz)

    // Wrap the base node with the pattern transform
    if (baseNode.type === 'transform') {
      // Combine pattern transform with existing transform
      const combinedMatrix = multiplyMatrices(patternTransform, baseNode.matrix)
      nodes.push({ type: 'transform', child: baseNode.child, matrix: combinedMatrix })
    } else {
      // Apply pattern transform to primitive
      nodes.push({ type: 'transform', child: baseNode, matrix: patternTransform })
    }
  }

  return new PatternShape(nodes)
}

/**
 * Create copies of a shape arranged in a circle
 *
 * @param shape - The shape to copy
 * @param count - Number of copies to create
 * @param radius - Distance from center to each copy
 * @param axis - Axis perpendicular to the circle plane ('x', 'y', or 'z')
 * @returns A Shape containing the union of all copies
 *
 * @example
 * ```typescript
 * const hole = shape.cylinder({ diameter: 5, height: 10 })
 * const boltHoles = circularPattern(hole, 6, 25, 'z')
 * // Creates 6 holes evenly spaced in a circle of radius 25mm around Z axis
 * ```
 */
export function circularPattern(
  shape: Shape,
  count: number,
  radius: number,
  axis: 'x' | 'y' | 'z'
): Shape {
  const nodes: GeoNode[] = []
  const baseNode = shape.getNode()

  const angleStep = (2 * Math.PI) / count

  for (let i = 0; i < count; i++) {
    const angle = i * angleStep

    // Calculate position on circle based on axis
    let tx = 0, ty = 0, tz = 0
    switch (axis) {
      case 'z':
        // Circle in XY plane
        tx = radius * Math.cos(angle)
        ty = radius * Math.sin(angle)
        break
      case 'y':
        // Circle in XZ plane
        tx = radius * Math.cos(angle)
        tz = radius * Math.sin(angle)
        break
      case 'x':
        // Circle in YZ plane
        ty = radius * Math.cos(angle)
        tz = radius * Math.sin(angle)
        break
    }

    // Apply pattern translation to the shape's node
    const patternTransform = translationMatrix(tx, ty, tz)

    // Wrap the base node with the pattern transform
    if (baseNode.type === 'transform') {
      // Combine pattern transform with existing transform
      const combinedMatrix = multiplyMatrices(patternTransform, baseNode.matrix)
      nodes.push({ type: 'transform', child: baseNode.child, matrix: combinedMatrix })
    } else {
      // Apply pattern transform to primitive
      nodes.push({ type: 'transform', child: baseNode, matrix: patternTransform })
    }
  }

  return new PatternShape(nodes)
}
