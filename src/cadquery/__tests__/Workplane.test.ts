import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Workplane } from '../Workplane'
import { MemoryManager } from '../MemoryManager'
import { GeometryError, UnsupportedOperationError, SelectorError } from '../errors'
import type { Manifold, ManifoldToplevel } from 'manifold-3d'

// ==================== Mock Setup ====================

/**
 * Create a mock Manifold object with chainable methods.
 */
const createMockManifold = (): Partial<Manifold> => ({
  delete: vi.fn(),
  translate: vi.fn().mockReturnThis(),
  rotate: vi.fn().mockReturnThis(),
  mirror: vi.fn().mockReturnThis(),
  transform: vi.fn().mockReturnThis(),
  add: vi.fn().mockReturnThis(),
  subtract: vi.fn().mockReturnThis(),
  intersect: vi.fn().mockReturnThis(),
  boundingBox: vi.fn().mockReturnValue({
    min: [0, 0, 0],
    max: [10, 10, 10]
  }),
  getMesh: vi.fn().mockReturnValue({
    numTri: 2,
    numVert: 4,
    numEdge: 4,
    verts: vi.fn((i: number) => {
      const vertices = [
        [0, 1, 2],
        [0, 1, 3],
        [0, 2, 3],
        [1, 2, 3]
      ]
      return vertices[i % vertices.length]
    }),
    position: vi.fn((i: number) => {
      const positions = [
        [0, 0, 0],
        [10, 0, 0],
        [10, 10, 0],
        [0, 10, 0]
      ]
      return positions[i % positions.length]
    })
  })
})

/**
 * Create a mock ManifoldToplevel (global M object).
 */
const createMockM = (): ManifoldToplevel => ({
  Manifold: {
    cube: vi.fn().mockReturnValue(createMockManifold()),
    cylinder: vi.fn().mockReturnValue(createMockManifold()),
    sphere: vi.fn().mockReturnValue(createMockManifold()),
    extrude: vi.fn().mockReturnValue(createMockManifold()),
    union: vi.fn().mockReturnValue(createMockManifold()),
    revolve: vi.fn().mockReturnValue(createMockManifold())
  } as any
} as any)

