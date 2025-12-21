import Module, { type ManifoldToplevel, type Manifold, type Mesh } from 'manifold-3d'
// Import WASM file URL for proper loading in worker context
import wasmUrl from 'manifold-3d/manifold.wasm?url'
import { MIN_WALL_THICKNESS, MIN_FEATURE_SIZE } from '../generators/manifold/printingConstants'
import { createCQ } from '../cadquery'
import type { MeshData, BoundingBox, NamedPart } from '../generators/types'
import type {
  BuildRequest,
  BuildResponse,
  ReadyMessage,
  InitErrorMessage,
  WorkerMessage,
  NamedManifoldResult
} from './types'

let manifoldModule: ManifoldToplevel | null = null

// Initialize manifold-3d with explicit WASM path
Module({
  locateFile: () => wasmUrl
})
  .then((M) => {
    manifoldModule = M
    M.setup()
    const msg: ReadyMessage = { type: 'ready' }
    postMessage(msg)
  })
  .catch((err) => {
    console.error('[ManifoldWorker] Failed to load manifold-3d:', err)
    const msg: InitErrorMessage = {
      type: 'init-error',
      error: err instanceof Error ? err.message : 'Failed to load WASM module'
    }
    postMessage(msg)
  })

/**
 * Convert a Manifold to mesh data suitable for Three.js BufferGeometry
 */
function manifoldToMeshData(manifold: Manifold): MeshData {
  const mesh: Mesh = manifold.getMesh()

  const numVerts = mesh.numVert
  const numTris = mesh.numTri

  // Extract positions (first 3 properties per vertex)
  const positions = new Float32Array(numVerts * 3)
  for (let i = 0; i < numVerts; i++) {
    const pos = mesh.position(i)
    positions[i * 3] = pos[0] ?? 0
    positions[i * 3 + 1] = pos[1] ?? 0
    positions[i * 3 + 2] = pos[2] ?? 0
  }

  // Extract indices
  const indices = new Uint32Array(numTris * 3)
  for (let i = 0; i < numTris; i++) {
    const tri = mesh.verts(i)
    indices[i * 3] = tri[0] ?? 0
    indices[i * 3 + 1] = tri[1] ?? 0
    indices[i * 3 + 2] = tri[2] ?? 0
  }

  // Calculate normals (Three.js can do this, but we'll do it here for completeness)
  const normals = new Float32Array(numVerts * 3)
  const counts = new Uint32Array(numVerts)

  // Accumulate face normals to vertices
  for (let i = 0; i < numTris; i++) {
    const i0 = indices[i * 3]!
    const i1 = indices[i * 3 + 1]!
    const i2 = indices[i * 3 + 2]!

    // Get vertex positions
    const v0x = positions[i0 * 3]!, v0y = positions[i0 * 3 + 1]!, v0z = positions[i0 * 3 + 2]!
    const v1x = positions[i1 * 3]!, v1y = positions[i1 * 3 + 1]!, v1z = positions[i1 * 3 + 2]!
    const v2x = positions[i2 * 3]!, v2y = positions[i2 * 3 + 1]!, v2z = positions[i2 * 3 + 2]!

    // Calculate face normal (cross product of edges)
    const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z
    const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x

    // Add to each vertex
    for (const idx of [i0, i1, i2]) {
      normals[idx * 3]! += nx
      normals[idx * 3 + 1]! += ny
      normals[idx * 3 + 2]! += nz
      counts[idx]!++
    }
  }

  // Normalize
  for (let i = 0; i < numVerts; i++) {
    if (counts[i]! > 0) {
      const nx = normals[i * 3]!
      const ny = normals[i * 3 + 1]!
      const nz = normals[i * 3 + 2]!
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (len > 0) {
        normals[i * 3] = nx / len
        normals[i * 3 + 1] = ny / len
        normals[i * 3 + 2] = nz / len
      }
    }
  }

  return { positions, normals, indices }
}

/**
 * Type guard to check if builder result is an array of named manifold results.
 */
function isNamedManifoldArray(result: unknown): result is NamedManifoldResult[] {
  if (!Array.isArray(result)) return false
  if (result.length === 0) return false
  // Check first element has required shape
  const first = result[0]
  return (
    typeof first === 'object' &&
    first !== null &&
    'name' in first &&
    typeof first.name === 'string' &&
    'manifold' in first &&
    typeof (first.manifold as Manifold).getMesh === 'function'
  )
}

/**
 * Compute combined bounding box from multiple bounding boxes.
 */
function computeCombinedBoundingBox(boxes: BoundingBox[]): BoundingBox {
  if (boxes.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0] }
  }
  const combined: BoundingBox = {
    min: [...boxes[0]!.min] as [number, number, number],
    max: [...boxes[0]!.max] as [number, number, number]
  }
  for (let i = 1; i < boxes.length; i++) {
    const box = boxes[i]!
    combined.min[0] = Math.min(combined.min[0], box.min[0])
    combined.min[1] = Math.min(combined.min[1], box.min[1])
    combined.min[2] = Math.min(combined.min[2], box.min[2])
    combined.max[0] = Math.max(combined.max[0], box.max[0])
    combined.max[1] = Math.max(combined.max[1], box.max[1])
    combined.max[2] = Math.max(combined.max[2], box.max[2])
  }
  return combined
}

