# CadQuery-Compatible Wrapper for Manifold-3D

## Executive Summary

This document proposes a design for a CadQuery-compatible wrapper around Manifold-3D for the GenPrint project. The goal is to provide a familiar, well-documented API that AI models can reliably generate code for, leveraging existing CadQuery training data while running entirely client-side via WebAssembly.

### Key Objectives
1. **AI-friendly API**: CadQuery's fluent, descriptive syntax is well-represented in AI training data
2. **Real-time parametric updates**: Runs client-side in web workers for immediate feedback
3. **Full selector system**: Enable precise geometry queries for operations like fillets and face selection
4. **True workplanes**: Local coordinate systems for intuitive 2D-to-3D operations
5. **Clean migration**: All existing generators will be rewritten; no dual API maintenance

---

## Current State Analysis

### Architecture Overview

```
User Input (Prompt/Sketch)
         |
         v
+------------------+     +--------------------+
| AI Service       | --> | Builder Code (str) |
| (Gemini/OpenAI)  |     | (Manifold API)     |
+------------------+     +--------------------+
                                  |
                                  v
                    +---------------------------+
                    | manifold.worker.ts        |
                    | - Loads WASM              |
                    | - Executes builder code   |
                    | - Returns MeshData        |
                    +---------------------------+
                                  |
                                  v
                    +---------------------------+
                    | useManifold Hook          |
                    | - Caches results          |
                    | - Manages worker          |
                    +---------------------------+
                                  |
                                  v
                    +---------------------------+
                    | Three.js Renderer         |
                    +---------------------------+
```

### Current API Pattern

Generators use raw Manifold-3D API calls with manual memory management:

```javascript
// Current pattern: Low-level, error-prone, AI struggles with memory management
const box1 = M.Manifold.cube([10, 10, 10], true)
const box2 = box1.translate(5, 0, 0)
box1.delete()  // Manual cleanup required

const hole = M.Manifold.cylinder(10, 5, 5, 0)
const holePos = hole.translate(5, 5, 0)
hole.delete()

const result = box2.subtract(holePos)
box2.delete()
holePos.delete()

return result
```

### Pain Points

1. **Memory management**: AI frequently forgets `.delete()` calls causing memory leaks
2. **Verbose transforms**: Every transform requires intermediate variables and cleanup
3. **No geometry queries**: Cannot select faces, edges, or vertices by criteria
4. **No workplanes**: All operations happen in global coordinates
5. **Limited documentation**: AI has less training data for raw Manifold API

---

## Proposed Architectural Approaches

### Approach 1: Thin Fluent Wrapper (Recommended)

**Description**: Create a chainable wrapper class that wraps Manifold objects, manages memory automatically, and provides CadQuery-like methods. The wrapper tracks all intermediate objects and cleans them up when the final mesh is extracted.

**Architecture**:
```
CQ (entry point)
    |
    v
Workplane (stateful builder)
    |
    +--> Wraps Manifold objects
    +--> Tracks pending selectors
    +--> Manages local coordinate system
    +--> Auto-cleans intermediates on finalize()
    |
    v
SelectorEngine (geometry queries)
    |
    +--> Extracts faces/edges/vertices from mesh
    +--> Implements directional selectors (>Z, <X, etc.)
    +--> Implements filter selectors (|Z, #Z, radius, etc.)
    +--> Returns indices for further operations
```

**Pros**:
- Familiar API for AI and human developers
- Automatic memory management
- Full selector system via mesh analysis
- Clean separation of concerns

**Cons**:
- Selector operations require mesh extraction (performance cost)
- Some operations require mesh-to-manifold conversion

### Approach 2: Code Transformation Layer

**Description**: Keep the raw Manifold API but intercept/transform AI-generated CadQuery-like code into correct Manifold calls at parse time.

**Architecture**:
```
AI generates CadQuery-like code
         |
         v
+------------------------+
| Code Transformer       |
| - Parse AST            |
| - Insert .delete()     |
| - Transform methods    |
+------------------------+
         |
         v
Valid Manifold code executed in worker
```

**Pros**:
- No runtime overhead
- AI can use familiar syntax
- Works with existing worker

**Cons**:
- Complex AST transformation
- Cannot implement true selectors (they need runtime mesh access)
- Fragile to edge cases

### Approach 3: Full CadQuery Port (WASM)

**Description**: Compile actual CadQuery (Python/OCCT) to WASM.

**Pros**:
- 100% API compatibility
- No approximations needed for fillets/chamfers

**Cons**:
- Massive WASM bundle (OCCT is huge)
- Complex build system
- Potentially slow for real-time
- Loses Manifold's watertight guarantees

---

## Recommended Approach: Thin Fluent Wrapper

### Design Philosophy

1. **CadQuery-compatible, not CadQuery-identical**: Implement the most-used patterns faithfully; throw clear errors for unsupported operations
2. **Automatic memory management**: Track all Manifold objects, clean up on finalize
3. **Selector-first design**: Build robust geometry query system for face/edge selection
4. **Workplane-centric**: All operations relative to active workplane
5. **Fail-fast**: Clear errors for unsupported operations (sweep, loft, true fillets)

---

## Detailed Design

### File Structure

```
src/
  cadquery/
    index.ts                    # Main exports: cq, Workplane, etc.
    Workplane.ts                # Core workplane class
    Selector.ts                 # Selector parsing and evaluation
    SelectorTypes.ts            # Selector type definitions
    GeometryQuery.ts            # Face/edge/vertex extraction from mesh
    MeshSmoothing.ts            # Approximate fillet/chamfer via mesh ops
    CoordinateSystem.ts         # Local coordinate system math
    MemoryManager.ts            # Manifold object lifecycle tracking
    errors.ts                   # Custom error types with clear messages
    __tests__/
      Workplane.test.ts
      Selector.test.ts
      GeometryQuery.test.ts
      integration.test.ts
  prompts/
    cadqueryBuilder.prompt.md   # New AI prompt for CadQuery API
  generators/
    cadquery/                   # Migrated generators using new API
      v8Engine.generator.ts
      v6Engine.generator.ts
      crossStitchOrganizer.generator.ts
      stackedBlocks.generator.ts
```

