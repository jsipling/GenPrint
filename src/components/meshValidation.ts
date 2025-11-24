import type { MeshData } from '../generators/types'

export type { MeshData }

export class MeshValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MeshValidationError'
  }
}

/**
 * Validates mesh data structure and bounds
 * @throws MeshValidationError if mesh data is invalid
 */
export function validateMeshData(meshData: MeshData): void {
  const { positions, normals, indices } = meshData

  // Check for empty data
  if (positions.length === 0) {
    throw new MeshValidationError('positions array is empty')
  }

  // Positions must be xyz triplets
  if (positions.length % 3 !== 0) {
    throw new MeshValidationError('positions length must be divisible by 3')
  }

  // Normals must match positions
  if (normals.length !== positions.length) {
    throw new MeshValidationError('normals length must match positions length')
  }

  // Indices must form triangles
  if (indices.length % 3 !== 0) {
    throw new MeshValidationError('indices length must be divisible by 3')
  }

  // Check index bounds
  const vertexCount = positions.length / 3
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]!
    if (index >= vertexCount) {
      throw new MeshValidationError(`index ${index} references non-existent vertex (max: ${vertexCount - 1})`)
    }
  }
}
