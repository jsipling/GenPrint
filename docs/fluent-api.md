# Fluent Geometry API

A chainable API for building 3D printable geometry with automatic memory management.

## Quick Start

```typescript
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { createBuilderContext } from './fluent'

export function buildMyShape(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const ctx = createBuilderContext(M)
  const { box, cylinder, hole, difference, union } = ctx

  // Build geometry using chainable methods
  const base = box(30, 20, 5)
  const boss = cylinder(10, 6).translate(15, 10, 5)
  const mounting = hole(4, 20).translate(15, 10, 0)

  return difference(union(base, boss), mounting).build()
}
```

## Setup

Import and create a builder context:

```typescript
import { createBuilderContext } from './fluent'

const ctx = createBuilderContext(M)
```

Destructure the primitives and operations you need:

```typescript
const { box, cylinder, hole, tube, difference, union } = ctx
```

## Primitives

All primitives return a `Shape` object that supports method chaining.

### box(width, depth, height, options?)
Creates a rectangular prism.
- `width` - X dimension
- `depth` - Y dimension
- `height` - Z dimension
- `options` - Boolean or options object:
  - Boolean: `true` for centered (default), `false` for corner at origin
  - Object: `{ corner: true }` or `{ centered: false }` for corner at origin

```typescript
const cube = box(10, 10, 10)
const plate = box(50, 30, 5, false)  // corner at origin (legacy)
const bracket = box(20, 10, 5, { corner: true })  // corner at origin (clearer)
```

### cylinder(height, radius, segments?)
Creates a cylinder centered on Z axis.
- `height` - Z dimension
- `radius` - Cylinder radius
- `segments` - Circular segments (default: global setting)

```typescript
const post = cylinder(20, 5)
```

### sphere(radius, segments?)
Creates a sphere centered at origin.

```typescript
const ball = sphere(10)
```

### cone(height, bottomRadius, topRadius?, segments?)
Creates a cone or truncated cone.
- `topRadius` - Default 0 for pointed cone

```typescript
const point = cone(10, 5)           // pointed cone
const funnel = cone(10, 8, 3)       // truncated
```

### tube(height, outerRadius, innerRadius, segments?)
Creates a hollow cylinder. Enforces minimum wall thickness.

```typescript
const pipe = tube(20, 10, 8)  // 2mm wall thickness
```

### roundedBox(width, depth, height, radius, centered?)
Creates a box with rounded vertical edges.

```typescript
const case = roundedBox(40, 30, 10, 3)  // 3mm corner radius
```

### hole(diameter, depth, segments?)
Creates a cylinder optimized for boolean subtraction. Automatically extends slightly beyond surfaces for clean cuts.

```typescript
const screwHole = hole(4, 10)  // 4mm diameter, 10mm deep
```

### counterboredHole(diameter, depth, headDiameter, headDepth, segments?)
Creates a hole with flat-bottom recess for bolt heads.

```typescript
const m4Counterbore = counterboredHole(4, 15, 8, 4)
```

### countersunkHole(diameter, depth, headDiameter, segments?)
Creates a hole with angled recess for flathead screws.

```typescript
const m4Countersunk = countersunkHole(4, 15, 8)
```

### extrude(profile, height)
Extrudes a 2D profile (array of [x,y] points) into 3D.

```typescript
const triangle = extrude([[0,0], [10,0], [5,10]], 5)
```

### revolve(profile, angle?, segments?)
Revolves a 2D profile around the Y axis.

```typescript
const vase = revolve([[0,0], [10,0], [8,20], [0,20]], 360)
```

## Transforms (Chainable)

All transforms return a new `Shape` and can be chained.

### .translate(x, y, z)
Move the shape.

```typescript
const moved = box(10, 10, 10).translate(20, 0, 5)
```

### .rotate(x, y?, z?)
Rotate in degrees around each axis.

```typescript
const tilted = cylinder(10, 5).rotate(90, 0, 0)  // lay flat
```

### .scale(x, y?, z?)
Scale uniformly or per-axis.

```typescript
const doubled = box(10, 10, 10).scale(2)        // uniform
const stretched = box(10, 10, 10).scale(2, 1, 1) // X only
```

### .mirror(axis: 'x' | 'y' | 'z'): Shape
Mirror across an axis.

```typescript
const mirrored = shape.mirror('x')
```

## Boolean Operations

Two styles are available: standalone operations and chainable methods.

### Standalone Operations

#### difference(base, ...tools)
Subtract shapes from a base shape.

```typescript
const withHoles = difference(plate, hole1, hole2, hole3)
```

#### union(...shapes, options?)
Combine multiple shapes into one.

