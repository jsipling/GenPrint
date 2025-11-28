/**
 * Thin wall detection for printability analysis.
 * Detects geometry sections that are too thin to print reliably.
 *
 * Uses bounding-box based analysis for reliability - conservative approach
 * that avoids false positives per AGENTS.md guidelines.
 */

import type { Manifold, Box } from 'manifold-3d'
import type { ThinWallIssue, BBox } from '../types'

type AxisAlignment = 'X' | 'Y' | 'Z' | 'None'

/**
 * Detect axis alignment from bounding box dimensions.
 * Returns the axis of the thin dimension.
 */
function detectAxisAlignment(bbox: BBox): AxisAlignment {
  const dimX = bbox.max[0] - bbox.min[0]
  const dimY = bbox.max[1] - bbox.min[1]
  const dimZ = bbox.max[2] - bbox.min[2]
  const dims = [dimX, dimY, dimZ]

  const minDim = Math.min(...dims)
  const maxDim = Math.max(...dims)

  // If one dimension is much smaller than others, it's aligned to that axis
  // Using 0.3 ratio as threshold (thin dimension < 30% of largest)
  if (minDim < maxDim * 0.3) {
    if (minDim === dimX) return 'X'
    if (minDim === dimY) return 'Y'
    if (minDim === dimZ) return 'Z'
  }

  return 'None'
}

/**
 * Get the smallest dimension of a bounding box.
 */
function getSmallestDimension(bbox: BBox): number {
  const dimX = bbox.max[0] - bbox.min[0]
  const dimY = bbox.max[1] - bbox.min[1]
  const dimZ = bbox.max[2] - bbox.min[2]
  return Math.min(dimX, dimY, dimZ)
}

/**
 * Convert manifold bounding box to our BBox type.
 */
function toBBox(manifoldBbox: Box): BBox {
  return {
    min: [...manifoldBbox.min],
    max: [...manifoldBbox.max],
  }
}

/**
 * Create a thin wall issue from a manifold component.
 */
function createIssue(manifold: Manifold, bbox: BBox, minThickness: number): ThinWallIssue {
  return {
    measured: getSmallestDimension(bbox),
    required: minThickness,
    bbox,
    axisAlignment: detectAxisAlignment(bbox),
    estimatedVolume: manifold.volume(),
  }
}

/**
 * Check geometry for thin walls that may not print reliably.
 *
 * Algorithm:
 * 1. Decompose into components
 * 2. Check each component's bounding box for thin dimensions
 * 3. Report any components where smallest dimension < minThickness
 *
 * This approach is conservative - it reliably detects thin geometry
 * but may not catch all thin sections within complex shapes.
 *
 * @param manifold - The geometry to check
 * @param minThickness - Minimum wall thickness
 * @returns Array of thin wall issues, empty if geometry passes
 */
export function checkThinWalls(manifold: Manifold, minThickness: number): ThinWallIssue[] {
  const volume = manifold.volume()

  // Skip invalid geometry
  if (volume <= 0) {
    return []
  }

  const issues: ThinWallIssue[] = []

  // Decompose to check each component individually
  const components = manifold.decompose()

  for (const component of components) {
    const compBbox = toBBox(component.boundingBox())
    const compSmallest = getSmallestDimension(compBbox)

    if (compSmallest < minThickness) {
      issues.push(createIssue(component, compBbox, minThickness))
    }

    component.delete()
  }

  // Sort by coordinate for deterministic output
  return issues.sort((a, b) => {
    if (a.bbox.min[0] !== b.bbox.min[0]) return a.bbox.min[0] - b.bbox.min[0]
    if (a.bbox.min[1] !== b.bbox.min[1]) return a.bbox.min[1] - b.bbox.min[1]
    return a.bbox.min[2] - b.bbox.min[2]
  })
}
