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

### difference(base, ...tools)
Subtract shapes from a base shape.

```typescript
const withHoles = difference(plate, hole1, hole2, hole3)
```

### union(...shapes)
Combine multiple shapes into one.

```typescript
const assembly = union(base, boss1, boss2)
```

### intersection(...shapes)
Keep only overlapping volume.

```typescript
const overlap = intersection(shape1, shape2)
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

### polarArray(shape, count, axis?, centerOffset?)
Create polar array around an axis.

```typescript
const ring = polarArray(boss, 6, 'z', 25)
```

### gridArray(shape, countX, countY, spacingX, spacingY)
Create a 2D grid of shapes.

```typescript
const holes = gridArray(hole(4, 10), 3, 4, 10, 10)
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

### .build()
**Required at the end.** Returns the raw Manifold for the worker.

```typescript
return finalShape.build()
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

Helper functions:
```typescript
const safeWall = ctx.ensureMinWall(requestedThickness)
const safeFeature = ctx.ensureMinFeature(requestedSize)
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
