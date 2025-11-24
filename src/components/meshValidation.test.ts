import { describe, it, expect } from 'vitest'
import { validateMeshData, MeshValidationError } from './meshValidation'

describe('validateMeshData', () => {
  it('accepts valid mesh data', () => {
    const meshData = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2])
    }
    expect(() => validateMeshData(meshData)).not.toThrow()
  })

  it('throws on empty positions array', () => {
    const meshData = {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      indices: new Uint32Array(0)
    }
    expect(() => validateMeshData(meshData)).toThrow(MeshValidationError)
    expect(() => validateMeshData(meshData)).toThrow('positions array is empty')
  })

  it('throws when positions length not divisible by 3', () => {
    const meshData = {
      positions: new Float32Array([0, 0, 0, 1, 0]), // 5 values, not divisible by 3
      normals: new Float32Array([0, 0, 1, 0, 0]),
      indices: new Uint32Array([0, 1])
    }
    expect(() => validateMeshData(meshData)).toThrow(MeshValidationError)
    expect(() => validateMeshData(meshData)).toThrow('positions length must be divisible by 3')
  })

  it('throws when normals length does not match positions', () => {
    const meshData = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1]), // 6 values, should be 9
      indices: new Uint32Array([0, 1, 2])
    }
    expect(() => validateMeshData(meshData)).toThrow(MeshValidationError)
    expect(() => validateMeshData(meshData)).toThrow('normals length must match positions length')
  })

  it('throws when indices reference out-of-bounds vertices', () => {
    const meshData = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), // 3 vertices (0, 1, 2)
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 5]) // 5 is out of bounds
    }
    expect(() => validateMeshData(meshData)).toThrow(MeshValidationError)
    expect(() => validateMeshData(meshData)).toThrow('index 5 references non-existent vertex')
  })

  it('throws when indices length not divisible by 3', () => {
    const meshData = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1]) // 2 indices, not a complete triangle
    }
    expect(() => validateMeshData(meshData)).toThrow(MeshValidationError)
    expect(() => validateMeshData(meshData)).toThrow('indices length must be divisible by 3')
  })
})
