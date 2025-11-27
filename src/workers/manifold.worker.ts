import Module, { type ManifoldToplevel, type Manifold, type Mesh } from 'manifold-3d'
// Import WASM file URL for proper loading in worker context
import wasmUrl from 'manifold-3d/manifold.wasm?url'
import { BuilderContext } from '../generators/manifold/fluent/BuilderContext'
import type { MeshData, BoundingBox } from '../generators/types'
import type {
  BuildRequest,
  BuildResponse,
  ReadyMessage,
  InitErrorMessage,
  WorkerMessage
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
 * Execute user-generated builder code in a sandboxed context
 * Returns the built Manifold or throws an error
 */
function executeUserBuilder(
  M: ManifoldToplevel,
  builderCode: string,
  params: Record<string, number | string | boolean>
): Manifold {
  const ctx = new BuilderContext(M)

  // Create a sandboxed function with access only to ctx and params
  // The code is expected to use ctx methods and return a Manifold
  const fn = new Function('ctx', 'params', `
    const { box, cylinder, sphere, cone, roundedBox, tube, hole, counterboredHole, countersunkHole, extrude, revolve, union, difference, intersection, linearArray, polarArray, gridArray, ensureMinWall, ensureMinFeature } = ctx
    const { constants, ops, primitives } = ctx
    ${builderCode}
  `)

  const result = fn(ctx, params)

  // Handle both Shape and Manifold returns
  if (result && typeof result.build === 'function') {
    // It's a Shape - get the underlying Manifold
    return result.build()
  } else if (result && typeof result.getMesh === 'function') {
    // It's already a Manifold
    return result
  } else {
    throw new Error('Builder must return a Shape or Manifold')
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
      const manifold = executeUserBuilder(manifoldModule, builderCode, params)

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

      const timing = performance.now() - startTime
      if (import.meta.env.DEV) {
        console.log(`[Manifold] Build time: ${timing.toFixed(1)}ms`)
      }

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

