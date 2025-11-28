/**
 * Connectivity check for detecting disconnected geometry components.
 * Disconnected parts won't print properly - they'll be separate pieces.
 */

import type { Manifold, Box } from 'manifold-3d'
import type { DisconnectedIssue, BBox } from '../types'
import { COMPARISON_TOLERANCE } from '../../generators/manifold/printingConstants'

/**
 * Check if a component is floating (not touching the print bed at Z=0).
 */
function isFloating(bbox: BBox): boolean {
  // Component is floating if its minimum Z is above the bed tolerance
  return bbox.min[2] > COMPARISON_TOLERANCE
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
 * Check geometry for disconnected components.
 *
 * @param manifold - The geometry to check
 * @returns DisconnectedIssue if multiple components found, null if geometry is connected
 */
export function checkConnectivity(manifold: Manifold): DisconnectedIssue | null {
  // Decompose into separate components
  const components = manifold.decompose()

  // Filter to only positive-volume components (negative volumes are holes from CSG operations)
  const positiveComponents = components.filter((c) => c.volume() > COMPARISON_TOLERANCE)

  // Clean up negative-volume components
  for (const component of components) {
    if (!positiveComponents.includes(component)) {
      component.delete()
    }
  }

  // If only one positive component, geometry is connected
  if (positiveComponents.length <= 1) {
    // Clean up
    for (const component of positiveComponents) {
      component.delete()
    }
    return null
  }

  // Analyze each component
  const componentDetails = positiveComponents.map((component) => {
    const bbox = toBBox(component.boundingBox())
    const volume = component.volume()
    const floating = isFloating(bbox)

    return {
      volume,
      bbox,
      isFloating: floating,
    }
  })

  // Clean up components
  for (const component of positiveComponents) {
    component.delete()
  }

  return {
    componentCount: componentDetails.length,
    components: componentDetails,
  }
}