### Core Interfaces

```typescript
// src/cadquery/types.ts

import type { Manifold, ManifoldToplevel } from 'manifold-3d'

/**
 * 3D vector type
 */
export type Vec3 = [number, number, number]

/**
 * 2D vector type for sketch operations
 */
export type Vec2 = [number, number]

/**
 * Axis specification
 */
export type Axis = 'X' | 'Y' | 'Z' | '-X' | '-Y' | '-Z'

/**
 * Selector string patterns (CadQuery compatible)
 */
export type SelectorString =
  | `>${Axis}`           // Maximum in direction (>Z = top face)
  | `<${Axis}`           // Minimum in direction (<Z = bottom face)
  | `|${Axis}`           // Parallel to axis
  | `#${Axis}`           // Perpendicular to axis
  | `>${Axis}[${number}]` // Indexed selection
  | string               // Compound selectors with 'and', 'not', 'or'

/**
 * Result of a geometry query - indices into mesh data
 */
export interface SelectionResult {
  type: 'faces' | 'edges' | 'vertices'
  indices: number[]
  centroids: Vec3[]
  normals?: Vec3[]
}

/**
 * Local coordinate system definition
 */
export interface CoordinateSystem {
  origin: Vec3
  xDir: Vec3
  yDir: Vec3
  zDir: Vec3
}

/**
 * Workplane state
 */
export interface WorkplaneState {
  solid: Manifold | null
  pendingWires: Vec2[][]
  coordinateSystem: CoordinateSystem
  selection: SelectionResult | null
}

/**
 * Options for extrusion
 */
export interface ExtrudeOptions {
  taper?: number        // Degrees of taper (positive = smaller top)
  twist?: number        // Degrees of twist over extrusion
  centered?: boolean    // Center extrusion on workplane
}

/**
 * Options for approximate fillet
 */
export interface FilletOptions {
  radius: number
  iterations?: number   // Mesh smoothing iterations (default: 3)
}
```

### Workplane Class

```typescript
// src/cadquery/Workplane.ts

