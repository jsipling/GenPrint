import type { Manifold } from 'manifold-3d'

/**
 * Manages lifecycle of Manifold WASM objects to prevent memory leaks.
 * Tracks all created objects and ensures cleanup on finalize.
 */
export class MemoryManager {
  private tracked = new Set<Manifold>()

  /**
   * Start tracking a Manifold object.
   */
  track(manifold: Manifold): void {
    this.tracked.add(manifold)
  }

  /**
   * Release a tracked object (calls .delete()).
   */
  release(manifold: Manifold): void {
    if (this.tracked.has(manifold)) {
      this.tracked.delete(manifold)
      manifold.delete()
    }
  }

  /**
   * Release all tracked objects except the specified one.
   * Used when finalizing to keep only the result.
   */
  releaseAllExcept(keep: Manifold): void {
    for (const manifold of this.tracked) {
      if (manifold !== keep) {
        manifold.delete()
      }
    }
    this.tracked.clear()
    this.tracked.add(keep)
  }

  /**
   * Release all tracked objects.
   */
  releaseAll(): void {
    for (const manifold of this.tracked) {
      manifold.delete()
    }
    this.tracked.clear()
  }

  /**
   * Get count of tracked objects (for debugging/testing).
   */
  get count(): number {
    return this.tracked.size
  }

  /**
   * Check if a manifold is being tracked.
   */
  isTracked(manifold: Manifold): boolean {
    return this.tracked.has(manifold)
  }
}
