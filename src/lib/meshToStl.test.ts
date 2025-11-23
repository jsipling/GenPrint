import { describe, it, expect } from 'vitest'
import { meshToStl } from './meshToStl'

describe('meshToStl', () => {
  // Simple triangle mesh (1 face)
  const simpleMesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2])
  }

  // Two triangles (forming a quad)
  const quadMesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3])
  }

  it('returns a Blob', () => {
    const result = meshToStl(simpleMesh)
    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('model/stl')
  })

  it('generates correct binary size for single triangle', () => {
    const result = meshToStl(simpleMesh)
    // 80 header + 4 count + 50 per triangle
    expect(result.size).toBe(80 + 4 + 50)
  })

  it('generates correct binary size for two triangles', () => {
    const result = meshToStl(quadMesh)
    expect(result.size).toBe(80 + 4 + 100)
  })

  it('handles empty mesh', () => {
    const emptyMesh = {
      positions: new Float32Array([]),
      normals: new Float32Array([]),
      indices: new Uint32Array([])
    }
    const result = meshToStl(emptyMesh)
    expect(result.size).toBe(80 + 4) // Just header and zero count
  })

  it('binary content has correct header', async () => {
    const result = meshToStl(simpleMesh)
    const buffer = await result.arrayBuffer()
    const header = new TextDecoder().decode(buffer.slice(0, 40))
    expect(header).toContain('Binary STL')
  })

  it('binary content has correct triangle count', async () => {
    const result = meshToStl(quadMesh)
    const buffer = await result.arrayBuffer()
    const view = new DataView(buffer)
    const triangleCount = view.getUint32(80, true) // Little-endian
    expect(triangleCount).toBe(2)
  })
})