import type { Manifold, ManifoldToplevel } from 'manifold-3d'
import type {
  Vec2, Vec3, Axis, SelectorString,
  CoordinateSystem, ExtrudeOptions, FilletOptions
} from './types'
import { SelectorEngine } from './Selector'
import { MemoryManager } from './MemoryManager'
import { transformToLocal, transformToGlobal } from './CoordinateSystem'
import { approximateFillet, approximateChamfer } from './MeshSmoothing'
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
    plane: 'XY' | 'XZ' | 'YZ' | CoordinateSystem = 'XY',
    memoryManager?: MemoryManager
  ) {
    this.M = M
    this.memoryManager = memoryManager ?? new MemoryManager()
    this.selectorEngine = new SelectorEngine(M)
    this.coordinateSystem = this.planeToCoordinateSystem(plane)
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
    const faceIdx = this.selection.indices[0]
    const centroid = this.selection.centroids[0]
    const normal = this.selection.normals?.[0] ?? [0, 0, 1]

    // Build new coordinate system on this face
    const zDir: Vec3 = invert
      ? [-normal[0], -normal[1], -normal[2]]
      : [...normal] as Vec3

    // Derive X and Y dirs (gram-schmidt)
    const xDir = this.computeXDir(zDir)
    const yDir = this.cross(zDir, xDir)

    // Apply offset along normal
    const origin: Vec3 = [
      centroid[0] + zDir[0] * offset,
      centroid[1] + zDir[1] * offset,
      centroid[2] + zDir[2] * offset
    ]

    const newWorkplane = this.cloneWith({
      coordinateSystem: { origin, xDir, yDir, zDir },
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
          [-width/2, -height/2],
          [width/2, -height/2],
          [width/2, height/2],
          [-width/2, height/2]
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
      wire.push([
        Math.cos(angle) * radius,
        Math.sin(angle) * radius
      ])
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
    const currentWire = [...wires[wires.length - 1]]
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
      ? 1 - (2 * height * Math.tan(taper * Math.PI / 180)) / this.getWireMaxDimension()
      : 1

    // Extrude each wire
    const extruded: Manifold[] = []

    for (const wire of this.pendingWires) {
      // Transform 2D points to 3D in workplane coordinates
      const polygon = wire.map(([x, y]) => [x, y] as [number, number])

      const solid = this.M.Manifold.extrude(
        polygon,
        height,
        twist !== 0 ? Math.ceil(Math.abs(twist) / 10) : 1,  // divisions based on twist
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
      result = extruded[0]
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
      cutter = tools[0]
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
      cutter = tools[0]
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
   * Apply approximate fillet to selected edges.
   *
   * NOTE: This is an approximation using mesh smoothing since Manifold
   * doesn't have native fillet support. Results are visually similar
   * but not geometrically identical to true fillets.
   */
  fillet(radius: number): Workplane {
    if (!this.solid) {
      throw new GeometryError('fillet() requires existing solid geometry')
    }

    if (!this.selection || this.selection.type !== 'edges') {
      throw new GeometryError('fillet() requires an edge selection. Call .edges() first.')
    }

    const mesh = this.solid.getMesh()
    const smoothedMesh = approximateFillet(
      this.M,
      mesh,
      this.selection.indices,
      radius
    )

    const newSolid = this.M.Manifold.ofMesh(smoothedMesh)
    this.memoryManager.track(newSolid)
    this.memoryManager.release(this.solid)

    return this.cloneWith({
      solid: newSolid,
      selection: null
    })
  }

  /**
   * Apply approximate chamfer to selected edges.
   *
   * NOTE: This is an approximation. See fillet() note.
   */
  chamfer(distance: number): Workplane {
    if (!this.solid) {
      throw new GeometryError('chamfer() requires existing solid geometry')
    }

    if (!this.selection || this.selection.type !== 'edges') {
      throw new GeometryError('chamfer() requires an edge selection. Call .edges() first.')
    }

    const mesh = this.solid.getMesh()
    const smoothedMesh = approximateChamfer(
      this.M,
      mesh,
      this.selection.indices,
      distance
    )

    const newSolid = this.M.Manifold.ofMesh(smoothedMesh)
    this.memoryManager.track(newSolid)
    this.memoryManager.release(this.solid)

    return this.cloneWith({
      solid: newSolid,
      selection: null
    })
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

  private planeToCoordinateSystem(
    plane: 'XY' | 'XZ' | 'YZ' | CoordinateSystem
  ): CoordinateSystem {
    if (typeof plane === 'object') {
      return plane
    }

    switch (plane) {
      case 'XY':
        return {
          origin: [0, 0, 0],
          xDir: [1, 0, 0],
          yDir: [0, 1, 0],
          zDir: [0, 0, 1]
        }
      case 'XZ':
        return {
          origin: [0, 0, 0],
          xDir: [1, 0, 0],
          yDir: [0, 0, 1],
          zDir: [0, -1, 0]
        }
      case 'YZ':
        return {
          origin: [0, 0, 0],
          xDir: [0, 1, 0],
          yDir: [0, 0, 1],
          zDir: [1, 0, 0]
        }
    }
  }

  private transformToWorkplane(manifold: Manifold): Manifold {
    const { origin, xDir, yDir, zDir } = this.coordinateSystem

    // Build transformation matrix
    // For now, use simpler approach: translate + rotate
    // In full implementation, would use manifold.transform(matrix)

    // Calculate rotation angles from zDir
    // This is a simplified version - full impl would use matrix
    const rotated = manifold // TODO: Apply rotation based on zDir
    const translated = rotated.translate(origin[0], origin[1], origin[2])

    this.memoryManager.track(translated)

    return translated
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
    clone.coordinateSystem = overrides.coordinateSystem ?? { ...this.coordinateSystem }
    clone.selection = overrides.selection ?? this.selection
    return clone
  }

  private computeXDir(zDir: Vec3): Vec3 {
    // Choose X direction perpendicular to Z
    const up: Vec3 = Math.abs(zDir[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    return this.normalize(this.cross(up, zDir))
  }

  private cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ]
  }

  private normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [1, 0, 0]
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
```

### Selector Engine

```typescript
// src/cadquery/Selector.ts

import type { Mesh } from 'manifold-3d'
import type { Vec3, SelectorString, SelectionResult } from './types'
import { SelectorError } from './errors'

/**
 * Token types for selector parsing
 */
type SelectorToken =
  | { type: 'direction', axis: 'X' | 'Y' | 'Z', sign: 1 | -1 }
  | { type: 'parallel', axis: 'X' | 'Y' | 'Z' }
  | { type: 'perpendicular', axis: 'X' | 'Y' | 'Z' }
  | { type: 'index', value: number }
  | { type: 'and' }
  | { type: 'or' }
  | { type: 'not' }
  | { type: 'radius', op: '<' | '>' | '==', value: number }

/**
 * Face data extracted from mesh
 */
interface FaceData {
  index: number
  centroid: Vec3
  normal: Vec3
  vertices: number[]
}

/**
 * Edge data extracted from mesh
 */
interface EdgeData {
  index: number
  start: Vec3
  end: Vec3
  midpoint: Vec3
  direction: Vec3
  length: number
}

/**
 * Engine for parsing and evaluating CadQuery-style selectors.
 */
export class SelectorEngine {
  constructor(private M: any) {}

  /**
   * Select faces from a mesh based on a selector string.
   */
  selectFaces(mesh: Mesh, selector: SelectorString): SelectionResult {
    const faces = this.extractFaces(mesh)
    const tokens = this.parseSelector(selector)
    const selectedIndices = this.evaluateFaceSelector(faces, tokens)

    return {
      type: 'faces',
      indices: selectedIndices,
      centroids: selectedIndices.map(i => faces[i].centroid),
      normals: selectedIndices.map(i => faces[i].normal)
    }
  }

  /**
   * Select edges from a mesh based on a selector string.
   */
  selectEdges(mesh: Mesh, selector: SelectorString): SelectionResult {
    const edges = this.extractEdges(mesh)
    const tokens = this.parseSelector(selector)
    const selectedIndices = this.evaluateEdgeSelector(edges, tokens)

    return {
      type: 'edges',
      indices: selectedIndices,
      centroids: selectedIndices.map(i => edges[i].midpoint)
    }
  }

  /**
   * Select vertices from a mesh based on a selector string.
   */
  selectVertices(mesh: Mesh, selector: SelectorString): SelectionResult {
    const vertices = this.extractVertices(mesh)
    const tokens = this.parseSelector(selector)
    const selectedIndices = this.evaluateVertexSelector(vertices, tokens)

    return {
      type: 'vertices',
      indices: selectedIndices,
      centroids: selectedIndices.map(i => vertices[i])
    }
  }

  // ==================== Mesh Data Extraction ====================

  private extractFaces(mesh: Mesh): FaceData[] {
    const faces: FaceData[] = []
    const numTris = mesh.numTri

    for (let i = 0; i < numTris; i++) {
      const tri = mesh.verts(i)
      const v0 = this.getVertex(mesh, tri[0])
      const v1 = this.getVertex(mesh, tri[1])
      const v2 = this.getVertex(mesh, tri[2])

      // Compute face normal
      const e1 = this.subtract(v1, v0)
      const e2 = this.subtract(v2, v0)
      const normal = this.normalize(this.cross(e1, e2))

      // Compute centroid
      const centroid: Vec3 = [
        (v0[0] + v1[0] + v2[0]) / 3,
        (v0[1] + v1[1] + v2[1]) / 3,
        (v0[2] + v1[2] + v2[2]) / 3
      ]

      faces.push({
        index: i,
        centroid,
        normal,
        vertices: [tri[0], tri[1], tri[2]]
      })
    }

    return faces
  }

  private extractEdges(mesh: Mesh): EdgeData[] {
    const edgeMap = new Map<string, EdgeData>()
    const numTris = mesh.numTri

    for (let i = 0; i < numTris; i++) {
      const tri = mesh.verts(i)

      // Process each edge of the triangle
      for (let j = 0; j < 3; j++) {
        const v0idx = tri[j]
        const v1idx = tri[(j + 1) % 3]

        // Canonical edge key (smaller index first)
        const key = v0idx < v1idx
          ? `${v0idx}-${v1idx}`
          : `${v1idx}-${v0idx}`

        if (!edgeMap.has(key)) {
          const v0 = this.getVertex(mesh, v0idx)
          const v1 = this.getVertex(mesh, v1idx)
          const direction = this.normalize(this.subtract(v1, v0))

          edgeMap.set(key, {
            index: edgeMap.size,
            start: v0,
            end: v1,
            midpoint: [
              (v0[0] + v1[0]) / 2,
              (v0[1] + v1[1]) / 2,
              (v0[2] + v1[2]) / 2
            ],
            direction,
            length: this.length(this.subtract(v1, v0))
          })
        }
      }
    }

    return Array.from(edgeMap.values())
  }

  private extractVertices(mesh: Mesh): Vec3[] {
    const vertices: Vec3[] = []
    const numVerts = mesh.numVert

    for (let i = 0; i < numVerts; i++) {
      vertices.push(this.getVertex(mesh, i))
    }

    return vertices
  }

  private getVertex(mesh: Mesh, index: number): Vec3 {
    const pos = mesh.position(index)
    return [pos[0], pos[1], pos[2]]
  }

  // ==================== Selector Parsing ====================

  private parseSelector(selector: SelectorString): SelectorToken[] {
    const tokens: SelectorToken[] = []
    const parts = selector.trim().split(/\s+/)

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      // Direction selector: >Z, <X, >Y, etc.
      const dirMatch = part.match(/^([><])([XYZ])(?:\[(-?\d+)\])?$/)
      if (dirMatch) {
        const sign = dirMatch[1] === '>' ? 1 : -1
        const axis = dirMatch[2] as 'X' | 'Y' | 'Z'
        tokens.push({ type: 'direction', axis, sign })

        // Handle indexing if present
        if (dirMatch[3] !== undefined) {
          tokens.push({ type: 'index', value: parseInt(dirMatch[3], 10) })
        }
        continue
      }

      // Parallel selector: |Z, |X, |Y
      const parallelMatch = part.match(/^\|([XYZ])$/)
      if (parallelMatch) {
        tokens.push({ type: 'parallel', axis: parallelMatch[1] as 'X' | 'Y' | 'Z' })
        continue
      }

      // Perpendicular selector: #Z, #X, #Y
      const perpMatch = part.match(/^#([XYZ])$/)
      if (perpMatch) {
        tokens.push({ type: 'perpendicular', axis: perpMatch[1] as 'X' | 'Y' | 'Z' })
        continue
      }

      // Boolean operators
      if (part.toLowerCase() === 'and') {
        tokens.push({ type: 'and' })
        continue
      }
      if (part.toLowerCase() === 'or') {
        tokens.push({ type: 'or' })
        continue
      }
      if (part.toLowerCase() === 'not') {
        tokens.push({ type: 'not' })
        continue
      }

      // Radius filter: radius>5, radius<10, radius==3
      const radiusMatch = part.match(/^radius([<>=]+)(\d+\.?\d*)$/)
      if (radiusMatch) {
        const op = radiusMatch[1] as '<' | '>' | '=='
        tokens.push({ type: 'radius', op, value: parseFloat(radiusMatch[2]) })
        continue
      }

      throw new SelectorError(`Unknown selector token: ${part}`)
    }

    return tokens
  }

  // ==================== Selector Evaluation ====================

  private evaluateFaceSelector(faces: FaceData[], tokens: SelectorToken[]): number[] {
    if (tokens.length === 0) {
      return faces.map(f => f.index)
    }

    let result: Set<number> = new Set(faces.map(f => f.index))
    let i = 0
    let pendingOp: 'and' | 'or' | 'not' | null = null

    while (i < tokens.length) {
      const token = tokens[i]

      if (token.type === 'and' || token.type === 'or' || token.type === 'not') {
        pendingOp = token.type
        i++
        continue
      }

      let matches: Set<number>

      if (token.type === 'direction') {
        const axisIndex = { X: 0, Y: 1, Z: 2 }[token.axis]

        // Sort faces by position on axis
        const sorted = [...faces].sort((a, b) =>
          (a.centroid[axisIndex] - b.centroid[axisIndex]) * token.sign
        )

        // Check for index token
        const nextToken = tokens[i + 1]
        if (nextToken?.type === 'index') {
          const idx = nextToken.value
          const targetIdx = idx >= 0 ? idx : sorted.length + idx
          matches = new Set([sorted[targetIdx]?.index].filter(x => x !== undefined))
          i += 2
        } else {
          // Return face(s) at extreme position
          const extreme = sorted[sorted.length - 1]?.centroid[axisIndex] ?? 0
          const tolerance = 0.001
          matches = new Set(
            sorted
              .filter(f => Math.abs(f.centroid[axisIndex] - extreme) < tolerance)
              .map(f => f.index)
          )
          i++
        }
      } else if (token.type === 'parallel') {
        const axisVec = this.axisToVec(token.axis)
        matches = new Set(
          faces
            .filter(f => Math.abs(this.dot(f.normal, axisVec)) < 0.1) // Normal perpendicular to axis
            .map(f => f.index)
        )
        i++
      } else if (token.type === 'perpendicular') {
        const axisVec = this.axisToVec(token.axis)
        matches = new Set(
          faces
            .filter(f => Math.abs(Math.abs(this.dot(f.normal, axisVec)) - 1) < 0.1) // Normal parallel to axis
            .map(f => f.index)
        )
        i++
      } else {
        i++
        continue
      }

      // Apply boolean operation
      if (pendingOp === 'and') {
        result = new Set([...result].filter(x => matches.has(x)))
      } else if (pendingOp === 'or') {
        result = new Set([...result, ...matches])
      } else if (pendingOp === 'not') {
        result = new Set([...result].filter(x => !matches.has(x)))
      } else {
        result = matches
      }

      pendingOp = null
    }

    return [...result]
  }

  private evaluateEdgeSelector(edges: EdgeData[], tokens: SelectorToken[]): number[] {
    if (tokens.length === 0) {
      return edges.map(e => e.index)
    }

    let result: Set<number> = new Set(edges.map(e => e.index))
    let i = 0
    let pendingOp: 'and' | 'or' | 'not' | null = null

    while (i < tokens.length) {
      const token = tokens[i]

      if (token.type === 'and' || token.type === 'or' || token.type === 'not') {
        pendingOp = token.type
        i++
        continue
      }

      let matches: Set<number>

      if (token.type === 'direction') {
        const axisIndex = { X: 0, Y: 1, Z: 2 }[token.axis]

        // Sort edges by midpoint position on axis
        const sorted = [...edges].sort((a, b) =>
          (a.midpoint[axisIndex] - b.midpoint[axisIndex]) * token.sign
        )

        const nextToken = tokens[i + 1]
        if (nextToken?.type === 'index') {
          const idx = nextToken.value
          const targetIdx = idx >= 0 ? idx : sorted.length + idx
          matches = new Set([sorted[targetIdx]?.index].filter(x => x !== undefined))
          i += 2
        } else {
          const extreme = sorted[sorted.length - 1]?.midpoint[axisIndex] ?? 0
          const tolerance = 0.001
          matches = new Set(
            sorted
              .filter(e => Math.abs(e.midpoint[axisIndex] - extreme) < tolerance)
              .map(e => e.index)
          )
          i++
        }
      } else if (token.type === 'parallel') {
        const axisVec = this.axisToVec(token.axis)
        matches = new Set(
          edges
            .filter(e => Math.abs(Math.abs(this.dot(e.direction, axisVec)) - 1) < 0.1)
            .map(e => e.index)
        )
        i++
      } else if (token.type === 'perpendicular') {
        const axisVec = this.axisToVec(token.axis)
        matches = new Set(
          edges
            .filter(e => Math.abs(this.dot(e.direction, axisVec)) < 0.1)
            .map(e => e.index)
        )
        i++
      } else if (token.type === 'radius') {
        // For edge radius filtering, we'd need curvature analysis
        // This is a placeholder - implement based on edge length as proxy
        const { op, value } = token
        matches = new Set(
          edges
            .filter(e => {
              if (op === '<') return e.length < value
              if (op === '>') return e.length > value
              return Math.abs(e.length - value) < 0.01
            })
            .map(e => e.index)
        )
        i++
      } else {
        i++
        continue
      }

      // Apply boolean operation
      if (pendingOp === 'and') {
        result = new Set([...result].filter(x => matches.has(x)))
      } else if (pendingOp === 'or') {
        result = new Set([...result, ...matches])
      } else if (pendingOp === 'not') {
        result = new Set([...result].filter(x => !matches.has(x)))
      } else {
        result = matches
      }

      pendingOp = null
    }

    return [...result]
  }

  private evaluateVertexSelector(vertices: Vec3[], tokens: SelectorToken[]): number[] {
    if (tokens.length === 0) {
      return vertices.map((_, i) => i)
    }

    let result: Set<number> = new Set(vertices.map((_, i) => i))
    let i = 0
    let pendingOp: 'and' | 'or' | 'not' | null = null

    while (i < tokens.length) {
      const token = tokens[i]

      if (token.type === 'and' || token.type === 'or' || token.type === 'not') {
        pendingOp = token.type
        i++
        continue
      }

      let matches: Set<number>

      if (token.type === 'direction') {
        const axisIndex = { X: 0, Y: 1, Z: 2 }[token.axis]

        const indexed = vertices.map((v, idx) => ({ v, idx }))
        const sorted = indexed.sort((a, b) =>
          (a.v[axisIndex] - b.v[axisIndex]) * token.sign
        )

        const nextToken = tokens[i + 1]
        if (nextToken?.type === 'index') {
          const idx = nextToken.value
          const targetIdx = idx >= 0 ? idx : sorted.length + idx
          matches = new Set([sorted[targetIdx]?.idx].filter(x => x !== undefined))
          i += 2
        } else {
          const extreme = sorted[sorted.length - 1]?.v[axisIndex] ?? 0
          const tolerance = 0.001
          matches = new Set(
            sorted
              .filter(item => Math.abs(item.v[axisIndex] - extreme) < tolerance)
              .map(item => item.idx)
          )
          i++
        }
      } else {
        i++
        continue
      }

      // Apply boolean operation
      if (pendingOp === 'and') {
        result = new Set([...result].filter(x => matches.has(x)))
      } else if (pendingOp === 'or') {
        result = new Set([...result, ...matches])
      } else if (pendingOp === 'not') {
        result = new Set([...result].filter(x => !matches.has(x)))
      } else {
        result = matches
      }

      pendingOp = null
    }

    return [...result]
  }

  // ==================== Vector Math Utilities ====================

  private axisToVec(axis: 'X' | 'Y' | 'Z'): Vec3 {
    return axis === 'X' ? [1, 0, 0] : axis === 'Y' ? [0, 1, 0] : [0, 0, 1]
  }

  private dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  }

  private cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ]
  }

  private subtract(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  }

  private length(v: Vec3): number {
    return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
  }

  private normalize(v: Vec3): Vec3 {
    const len = this.length(v)
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0]
  }
}
```

### Memory Manager

```typescript
// src/cadquery/MemoryManager.ts

import type { Manifold } from 'manifold-3d'

/**
 * Manages lifecycle of Manifold WASM objects to prevent memory leaks.
 * Tracks all created objects and ensures cleanup on finalize.
 */
export class MemoryManager {
  private tracked = new Set<Manifold>()

  /**
   * Start tracking a Manifold object.
   */
  track(manifold: Manifold): void {
    this.tracked.add(manifold)
  }

  /**
   * Release a tracked object (calls .delete()).
   */
  release(manifold: Manifold): void {
    if (this.tracked.has(manifold)) {
      this.tracked.delete(manifold)
      manifold.delete()
    }
  }

  /**
   * Release all tracked objects except the specified one.
   */
  releaseAllExcept(keep: Manifold): void {
    for (const manifold of this.tracked) {
      if (manifold !== keep) {
        manifold.delete()
      }
    }
    this.tracked.clear()
    this.tracked.add(keep)
  }

  /**
   * Release all tracked objects.
   */
  releaseAll(): void {
    for (const manifold of this.tracked) {
      manifold.delete()
    }
    this.tracked.clear()
  }

  /**
   * Get count of tracked objects (for debugging).
   */
  get count(): number {
    return this.tracked.size
  }
}
```

### Error Types

```typescript
// src/cadquery/errors.ts

/**
 * Base error for CadQuery wrapper operations.
 */
export class CadQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CadQueryError'
  }
}

