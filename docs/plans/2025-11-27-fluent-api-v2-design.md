# Fluent API V2 Design

Based on engineer feedback from building complex mechanical assemblies (V8 engine generator).

## Summary

Seven improvements to make the fluent API production-ready:

| Feature | Priority | Complexity | V1 Scope |
|---------|----------|------------|----------|
| 2D Sketch Builder | High | Medium | Full |
| Chamfers/Fillets | High | Medium | Cylinders full, Box chamfer only |
| Align Helper | Medium | Low | Full |
| Consumption Safety | High | Low | Full with `consumedBy` tracking |
| Colors | Medium | Low | Whole-shape only |
| Debug/Inspect | Medium | Low | Full |
| Hull | Medium | Low | Full (native Manifold support) |

---

## 1. 2D Sketch Builder

### Problem

Defining custom profiles requires raw coordinate arrays, which is brittle and breaks fluent flow:

```typescript
// Current - manual coordinates
const profile = [[0,0], [10,0], [10,20], [0,20]]
const shape = extrude(profile, 5)
```

### Solution

A fluent `Sketch` class wrapping Manifold's `CrossSection`:

```typescript
// Proposed
const shape = Sketch.rectangle(10, 20)
  .roundCorners(2)
  .subtract(Sketch.circle(5).at(5, 10))
  .extrude(5)
```

### API

#### Primitives

```typescript
Sketch.rectangle(width: number, height: number): Sketch
Sketch.circle(radius: number, segments?: number): Sketch
Sketch.polygon(points: [number, number][]): Sketch
Sketch.slot(length: number, width: number): Sketch  // Stadium shape
```

#### Transforms

```typescript
.at(x: number, y: number): Sketch      // Translate (alias for positioning)
.translate(x: number, y: number): Sketch
.rotate(degrees: number): Sketch
.scale(factor: number): Sketch
.scale(x: number, y: number): Sketch
.mirror(axis: 'x' | 'y'): Sketch
```

#### Boolean Operations

```typescript
.add(other: Sketch): Sketch
.subtract(other: Sketch, ...others: Sketch[]): Sketch
.intersect(other: Sketch): Sketch
```

#### Modifiers

```typescript
.roundCorners(radius: number): Sketch   // Uses offset(-r).offset(+r) with JoinType.Round
.offset(delta: number): Sketch          // Expand/contract outline
```

#### 3D Conversion

```typescript
.extrude(height: number): Shape
.extrude(height: number, options: {
  twist?: number,      // Degrees to twist top relative to bottom
  scale?: number,      // Scale factor for top (0 = cone)
  divisions?: number   // Intermediate slices for smooth twist
}): Shape

.revolve(degrees?: number, segments?: number): Shape
```

#### Hull

```typescript
Sketch.hull(...sketches: Sketch[]): Sketch
```

### Implementation Notes

- `Sketch` class wraps `CrossSection`, auto-consumes instances like `Shape` does
- `roundCorners(r)` implementation: `offset(-r, JoinType.Round).offset(+r, JoinType.Round)`
- Memory management follows same pattern as `Shape` class

---

## 2. Chamfers and Fillets

### Problem

No way to chamfer/fillet edges. Users simulate chamfers by stacking cones on cylinders.

### Solution

Chainable edge modifiers for primitives.

### API - Cylinders

```typescript
// Chamfers (angled cuts)
cylinder(height, radius).chamferTop(size: number): Shape
cylinder(height, radius).chamferBottom(size: number): Shape
cylinder(height, radius).chamferBoth(size: number): Shape

// Fillets (rounded edges)
cylinder(height, radius).filletTop(radius: number): Shape
cylinder(height, radius).filletBottom(radius: number): Shape
cylinder(height, radius).filletBoth(radius: number): Shape
```

### API - Boxes (V1: Chamfer only)

```typescript
box(w, d, h).chamferTopEdges(size: number): Shape
```

Box fillets deferred to V2 due to complexity (3-way corner intersections). Users wanting filleted boxes should use:

```typescript
Sketch.rectangle(w, d).roundCorners(r).extrude(h)
```

### Implementation

**Cylinder Chamfer (Constructive):**
```typescript
chamferTop(size) {
  return union(
    cylinder(this.height - size, this.radius),
    cone(size, this.radius, this.radius - size)
      .translate(0, 0, this.height - size)
  )
}
```

**Cylinder Fillet (Constructive):**
```typescript
filletTop(radius) {
  // Quarter-circle profile revolved around cylinder edge
  const filletProfile = [[this.radius - radius, 0], ...]  // Quarter circle
  const fillet = revolve(filletProfile).translate(0, 0, this.height - radius)
  return union(
    cylinder(this.height - radius, this.radius),
    fillet
  )
}
```

**Box Chamfer (Subtractive):**
```typescript
chamferTopEdges(size) {
  // Subtract 4 triangular prisms along top edges
  const chamferPrism = extrude([[0,0], [size,0], [0,size]], this.width + 2)
  // ... rotate and position along each edge
  return difference(this, ...chamferPrisms)
}
```

---

## 3. Align Helper

### Problem

Centering and positioning requires manual bounding box math:

```typescript
// Current - tedious
const centered = shape.translate(-width/2, -depth/2, 0)
```

### Solution

Bounding-box based alignment helpers.

### API

```typescript
type XAlign = 'left' | 'center' | 'right' | 'none'
type YAlign = 'front' | 'center' | 'back' | 'none'
type ZAlign = 'bottom' | 'center' | 'top' | 'none'

// Align to origin
shape.align(x: XAlign, y: YAlign, z: ZAlign): Shape

// Align relative to another shape (face-to-face alignment)
shape.alignTo(target: Shape, x: XAlign, y: YAlign, z: ZAlign): Shape
```