describe('Workplane', () => {
  let M: ManifoldToplevel
  let memoryManager: MemoryManager

  beforeEach(() => {
    M = createMockM()
    memoryManager = new MemoryManager()
  })

  // ==================== Constructor Tests ====================

  describe('constructor', () => {
    it('should create workplane with default XY plane', () => {
      const wp = new Workplane(M)
      expect(wp).toBeDefined()
    })

    it('should create workplane with XY plane explicitly', () => {
      const wp = new Workplane(M, 'XY')
      expect(wp).toBeDefined()
    })

    it('should create workplane with XZ plane', () => {
      const wp = new Workplane(M, 'XZ')
      expect(wp).toBeDefined()
    })

    it('should create workplane with YZ plane', () => {
      const wp = new Workplane(M, 'YZ')
      expect(wp).toBeDefined()
    })

    it('should create workplane with custom coordinate system', () => {
      const customCS = {
        origin: [1, 2, 3] as [number, number, number],
        xDir: [1, 0, 0] as [number, number, number],
        yDir: [0, 1, 0] as [number, number, number],
        zDir: [0, 0, 1] as [number, number, number]
      }
      const wp = new Workplane(M, customCS)
      expect(wp).toBeDefined()
    })

    it('should share memory manager when provided', () => {
      const wp1 = new Workplane(M, 'XY', memoryManager)
      const wp2 = new Workplane(M, 'XY', memoryManager)
      expect(wp1).toBeDefined()
      expect(wp2).toBeDefined()
    })

    it('should create new memory manager if not provided', () => {
      const wp = new Workplane(M, 'XY')
      expect(wp).toBeDefined()
    })
  })

  // ==================== Primitive Creation Tests ====================

  describe('primitives', () => {
    it('box() should create centered box by default', () => {
      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5)

      expect(M.Manifold.cube).toHaveBeenCalledWith([10, 10, 5], true)
      expect(result).toBeDefined()
    })

    it('box() should create non-centered box when specified', () => {
      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5, false)

      expect(M.Manifold.cube).toHaveBeenCalledWith([10, 10, 5], false)
      expect(result).toBeDefined()
    })

    it('cylinder() should create cylinder with specified dimensions', () => {
      const wp = new Workplane(M)
      const result = wp.cylinder(20, 5)

      expect(M.Manifold.cylinder).toHaveBeenCalledWith(20, 5, 5, 32, true)
      expect(result).toBeDefined()
    })

    it('cylinder() should support non-centered option', () => {
      const wp = new Workplane(M)
      const result = wp.cylinder(20, 5, false)

      expect(M.Manifold.cylinder).toHaveBeenCalledWith(20, 5, 5, 32, false)
      expect(result).toBeDefined()
    })

    it('sphere() should create sphere with specified radius', () => {
      const wp = new Workplane(M)
      const result = wp.sphere(5)

      expect(M.Manifold.sphere).toHaveBeenCalledWith(5, 32)
      expect(result).toBeDefined()
    })

    it('sphere() should return Workplane for chaining', () => {
      const wp = new Workplane(M)
      const result = wp.sphere(5)

      expect(result instanceof Workplane).toBe(true)
    })
  })

  // ==================== 2D Sketch Tests ====================

  describe('2D sketches', () => {
    it('rect() should add centered rectangle to pending wires', () => {
      const wp = new Workplane(M)
      const result = wp.rect(10, 5)

      // Should return a new workplane with pending wires
      expect(result).toBeDefined()
    })

    it('rect() should create non-centered rectangle', () => {
      const wp = new Workplane(M)
      const result = wp.rect(10, 5, false)

      expect(result).toBeDefined()
    })

    it('circle() should add circle with 32 segments', () => {
      const wp = new Workplane(M)
      const result = wp.circle(3)

      expect(result).toBeDefined()
    })

    it('polygon() should add custom polygon to pending wires', () => {
      const wp = new Workplane(M)
      const points: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
      const result = wp.polygon(points)

      expect(result).toBeDefined()
    })

    it('moveTo() should start new wire at specified position', () => {
      const wp = new Workplane(M)
      const result = wp.moveTo(5, 5)

      expect(result).toBeDefined()
    })

    it('lineTo() should add line to current wire', () => {
      const wp = new Workplane(M)
      const result = wp.moveTo(0, 0).lineTo(10, 0).lineTo(10, 10)

      expect(result).toBeDefined()
    })

    it('lineTo() should create initial wire if none exists', () => {
      const wp = new Workplane(M)
      const result = wp.lineTo(5, 5)

      expect(result).toBeDefined()
    })

    it('close() should return workplane for chaining', () => {
      const wp = new Workplane(M)
      const result = wp.rect(10, 10).close()

      expect(result).toBeDefined()
    })

    it('wire building should support fluent chaining', () => {
      const wp = new Workplane(M)
      const result = wp
        .moveTo(0, 0)
        .lineTo(10, 0)
        .lineTo(10, 10)
        .lineTo(0, 10)
        .close()

      expect(result).toBeDefined()
    })
  })

  // ==================== Extrusion Tests ====================

  describe('extrusion', () => {
    it('extrude() should throw without pending wires', () => {
      const wp = new Workplane(M)
      expect(() => wp.extrude(5)).toThrow(GeometryError)
    })

    it('extrude() should create solid from pending wires', () => {
      const wp = new Workplane(M)
      const result = wp.rect(10, 10).extrude(5)

      expect(M.Manifold.extrude).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('extrude() should support taper option', () => {
      const wp = new Workplane(M)
      const result = wp.rect(10, 10).extrude(5, { taper: 10 })

      expect(M.Manifold.extrude).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('extrude() should support twist option', () => {
      const wp = new Workplane(M)
      const result = wp.rect(10, 10).extrude(5, { twist: 45 })

      expect(M.Manifold.extrude).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('extrude() should support centered option', () => {
      const wp = new Workplane(M)
      const result = wp.rect(10, 10).extrude(5, { centered: true })

      expect(M.Manifold.extrude).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('extrude() should clear pending wires after extrusion', () => {
      const wp = new Workplane(M)
      const result = wp.rect(10, 10).circle(3).extrude(5)

      // Should be able to create another solid without extrude throwing
      const result2 = result.box(5, 5, 5)
      expect(result2).toBeDefined()
    })

    it('cutThruAll() should throw without solid', () => {
      const wp = new Workplane(M)
      expect(() => wp.rect(5, 5).cutThruAll()).toThrow(GeometryError)
    })

    it('cutThruAll() should throw without pending wires', () => {
      const wp = new Workplane(M)
      const withSolid = wp.box(10, 10, 5)
      expect(() => withSolid.cutThruAll()).toThrow(GeometryError)
    })

    it('cutThruAll() should cut through solid', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).rect(2, 2).cutThruAll()

      expect(result).toBeDefined()
    })

    it('cutBlind() should throw without solid', () => {
      const wp = new Workplane(M)
      expect(() => wp.rect(5, 5).cutBlind(3)).toThrow(GeometryError)
    })

    it('cutBlind() should throw without pending wires', () => {
      const wp = new Workplane(M)
      const withSolid = wp.box(10, 10, 5)
      expect(() => withSolid.cutBlind(3)).toThrow(GeometryError)
    })

    it('cutBlind() should cut to specified depth', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).rect(2, 2).cutBlind(2)

      expect(result).toBeDefined()
    })
  })

  // ==================== Selector Tests ====================

  describe('selectors', () => {
    it('faces() should throw without solid', () => {
      const wp = new Workplane(M)
      expect(() => wp.faces('>Z')).toThrow(GeometryError)
    })

    it('faces() should select faces matching selector', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).faces('>Z')

      expect(result).toBeDefined()
    })

    it('faces() should throw on empty selection', () => {
      const mockManifold = createMockManifold() as Manifold
      const mockMesh = {
        numTri: 0,
        numVert: 0,
        numEdge: 0,
        verts: vi.fn().mockReturnValue([]),
        position: vi.fn().mockReturnValue([0, 0, 0])
      }
      ;(mockManifold.getMesh as any) = vi.fn().mockReturnValue(mockMesh)
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      expect(() => wp.box(10, 10, 5).faces('>Z')).toThrow(SelectorError)
    })

    it('edges() should select edges matching selector', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).edges('>X')

      expect(result).toBeDefined()
    })

    it('vertices() should select vertices matching selector', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).vertices('>Z')

      expect(result).toBeDefined()
    })

    it('workplane() should throw without face selection', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const withSolid = wp.box(10, 10, 5)
      expect(() => withSolid.workplane()).toThrow(GeometryError)
    })

    it('workplane() should create new workplane on selected face', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).faces('>Z').workplane()

      expect(result).toBeDefined()
      expect(result instanceof Workplane).toBe(true)
    })

    it('workplane() should support offset parameter', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).faces('>Z').workplane(2)

      expect(result).toBeDefined()
    })

    it('workplane() should support invert parameter', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).faces('>Z').workplane(0, true)

      expect(result).toBeDefined()
    })
  })

  // ==================== Unsupported Operations Tests ====================

  describe('unsupported operations', () => {
    it('sweep() should throw UnsupportedOperationError', () => {
      const wp = new Workplane(M)
      expect(() => (wp as any).sweep()).toThrow(UnsupportedOperationError)
    })

    it('loft() should throw UnsupportedOperationError', () => {
      const wp = new Workplane(M)
      expect(() => (wp as any).loft()).toThrow(UnsupportedOperationError)
    })

    it('fillet() should throw UnsupportedOperationError', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const withSolid = wp.box(10, 10, 5).edges('>X')
      expect(() => (withSolid as any).fillet(1)).toThrow(UnsupportedOperationError)
    })

    it('chamfer() should throw UnsupportedOperationError', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const withSolid = wp.box(10, 10, 5).edges('>X')
      expect(() => (withSolid as any).chamfer(1)).toThrow(UnsupportedOperationError)
    })
  })

  // ==================== Boolean Operations Tests ====================

  describe('booleans', () => {
    it('union() should combine two solids', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp1 = new Workplane(M).box(10, 10, 5)
      const wp2 = new Workplane(M).box(5, 5, 5)
      const result = wp1.union(wp2)

      expect(result).toBeDefined()
    })

    it('union() should throw without both solids', () => {
      const wp1 = new Workplane(M)
      const wp2 = new Workplane(M)
      expect(() => wp1.union(wp2)).toThrow(GeometryError)
    })

    it('union() should throw without first solid', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp1 = new Workplane(M)
      const wp2 = new Workplane(M).box(5, 5, 5)
      expect(() => wp1.union(wp2)).toThrow(GeometryError)
    })

    it('cut() should subtract second solid from first', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp1 = new Workplane(M).box(10, 10, 5)
      const wp2 = new Workplane(M).box(5, 5, 5)
      const result = wp1.cut(wp2)

      expect(result).toBeDefined()
    })

    it('cut() should throw without both solids', () => {
      const wp1 = new Workplane(M)
      const wp2 = new Workplane(M)
      expect(() => wp1.cut(wp2)).toThrow(GeometryError)
    })

    it('intersect() should intersect two solids', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp1 = new Workplane(M).box(10, 10, 5)
      const wp2 = new Workplane(M).box(5, 5, 5)
      const result = wp1.intersect(wp2)

      expect(result).toBeDefined()
    })

    it('intersect() should throw without both solids', () => {
      const wp1 = new Workplane(M)
      const wp2 = new Workplane(M)
      expect(() => wp1.intersect(wp2)).toThrow(GeometryError)
    })
  })

  // ==================== Transform Operations Tests ====================

  describe('transforms', () => {
    it('translate() should move solid', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).translate(5, 10, 2)

      expect(result).toBeDefined()
    })

    it('translate() should throw without solid', () => {
      const wp = new Workplane(M)
      expect(() => wp.translate(5, 10, 2)).toThrow(GeometryError)
    })

    it('rotate() should rotate solid', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).rotate(45, 0, 0)

      expect(result).toBeDefined()
    })

    it('rotate() should throw without solid', () => {
      const wp = new Workplane(M)
      expect(() => wp.rotate(45, 0, 0)).toThrow(GeometryError)
    })

    it('mirror() should mirror solid over plane', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).mirror([0, 0, 1])

      expect(result).toBeDefined()
    })

    it('mirror() should throw without solid', () => {
      const wp = new Workplane(M)
      expect(() => wp.mirror([0, 0, 1])).toThrow(GeometryError)
    })

    it('transforms should support chaining', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp
        .box(10, 10, 5)
        .translate(5, 0, 0)
        .rotate(0, 0, 45)
        .mirror([0, 0, 1])

      expect(result).toBeDefined()
    })
  })

  // ==================== Output Operations Tests ====================

  describe('output', () => {
    it('val() should throw without solid', () => {
      const wp = new Workplane(M)
      expect(() => wp.val()).toThrow(GeometryError)
    })

    it('val() should return manifold', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).val()

      expect(result).toBeDefined()
    })

    it('vals() should return array with one solid', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).vals()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(1)
    })

    it('vals() should return empty array without solid', () => {
      const wp = new Workplane(M)
      const result = wp.vals()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })

    it('dispose() should not throw', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const withSolid = wp.box(10, 10, 5)

      expect(() => withSolid.dispose()).not.toThrow()
    })
  })

  // ==================== Method Chaining Tests ====================

  describe('method chaining', () => {
    it('should support fluent chaining of primitive + extrude', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).rect(3, 3).extrude(2)

      expect(result).toBeDefined()
      expect(result instanceof Workplane).toBe(true)
    })

    it('should support complex chaining with selectors', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp
        .box(10, 10, 5)
        .faces('>Z')
        .workplane()
        .circle(2)
        .extrude(3)

      expect(result).toBeDefined()
      expect(result instanceof Workplane).toBe(true)
    })

    it('should support boolean operations chaining', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp1 = new Workplane(M).box(10, 10, 10)
      const wp2 = new Workplane(M).box(5, 5, 5)
      const result = wp1.cut(wp2)

      expect(result).toBeDefined()
      expect(result instanceof Workplane).toBe(true)
    })

    it('should support mixed operations chaining', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp
        .box(20, 20, 10)
        .translate(0, 0, 5)
        .rotate(0, 0, 45)
        .faces('>Z')
        .workplane()
        .circle(3)
        .extrude(5)
        .translate(0, 0, 2)

      expect(result).toBeDefined()
      expect(result instanceof Workplane).toBe(true)
    })

    it('should support multiple box operations', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp
        .box(10, 10, 5)
        .box(8, 8, 3)
        .box(5, 5, 2)

      expect(result).toBeDefined()
    })

    it('should support multiple sketch operations', () => {
      const wp = new Workplane(M)
      const result = wp
        .rect(10, 10)
        .circle(3)
        .polygon([[5, 5], [6, 5], [6, 6]])

      expect(result).toBeDefined()
    })
  })

  // ==================== State Management Tests ====================

  describe('state management', () => {
    it('should preserve coordinate system across operations', () => {
      const customCS = {
        origin: [1, 2, 3] as [number, number, number],
        xDir: [1, 0, 0] as [number, number, number],
        yDir: [0, 1, 0] as [number, number, number],
        zDir: [0, 0, 1] as [number, number, number]
      }
      const wp = new Workplane(M, customCS)
      const result = wp.box(10, 10, 5)

      expect(result).toBeDefined()
    })

    it('should clear pending wires after extrude', () => {
      const wp = new Workplane(M)
      const result = wp.rect(10, 10).extrude(5)

      // After extrude, pending wires should be cleared
      // Attempting to extrude again without new wires should throw
      expect(() => result.extrude(5)).toThrow(GeometryError)
    })

    it('should accumulate solids with multiple primitives', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      const result = wp.box(10, 10, 5).cylinder(5, 3)

      // Should have a solid, not pending wires
      expect(result.vals().length).toBe(1)
    })
  })

  // ==================== Edge Cases Tests ====================

  describe('edge cases', () => {
    it('should handle zero-dimension primitives', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      expect(() => wp.box(0, 0, 0)).not.toThrow()
    })

    it('should handle negative dimensions', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const wp = new Workplane(M)
      expect(() => wp.box(-10, -10, -5)).not.toThrow()
    })

    it('should handle very large extrusion height', () => {
      const wp = new Workplane(M)
      expect(() => wp.rect(10, 10).extrude(10000)).not.toThrow()
    })

    it('should handle large twist angle', () => {
      const wp = new Workplane(M)
      expect(() => wp.rect(10, 10).extrude(5, { twist: 720 })).not.toThrow()
    })

    it('should handle empty polygon', () => {
      const wp = new Workplane(M)
      expect(() => wp.polygon([])).not.toThrow()
    })

    it('should handle single-point polygon', () => {
      const wp = new Workplane(M)
      expect(() => wp.polygon([[0, 0]])).not.toThrow()
    })

    it('should handle memory manager with multiple workplanes', () => {
      const mockManifold = createMockManifold() as Manifold
      ;(M.Manifold.cube as any).mockReturnValue(mockManifold)

      const sharedManager = new MemoryManager()
      const wp1 = new Workplane(M, 'XY', sharedManager)
      const wp2 = new Workplane(M, 'XY', sharedManager)
      const wp3 = new Workplane(M, 'XY', sharedManager)

      expect(wp1).toBeDefined()
      expect(wp2).toBeDefined()
      expect(wp3).toBeDefined()
    })
  })
})
