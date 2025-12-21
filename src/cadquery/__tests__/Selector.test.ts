import { describe, it, expect, vi } from 'vitest'
import { SelectorEngine } from '../Selector'
import { SelectorError } from '../errors'

describe('SelectorEngine', () => {
  describe('selector parsing and validation', () => {
    it('should reject unknown selector tokens', () => {
      const engine = new SelectorEngine()

      // Create a mock mesh with basic structure
      const mockMesh = {
        numTri: 0,
        numVert: 0,
        numEdge: 0,
        verts: vi.fn().mockReturnValue([0, 1, 2]),
        position: vi.fn().mockReturnValue([0, 0, 0])
      }

      // Invalid selector token should throw
      expect(() => engine.selectFaces(mockMesh as any, 'INVALID')).toThrow(SelectorError)
    })

    it('should accept direction selector >X', () => {
      const engine = new SelectorEngine()

      // Create a mock mesh with at least one triangle
      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => {
          if (i === 0) return [0, 1, 2]
          return [0, 1, 2]
        }),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      // Should not throw
      expect(() => engine.selectFaces(mockMesh as any, '>X')).not.toThrow()
    })

    it('should accept direction selector <Z', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      expect(() => engine.selectFaces(mockMesh as any, '<Z')).not.toThrow()
    })

    it('should accept parallel selector |Y', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      expect(() => engine.selectFaces(mockMesh as any, '|Y')).not.toThrow()
    })

    it('should accept perpendicular selector #X', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      expect(() => engine.selectFaces(mockMesh as any, '#X')).not.toThrow()
    })

    it('should accept boolean operator and', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      expect(() => engine.selectFaces(mockMesh as any, '>X and |Y')).not.toThrow()
    })

    it('should accept boolean operator or', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      expect(() => engine.selectFaces(mockMesh as any, '>X or |Y')).not.toThrow()
    })

    it('should accept boolean operator not', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      expect(() => engine.selectFaces(mockMesh as any, 'not >X')).not.toThrow()
    })

    it('should accept radius filter with < operator', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 0,
        numVert: 0,
        numEdge: 1,
        verts: vi.fn(),
        position: vi.fn(),
        edgeStart: vi.fn().mockReturnValue([0, 0, 0]),
        edgeEnd: vi.fn().mockReturnValue([1, 1, 1])
      }

      // Radius filter is used for edge selection
      expect(() => engine.selectEdges(mockMesh as any, 'radius<5')).not.toThrow()
    })

    it('should accept radius filter with > operator', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 0,
        numVert: 0,
        numEdge: 1,
        verts: vi.fn(),
        position: vi.fn()
      }

      expect(() => engine.selectEdges(mockMesh as any, 'radius>10')).not.toThrow()
    })

    it('should accept radius filter with == operator', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 0,
        numVert: 0,
        numEdge: 1,
        verts: vi.fn(),
        position: vi.fn()
      }

      expect(() => engine.selectEdges(mockMesh as any, 'radius==3.5')).not.toThrow()
    })

    it('should accept direction selector with index notation', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      expect(() => engine.selectFaces(mockMesh as any, '>X[0]')).not.toThrow()
    })

    it('should accept direction selector with negative index', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      expect(() => engine.selectFaces(mockMesh as any, '>X[-1]')).not.toThrow()
    })
  })

  describe('face selection', () => {
    it('should return empty result for empty mesh', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 0,
        numVert: 0,
        verts: vi.fn(),
        position: vi.fn()
      }

      const result = engine.selectFaces(mockMesh as any, '>X')
      expect(result.type).toBe('faces')
      expect(result.indices.length).toBe(0)
    })

    it('should return all faces for empty selector', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 2,
        numVert: 6,
        verts: vi.fn((i) => {
          if (i === 0) return [0, 1, 2]
          return [3, 4, 5]
        }),
        position: vi.fn((i) => {
          const positions = [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [1, 0, 0],
            [2, 0, 0],
            [1, 1, 0]
          ]
          return positions[i]
        })
      }

      const result = engine.selectFaces(mockMesh as any, '')
      expect(result.type).toBe('faces')
      expect(result.indices.length).toBe(2)
    })

    it('should return face centroids in result', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [3, 0, 0]
          return [0, 3, 0]
        })
      }

      const result = engine.selectFaces(mockMesh as any, '>X')
      expect(result.centroids.length).toBeGreaterThanOrEqual(0)
      if (result.centroids.length > 0) {
        expect(result.centroids[0].length).toBe(3)
      }
    })

    it('should return face normals in result', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [3, 0, 0]
          return [0, 3, 0]
        })
      }

      const result = engine.selectFaces(mockMesh as any, '>X')
      expect(result.normals).toBeDefined()
      if (result.normals && result.normals.length > 0) {
        expect(result.normals[0].length).toBe(3)
      }
    })
  })

  describe('edge selection', () => {
    it('should return empty result for empty mesh', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 0,
        numVert: 0,
        verts: vi.fn(),
        position: vi.fn()
      }

      const result = engine.selectEdges(mockMesh as any, '>X')
      expect(result.type).toBe('edges')
      expect(result.indices.length).toBe(0)
    })

    it('should return edge centroids (midpoints) in result', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      const result = engine.selectEdges(mockMesh as any, '>X')
      expect(result.centroids).toBeDefined()
      expect(Array.isArray(result.centroids)).toBe(true)
    })
  })

  describe('vertex selection', () => {
    it('should return empty result for empty mesh', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 0,
        numVert: 0,
        verts: vi.fn(),
        position: vi.fn()
      }

      const result = engine.selectVertices(mockMesh as any, '>X')
      expect(result.type).toBe('vertices')
      expect(result.indices.length).toBe(0)
    })

    it('should return all vertices for empty selector', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      const result = engine.selectVertices(mockMesh as any, '')
      expect(result.type).toBe('vertices')
      expect(result.indices.length).toBe(3)
    })

    it('should return vertex centroids in result', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      const result = engine.selectVertices(mockMesh as any, '')
      expect(result.centroids.length).toBe(3)
      result.centroids.forEach(centroid => {
        expect(centroid.length).toBe(3)
      })
    })
  })

  describe('whitespace handling', () => {
    it('should handle extra whitespace in selector', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      // Multiple spaces should be handled gracefully
      expect(() => engine.selectFaces(mockMesh as any, '  >X  ')).not.toThrow()
    })

    it('should handle multiple spaces between tokens', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      expect(() => engine.selectFaces(mockMesh as any, '>X    and    |Y')).not.toThrow()
    })
  })

  describe('error messages', () => {
    it('should provide helpful error message for invalid token', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 0,
        numVert: 0,
        verts: vi.fn(),
        position: vi.fn()
      }

      try {
        engine.selectFaces(mockMesh as any, 'BADTOKEN')
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(SelectorError)
        expect((e as Error).message).toContain('Unknown selector token')
      }
    })
  })

  describe('integration scenarios', () => {
    it('should handle complex multi-token selectors', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 2,
        numVert: 6,
        verts: vi.fn((i) => {
          if (i === 0) return [0, 1, 2]
          return [3, 4, 5]
        }),
        position: vi.fn((i) => {
          const positions = [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [2, 0, 0],
            [3, 0, 0],
            [2, 1, 0]
          ]
          return positions[i]
        })
      }

      // Complex selector with multiple operators
      expect(() => engine.selectFaces(mockMesh as any, '>X and |Y or #Z')).not.toThrow()
    })

    it('should handle selectors with different axis combinations', () => {
      const engine = new SelectorEngine()

      const mockMesh = {
        numTri: 1,
        numVert: 3,
        verts: vi.fn((i) => [0, 1, 2]),
        position: vi.fn((i) => {
          if (i === 0) return [0, 0, 0]
          if (i === 1) return [1, 0, 0]
          return [0, 1, 0]
        })
      }

      const axes = ['X', 'Y', 'Z'] as const
      for (const axis of axes) {
        expect(() => engine.selectFaces(mockMesh as any, `>${axis}`)).not.toThrow()
        expect(() => engine.selectFaces(mockMesh as any, `<${axis}`)).not.toThrow()
        expect(() => engine.selectFaces(mockMesh as any, `|${axis}`)).not.toThrow()
        expect(() => engine.selectFaces(mockMesh as any, `#${axis}`)).not.toThrow()
      }
    })
  })
})