/**
 * Process an array of named manifold results into named parts.
 * Converts each manifold to MeshData and extracts bounding boxes.
 * Cleans up manifold WASM memory after conversion.
 */
function processNamedManifolds(results: NamedManifoldResult[]): {
  parts: NamedPart[]
  boundingBox: BoundingBox
  transferBuffers: ArrayBuffer[]
} {
  const parts: NamedPart[] = []
  const boundingBoxes: BoundingBox[] = []
  const transferBuffers: ArrayBuffer[] = []

  for (const result of results) {
    const bbox = result.manifold.boundingBox()
    const boundingBox: BoundingBox = {
      min: [bbox.min[0], bbox.min[1], bbox.min[2]],
      max: [bbox.max[0], bbox.max[1], bbox.max[2]]
    }
    boundingBoxes.push(boundingBox)

    const meshData = manifoldToMeshData(result.manifold)
    parts.push({
      name: result.name,
      meshData,
      boundingBox,
      dimensions: result.dimensions,
      params: result.params
    })

    // Collect buffers for transfer
    transferBuffers.push(
      meshData.positions.buffer,
      meshData.normals.buffer,
      meshData.indices.buffer
    )

    // Clean up manifold WASM memory
    result.manifold.delete()
  }

  return {
    parts,
    boundingBox: computeCombinedBoundingBox(boundingBoxes),
    transferBuffers
  }
}

/**
 * Execute user-generated builder code in a sandboxed context.
 * Returns either a single Manifold or an array of NamedManifoldResult for multi-part models.
 *
 * The code has access to:
 * - M: Manifold-3D toplevel (for raw Manifold API)
 * - cq: CadQuery factory (for fluent API)
 * - MIN_WALL_THICKNESS, MIN_FEATURE_SIZE: printing constants
 * - params: user-provided parameters
 */
function executeUserBuilder(
  M: ManifoldToplevel,
  builderCode: string,
  params: Record<string, number | string | boolean>
): Manifold | NamedManifoldResult[] {
  // Create CQ instance for this build
  const cq = createCQ(M)

  try {
    // Create a sandboxed function with access to M, cq, constants, and params
    // The code can return either a Manifold, a Workplane (which has .val()), or an array of named parts
    const fn = new Function(
      'M',
      'cq',
      'MIN_WALL_THICKNESS',
      'MIN_FEATURE_SIZE',
      'params',
      `
    ${builderCode}
  `
    )

    const result = fn(M, cq, MIN_WALL_THICKNESS, MIN_FEATURE_SIZE, params)

    // Handle Workplane return values
    if (result && typeof result.val === 'function') {
      // It's a Workplane - extract the Manifold
      return result.val()
    }

    // Check for multi-part result
    if (isNamedManifoldArray(result)) {
      return result
    }

    // Result should be a Manifold
    if (result && typeof result.getMesh === 'function') {
      return result
    } else {
      throw new Error('Builder must return a Manifold, Workplane, or array of NamedManifoldResult')
    }
  } finally {
    // Clean up CQ resources, even if an error occurred
    cq.dispose()
  }
}

onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { data } = event

  if (data.type === 'build') {
    const { id, builderCode, params, circularSegments } = data
    const startTime = performance.now()

    if (!manifoldModule) {
      const response: BuildResponse = {
        type: 'build-result',
        id,
        success: false,
        error: 'Manifold module not loaded'
      }
      postMessage(response)
      return
    }

    try {
      // Set quality
      manifoldModule.setCircularSegments(circularSegments)

      // Execute the builder code
      const result = executeUserBuilder(manifoldModule, builderCode, params)

      const timing = performance.now() - startTime
      if (import.meta.env.DEV) {
        console.log(`[Manifold] Build time: ${timing.toFixed(1)}ms`)
      }

      // Check if multi-part result
      if (Array.isArray(result)) {
        // Multi-part result: process each named manifold
        const { parts, boundingBox, transferBuffers } = processNamedManifolds(result)

        const response: BuildResponse = {
          type: 'build-result',
          id,
          success: true,
          parts,
          boundingBox,
          timing
        }

        // Transfer all buffers to avoid copying
        postMessage(response, { transfer: transferBuffers })
      } else {
        // Single-part result: backwards compatible path
        const manifold = result

        // Get bounding box before cleanup
        const bbox = manifold.boundingBox()
        const boundingBox: BoundingBox = {
          min: [bbox.min[0], bbox.min[1], bbox.min[2]],
          max: [bbox.max[0], bbox.max[1], bbox.max[2]]
        }

        // Convert to mesh data
        const meshData = manifoldToMeshData(manifold)

        // Clean up WASM memory
        manifold.delete()

        const response: BuildResponse = {
          type: 'build-result',
          id,
          success: true,
          meshData,
          boundingBox,
          timing
        }

        // Transfer buffers to avoid copying
        postMessage(response, {
          transfer: [
            meshData.positions.buffer,
            meshData.normals.buffer,
            meshData.indices.buffer
          ]
        })
      }

    } catch (err) {
      const response: BuildResponse = {
        type: 'build-result',
        id,
        success: false,
        error: err instanceof Error ? err.message : 'Build failed'
      }
      postMessage(response)
    }
  }
}

// Re-export types for convenience (used by useManifold)
export type { BuildRequest, BuildResponse, MeshData }