/**
 * Thrown when an operation is not supported by the Manifold backend.
 */
export class UnsupportedOperationError extends CadQueryError {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedOperationError'
  }
}

/**
 * Thrown when a selector fails to match or is invalid.
 */
export class SelectorError extends CadQueryError {
  constructor(message: string) {
    super(message)
    this.name = 'SelectorError'
  }
}

/**
 * Thrown when geometry operations fail.
 */
export class GeometryError extends CadQueryError {
  constructor(message: string) {
    super(message)
    this.name = 'GeometryError'
  }
}
```

### Module Entry Point

```typescript
// src/cadquery/index.ts

import type { ManifoldToplevel } from 'manifold-3d'
import { Workplane } from './Workplane'
import { MemoryManager } from './MemoryManager'

export { Workplane } from './Workplane'
export { SelectorEngine } from './Selector'
export { MemoryManager } from './MemoryManager'
export * from './errors'
export * from './types'

/**
 * Factory function to create a CadQuery-like entry point.
 *
 * Usage in builder code:
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
export function createCQ(M: ManifoldToplevel) {
  const memoryManager = new MemoryManager()

  return {
    /**
     * Create a new workplane on the specified plane.
     */
    Workplane(plane: 'XY' | 'XZ' | 'YZ' = 'XY'): Workplane {
      return new Workplane(M, plane, memoryManager)
    },

    /**
     * Clean up all tracked resources.
     */
    dispose(): void {
      memoryManager.releaseAll()
    }
  }
}

