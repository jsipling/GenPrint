# Fluent API Wishlist

Feature requests based on building complex mechanical assemblies (V8 engine generator).

---

## High Priority

### 1. Auto-Connect / Overlap Helper

**Problem:** Ensuring rotated/translated parts overlap with the main body requires tedious manual position calculations. When building assemblies, parts often need to connect but calculating exact overlap positions for rotated cylinders is error-prone.

**Current:**
```typescript
// Must manually calculate overlap position for rotated cylinder
const exhaustOffsetX = blockWidth / 2 - 2 * scale  // Trial and error
parts.push(cylinder(exhaustLength, exhaustRadius)
  .rotate(0, 90, 0)
  .translate(-exhaustOffsetX - exhaustLength / 2, pipeY, exhaustZ))
// Hope it overlaps...
```

**Proposed:**
```typescript
// Auto-position to overlap with target by specified amount
const exhaustPipe = cylinder(exhaustLength, exhaustRadius)
  .connectTo(engineBlock, {
    overlap: 2 * scale,  // How much to overlap
    direction: '-x',     // Which direction to approach from
    at: [0, pipeY, exhaustZ],  // Where on target to connect
    alignAxis: 'length', // Orient cylinder's length axis along direction (optional)
    frame: 'world'       // 'world' or 'target' - coordinate frame for 'at' (default: 'world')
  })
```

**Benefits:**
- Eliminates manual overlap calculations
- Works correctly with rotated shapes
- Self-documenting intent
- Optional axis alignment handles rotation automatically

**Design Considerations:**
- `frame: 'target'` would interpret `at` in the target's local coordinates (useful for rotated assemblies)
- `alignAxis` options: `'length'` (Z), `'width'` (X), `'height'` (Y), or `'none'` (use current orientation)

---

### 2. Overlap Verification / Debug Helper

**Problem:** When building complex assemblies, it's hard to know if parts actually connect. Negative genus errors don't tell you *which* parts are disconnected.

**Current:**
```typescript
const result = union(...parts)
// genus = -7 ... which parts aren't connected?
```

**Proposed:**
```typescript
// Check if two shapes intersect (with optional minimum volume threshold)
if (!partA.overlaps(partB, { minVolume: 1 })) {  // at least 1mm³ intersection
  console.warn('Parts do not connect:', partA.name, partB.name)
}

// Batch check all parts against main body
const disconnected = ctx.findDisconnected(mainBody, [...parts])
// Returns: ['exhaustPipe3', 'sparkPlug2', ...]

// Build-time validation - fail loudly with actionable info
const engine = union(...parts).assertConnected()
// Throws: "Disconnected parts: exhaustPipe3, sparkPlug2" instead of silent bad geometry

// Debug mode: highlight disconnected parts in preview
ctx.debugOverlaps(true)
```

**Benefits:**
- Faster debugging of complex assemblies
- Identifies exactly which parts are disconnected
- `assertConnected()` fails loudly with actionable information for LLM workflows
- `minVolume` threshold handles numerical precision issues
- Could integrate with preview rendering

---

### 3. Snap-to-Surface Positioning

**Problem:** Many parts need to be placed flush against a surface (fasteners, bosses, surface-mounted features) rather than overlapping into a body.

**Current:**
```typescript
// Must know exact Z height of bracket top surface
const boltZ = bracketHeight + baseOffset
bolt.translate(10, 15, boltZ)
// And hope the surface is actually there...
```

**Proposed:**
```typescript
// Place bolt head flush against surface, centered at point
bolt.snapTo(bracket, {
  surface: 'top',      // 'top', 'bottom', 'left', 'right', 'front', 'back', or 'nearest'
  at: [10, 15],        // Position on that surface (2D coordinates in surface plane)
  penetrate: 0,        // Negative to hover above, positive to embed partially
  alignAxis: 'z'       // Orient this axis perpendicular to surface
})

// Auto-detect nearest surface to a point
washer.snapTo(bracket, {
  surface: 'nearest',
  at: [10, 15, bracketHeight],  // 3D point - finds closest surface
  penetrate: -0.1      // Small gap for clearance
})
```

**Benefits:**
- Natural for fasteners, labels, surface features
- Complements `connectTo` (flush vs. overlapping)
- Surface detection eliminates coordinate guessing
- `penetrate` parameter handles both standoff and embedding cases

---

## Medium Priority

### 4. Polar/Cylindrical Positioning Helpers

**Problem:** Engine geometry is naturally cylindrical (angles + radii), but API uses Cartesian.

