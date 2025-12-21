import type { Manifold, ManifoldToplevel } from 'manifold-3d'
import type {
  Vec2,
  Vec3,
  Plane,
  SelectorString,
  CoordinateSystem,
  ExtrudeOptions,
  SelectionResult
} from './types'
import { SelectorEngine } from './Selector'
import { MemoryManager } from './MemoryManager'
import {
  planeToCoordinateSystem,
  coordinateSystemOnFace
} from './CoordinateSystem'
import { UnsupportedOperationError, SelectorError, GeometryError } from './errors'

/**
 * CadQuery-compatible workplane for building 3D geometry.
 *
 * Provides a fluent API where all operations return a new Workplane,
 * enabling method chaining:
 *
 * ```typescript
 * const result = cq.Workplane("XY")
 *   .box(10, 10, 5)
 *   .faces(">Z")
 *   .workplane()
 *   .circle(3)
 *   .extrude(2)
 *   .val()
 * ```
 */
export class Workplane {
  private M: ManifoldToplevel
  private solid: Manifold | null = null
  private pendingWires: Vec2[][] = []
  private coordinateSystem: CoordinateSystem
  private selection: SelectionResult | null = null
  private memoryManager: MemoryManager
  private selectorEngine: SelectorEngine

  constructor(
    M: ManifoldToplevel,
    plane: Plane | CoordinateSystem = 'XY',
    memoryManager?: MemoryManager
  ) {
    this.M = M
    this.memoryManager = memoryManager ?? new MemoryManager()
    this.selectorEngine = new SelectorEngine(M)
    this.coordinateSystem = typeof plane === 'string'
      ? planeToCoordinateSystem(plane)
      : plane
  }

  /**
   * Create a workplane on a selected face.
   * Requires a prior .faces() selection.
   */
  workplane(offset: number = 0, invert: boolean = false): Workplane {
    if (!this.selection || this.selection.type !== 'faces') {
      throw new GeometryError(
        'workplane() requires a face selection. Call .faces() first.'
      )
    }

    if (this.selection.indices.length === 0) {
      throw new SelectorError('No faces matched the selector')
    }

    // Use first selected face
    const centroid = this.selection.centroids[0]!
    const normal = this.selection.normals?.[0] ?? [0, 0, 1] as Vec3

    // Create new coordinate system on this face
    const cs = coordinateSystemOnFace(centroid, normal, offset, invert)

    const newWorkplane = this.cloneWith({
      coordinateSystem: cs,
      selection: null,
      pendingWires: []
    })

    return newWorkplane
  }

  // ==================== Primitive Creation ====================

  /**
   * Create a box centered on the workplane origin.
   */
  box(length: number, width: number, height: number, centered: boolean = true): Workplane {
    const box = this.M.Manifold.cube([length, width, height], centered)
    this.memoryManager.track(box)

    // Transform to workplane coordinates
    const positioned = this.transformToWorkplane(box)
    this.memoryManager.release(box)

    return this.cloneWith({ solid: this.combine(positioned) })
  }

  /**
   * Create a cylinder along the workplane's Z axis.
   */
  cylinder(height: number, radius: number, centered: boolean = true): Workplane {
    const cyl = this.M.Manifold.cylinder(height, radius, radius, 32, centered)
    this.memoryManager.track(cyl)

    const positioned = this.transformToWorkplane(cyl)
    this.memoryManager.release(cyl)

    return this.cloneWith({ solid: this.combine(positioned) })
  }

  /**
   * Create a sphere centered on the workplane origin.
   */
  sphere(radius: number): Workplane {
    const sph = this.M.Manifold.sphere(radius, 32)
    this.memoryManager.track(sph)

    const positioned = this.transformToWorkplane(sph)
    this.memoryManager.release(sph)

    return this.cloneWith({ solid: this.combine(positioned) })
  }

  // ==================== 2D Sketch Operations ====================