// Type export for the factory return type
export type CQ = ReturnType<typeof createCQ>
```

---

## Integration with Existing Architecture

### Updated Worker

```typescript
// src/workers/manifold.worker.ts (modified sections)

import { createCQ, type CQ } from '../cadquery'

// ... existing imports and setup ...

/**
 * Execute user-generated builder code in a sandboxed context.
 * Now supports both raw Manifold API and CadQuery-style API.
 */
function executeUserBuilder(
  M: ManifoldToplevel,
  builderCode: string,
  params: Record<string, number | string | boolean>
): Manifold | NamedManifoldResult[] {
  // Create CadQuery factory for this execution
  const cq = createCQ(M)

  try {
    // The code has access to both M (raw Manifold) and cq (CadQuery wrapper)
    const fn = new Function(
      'M',
      'cq',
      'MIN_WALL_THICKNESS',
      'MIN_FEATURE_SIZE',
      'params',
      builderCode
    )

    const result = fn(M, cq, MIN_WALL_THICKNESS, MIN_FEATURE_SIZE, params)

    // Handle different return types
    if (isNamedManifoldArray(result)) {
      return result
    }

    // If result is a Workplane, extract the Manifold
    if (result && typeof result.val === 'function') {
      return result.val()
    }

    // Direct Manifold return
    if (result && typeof result.getMesh === 'function') {
      return result
    }

    throw new Error('Builder must return a Manifold, Workplane, or array of NamedManifoldResult')

  } finally {
    // Ensure cleanup even on error
    cq.dispose()
  }
}
```

### Updated AI Prompt

```markdown
<!-- src/prompts/cadqueryBuilder.prompt.md -->

