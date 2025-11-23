/**
 * Shared manifold setup for tests
 * Loads WASM once per test file via beforeAll
 */
import Module, { type ManifoldToplevel } from 'manifold-3d'

let manifoldModule: ManifoldToplevel | null = null

/**
 * Get or initialize the manifold module
 * Call this in beforeAll() for each test file that needs manifold
 */
export async function getManifold(): Promise<ManifoldToplevel> {
  if (manifoldModule) {
    return manifoldModule
  }

  // Initialize manifold-3d WASM
  manifoldModule = await Module()
  manifoldModule.setup()

  return manifoldModule
}

/**
 * Set circular segments for quality control
 * Higher values = smoother curves but slower tests
 */
export function setCircularSegments(M: ManifoldToplevel, segments: number): void {
  M.setCircularSegments(segments)
}