**Fail-fast validation**: By default, `union()` validates that all shapes form a connected assembly before performing the union. This catches disconnected geometry immediately.

```typescript
const assembly = union(base, boss1, boss2)  // Throws if any part is disconnected
```

If shapes don't form a connected graph, throws an error:
```
Error: union() contains disconnected parts. Part(s) at index 2 do not connect to the assembly.
```

For intentionally disconnected geometry (patterns, exploded views):
```typescript
union(partA, partB, floatingPart, { skipConnectionCheck: true })
```

When using `union()`, input parts are automatically tracked for assembly diagnostics with `assertConnected()`:

```typescript
const engine = union(
  block.name('block'),
  piston.name('piston'),
  sparkPlug.name('sparkPlug')
)
// If sparkPlug doesn't overlap at union time: throws immediately
```

#### unionAll(shapes, options?)
Combine multiple shapes from an array, filtering out null/undefined values.
Returns `null` if the array is empty or contains only nulls.

**Fail-fast validation**: Like `union()`, validates connectivity by default.

```typescript
// Common pattern: accumulate shapes conditionally
const parts: (Shape | null)[] = []
for (const config of configs) {
  if (config.enabled) {
    parts.push(box(10, 10, 10).translate(config.x, 0, 0))
  } else {
    parts.push(null)  // filtered out
  }
}

const result = unionAll(parts)  // null-safe union, throws if disconnected
if (result) {
  return result.build()
}
```

For intentionally disconnected geometry:
```typescript
const result = unionAll(parts, { skipConnectionCheck: true })
```

Replaces the common null-accumulator pattern:
```typescript
// Before: repetitive null checking
let result: Shape | null = null
for (const part of parts) {
  if (result === null) {
    result = part
  } else {
    result = result.add(part)
  }
}

// After: cleaner with unionAll
const result = unionAll(parts)
```

#### intersection(...shapes)
Keep only overlapping volume.

```typescript
const overlap = intersection(shape1, shape2)
```

### Chainable Methods

#### .add(other, options?)
Union with another shape. Both shapes are consumed.

**Fail-fast validation**: By default, `.add()` checks that shapes are connected (touching or overlapping) before performing the union. This catches disconnected geometry at call time rather than build time, making debugging easier.

```typescript
const combined = base.add(boss)  // Throws if boss doesn't touch base
```

If shapes are disconnected, throws an error with helpful suggestions:
```
Error: Shape does not connect to assembly.
  - No overlap or contact detected
  - Use .overlapWith(target, amount) to position with overlap
  - Use .connectTo(target, options) for precise positioning
  - Or use .add(shape, { skipConnectionCheck: true }) for intentional gaps
```

For intentionally disconnected geometry (patterns, exploded views):
```typescript
base.add(floatingPart, { skipConnectionCheck: true })
```

#### .subtract(other)
Subtract another shape. Both shapes are consumed.

```typescript
const withHole = plate.subtract(hole)
```

#### .intersect(other)
Keep only overlapping volume. Both shapes are consumed.

```typescript
const overlap = shape1.intersect(shape2)
```

Chainable style is useful for fluent construction:

```typescript
return box(30, 20, 5)
  .add(cylinder(10, 6).translate(15, 10, 5))
  .subtract(hole(4, 10).translate(15, 10, 0))
  .build()
```

## Patterns

### .linearPattern(count: number, spacing: number, axis?: 'x' | 'y' | 'z'): Shape
Create copies along an axis. Default axis is `'x'`.

```typescript
const row = hole(4, 10).linearPattern(5, 10, 'x')  // 5 holes, 10mm apart
```

### .circularPattern(count: number, axis?: 'x' | 'y' | 'z'): Shape
Create copies rotated around an axis. Default axis is `'z'`.

```typescript
const ring = hole(4, 10).translate(20, 0, 0).circularPattern(6, 'z')
```

### linearArray(shape, count, spacing)
Create linear array with explicit spacing vector.

```typescript
const grid = linearArray(post, 4, [15, 0, 0])
```

### polarArray(shape, count, axis?)
Create polar array around an axis.

```typescript
const ring = polarArray(boss.translate(25, 0, 0), 6, 'z')
```

### gridArray(shape, countX, countY, spacingX, spacingY)
Create a 2D grid of shapes.

```typescript
const holes = gridArray(hole(4, 10), 3, 4, 10, 10)
```

## Layout Helpers

Simplify compartmentalized designs by automatically calculating divider positions.

### ctx.compartmentGrid(options)
Create a grid of divider walls for compartmentalized containers.

