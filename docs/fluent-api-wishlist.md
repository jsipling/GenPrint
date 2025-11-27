# Fluent API Wishlist

Feature requests based on building complex mechanical assemblies (V8 engine generator).

---

## Implemented Features

The following features from the original wishlist have been implemented:

- **Auto-Connect / Overlap Helper** - `connectTo()` and `overlapWith()` methods
- **Overlap Verification / Debug Helper** - `overlaps()`, `assertConnected()` with part tracking, `findDisconnected()`
- **Snap-to-Surface Positioning** - `snapTo()` method
- **Polar/Cylindrical Positioning** - `polar()` and `cylindrical()` methods
- **Named Parts** - `name()`, `getName()`, `getTrackedParts()`, `getTrackedPartClones()`

See [fluent-api.md](./fluent-api.md) for documentation.

---

## Remaining Wishlist

### 1. Pattern with Transform Callback

**Problem:** Complex patterns where each instance has different transforms.

**Current:**
```typescript
const crankThrows = [0, 90, 270, 180]
for (let i = 0; i < 4; i++) {
  const throwAngle = (crankAngle + crankThrows[i]) * Math.PI / 180
  const pinX = crankThrow * Math.sin(throwAngle)
  const pinZ = crankThrow * Math.cos(throwAngle)
  const pin = cylinder(journalLength, crankpinRadius)
    .translate(pinX, (i + 0.5) * spacing, pinZ)
  parts.push(pin)
}
union(...parts)
```

**Proposed:**
```typescript
const crankThrows = [0, 90, 270, 180]

cylinder(journalLength, crankpinRadius)
  .patternWith(4, (i, prev) => ({
    polar: [crankAngle + crankThrows[i], crankThrow, 'xz'],
    translate: [0, (i + 0.5) * spacing, 0]
  }))

// Chain-link patterns using previous instance
link.patternWith(10, (i, prev) => ({
  alignTo: prev ? { target: prev, myPoint: 'endLoop', targetPoint: 'startLoop' } : null,
  rotate: [0, 0, i * 5]  // Gradual twist
}))
```

**Benefits:**
- Handles non-uniform patterns elegantly
- `prev` parameter enables chained assemblies (chain links, vertebrae, etc.)
- ~20% code reduction for complex patterns

---

### 2. Loft Between Profiles

**Problem:** Connecting rods, intake manifolds, and transitions need varying cross-sections along length.

**Current:**
```typescript
// Approximation with discrete shapes
const beam = box(rodWidth, rodThickness, beamLength)
const bigEnd = tube(rodWidth, bigEndRadius, crankpinRadius)
const smallEnd = tube(rodWidth, smallEndRadius, wristPinRadius)
union(beam, bigEnd, smallEnd) // Doesn't blend smoothly
```

**Proposed:**
```typescript
// Smooth transition between same-topology profiles
const rod = loft([
  { profile: circleProfile(bigEndRadius), z: 0 },
  { profile: circleProfile(rodWidth / 2), z: bigEndRadius },
  { profile: circleProfile(rodWidth * 0.4), z: rodLength - smallEndRadius },
  { profile: circleProfile(smallEndRadius), z: rodLength }
])
```

**Benefits:**
- Realistic mechanical parts
- Smooth transitions (better for FDM printing)
- Single watertight mesh

**Implementation Notes:**
- Constrain to same-topology profiles (circle→circle, rect→rect) for predictable LLM-generated code
- Provide helper functions: `circleProfile(r, segments)`, `rectProfile(w, h)`, `polygonProfile(points)`
- Error clearly if vertex counts don't match

---

### 3. Path Sweep

**Problem:** Curved parts (exhaust headers, piping) need profile swept along a path.

**Proposed:**
```typescript
// Sweep along arc (most common, implement first)
const curvedPipe = sweep(
  circleProfile(pipeRadius),
  arcPath({ radius: 50, startAngle: 0, endAngle: 90, plane: 'xz' })
)

// Sweep along bezier curve
const exhaustPipe = sweep(
  circleProfile(pipeRadius),
  bezierPath([start, control1, control2, end])
)

// Sweep along polyline with automatic smoothing
const conduit = sweep(
  circleProfile(5),
  polylinePath([[0,0,0], [20,0,0], [20,30,0], [20,30,50]], { cornerRadius: 5 })
)
```

**Implementation Notes:**
- Start with arc sweep (most useful, easiest to implement)
- Use fixed up-vector for orientation (more predictable than Frenet frame)
- Discretize path, place profile at each point, hull adjacent pairs

---

### 4. 2D Profile Operations

**Problem:** Complex extrusion profiles need boolean operations before extruding.

**Proposed:**
```typescript
// Basic CSG on 2D profiles
const profile = union2d(
  rectProfile(width, height),
  circleProfile(radius).translate2d(x, y)
)

const holedPlate = difference2d(
  rectProfile(50, 30),
  circleProfile(5).translate2d(10, 10),
  circleProfile(5).translate2d(40, 10)
)

extrude(holedPlate, depth)
```

**Benefits:**
- Complex extrusions without 3D boolean overhead
- Cleaner geometry (single extrusion vs. union of extrusions)

**Implementation Notes:**
- Start with basic CSG (union, difference, intersection)
- Defer fillet/chamfer on 2D profiles (geometrically complex)

---

### 5. Clearance/Interference Checking

**Problem:** Moving assemblies (pistons in bores) need clearance verification.

**Proposed:**
```typescript
const clearance = piston.clearanceTo(bore)
if (clearance < 0.5) {
  console.warn('Tight fit:', clearance)
}

// Interference check
if (piston.intersects(rod)) {
  throw new Error('Collision detected')
}

// Batch validation
assembly.validateClearances({
  min: 0.3,
  pairs: [['piston', 'bore'], ['rod', 'crankcase']]
})
```

**Implementation Notes:**
- `intersects()` is straightforward via boolean intersection + volume check
- `clearanceTo()` requires mesh distance calculation (more complex)

---

## Summary by Impact

| Feature | Code Reduction | Complexity Reduction | Effort | Use Case |
|---------|---------------|---------------------|--------|----------|
| Pattern Callback | ~20% | Medium | Medium | Variable patterns |
| Loft | N/A | Medium | High | Transitions, rods |
| Path Sweep | N/A | Medium | High | Curved parts, piping |
| 2D Profiles | ~10% | Low | Medium | Complex extrusions |
| Clearance Check | N/A | Medium | Medium | Moving assemblies |

---

## Implementation Phases

| Phase | Features | Rationale |
|-------|----------|-----------|
| 1 | Pattern Callback | Builds on existing positioning helpers. |
| 2 | 2D Profile Operations | Medium effort, cleaner extrusions. |
| 3 | Loft | Higher effort, depends on Manifold capabilities. |
| 4 | Path Sweep | Arc sweep first, then bezier/polyline. |
| 5 | Clearance Checking | Useful but less critical than connectivity. |

---

## Design Decisions to Resolve

### 1. Pattern Callback Return Type

What transforms should the callback be able to specify?
```typescript
(i: number, prev?: Shape) => {
  translate?: [number, number, number]
  rotate?: [number, number, number]
  scale?: number | [number, number, number]
  polar?: [angle: number, radius: number, plane: 'xy' | 'xz' | 'yz']
  cylindrical?: [angle: number, radius: number, height: number]
  alignTo?: { target: Shape, myPoint: string, targetPoint: string }
}
```

**Recommendation:** Support all of the above. Apply in order: alignTo → polar/cylindrical → translate → rotate → scale.