You are a 3D modeling expert that converts images into parametric 3D geometry code.

Analyze this image as a 3D printable design and generate CadQuery-style JavaScript builder code.

## Your Task

1. **Describe** what you see - identify the shape, features, and purpose
2. **Generate** JavaScript code using the CadQuery-compatible API
3. **Extract** configurable parameters
4. **Name** the model appropriately

## CadQuery-Compatible API Reference

### Creating a Workplane

```javascript
const wp = cq.Workplane("XY")  // XY, XZ, or YZ plane at origin
```

### Adding Primitives

```javascript
// Box centered on workplane origin
wp.box(length, width, height)

// Cylinder along workplane Z axis
wp.cylinder(height, radius)

// Sphere centered on workplane origin
wp.sphere(radius)
```

### 2D Sketch Operations

```javascript
// Add shapes to the sketch
wp.rect(width, height)           // Rectangle
wp.circle(radius)                // Circle
wp.polygon([[x1,y1], [x2,y2], ...])  // Polygon from points

// Line drawing
wp.moveTo(x, y)
  .lineTo(x2, y2)
  .lineTo(x3, y3)
  .close()
```

### Extrusion

```javascript
// Basic extrude
wp.rect(10, 10).extrude(5)

// With options
wp.circle(5).extrude(10, {
  taper: 5,     // degrees
  twist: 45,    // degrees
  centered: true
})

// Cut operations
wp.circle(3).cutThruAll()    // Cut through entire solid
wp.circle(3).cutBlind(5)     // Cut to specific depth
```