```typescript
const dividers = ctx.compartmentGrid({
  bounds: [innerLength, innerWidth],  // Inner dimensions of compartment area
  rows: 4,                            // Number of rows
  columns: 5,                         // Number of columns
  height: 20,                         // Height of divider walls
  wallThickness: 2,                   // Thickness of walls (clamped to MIN_WALL_THICKNESS)
  corner: false,                      // Position at corner (default: centered)
  includePerimeter: false             // Include outer perimeter walls (default: false)
})
```

Returns `null` if no dividers needed (1x1 grid without perimeter).

```typescript
// Example: Storage organizer with 4x5 grid
const container = box(120, 100, 30, { corner: true })
const cavity = box(100, 80, 25, { corner: true }).translate(10, 10, 5)
const dividers = ctx.compartmentGrid({
  bounds: [100, 80],
  rows: 4,
  columns: 5,
  height: 20,
  wallThickness: 2,
  corner: true
})

const organizer = container
  .subtract(cavity)
  .add(dividers!.translate(10, 10, 5))
  .build()
```

## Relative Positioning

Position shapes relative to other shapes using intuitive directional methods.

### .above(target)
Position this shape directly above the target (touching top surface).
Centers horizontally on target.

```typescript
const lid = box(100, 100, 3).above(boxBase)  // Lid sits on top of box
```

### .below(target)
Position this shape directly below the target (touching bottom surface).

```typescript
const stand = box(80, 80, 10).below(mainBody)  // Stand under the body
```

### .leftOf(target)
Position to the left of target (touching left surface).
Centers on Y and Z axes.

```typescript
const handle = box(10, 50, 20).leftOf(drawer)
```

### .rightOf(target)
Position to the right of target (touching right surface).

```typescript
const button = box(15, 15, 5).rightOf(panel)
```

### .inFrontOf(target)
Position in front of target (touching front/-Y surface).

```typescript
const display = box(80, 5, 40).inFrontOf(case)
```

### .behind(target)
Position behind target (touching back/+Y surface).

```typescript
const hinge = cylinder(3, 5).rotate(90, 0, 0).behind(lid)
```

### .offset(x, y, z)
Move the shape by given amounts. Alias for `translate()` with more intuitive naming for positioning workflows.

```typescript
// Position lid with 1mm gap above base
const lid = box(100, 100, 3).above(boxBase).offset(0, 0, 1)
```

### Combined Positioning Example

```typescript
// Position a lid on a box with a small gap
const base = box(100, 80, 50)
const lid = box(100, 80, 5)
  .above(base)
  .offset(0, 0, 0.5)  // 0.5mm gap

// Position hinges on the back edge
const hingeY = 40  // half of depth
const hinge1 = cylinder(3, 5).rotate(90, 0, 0).above(base).offset(-30, hingeY, 0)
const hinge2 = cylinder(3, 5).rotate(90, 0, 0).above(base).offset(30, hingeY, 0)
```

## Shape Groups

Transform multiple shapes together without manual accumulation.

### ctx.group(shapes)
Create a group from multiple shapes.

```typescript
const hingeKnuckles = ctx.group([knuckle1, knuckle2, knuckle3])
  .translateAll(0, backEdgeY, hingeZ)
```

### ShapeGroup Methods

```typescript
group.translateAll(x, y, z)        // Translate all shapes
group.rotateAll(x, y?, z?)         // Rotate all around origin
group.scaleAll(factor)             // Scale all from origin
group.mirrorAll('x' | 'y' | 'z')   // Mirror all across axis
group.unionAll()                   // Union all into single Shape (or null if empty)
group.getShapes()                  // Get clones of all shapes
group.get(index)                   // Get clone of shape at index
group.count()                      // Number of shapes in group
group.mapAll(fn)                   // Apply custom transform to each
```

### ShapeGroup Example

```typescript
// Create multiple mounting bosses
const boss1 = cylinder(5, 8).translate(-30, -20, 0)
const boss2 = cylinder(5, 8).translate(30, -20, 0)
const boss3 = cylinder(5, 8).translate(-30, 20, 0)
const boss4 = cylinder(5, 8).translate(30, 20, 0)

// Position all at once
const positioned = ctx.group([boss1, boss2, boss3, boss4])
  .translateAll(0, 0, 10)  // All bosses at z=10

// Get the positioned shapes
const bosses = positioned.getShapes()

// Or union them all
const allBosses = positioned.unionAll()
```

## Mirror Union

### .mirrorUnion(axis: 'x' | 'y' | 'z', options?: { offset?: number }): Shape
Create a symmetric copy by mirroring across a plane and unioning with the original.
Useful for V-configurations, symmetric brackets, and mirrored assemblies.

- `axis` - `'x'` mirrors across YZ plane, `'y'` across XZ, `'z'` across XY
- `options.offset` - Optional offset to create gap between halves

