# Direct Manifold API Guide

GenPrint generators use the [Manifold-3D](https://github.com/elalish/manifold) library directly for building 3D printable geometry.

## Generator Function Signature

Generators receive three parameters:
```javascript
function(M, MIN_WALL_THICKNESS, params) {
  // M: ManifoldToplevel module
  // MIN_WALL_THICKNESS: 1.2mm constant
  // params: user-supplied parameters

  // ... build geometry ...

  return manifold // Return a Manifold directly
}
```

## Common Operations

### Creating Primitives

```javascript
// Box (cube)
const box = M.Manifold.cube([width, depth, height], centered)
// centered = true: center at origin
// centered = false: corner at origin

// Cylinder
const cyl = M.Manifold.cylinder(height, bottomRadius, topRadius, segments)
// segments: number of circular segments (default based on radius)

// Sphere
const sphere = M.Manifold.sphere(radius, segments)
```

### Transforms

All transforms return a new Manifold and DO NOT modify the original:

```javascript
// Translate - must delete original
const temp = M.Manifold.cube([10, 10, 10], true)
const moved = temp.translate(5, 0, 0)
temp.delete() // Required: clean up intermediate

// Rotate - takes array [x, y, z] in degrees
const temp = M.Manifold.cylinder(10, 5, 5, 0)
const rotated = temp.rotate([90, 0, 0])
temp.delete()

// Scale
const temp = M.Manifold.cube([10, 10, 10], true)
const scaled = temp.scale([2, 1, 1])
temp.delete()
```

### Boolean Operations

```javascript
// Binary union (two manifolds)
const result = manifold1.add(manifold2)
manifold1.delete()
manifold2.delete()

// Batch union (array of manifolds)
const parts = [part1, part2, part3]
const result = M.Manifold.union(parts)
parts.forEach(p => p.delete())

// Subtraction
const result = base.subtract(tool)
base.delete()
tool.delete()

// Batch subtraction (multiple tools)
const result = M.Manifold.difference(base, [tool1, tool2, tool3])
base.delete()
tool1.delete()
tool2.delete()
tool3.delete()

// Intersection
const result = manifold1.intersect(manifold2)
manifold1.delete()
manifold2.delete()
```

## Memory Management Pattern

**Critical:** Every intermediate Manifold must be deleted to avoid memory leaks.

### Iterative Operations

```javascript
// Building up geometry in a loop
const parts = []
for (let i = 0; i < count; i++) {
  const temp = M.Manifold.cube([10, 10, 10], false)
  const positioned = temp.translate(i * 15, 0, 0)
  temp.delete()
  parts.push(positioned)
}

// Union all parts
const result = M.Manifold.union(parts)
parts.forEach(p => p.delete())
```

### Sequential Operations

```javascript
// Pattern: transform → transform → delete intermediate
const box1 = M.Manifold.cube([10, 10, 10], true)
const box2 = box1.translate(5, 0, 0)
box1.delete()

const box3 = box2.rotate([0, 0, 45])
box2.delete()

// box3 is the final result (don't delete until done using it)
```

### Conditional Geometry

```javascript
// Accumulating optional parts
let result = M.Manifold.cube([100, 100, 10], false)

if (params['add_boss']) {
  const boss = M.Manifold.cylinder(5, 10, 10, 0)
  const positioned = boss.translate(50, 50, 10)
  boss.delete()

  const newResult = result.add(positioned)
  result.delete()
  positioned.delete()
  result = newResult
}

return result
```

## Utilities

```javascript
// Bounding box
const bbox = manifold.boundingBox()
// Returns: { min: [x, y, z], max: [x, y, z] }

// Volume (mm³)
const volume = manifold.volume()

// Surface area (mm²)
const area = manifold.surfaceArea()

// Genus (topology check)
const genus = manifold.genus()
// genus = 0: single solid
// genus < 0: disconnected parts

// Check if valid
const isValid = manifold.isValid()
```

## Common Patterns

### Rounded Box

```javascript
function createRoundedBox(M, w, d, h, r, centered) {
  const box = M.Manifold.cube([w - 2*r, d - 2*r, h], centered)

  const corners = []
  const offsets = [
    [-(w/2 - r), -(d/2 - r)],
    [ (w/2 - r), -(d/2 - r)],
    [ (w/2 - r),  (d/2 - r)],
    [-(w/2 - r),  (d/2 - r)]
  ]

  for (const [x, y] of offsets) {
    const cyl = M.Manifold.cylinder(h, r, r, 0)
    const positioned = cyl.translate(x, y, centered ? 0 : h/2)
    cyl.delete()
    corners.push(positioned)
  }

  const allParts = [box, ...corners]
  const result = M.Manifold.union(allParts)
  allParts.forEach(p => p.delete())

  return result
}
```

### Hole (for subtraction)

```javascript
// Simple through-hole
function createHole(M, diameter, depth) {
  const radius = diameter / 2
  const hole = M.Manifold.cylinder(depth + 2, radius, radius, 16)
  const positioned = hole.translate(0, 0, -1) // Extend 1mm below surface
  hole.delete()
  return positioned
}
```

### Array Pattern

```javascript
// Linear array
function linearArray(M, part, count, spacing) {
  const parts = []
  for (let i = 0; i < count; i++) {
    const temp = part.clone() // Not available - create new instead
    // OR: re-create the part for each position
    const positioned = createPart(M).translate(i * spacing, 0, 0)
    parts.push(positioned)
  }
  const result = M.Manifold.union(parts)
  parts.forEach(p => p.delete())
  return result
}
```

## Best Practices

1. **Delete intermediates immediately**: Don't accumulate Manifolds in memory
2. **Use batch operations**: `M.Manifold.union([array])` is more efficient than sequential adds
3. **Avoid re-creating geometry**: If you need the same shape multiple times, create it once and position copies
4. **Return Manifold directly**: No wrapper `.build()` call needed
5. **Check validity**: Use `.genus()` to detect disconnected parts (genus < 0 means disconnected)

## Migration from Fluent API

If you're updating old generator code:

| Old (Fluent API) | New (Direct Manifold) |
|------------------|----------------------|
| `box(w, d, h)` | `M.Manifold.cube([w, d, h], true)` |
| `box(w, d, h, false)` | `M.Manifold.cube([w, d, h], false)` |
| `cylinder(h, r)` | `M.Manifold.cylinder(h, r, r, 0)` |
| `.translate(x, y, z)` | `.translate(x, y, z)` + delete original |
| `.rotate(x, y, z)` | `.rotate([x, y, z])` + delete original |
| `.subtract(other)` | `.subtract(other)` + delete both |
| `group([a,b]).unionAll()` | `M.Manifold.union([a,b])` + delete all |
| `.build()` | Return manifold directly |
| `.getBoundingBox()` | `.boundingBox()` |

## References

- [Manifold-3D GitHub](https://github.com/elalish/manifold)
- [Manifold API Documentation](https://elalish.github.io/manifold/docs/html/annotated.html)