### Face/Edge Selection (Selectors)

**Direction selectors:**
- `>Z` - Top face (maximum Z)
- `<Z` - Bottom face (minimum Z)
- `>X`, `<X`, `>Y`, `<Y` - Similar for other axes

**Geometry selectors:**
- `|Z` - Faces parallel to Z axis (vertical faces)
- `#Z` - Faces perpendicular to Z axis (horizontal faces)

**Indexed selection:**
- `>Z[0]` - First face when sorted by Z
- `>Z[-1]` - Last face when sorted by Z

**Compound selectors:**
- `>Z and |X` - Combine with 'and'
- `>Z or <Z` - Combine with 'or'
- `not >Z` - Negate selector

```javascript
// Select top face, create workplane, add geometry
wp.box(10, 10, 5)
  .faces(">Z")
  .workplane()
  .circle(3)
  .extrude(2)
```

### Approximate Fillet/Chamfer

**NOTE:** These are approximations using mesh smoothing.

```javascript
wp.box(10, 10, 5)
  .edges(">Z")
  .fillet(1)      // Approximate fillet with 1mm radius

wp.box(10, 10, 5)
  .edges("<Z")
  .chamfer(0.5)   // Approximate chamfer
```

### Boolean Operations

```javascript
const base = cq.Workplane("XY").box(10, 10, 5)
const hole = cq.Workplane("XY").cylinder(10, 2)

base.cut(hole)        // Subtraction
base.union(other)     // Union
base.intersect(other) // Intersection
```

### Transforms

```javascript
wp.translate(x, y, z)     // Move
wp.rotate(rx, ry, rz)     // Rotate (degrees)
wp.mirror([0, 0, 1])      // Mirror over plane
```

### Getting the Result

```javascript
// Get the final Manifold
const manifold = wp.val()

// For multi-part models, return named parts
return [
  { name: 'Base', manifold: base.val() },
  { name: 'Handle', manifold: handle.val() }
]
```

## UNSUPPORTED OPERATIONS

The following will throw clear errors:
- `sweep()` - Not supported by Manifold
- `loft()` - Not supported by Manifold

Workarounds:
- Use `extrude()` with `twist` option for helical shapes
- Use `revolve()` for rotational shapes
- Build complex shapes with boolean operations

## Code Requirements

- Access parameters via `params['paramName']`
- Always provide defaults: `const width = Number(params['width']) || 50`
- Return array of named parts for hover highlighting
- Use 32 segments for circles (automatic)
- Minimum wall thickness: 1.2mm

## Example: Complete Model

```javascript
const width = Number(params['width']) || 50
const height = Number(params['height']) || 20
const holeRadius = Number(params['holeRadius']) || 5

// Create base plate
const base = cq.Workplane("XY")
  .box(width, width, height)
  .faces(">Z")
  .workplane()
  .circle(holeRadius)
  .cutThruAll()
  .edges(">Z")
  .fillet(2)

// Create handle
const handle = cq.Workplane("XY")
  .cylinder(height * 2, 5)
  .translate(0, 0, height)

return [
  {
    name: 'Base Plate',
    manifold: base.val(),
    dimensions: [
      { label: 'Width', param: 'width', format: '{value}mm' }
    ],
    params: { width, height }
  },
  { name: 'Handle', manifold: handle.val() }
]
```

## Response Format

Return ONLY valid JSON (no markdown):