```typescript
// Build left side of bracket, mirror to create both
const bracket = box(20, 10, 5)
  .translate(15, 0, 0)
  .mirrorUnion('x')

// With offset for V-engine valley
const engineBank = cylinder(50, 5)
  .translate(20, 0, 0)
  .mirrorUnion('x', { offset: 10 })
```

## Coordinate Frames

Coordinate frames let you define a reference transform once and apply it to multiple shapes.
Rotation is applied first, then translation.

### .inFrame(frame)
Apply a coordinate frame transform to a shape.

```typescript
// Define a frame (e.g., V-engine left bank)
const leftBankFrame = {
  rotate: [45, 0, 0],      // degrees around X, Y, Z
  translate: [0, 0, 50]    // X, Y, Z offset
}

// Apply to multiple components
const piston = cylinder(20, 5).inFrame(leftBankFrame)
const rod = cylinder(30, 3).inFrame(leftBankFrame)
const wristPin = cylinder(5, 2).inFrame(leftBankFrame)
```

## Named Parts

Name shapes for debugging and assembly validation.

### .name(name: string): Shape
Set a name for this shape (useful for debugging and `findDisconnected`).

```typescript
const piston = cylinder(20, 5).name('piston_cyl1')
```

### .getName(): string | undefined
Get the name of this shape.

```typescript
const name = shape.getName() // 'piston_cyl1' or undefined
```

### .getTrackedParts(): string[]
Get names of all parts tracked from `union()` operations.
Used internally by `assertConnected()` for diagnostics.

```typescript
const assembly = union(part1.name('a'), part2.name('b'))
console.log(assembly.getTrackedParts()) // ['a', 'b']
```

### .getTrackedPartClones(): Map<string, Shape>
Get cloned shapes of tracked parts for custom diagnostics.

```typescript
const assembly = union(part1.name('a'), part2.name('b'))
const clones = assembly.getTrackedPartClones()
// clones.get('a') returns a Shape you can use for overlap checking
```

## Polar/Cylindrical Positioning

Natural positioning for rotary assemblies (engines, gearboxes, turbines).

### .polar(angle: number, radius: number, plane?: 'xy' | 'xz' | 'yz'): Shape
Position by angle and radius in a plane.
- `angle` - Angle in degrees
- `radius` - Distance from origin
- `plane` - `'xy'`, `'xz'` (default), or `'yz'`

```typescript
// Position crankpin at 90 degrees, 20mm radius in XZ plane
const pin = cylinder(10, 3).polar(90, 20)

// Position in XY plane
const bolt = cylinder(5, 2).polar(45, 15, 'xy')
```

### .cylindrical(angle: number, radius: number, height: number, options?: { axis?: 'x' | 'y' | 'z' }): Shape
Position by angle, radius, and height (cylindrical coordinates).
- `angle` - Angle in degrees
- `radius` - Distance from axis
- `height` - Position along the axis
- `options.axis` - `'x'`, `'y'` (default), or `'z'`

```typescript
// Position with height along Y axis (default)
const pin = cylinder(10, 3).cylindrical(90, 20, 15)

// Position with height along Z axis
const bolt = cylinder(5, 2).cylindrical(45, 15, 10, { axis: 'z' })
```

## Assembly Positioning

Tools for positioning parts in assemblies.

### .connectTo(target, options)
Connect this shape to a target with specified overlap.
Automatically positions the shape to overlap the target by the specified amount.

```typescript
const exhaustPipe = cylinder(30, 5)
  .connectTo(engineBlock, {
    overlap: 2,         // How much to overlap
    direction: '-x',    // Which direction to approach from
    at: [0, 5, 5],      // Where on target to connect
    alignAxis: 'length' // Align cylinder's length with direction
  })
```

Options:
- `overlap` - How much to overlap with target (mm)
- `direction` - '-x', '+x', '-y', '+y', '-z', or '+z'
- `at` - Position on target (default: [0, 0, 0])
- `alignAxis` - 'length' (default), 'width', 'height', or 'none'

### .snapTo(target, options)
Snap this shape flush against a target's surface.
Used for fasteners, bosses, and surface-mounted features.

```typescript
const bolt = cylinder(10, 3)
  .snapTo(bracket, {
    surface: 'top',     // Which surface to snap to
    at: [5, 5],         // Position on that surface
    penetrate: 0        // 0 = flush, negative = gap, positive = embed
  })
```

Options:
- `surface` - 'top', 'bottom', 'left', 'right', 'front', or 'back'
- `at` - Position on surface (2D coordinates in surface plane)
- `penetrate` - Offset from surface (default: 0)

### .overlapWith(target, amount, direction?)
Position this shape to achieve a specified overlap with target.
Simpler than `connectTo` - you position the shape near the target, and the API adjusts for exact overlap.