### Coordinate System

Standard 3D printing coordinates:
- **X axis**: Left (-) / Right (+)
- **Y axis**: Front (-) / Back (+)
- **Z axis**: Bottom (-) / Top (+)

### Examples

```typescript
// Center XY, bottom at Z=0
box(10, 10, 10).align('center', 'center', 'bottom')

// Align piston's bottom face to block's bottom face (side-by-side on floor)
piston.alignTo(block, 'center', 'center', 'bottom')

// Only align Z, keep X and Y unchanged
part.alignTo(reference, 'none', 'none', 'bottom')
```

### Semantics

- `alignTo` is **face-to-face alignment** (flush surfaces)
- For **stacking** (part on top of another), use existing `snapTo()` or `connectTo()`

---

## 4. Consumption Safety

### Problem

Shapes are consumed by operations. Reusing a consumed shape crashes:

```typescript
const a = box(10)
const b = box(10).translate(20)
const c = union(a, b)
// 'a' and 'b' are now invalid WASM pointers
const d = a.translate(5)  // CRASH or undefined behavior
```

### Solution

Track consumption state and throw clear errors.

### Implementation

```typescript
class Shape {
  private consumed = false
  private consumedBy = ''

  markConsumed(operationName: string) {
    this.consumed = true
    this.consumedBy = operationName
  }

  private assertNotConsumed() {
    if (this.consumed) {
      const name = this.shapeName ? ` '${this.shapeName}'` : ''
      throw new Error(
        `Shape${name} has already been consumed by '${this.consumedBy}'. ` +
        `Use .clone() if you need to reuse this geometry.`
      )
    }
  }

  // Every method that accesses manifold checks first
  translate(x: number, y: number, z: number): Shape {
    this.assertNotConsumed()
    // ... existing logic
  }
}
```

### Error Message Examples

```
Shape 'engineBlock' has already been consumed by 'union()'. Use .clone() if you need to reuse this geometry.

Shape has already been consumed by 'difference()'. Use .clone() if you need to reuse this geometry.
```

---

## 5. Colors

### Problem

No way to assign colors for visual debugging or multi-color 3MF export.

### Solution

Color as shape metadata.

### API

```typescript
shape.color(hex: string): Shape
shape.color(r: number, g: number, b: number): Shape

// Examples
const block = box(100, 60, 40).color('#CC0000')    // Red
const piston = cylinder(20, 10).color('#C0C0C0')  // Silver
```

### V1 Behavior

- Color is a whole-shape property
- On `union()`: First argument's color wins
- Preserved through transforms
- Passed to mesh export for 3MF compatibility

### Future (V2)

- `Assembly` object for multi-color exports without boolean union
- Per-face colors via Manifold vertex properties

---

## 6. Debug and Inspect

### Problem

Hard to debug geometry issues without exporting and opening in external viewer.

### Solution

Built-in debug helpers.

### API

```typescript
// Write STL to ./debug/ AND log stats to console
shape.debug(label: string): Shape  // Returns this for chaining

// Console stats only (volume, bounding box, validity)
shape.inspect(label: string): Shape  // Returns this for chaining
```

### Output

**Console output for `.inspect('step1')`:**
```
[step1] Volume: 1234.56 mm³ | BBox: [0,0,0] → [10,20,30] | Valid: true
```

**File output for `.debug('step1')`:**
- Writes `./debug/step1.stl`
- Also logs stats to console

### Implementation Notes

- Debug folder created automatically if missing
- STL export uses existing mesh conversion
- Both methods return `this` for chaining

---

## 7. Hull Operation

### Problem

Creating organic transitions and mounts is difficult without convex hull.

### Solution

Expose Manifold's native hull operations.

### API

```typescript
// 3D Hull
hull(...shapes: Shape[]): Shape

// 2D Hull (in Sketch context)
Sketch.hull(...sketches: Sketch[]): Sketch
```

### Examples

```typescript
// Smooth mount between two points
const mount = hull(
  cylinder(5, 10).translate(0, 0, 0),
  cylinder(5, 10).translate(20, 0, 10)
)

// 2D hull for profile
const profile = Sketch.hull(
  Sketch.circle(5).at(0, 0),
  Sketch.circle(5).at(20, 0)
)
```

### Implementation

Direct wrapper around `Manifold.hull()` and `CrossSection.hull()`.

---

## Implementation Phases

### Phase 1: Foundation (Low complexity, high impact)
1. Consumption Safety
2. Align Helper
3. Hull Operation

### Phase 2: 2D Sketch Builder
1. Sketch class with primitives
2. 2D transforms and booleans
3. roundCorners via offset
4. extrude/revolve integration

### Phase 3: Chamfers and Fillets
1. Cylinder chamfer (constructive)
2. Cylinder fillet (constructive)
3. Box chamfer (subtractive)

### Phase 4: Debug and Colors
1. inspect() - console stats
2. debug() - STL export
3. color() - metadata property

---

## Testing Strategy

Each feature requires:
1. Unit tests for core functionality
2. Edge case tests (zero values, negative values, already-consumed shapes)
3. Integration tests with existing API
4. Memory leak tests (WASM cleanup)

---

## Documentation Updates

After implementation:
1. Update `docs/fluent-api.md` with new methods
2. Add examples for each feature
3. Update `docs/fluent-api-wishlist.md` to mark implemented items