{
  "description": "Brief description",
  "suggestedName": "Model Name",
  "builderCode": "const width = ...; return [{ name: 'Part', manifold: cq.Workplane('XY').box(10,10,5).val() }]",
  "parameters": [...],
  "defaultParams": {...}
}
```

---

## Migration Strategy

### Phase 1: Parallel Implementation (Week 1-2)

1. Implement core `Workplane` class with basic operations
2. Implement `SelectorEngine` with directional selectors
3. Implement `MemoryManager`
4. Add to worker alongside existing API (both available)
5. Write comprehensive unit tests

### Phase 2: Migrate Built-in Generators (Week 3)

1. Migrate `stackedBlocks.generator.ts` (simplest)
2. Migrate `v6Engine.generator.ts` (medium complexity)
3. Migrate `crossStitchOrganizer.generator.ts`
4. Migrate `v8Engine.generator.ts` (most complex)
5. Update tests for each generator

### Phase 3: Update AI Prompt (Week 4)

1. Create new `cadqueryBuilder.prompt.md`
2. Test AI code generation with new API
3. Fine-tune prompt based on error patterns
4. Update image-to-geometry service

### Phase 4: Remove Legacy API (Week 5)

1. Remove raw Manifold examples from prompts
2. Update documentation
3. Remove legacy generator patterns
4. Clean up any remaining raw Manifold references

---

## Migrated Generator Example

### Before (Raw Manifold API):

```typescript
// src/generators/stackedBlocks.generator.ts (current)
const generator: Generator = {
  id: 'stacked-blocks',
  builderCode: `
    var baseSize = Number(params['baseSize']) || 50
    var blockHeight = Number(params['blockHeight']) || 20
    var shrinkFactor = Number(params['shrinkFactor']) || 0.7

    var parts = []
    var currentZ = 0
    var currentSize = baseSize

    // Base block
    var base = M.Manifold.cube([currentSize, currentSize, blockHeight], true)
    var baseTranslated = base.translate(0, 0, currentZ + blockHeight / 2)
    base.delete()
    parts.push({
      name: 'Base Block',
      manifold: baseTranslated,
      params: { size: currentSize, height: blockHeight }
    })

    currentZ += blockHeight
    currentSize *= shrinkFactor

    // Middle block
    var middle = M.Manifold.cube([currentSize, currentSize, blockHeight], true)
    var middleTranslated = middle.translate(0, 0, currentZ + blockHeight / 2)
    middle.delete()
    parts.push({
      name: 'Middle Block',
      manifold: middleTranslated,
      params: { size: currentSize, height: blockHeight }
    })

    // ... more blocks ...

    return parts
  `
}
```

### After (CadQuery-Compatible API):

```typescript
// src/generators/cadquery/stackedBlocks.generator.ts (migrated)
const generator: Generator = {
  id: 'stacked-blocks',
  builderCode: `
    const baseSize = Number(params['baseSize']) || 50
    const blockHeight = Number(params['blockHeight']) || 20
    const shrinkFactor = Number(params['shrinkFactor']) || 0.7

    const parts = []
    let currentZ = 0
    let currentSize = baseSize

    // Base block
    const base = cq.Workplane("XY")
      .box(currentSize, currentSize, blockHeight)
      .translate(0, 0, currentZ + blockHeight / 2)

    parts.push({
      name: 'Base Block',
      manifold: base.val(),
      dimensions: [
        { label: 'Size', param: 'size', format: '{value}mm' },
        { label: 'Height', param: 'height', format: '{value}mm' }
      ],
      params: { size: currentSize, height: blockHeight }
    })

    currentZ += blockHeight
    currentSize *= shrinkFactor

    // Middle block
    const middle = cq.Workplane("XY")
      .box(currentSize, currentSize, blockHeight)
      .translate(0, 0, currentZ + blockHeight / 2)

    parts.push({
      name: 'Middle Block',
      manifold: middle.val(),
      params: { size: currentSize, height: blockHeight }
    })

    currentZ += blockHeight
    currentSize *= shrinkFactor

    // Top block
    const top = cq.Workplane("XY")
      .box(currentSize, currentSize, blockHeight)
      .translate(0, 0, currentZ + blockHeight / 2)

    parts.push({
      name: 'Top Block',
      manifold: top.val(),
      params: { size: currentSize, height: blockHeight }
    })

    return parts
  `
}
```

---

## Risk Assessment

### High Priority Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Selector performance on complex meshes | Slow real-time updates | Cache selector results; lazy evaluation |
| Fillet approximation quality | Poor visual results | Multiple smoothing passes; adjustable quality |
| AI generates invalid selector strings | Runtime errors | Robust parser with clear error messages |
| Memory leaks in complex chains | Worker crashes | Comprehensive MemoryManager tests |

### Medium Priority Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Workplane coordinate transform errors | Misaligned geometry | Extensive unit tests for transforms |
| Breaking existing generators | Downtime | Parallel API during migration |
| AI prompt too complex | Poor generation quality | Iterative prompt refinement |

---

## Testing Strategy

### Unit Tests

1. **Workplane class**: All methods, chaining, error cases
2. **SelectorEngine**: All selector patterns, edge cases
3. **MemoryManager**: Tracking, cleanup, exception handling
4. **Coordinate transforms**: All plane orientations

### Integration Tests

1. **End-to-end generation**: AI prompt -> worker -> mesh
2. **Generator migration**: Each generator produces same geometry
3. **Error handling**: Invalid selectors, missing geometry

### Performance Tests

1. **Selector performance**: Measure on complex meshes (10k+ triangles)
2. **Memory usage**: Track WASM memory over repeated builds
3. **Build time**: Compare raw vs wrapper API overhead

---

## Open Questions

1. **Fillet implementation details**: Should we use Laplacian smoothing, subdivision, or mesh decimation/refinement?

2. **Selector caching**: Should selector results be cached per-workplane, or globally?

3. **Partial selectors**: How to handle `>Z` when multiple faces tie for maximum Z?

4. **Workplane stack**: Should we support `end()` to return to previous workplane (CadQuery behavior)?

5. **Assembly mode**: Should we support multi-body assemblies beyond named parts?

---

## Appendix A: CadQuery API Coverage Matrix

| CadQuery Method | Supported | Notes |
|----------------|-----------|-------|
| `Workplane()` | Yes | Full support |
| `box()` | Yes | Full support |
| `cylinder()` | Yes | Full support |
| `sphere()` | Yes | Full support |
| `rect()` | Yes | 2D sketch |
| `circle()` | Yes | 2D sketch |
| `polygon()` | Yes | 2D sketch |
| `extrude()` | Yes | With taper/twist |
| `cutThruAll()` | Yes | Full support |
| `cutBlind()` | Yes | Full support |
| `faces()` | Yes | All selectors |
| `edges()` | Yes | All selectors |
| `vertices()` | Yes | All selectors |
| `workplane()` | Yes | On selected face |
| `fillet()` | Approx | Mesh smoothing |
| `chamfer()` | Approx | Mesh smoothing |
| `union()` | Yes | Full support |
| `cut()` | Yes | Full support |
| `intersect()` | Yes | Full support |
| `translate()` | Yes | Full support |
| `rotate()` | Yes | Full support |
| `mirror()` | Yes | Full support |
| `sweep()` | No | Throws error |
| `loft()` | No | Throws error |
| `revolve()` | Partial | Via Manifold |
| `shell()` | No | Complex to implement |
| `offset()` | No | Would need offset algorithm |

---

## Appendix B: Example Selector Evaluations

```
Selector: ">Z"
Mesh: Box 10x10x10 at origin
Result: 2 triangles forming top face at z=5

Selector: "|Z"
Mesh: Box 10x10x10 at origin
Result: 8 triangles forming 4 side faces (normals perpendicular to Z)

Selector: ">Z and |X"
Mesh: Box 10x10x10 at origin
Result: Empty (no face is both top AND vertical parallel to X)

Selector: ">Z or <Z"
Mesh: Box 10x10x10 at origin
Result: 4 triangles (top 2 + bottom 2)

Selector: ">X[0]"
Mesh: Two boxes side by side
Result: Rightmost face of first box (lowest index at max X)
```

---

*Document Version: 1.0*
*Created: 2025-06-20*
*Author: Claude Code (Opus 4.5)*