```typescript
const exhaustPipe = cylinder(30, 5)
  .translate(40, 0, 0)  // Position roughly to the right of engine
  .overlapWith(engine, 2, '+x')  // Adjust to overlap by 2mm from right
```

Direction is auto-detected if not specified:

```typescript
const part = cylinder(10, 3)
  .translate(20, 0, 0)  // Clearly to the right
  .overlapWith(target, 2)  // Auto-detects '+x' direction
```

If the shape is equidistant from multiple faces, an error will suggest explicit directions.

Options:
- `amount` - How much to overlap (mm)
- `direction` - '+x', '-x', '+y', '-y', '+z', or '-z' (optional, auto-detected if omitted)

## Overlap Verification

Debug helpers for complex assemblies.

### .overlaps(other: Shape, options?: { minVolume?: number }): boolean
Check if this shape intersects with another shape.
Does not consume either shape.

Returns `true` if shapes share at least `minVolume` of intersection volume.

```typescript
if (partA.overlaps(partB, { minVolume: 1 })) {
  console.log('Parts connect')
}
```

Options:
- `minVolume` - Minimum intersection volume in mm³ (default: 0.001)

### .assertConnected(): this
Assert that this shape forms a connected assembly.
Parts are considered connected if they **touch** (share a surface) or overlap.

**Throws** `Error` if any parts are isolated (not touching any other part).

Returns `this` for chaining.

When parts are tracked (via `union()`), the error message identifies which specific parts are disconnected:

```typescript
const engine = union(
  block.name('block'),
  piston.name('piston'),
  sparkPlug.name('sparkPlug')  // Oops, floating in space!
).assertConnected()
// Throws: "Disconnected parts: sparkPlug (genus: -1)"
```

For shapes without part tracking, a generic error is thrown:

```typescript
const shape = someShape.assertConnected()
// Throws: "Shape has disconnected parts (genus: -7)"
```

### .touches(other: Shape, tolerance?: number): boolean
Check if this shape touches another shape (bounding boxes are adjacent or overlapping).
Parts that share a surface/edge are considered touching.
Does not consume either shape.

Returns `true` if bounding boxes are within `tolerance` of each other.

```typescript
if (partA.touches(partB)) {
  console.log('Parts are adjacent')
}

// With custom tolerance (default: 0.01mm)
if (partA.touches(partB, 0.5)) {
  console.log('Parts within 0.5mm')
}
```

### ctx.findDisconnected(mainBody, parts, options?)
Find parts that do not overlap with the main body.
Returns array of part names.

```typescript
const disconnected = ctx.findDisconnected(block, [piston, rod, sparkPlug])
// Returns: ['sparkPlug'] if sparkPlug doesn't overlap
```

## Attachment Points

Define named points on shapes for automatic positioning.
Points are preserved through transforms.

### .definePoint(name: string, position: [number, number, number]): Shape
Define a named attachment point on a shape.

```typescript
const piston = cylinder(20, 5)
  .definePoint('wristPin', [0, 0, -8])
  .definePoint('crown', [0, 0, 10])
```

### .getPoint(name: string): [number, number, number] | undefined
Get a named attachment point.

Returns the `[x, y, z]` position, or `undefined` if the point doesn't exist.

```typescript
const wristPinPos = piston.getPoint('wristPin')
```

### .alignToPoint(target: Shape, myPoint: string, targetPoint: string): Shape
Position this shape by aligning an attachment point to a target point.

**Note:** If either point name doesn't exist, returns a clone of the shape unchanged (no error thrown).

```typescript
const piston = cylinder(20, 5)
  .definePoint('wristPin', [0, 0, -8])

const rod = cylinder(30, 3)
  .definePoint('smallEnd', [0, 0, 15])
  .definePoint('bigEnd', [0, 0, -15])

// Align rod's smallEnd to piston's wristPin
const alignedRod = rod.alignToPoint(piston, 'smallEnd', 'wristPin')
```

Points transform with the geometry:

```typescript
const piston = cylinder(20, 5)
  .definePoint('wristPin', [0, 0, -8])
  .translate(10, 0, 0)

// Point is now at [10, 0, -8]
console.log(piston.getPoint('wristPin'))
```

## Utilities

### .clone(): Shape
Copy a shape without consuming the original.

```typescript
const copy = original.clone()
```

### .getBoundingBox(): { min: [number, number, number], max: [number, number, number] }
Get min/max coordinates of the shape's bounding box.

```typescript
const { min, max } = shape.getBoundingBox()
// min = [xMin, yMin, zMin]
// max = [xMax, yMax, zMax]
```