**Current:**
```typescript
const pinX = crankThrow * Math.sin(throwAngle)
const pinZ = crankThrow * Math.cos(throwAngle)
crankpin.translate(pinX, yPos, pinZ)
```

**Proposed:**
```typescript
// Position by angle and radius in a plane
crankpin.polar(throwAngle, crankThrow, 'xz').translate(0, yPos, 0)

// Or cylindrical (angle, radius, height) - all in one call
crankpin.cylindrical(throwAngle, crankThrow, yPos, { axis: 'y' })

// Chainable with other transforms
pin.cylindrical(45, 20, 10).rotate(0, 45, 0)
```

**Benefits:**
- Natural for rotary assemblies (engines, gearboxes, turbines)
- Eliminates manual sin/cos calculations
- ~15% code reduction for rotary geometry

**Implementation:** Simple wrapper around trigonometry. Low effort, high value.

---

### 5. Pattern with Transform Callback

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

### 6. Loft Between Profiles

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

### 7. Path Sweep

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

## Lower Priority

### 8. 2D Profile Operations

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

### 9. Named Sub-assemblies

**Problem:** Complex builds have many intermediate shapes that are hard to track/debug.

**Proposed:**
```typescript
const piston = buildPiston().name('piston_cyl1')
const rod = buildRod().name('rod_cyl1')

// Query by name
engine.getByName('piston_cyl1')

// List all named parts
engine.listParts() // ['piston_cyl1', 'rod_cyl1', ...]

// Integrates with overlap debugging
const disconnected = ctx.findDisconnected(block, parts)
// Returns names: ['exhaustPipe3', 'sparkPlug2']
```

**Benefits:**
- Essential for debugging with `findDisconnected`
- Foundation for exploded views and documentation
- Self-documenting assemblies

---

### 10. Clearance/Interference Checking

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
| Auto-Connect | ~30% | High | Medium | Assembly overlap positioning |
| Overlap Debug | N/A | High | Low | Debugging disconnected parts |
| Snap-to-Surface | ~20% | High | Medium | Fasteners, surface features |
| Polar Positioning | ~15% | Medium | Low | Rotary assemblies |
| Pattern Callback | ~20% | Medium | Medium | Variable patterns |
| Loft | N/A | Medium | High | Transitions, rods |
| Path Sweep | N/A | Medium | High | Curved parts, piping |
| 2D Profiles | ~10% | Low | Medium | Complex extrusions |
| Named Parts | N/A | Medium | Low | Debugging, documentation |
| Clearance Check | N/A | Medium | Medium | Moving assemblies |

---

## Implementation Phases

| Phase | Features | Rationale |
|-------|----------|-----------|
| 1 | Auto-Connect, Overlap Debug, Named Parts | Core assembly validation. Named parts required for useful debug output. |
| 2 | Snap-to-Surface | Completes positioning toolkit (overlap vs. flush mounting). |
| 3 | Polar Positioning | Low effort, immediate value for rotary geometry. |
| 4 | Pattern Callback | Builds on positioning helpers. |
| 5 | 2D Profile Operations | Medium effort, cleaner extrusions. |
| 6 | Loft | Higher effort, depends on Manifold capabilities. |
| 7 | Path Sweep | Arc sweep first, then bezier/polyline. |
| 8 | Clearance Checking | Useful but less critical than connectivity. |

---

## Design Decisions to Resolve

### 1. Coordinate Frames for `connectTo`

When `at` specifies a position, which coordinate frame?

**Option A:** Always world coordinates (simpler mental model)
**Option B:** Parameter to choose: `frame: 'world' | 'target'`
**Option C:** Always target-local (more useful for rotated assemblies)

**Recommendation:** Option B with `'world'` as default. Target-local is powerful but can be confusing.

### 2. Surface Detection for `snapTo`

How to identify surfaces?

**Option A:** Named surfaces (`'top'`, `'bottom'`, etc.) based on bounding box
**Option B:** Surface normal direction (`[0, 0, 1]` for top)
**Option C:** Nearest surface to a point

**Recommendation:** Support all three. Named surfaces for simple cases, normal vector for precision, nearest for convenience.

### 3. Overlap Volume Threshold

What's a sensible default for `overlaps()` and `assertConnected()`?

**Recommendation:** Default `minVolume: 0.001` (1mm³ at mm scale). Small enough to catch real connections, large enough to ignore numerical noise.

### 4. Pattern Callback Return Type

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