  /**
   * Add a rectangle to the current sketch.
   */
  rect(width: number, height: number, centered: boolean = true): Workplane {
    const wire: Vec2[] = centered
      ? [
          [-width / 2, -height / 2],
          [width / 2, -height / 2],
          [width / 2, height / 2],
          [-width / 2, height / 2]
        ]
      : [
          [0, 0],
          [width, 0],
          [width, height],
          [0, height]
        ]

    return this.cloneWith({
      pendingWires: [...this.pendingWires, wire]
    })
  }

  /**
   * Add a circle to the current sketch.
   */
  circle(radius: number): Workplane {
    const segments = 32
    const wire: Vec2[] = []

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      wire.push([Math.cos(angle) * radius, Math.sin(angle) * radius])
    }

    return this.cloneWith({
      pendingWires: [...this.pendingWires, wire]
    })
  }

  /**
   * Add a polygon defined by points to the current sketch.
   */
  polygon(points: Vec2[]): Workplane {
    return this.cloneWith({
      pendingWires: [...this.pendingWires, [...points]]
    })
  }

  /**
   * Move the sketch cursor to a new position.
   */
  moveTo(x: number, y: number): Workplane {
    // Start a new wire at this position
    return this.cloneWith({
      pendingWires: [...this.pendingWires, [[x, y]]]
    })
  }

  /**
   * Draw a line to a point (adds to current wire).
   */
  lineTo(x: number, y: number): Workplane {
    if (this.pendingWires.length === 0) {
      return this.moveTo(0, 0).lineTo(x, y)
    }

    const wires = [...this.pendingWires]
    const currentWire = [...wires[wires.length - 1]!]
    currentWire.push([x, y])
    wires[wires.length - 1] = currentWire

    return this.cloneWith({ pendingWires: wires })
  }

  /**
   * Close the current wire.
   */
  close(): Workplane {
    // Wire is automatically closed when extruded
    return this
  }

  // ==================== Extrusion Operations ====================

  /**
   * Extrude pending 2D wires along the workplane's Z axis.
   */
  extrude(height: number, options: ExtrudeOptions = {}): Workplane {
    if (this.pendingWires.length === 0) {
      throw new GeometryError(
        'extrude() requires pending sketch geometry. Add shapes with rect(), circle(), etc.'
      )
    }

    const { taper = 0, twist = 0, centered = false } = options

    // Calculate scale factor for taper
    const scaleTop = taper !== 0
      ? 1 - (2 * height * Math.tan((taper * Math.PI) / 180)) / this.getWireMaxDimension()
      : 1

    // Extrude each wire
    const extruded: Manifold[] = []

    for (const wire of this.pendingWires) {
      // Transform 2D points to 3D in workplane coordinates
      const polygon = wire.map(([x, y]) => [x, y] as [number, number])

      const divisions = twist !== 0 ? Math.ceil(Math.abs(twist) / 10) : 1
      const solid = this.M.Manifold.extrude(
        polygon,
        height,
        divisions,
        twist,
        [scaleTop, scaleTop],
        centered
      )

      this.memoryManager.track(solid)

      // Transform to global coordinates via workplane
      const positioned = this.transformToWorkplane(solid)
      this.memoryManager.release(solid)

      extruded.push(positioned)
    }

    // Combine all extrusions
    let result: Manifold
    if (extruded.length === 1) {
      result = extruded[0]!
    } else {
      result = this.M.Manifold.union(extruded)
      this.memoryManager.track(result)
      extruded.forEach(e => this.memoryManager.release(e))
    }

    return this.cloneWith({
      solid: this.combine(result),
      pendingWires: []
    })
  }

  /**
   * Cut (subtract) pending 2D wires through the solid.
   */
  cutThruAll(): Workplane {
    if (!this.solid) {
      throw new GeometryError('cutThruAll() requires existing solid geometry')
    }

    if (this.pendingWires.length === 0) {
      throw new GeometryError('cutThruAll() requires pending sketch geometry')
    }

    // Get bounding box to determine cut depth
    const bbox = this.solid.boundingBox()
    const maxDim = Math.max(
      bbox.max[0] - bbox.min[0],
      bbox.max[1] - bbox.min[1],
      bbox.max[2] - bbox.min[2]
    )

    // Extrude both directions to ensure full cut
    const cutDepth = maxDim * 2

    const tools: Manifold[] = []

    for (const wire of this.pendingWires) {
      const polygon = wire.map(([x, y]) => [x, y] as [number, number])

      const tool = this.M.Manifold.extrude(polygon, cutDepth, 1, 0, [1, 1], true)
      this.memoryManager.track(tool)

      const positioned = this.transformToWorkplane(tool)
      this.memoryManager.release(tool)

      tools.push(positioned)
    }

    // Subtract all tools from solid
    let cutter: Manifold
    if (tools.length === 1) {
      cutter = tools[0]!
    } else {
      cutter = this.M.Manifold.union(tools)
      this.memoryManager.track(cutter)
      tools.forEach(t => this.memoryManager.release(t))
    }

    const result = this.solid.subtract(cutter)
    this.memoryManager.track(result)
    this.memoryManager.release(this.solid)
    this.memoryManager.release(cutter)

    return this.cloneWith({
      solid: result,
      pendingWires: []
    })
  }

  /**
   * Cut (subtract) pending 2D wires to a specific depth.
   */
  cutBlind(depth: number): Workplane {
    if (!this.solid) {
      throw new GeometryError('cutBlind() requires existing solid geometry')
    }

    if (this.pendingWires.length === 0) {
      throw new GeometryError('cutBlind() requires pending sketch geometry')
    }

    const tools: Manifold[] = []

    for (const wire of this.pendingWires) {
      const polygon = wire.map(([x, y]) => [x, y] as [number, number])

      // Extrude downward from workplane
      const tool = this.M.Manifold.extrude(polygon, depth, 1, 0, [1, 1], false)
      this.memoryManager.track(tool)

      // Mirror to cut in -Z direction, then position at workplane
      const mirrored = tool.mirror([0, 0, 1])
      this.memoryManager.track(mirrored)
      this.memoryManager.release(tool)

      const positioned = this.transformToWorkplane(mirrored)
      this.memoryManager.release(mirrored)

      tools.push(positioned)
    }

    let cutter: Manifold
    if (tools.length === 1) {
      cutter = tools[0]!
    } else {
      cutter = this.M.Manifold.union(tools)
      this.memoryManager.track(cutter)
      tools.forEach(t => this.memoryManager.release(t))
    }

    const result = this.solid.subtract(cutter)
    this.memoryManager.track(result)
    this.memoryManager.release(this.solid)
    this.memoryManager.release(cutter)

    return this.cloneWith({
      solid: result,
      pendingWires: []
    })
  }

  // ==================== Selector Operations ====================

  /**
   * Select faces matching a selector string.
   *
   * Selector syntax:
   * - `>Z` - Face with maximum Z (top face)
   * - `<Z` - Face with minimum Z (bottom face)
   * - `>X`, `<X`, `>Y`, `<Y` - Similar for other axes
   * - `|Z` - Faces parallel to Z axis (vertical faces)
   * - `#Z` - Faces perpendicular to Z axis (horizontal faces)
   * - `>Z[0]` - First face when sorted by Z
   * - `>Z[-1]` - Last face when sorted by Z
   * - Compound: `>Z and |X` - Combine with 'and', 'or', 'not'
   */
  faces(selector: SelectorString): Workplane {
    if (!this.solid) {
      throw new GeometryError('faces() requires existing solid geometry')
    }

    const mesh = this.solid.getMesh()
    const selection = this.selectorEngine.selectFaces(mesh, selector)

    if (selection.indices.length === 0) {
      throw new SelectorError(`No faces matched selector: ${selector}`)
    }

    return this.cloneWith({ selection })
  }

  /**
   * Select edges matching a selector string.
   */
  edges(selector: SelectorString): Workplane {
    if (!this.solid) {
      throw new GeometryError('edges() requires existing solid geometry')
    }

    const mesh = this.solid.getMesh()
    const selection = this.selectorEngine.selectEdges(mesh, selector)

    if (selection.indices.length === 0) {
      throw new SelectorError(`No edges matched selector: ${selector}`)
    }

    return this.cloneWith({ selection })
  }

  /**
   * Select vertices matching a selector string.
   */
  vertices(selector: SelectorString): Workplane {
    if (!this.solid) {
      throw new GeometryError('vertices() requires existing solid geometry')
    }

    const mesh = this.solid.getMesh()
    const selection = this.selectorEngine.selectVertices(mesh, selector)

    if (selection.indices.length === 0) {
      throw new SelectorError(`No vertices matched selector: ${selector}`)
    }

    return this.cloneWith({ selection })
  }

  // ==================== Fillet/Chamfer (Approximations) ====================

  /**
   * Apply fillet to selected edges.
   * @throws UnsupportedOperationError
   */
  fillet(_radius: number): never {
    throw new UnsupportedOperationError(
      'fillet() is not yet implemented. Mesh-based fillet approximation is planned for a future release. ' +
        'For now, consider designing geometry with built-in fillets or using chamfer-like geometry with extrude().'
    )
  }

  /**
   * Apply chamfer to selected edges.
   * @throws UnsupportedOperationError
   */
  chamfer(_distance: number): never {
    throw new UnsupportedOperationError(
      'chamfer() is not yet implemented. Mesh-based chamfer approximation is planned for a future release. ' +
        'For now, consider creating beveled edges using extrude() or other geometric primitives.'
    )
  }

  // ==================== Unsupported Operations ====================

  /**
   * Sweep is not supported in the Manifold wrapper.
   * @throws UnsupportedOperationError
   */
  sweep(): never {
    throw new UnsupportedOperationError(
      'sweep() is not supported. Manifold-3D does not have native sweep support. ' +
        'Consider using extrude() with twist, or building geometry with boolean operations.'
    )
  }

  /**
   * Loft is not supported in the Manifold wrapper.
   * @throws UnsupportedOperationError
   */
  loft(): never {
    throw new UnsupportedOperationError(
      'loft() is not supported. Manifold-3D does not have native loft support. ' +
        'Consider using revolve() or building geometry with boolean operations.'
    )
  }

  // ==================== Boolean Operations ====================

  /**
   * Union with another solid.
   */
  union(other: Workplane): Workplane {
    if (!this.solid || !other.solid) {
      throw new GeometryError('union() requires both workplanes to have solid geometry')
    }

    const result = this.solid.add(other.solid)
    this.memoryManager.track(result)
    this.memoryManager.release(this.solid)

    return this.cloneWith({ solid: result })
  }

  /**
   * Subtract another solid.
   */
  cut(other: Workplane): Workplane {
    if (!this.solid || !other.solid) {
      throw new GeometryError('cut() requires both workplanes to have solid geometry')
    }

    const result = this.solid.subtract(other.solid)
    this.memoryManager.track(result)
    this.memoryManager.release(this.solid)

    return this.cloneWith({ solid: result })
  }

  /**
   * Intersect with another solid.
   */
  intersect(other: Workplane): Workplane {
    if (!this.solid || !other.solid) {
      throw new GeometryError('intersect() requires both workplanes to have solid geometry')
    }

    const result = this.solid.intersect(other.solid)
    this.memoryManager.track(result)
    this.memoryManager.release(this.solid)

    return this.cloneWith({ solid: result })
  }

  // ==================== Transform Operations ====================

  /**
   * Translate the solid.
   */
  translate(x: number, y: number, z: number): Workplane {
    if (!this.solid) {
      throw new GeometryError('translate() requires solid geometry')
    }

    const result = this.solid.translate(x, y, z)
    this.memoryManager.track(result)
    this.memoryManager.release(this.solid)

    return this.cloneWith({ solid: result })
  }

  /**
   * Rotate the solid (degrees).
   */
  rotate(x: number, y: number, z: number): Workplane {
    if (!this.solid) {
      throw new GeometryError('rotate() requires solid geometry')
    }

    const result = this.solid.rotate([x, y, z])
    this.memoryManager.track(result)
    this.memoryManager.release(this.solid)

    return this.cloneWith({ solid: result })
  }

  /**
   * Mirror the solid over a plane.
   */
  mirror(normal: Vec3): Workplane {
    if (!this.solid) {
      throw new GeometryError('mirror() requires solid geometry')
    }

    const result = this.solid.mirror(normal)
    this.memoryManager.track(result)
    this.memoryManager.release(this.solid)

    return this.cloneWith({ solid: result })
  }

  // ==================== Output Operations ====================

  /**
   * Get the final Manifold object.
   * This transfers ownership - do not call other methods after this.
   */
  val(): Manifold {
    if (!this.solid) {
      throw new GeometryError('val() requires solid geometry')
    }

    // Clean up all tracked objects except the final solid
    this.memoryManager.releaseAllExcept(this.solid)

    return this.solid
  }

  /**
   * Get all solids (for multi-part models).
   */
  vals(): Manifold[] {
    if (!this.solid) {
      return []
    }
    return [this.solid]
  }

  /**
   * Finalize and clean up resources.
   * Call this if you don't need the result.
   */
  dispose(): void {
    this.memoryManager.releaseAll()
  }

  // ==================== Private Helpers ====================

  private transformToWorkplane(manifold: Manifold): Manifold {
    const { origin, xDir, yDir, zDir } = this.coordinateSystem

    // For simple case where workplane is already aligned with global axes,
    // just translate. For general case, we need full transform.

    // Check if this is a standard plane
    const isStandardPlane =
      (xDir[0] === 1 && yDir[1] === 1 && zDir[2] === 1) || // XY
      (xDir[0] === 1 && yDir[2] === 1 && zDir[1] === -1) || // XZ
      (xDir[1] === 1 && yDir[2] === 1 && zDir[0] === 1) // YZ

    if (isStandardPlane) {
      // Simple translation for standard planes
      const translated = manifold.translate(origin[0], origin[1], origin[2])
      this.memoryManager.track(translated)
      return translated
    }

    // For non-standard planes, we need to compute the rotation matrix
    // and apply it as a transform
    // Build a 4x4 transformation matrix (column-major, 16 elements)
    const matrix = new Float32Array([
      xDir[0], xDir[1], xDir[2], 0,
      yDir[0], yDir[1], yDir[2], 0,
      zDir[0], zDir[1], zDir[2], 0,
      origin[0], origin[1], origin[2], 1
    ]) as any

    // Apply transformation using Manifold's transform method
    const transformed = manifold.transform(matrix)
    this.memoryManager.track(transformed)
    return transformed
  }

  private combine(newSolid: Manifold): Manifold {
    if (!this.solid) {
      return newSolid
    }

    const result = this.solid.add(newSolid)
    this.memoryManager.track(result)
    this.memoryManager.release(this.solid)
    this.memoryManager.release(newSolid)

    return result
  }

  private cloneWith(overrides: Partial<{
    solid: Manifold | null
    pendingWires: Vec2[][]
    coordinateSystem: CoordinateSystem
    selection: SelectionResult | null
  }>): Workplane {
    const clone = new Workplane(this.M, this.coordinateSystem, this.memoryManager)
    clone.solid = overrides.solid ?? this.solid
    clone.pendingWires = overrides.pendingWires ?? [...this.pendingWires]
    clone.coordinateSystem = overrides.coordinateSystem ?? {
      ...this.coordinateSystem
    }
    clone.selection = overrides.selection ?? this.selection
    return clone
  }

  private getWireMaxDimension(): number {
    let maxDim = 0
    for (const wire of this.pendingWires) {
      for (const [x, y] of wire) {
        maxDim = Math.max(maxDim, Math.abs(x), Math.abs(y))
      }
    }
    return maxDim || 1
  }

}