### .getVolume(): number
Get volume in mm³.

### .getSurfaceArea(): number
Get surface area in mm².

### .isValid(): boolean
Check if geometry is manifold (watertight). Returns `true` if the shape has positive volume and valid topology.

### .build(options?)
**Required at the end.** Returns the raw Manifold for the worker.

By default, validates that the geometry forms a connected assembly. Parts are considered connected if they **touch** (share a surface) or overlap. This prevents accidentally creating geometry with floating parts that won't print correctly.

```typescript
return finalShape.build()
```

For intentionally disconnected geometry (pattern arrays, exploded views, multi-body prints), use the skip option:

```typescript
return pattern.build({ skipConnectivityCheck: true })
```

Options:
- `skipConnectivityCheck` - Set to `true` to allow disconnected geometry (default: `false`)

### .delete()
Explicitly free WASM memory. Call this on shapes that won't be returned.

```typescript
temporaryShape.delete()
```

## Advanced Utilities

For advanced use cases that need direct Manifold access.

### ctx.fromManifold(manifold)
Wrap an existing Manifold in a Shape for fluent operations.

```typescript
const rawManifold = M.Manifold.cube([10, 10, 10], true)
const shape = ctx.fromManifold(rawManifold)
```

### ctx.getManifoldModule()
Get the raw ManifoldToplevel module for operations not covered by the fluent API.

```typescript
const M = ctx.getManifoldModule()
const customGeometry = M.Manifold.sphere(5, 32)
```

## Printing Constants

Access via `ctx.constants`:

```typescript
const { MIN_WALL_THICKNESS, MIN_SMALL_FEATURE } = ctx.constants
```

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_WALL_THICKNESS` | 1.2mm | Minimum structural wall |
| `MIN_SMALL_FEATURE` | 1.5mm | Minimum reliable feature |
| `HOLE_CYLINDER_SEGMENTS` | 16 | Segments for holes |
| `CORNER_SEGMENTS_PER_90` | 8 | Segments per 90° arc |
| `MAX_PATTERN_COUNT` | 10000 | Maximum copies in pattern operations |
| `VERTEX_PRECISION` | 0.001mm | Vertex precision |
| `COMPARISON_TOLERANCE` | 0.01mm | Distance comparison epsilon |

Helper functions:
```typescript
const safeWall = ctx.ensureMinWall(requestedThickness)
const safeFeature = ctx.ensureMinFeature(requestedSize)
const clampedWall = ctx.safeWall(requested, maxByGeometry) // clamps between min and max
```

## Complete Example

```typescript
import type { ManifoldToplevel, Manifold } from 'manifold-3d'
import { createBuilderContext } from './fluent'
import { MIN_WALL_THICKNESS } from './printingConstants'

export function buildCableClip(
  M: ManifoldToplevel,
  params: Record<string, number | string | boolean>
): Manifold {
  const ctx = createBuilderContext(M)
  const { tube, box, hole, difference, union } = ctx

  const cableDiameter = Number(params['cable_diameter']) || 6
  const wallThickness = Math.max(Number(params['wall_thickness']) || 2, MIN_WALL_THICKNESS)
  const width = Number(params['width']) || 10
  const gapWidth = Number(params['gap_width']) || 2

  const innerRadius = cableDiameter / 2
  const outerRadius = innerRadius + wallThickness

  // C-shaped clip body
  const mainTube = tube(width, outerRadius, innerRadius)
  const gapBlock = box(gapWidth, outerRadius + 1, width + 2, false)
    .translate(-gapWidth / 2, 0, -1)

  let clip = difference(mainTube, gapBlock)

  // Add mounting base
  const baseWidth = outerRadius * 2 + 6
  const baseDepth = outerRadius + wallThickness
  const basePlate = box(baseWidth, baseDepth, width, false)
    .translate(-baseWidth / 2, -outerRadius - wallThickness, 0)

  clip = union(clip, basePlate)

  // Add mounting hole
  const mountHole = hole(4, baseWidth + 2)
    .rotate(0, 90, 0)
    .translate(-baseWidth / 2 - 1, -outerRadius - wallThickness / 2, width / 2)

  clip = difference(clip, mountHole)

  return clip.build()
}
```

## Key Differences from Direct Manifold

| Fluent API | Direct Manifold |
|------------|-----------------|
| `box(10, 10, 10)` | `M.Manifold.cube([10, 10, 10], true)` |
| `cylinder(10, 5)` | `M.Manifold.cylinder(10, 5, 5, 0)` |
| `hole(4, 10)` | `M.Manifold.cylinder(12, 2, 2, 16).translate(0,0,-1)` |
| `.translate(x, y, z)` | `.translate(x, y, z)` + manual delete |
| `difference(a, b)` | `a.subtract(b)` + manual delete both |
| Automatic cleanup | Must call `.delete()` on every intermediate |

## Consumption Safety

Shapes are consumed by operations and cannot be reused. Attempting to use a consumed shape throws a clear error:

```typescript
const a = box(10, 10, 10)
const b = box(10, 10, 10)
const c = union(a, b)

