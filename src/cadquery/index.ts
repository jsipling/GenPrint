// src/cadquery/index.ts

import type { ManifoldToplevel } from 'manifold-3d'
import type { Plane } from './types'
import { Workplane } from './Workplane'
import { MemoryManager } from './MemoryManager'

// Re-export all public components
export { Workplane } from './Workplane'
export { SelectorEngine } from './Selector'
export { MemoryManager } from './MemoryManager'
export * from './errors'
export * from './types'
export * from './CoordinateSystem'

/**
 * Factory function to create a CadQuery-like entry point.
 *
 * Usage in builder code:
 * ```typescript
 * const result = cq.Workplane("XY")
 *   .box(10, 10, 5)
 *   .faces(">Z")
 *   .workplane()
 *   .circle(3)
 *   .extrude(2)
 *   .val()
 * ```
 *
 * @param M - The Manifold-3D toplevel module
 * @returns CQ object with Workplane factory and cleanup methods
 */
export function createCQ(M: ManifoldToplevel) {
  const memoryManager = new MemoryManager()

  return {
    /**
     * Create a new workplane on the specified plane.
     * @param plane - The plane to create the workplane on ('XY', 'XZ', or 'YZ')
     */
    Workplane(plane: Plane = 'XY'): Workplane {
      return new Workplane(M, plane, memoryManager)
    },

    /**
     * Clean up all tracked resources.
     * Call this after extracting final geometry with val().
     */
    dispose(): void {
      memoryManager.releaseAll()
    },

    /**
     * Get the count of currently tracked Manifold objects.
     * Useful for debugging memory leaks.
     */
    get trackedCount(): number {
      return memoryManager.count
    }
  }
}

/**
 * Type for the CQ factory return value.
 */
export type CQ = ReturnType<typeof createCQ>
