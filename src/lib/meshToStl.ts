/**
 * Convert mesh data to binary STL format
 */

interface MeshData {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

/**
 * Convert mesh data (positions, normals, indices) to binary STL blob
 */
export function meshToStl(meshData: MeshData): Blob {
  const { positions, indices } = meshData
  // Note: normals from meshData are vertex normals, but STL uses face normals
  // which we calculate below
  const numTriangles = indices.length / 3

  // Binary STL format:
  // - 80 byte header
  // - 4 byte uint32 triangle count
  // - For each triangle (50 bytes):
  //   - 12 bytes: normal vector (3 floats)
  //   - 36 bytes: 3 vertices (9 floats)
  //   - 2 bytes: attribute byte count (unused)

  const stlSize = 80 + 4 + numTriangles * 50
  const buffer = new ArrayBuffer(stlSize)
  const view = new DataView(buffer)

  // Header (80 bytes) - leave as zeros
  const header = 'Binary STL exported from GenPrint'
  for (let i = 0; i < header.length && i < 80; i++) {
    view.setUint8(i, header.charCodeAt(i))
  }

  // Triangle count
  view.setUint32(80, numTriangles, true)

  let offset = 84

  for (let i = 0; i < numTriangles; i++) {
    const i0 = indices[i * 3]!
    const i1 = indices[i * 3 + 1]!
    const i2 = indices[i * 3 + 2]!

    // Get vertices
    const v0x = positions[i0 * 3]!
    const v0y = positions[i0 * 3 + 1]!
    const v0z = positions[i0 * 3 + 2]!
    const v1x = positions[i1 * 3]!
    const v1y = positions[i1 * 3 + 1]!
    const v1z = positions[i1 * 3 + 2]!
    const v2x = positions[i2 * 3]!
    const v2y = positions[i2 * 3 + 1]!
    const v2z = positions[i2 * 3 + 2]!

    // Calculate face normal
    const e1x = v1x - v0x, e1y = v1y - v0y, e1z = v1z - v0z
    const e2x = v2x - v0x, e2y = v2y - v0y, e2z = v2z - v0z
    let nx = e1y * e2z - e1z * e2y
    let ny = e1z * e2x - e1x * e2z
    let nz = e1x * e2y - e1y * e2x
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (len > 0) {
      nx /= len
      ny /= len
      nz /= len
    }

    // Write normal
    view.setFloat32(offset, nx, true); offset += 4
    view.setFloat32(offset, ny, true); offset += 4
    view.setFloat32(offset, nz, true); offset += 4

    // Write vertex 1
    view.setFloat32(offset, v0x, true); offset += 4
    view.setFloat32(offset, v0y, true); offset += 4
    view.setFloat32(offset, v0z, true); offset += 4

    // Write vertex 2
    view.setFloat32(offset, v1x, true); offset += 4
    view.setFloat32(offset, v1y, true); offset += 4
    view.setFloat32(offset, v1z, true); offset += 4

    // Write vertex 3
    view.setFloat32(offset, v2x, true); offset += 4
    view.setFloat32(offset, v2y, true); offset += 4
    view.setFloat32(offset, v2z, true); offset += 4

    // Attribute byte count (unused, set to 0)
    view.setUint16(offset, 0, true); offset += 2
  }

  return new Blob([buffer], { type: 'model/stl' })
}