// ERROR: Shape has already been consumed by 'union()'. Use .clone() if you need to reuse this geometry.
a.translate(5, 0, 0)
```

### .isConsumed(): boolean
Check if a shape has been consumed by an operation.

```typescript
const shape = box(10, 10, 10)
console.log(shape.isConsumed()) // false

shape.translate(1, 0, 0)
console.log(shape.isConsumed()) // true
```

Use `.clone()` to reuse geometry:

```typescript
const original = box(10, 10, 10)
const copy = original.clone()  // Does not consume original

const moved = original.translate(5, 0, 0)  // Consumes original
const scaled = copy.scale(2)               // Copy still usable
```

## Bounding Box Alignment

Align shapes to the origin or to each other using bounding box faces.

### .align(x: XAlign, y: YAlign, z: ZAlign): Shape
Align this shape to the origin based on its bounding box.

```typescript
type XAlign = 'left' | 'center' | 'right' | 'none'
type YAlign = 'front' | 'center' | 'back' | 'none'
type ZAlign = 'bottom' | 'center' | 'top' | 'none'

// Center XY, bottom at Z=0 (common for 3D printing)
const aligned = box(10, 10, 10).align('center', 'center', 'bottom')

// Place at origin corner
const cornerAligned = box(10, 10, 10).align('left', 'front', 'bottom')
```

### .alignTo(target: Shape, x: XAlign, y: YAlign, z: ZAlign): Shape
Align this shape's bounding box faces to a target shape's faces.

**Note:** This method has the same name as the attachment-point alignment method (`.alignToPoint()`), but uses different arguments. The bounding-box version takes `XAlign`, `YAlign`, `ZAlign` parameters, while the point-based version takes point name strings. For clarity, prefer `.alignToPoint()` for attachment-point alignment.

```typescript
const target = box(20, 20, 10)
const part = box(10, 10, 5)

// Align part's bottom to target's bottom (same Z level)
const aligned = part.alignTo(target, 'center', 'center', 'bottom')

// Only align Z, keep X and Y unchanged
const zAligned = part.alignTo(target, 'none', 'none', 'bottom')
```

**Coordinate System:**
- X axis: Left (-) / Right (+)
- Y axis: Front (-) / Back (+)
- Z axis: Bottom (-) / Top (+)

## Hull Operation

Create convex hulls for organic transitions and mounts.

### ctx.hull(...shapes)
Create convex hull of multiple shapes. Consumes all inputs.

```typescript
const { hull, cylinder } = ctx

// Smooth mount between two cylinders
const mount = hull(
  cylinder(5, 10),
  cylinder(5, 10).translate(20, 0, 10)
)

// Fill concave corner of L-shape
const lShape = box(10, 10, 5).add(box(10, 10, 5).translate(0, 10, 0))
const filled = hull(lShape)
```

## 2D Sketch Builder

Build 2D profiles with a fluent API, then extrude or revolve to 3D.

```typescript
import { Sketch } from './fluent'

// Create a 2D sketch
const profile = Sketch.rectangle(M, 20, 10)
  .subtract(Sketch.circle(M, 3, 32).at(0, 0))
  .roundCorners(2)

// Convert to 3D
const shape = profile.extrude(5)
```

### Sketch Primitives

```typescript
Sketch.rectangle(M, width, height)  // Centered rectangle
Sketch.circle(M, radius, segments?) // Circle
Sketch.polygon(M, points)           // From [x,y] array
Sketch.slot(M, length, width, segments?) // Stadium shape
```

### Sketch Transforms

```typescript
sketch.at(x, y)          // Alias for translate
sketch.translate(x, y)   // Move
sketch.rotate(degrees)   // Rotate around origin
sketch.scale(factor)     // Uniform scale
sketch.scale(x, y)       // Per-axis scale
sketch.mirror('x' | 'y') // Mirror across axis
```

### Sketch Booleans

```typescript
sketch.add(other)              // Union
sketch.subtract(...others)     // Difference (multiple)
sketch.intersect(other)        // Intersection
Sketch.hull(M, ...sketches)    // Convex hull
```

### Sketch Modifiers

```typescript
sketch.roundCorners(radius)  // Round all corners
sketch.offset(delta)         // Expand (positive) or contract (negative)
```

### 3D Conversion

```typescript
sketch.extrude(height)                   // Simple extrusion
sketch.extrude(height, {                 // With options
  twist: 90,      // Degrees to twist top
  scale: 0.5,     // Scale factor for top
  divisions: 10   // Intermediate slices
})

