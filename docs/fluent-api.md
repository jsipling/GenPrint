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

### box(width, depth, height, centered?)
Creates a rectangular prism.
- `width` - X dimension
- `depth` - Y dimension
- `height` - Z dimension
- `centered` - Center at origin (default: true)

```typescript
const cube = box(10, 10, 10)
const plate = box(50, 30, 5, false)  // corner at origin
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

### .mirror(axis)
Mirror across an axis ('x', 'y', or 'z').

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

#### union(...shapes)
Combine multiple shapes into one.
When using `union()`, input parts are automatically tracked for assembly diagnostics with `assertConnected()`.

```typescript
const assembly = union(base, boss1, boss2)
```

Part tracking enables detailed error messages when parts are disconnected:

```typescript
const engine = union(
  block.name('block'),
  piston.name('piston'),
  sparkPlug.name('sparkPlug')
).assertConnected()
// If sparkPlug doesn't overlap: "Disconnected parts: sparkPlug (genus: -1)"
```

#### intersection(...shapes)
Keep only overlapping volume.

```typescript
const overlap = intersection(shape1, shape2)
```

### Chainable Methods

#### .add(other)
Union with another shape. Both shapes are consumed.

```typescript
const combined = base.add(boss)
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

### .linearPattern(count, spacing, axis?)
Create copies along an axis.

```typescript
const row = hole(4, 10).linearPattern(5, 10, 'x')  // 5 holes, 10mm apart
```

### .circularPattern(count, axis?)
Create copies rotated around an axis.

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

## Mirror Union

### .mirrorUnion(axis, options?)
Create a symmetric copy by mirroring across a plane and unioning with the original.
Useful for V-configurations, symmetric brackets, and mirrored assemblies.

- `axis` - 'x' mirrors across YZ plane, 'y' across XZ, 'z' across XY
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

### .name(name)
Set a name for this shape (useful for debugging and `findDisconnected`).

```typescript
const piston = cylinder(20, 5).name('piston_cyl1')
```

### .getName()
Get the name of this shape (returns `undefined` if not named).

```typescript
const name = shape.getName() // 'piston_cyl1' or undefined
```

### .getTrackedParts()
Get names of all parts tracked from `union()` operations.
Used internally by `assertConnected()` for diagnostics.

```typescript
const assembly = union(part1.name('a'), part2.name('b'))
console.log(assembly.getTrackedParts()) // ['a', 'b']
```

### .getTrackedPartClones()
Get cloned shapes of tracked parts for custom diagnostics.
Returns a `Map<string, Shape>` of part name to cloned Shape.

```typescript
const assembly = union(part1.name('a'), part2.name('b'))
const clones = assembly.getTrackedPartClones()
// clones.get('a') returns a Shape you can use for overlap checking
```

## Polar/Cylindrical Positioning

Natural positioning for rotary assemblies (engines, gearboxes, turbines).

### .polar(angle, radius, plane?)
Position by angle and radius in a plane.
- `angle` - Angle in degrees
- `radius` - Distance from origin
- `plane` - 'xy', 'xz' (default), or 'yz'

```typescript
// Position crankpin at 90 degrees, 20mm radius in XZ plane
const pin = cylinder(10, 3).polar(90, 20)

// Position in XY plane
const bolt = cylinder(5, 2).polar(45, 15, 'xy')
```

### .cylindrical(angle, radius, height, options?)
Position by angle, radius, and height (cylindrical coordinates).
- `angle` - Angle in degrees
- `radius` - Distance from axis
- `height` - Position along the axis
- `options.axis` - 'x', 'y' (default), or 'z'

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

### .overlaps(other, options?)
Check if this shape intersects with another shape.
Does not consume either shape.

```typescript
if (partA.overlaps(partB, { minVolume: 1 })) {
  console.log('Parts connect')
}
```

Options:
- `minVolume` - Minimum intersection volume (default: 0.001 mm³)

### .assertConnected()
Assert that this shape forms a connected assembly.
Parts are considered connected if they **touch** (share a surface) or overlap.
Throws if any parts are isolated (not touching any other part).
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

### .touches(other, tolerance?)
Check if this shape touches another shape (bounding boxes are adjacent or overlapping).
Parts that share a surface/edge are considered touching.
Does not consume either shape.

```typescript
if (partA.touches(partB)) {
  console.log('Parts are adjacent')
}

// With custom tolerance (default: 0.1mm)
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

### .definePoint(name, position)
Define a named attachment point on a shape.

```typescript
const piston = cylinder(20, 5)
  .definePoint('wristPin', [0, 0, -8])
  .definePoint('crown', [0, 0, 10])
```

### .getPoint(name)
Get a named attachment point. Returns `[x, y, z]` or `undefined`.

```typescript
const wristPinPos = piston.getPoint('wristPin')
```

### .alignTo(target, myPoint, targetPoint)
Position this shape by aligning an attachment point to a target point.

```typescript
const piston = cylinder(20, 5)
  .definePoint('wristPin', [0, 0, -8])

const rod = cylinder(30, 3)
  .definePoint('smallEnd', [0, 0, 15])
  .definePoint('bigEnd', [0, 0, -15])

// Align rod's smallEnd to piston's wristPin
const alignedRod = rod.alignTo(piston, 'smallEnd', 'wristPin')
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

### .clone()
Copy a shape without consuming the original.

```typescript
const copy = original.clone()
```

### .getBoundingBox()
Get min/max coordinates.

```typescript
const { min, max } = shape.getBoundingBox()
```

### .getVolume() / .getSurfaceArea()
Get measurements.

### .isValid()
Check if geometry is manifold (watertight).

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

## Memory Management

The fluent API handles WASM memory automatically:
- Each transform consumes the input and returns a new Shape
- Boolean operations consume all inputs
- Only call `.build()` at the end - the returned Manifold is owned by the caller
- Use `.clone()` if you need to reuse a shape