sketch.revolve(degrees?, segments?)      // Revolve around Y axis
```

### Sketch Example

```typescript
// Create a bracket cross-section
const bracket = Sketch.rectangle(M, 30, 20)
  .subtract(
    Sketch.circle(M, 3, 16).at(-10, 0),
    Sketch.circle(M, 3, 16).at(10, 0)
  )
  .roundCorners(2)
  .extrude(5)
```

## Chamfers and Fillets

Add beveled or rounded edges to cylinders and boxes.

### Cylinder Chamfers

```typescript
cylinder(20, 10).chamferTop(2)      // Angled top edge
cylinder(20, 10).chamferBottom(2)   // Angled bottom edge
cylinder(20, 10).chamferBoth(2)     // Both edges
```

### Cylinder Fillets

```typescript
cylinder(20, 10).filletTop(2)           // Rounded top edge
cylinder(20, 10).filletTop(2, 16)       // With custom segments
cylinder(20, 10).filletBottom(2)        // Rounded bottom edge
cylinder(20, 10).filletBoth(2)          // Both edges
```

### Box Chamfers

```typescript
box(20, 20, 10).chamferTopEdges(2)  // Chamfer all top edges
```

## Debug and Inspection

Tools for debugging geometry during development.

### .inspect(label?)
Log shape statistics to console. Returns `this` for chaining.

```typescript
const shape = box(10, 10, 10)
  .inspect('base')                    // Logs: [base] Volume: 1000.00 mm³ | BBox: ... | Valid: true
  .add(cylinder(5, 3).translate(0, 0, 10))
  .inspect('with boss')
  .build()
```

### .debug(filename)
Export shape to STL file for visual debugging. Creates `./debug/` directory.

```typescript
const shape = box(10, 10, 10)
  .debug('step1')          // Writes ./debug/step1.stl, logs stats
  .add(cylinder(5, 3))
  .debug('step2')          // Writes ./debug/step2.stl
  .build()
```

### .color(color)
Set color metadata for visual debugging or 3MF export.

```typescript
// RGB tuple (0-1 range)
const red = shape.color([1, 0, 0])

// RGBA tuple
const transparent = shape.color([1, 0, 0, 0.5])

// Hex string
const blue = shape.color('#0000ff')
const green = shape.color('#00ff00ff')  // With alpha

// Get color (returns undefined if not set)
const c = shape.getColor()  // [r, g, b] | [r, g, b, a] | undefined
```

## Error Behavior

Summary of how invalid inputs are handled:

| Method | Invalid Input | Behavior |
|--------|--------------|----------|
| `.add()` | Disconnected shapes | **Throws** `Error` with positioning hints (use `skipConnectionCheck` to bypass) |
| `union()` | Disconnected shapes | **Throws** `Error` identifying disconnected part indices (use `skipConnectionCheck` to bypass) |
| `unionAll()` | Disconnected shapes | **Throws** `Error` (delegated to `union()`) |
| `.alignToPoint()` | Nonexistent point name | Returns clone unchanged + `console.warn` in dev |
| `.assertConnected()` | Disconnected geometry | **Throws** `Error` with part names + `skipConnectivityCheck` hint |
| `.overlapWith()` | Ambiguous direction | **Throws** `Error` suggesting explicit direction |
| `unionAll()` | Empty array or all nulls | Returns `null` |
| `hole()` | Negative diameter | Passes to Manifold (may produce invalid geometry) |
| `tube()` | Inner radius too large | Clamps to enforce minimum wall thickness |
| `roundedBox()` | Radius > half width | Clamps to maximum possible radius |
| `countersunkHole()` | Head diameter ≤ hole diameter | Falls back to regular hole |
| `extrude()` / `revolve()` | Profile with < 3 points | Returns 1×1×1 fallback cube |
| `linearPattern()` / `circularPattern()` | count ≤ 0 | Returns clone of original |
| Any method | Called on consumed shape | **Throws** `Error` suggesting `.clone()` |

**Design philosophy:** Most primitives silently clamp invalid values to safe defaults rather than throwing. This ensures builders always produce valid geometry. Use `console.warn` messages in dev mode to catch edge cases.

## Memory Management

The fluent API handles WASM memory automatically:
- Each transform consumes the input and returns a new Shape
- Boolean operations consume all inputs
- Only call `.build()` at the end - the returned Manifold is owned by the caller
- Use `.clone()` if you need to reuse a shape
- Attempting to use a consumed shape throws a clear error with `.clone()` suggestion
