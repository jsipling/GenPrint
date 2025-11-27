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
  .rotate(0, 90, 0)
  .connectTo(engineBlock, {
    overlap: 2 * scale,  // How much to overlap
    direction: '-x',     // Which direction to approach from
    at: [0, pipeY, exhaustZ]  // Where on target to connect
  })
```

**Benefits:**
- Eliminates manual overlap calculations
- Works correctly with rotated shapes
- Self-documenting intent

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
// Check if two shapes intersect
if (!partA.overlaps(partB)) {
  console.warn('Parts do not connect:', partA.name, partB.name)
}

// Or batch check all parts against main body
const disconnected = ctx.findDisconnected(mainBody, [...parts])
// Returns: ['exhaustPipe3', 'sparkPlug2', ...]

// Debug mode: highlight disconnected parts in preview
ctx.debugOverlaps(true)
```

**Benefits:**
- Faster debugging of complex assemblies
- Identifies exactly which parts are disconnected
- Could integrate with preview rendering

---

## Medium Priority

### 3. Loft Between Profiles

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
// Smooth transition between profiles
const rod = loft([
  { profile: circleProfile(bigEndRadius), z: 0 },
  { profile: iBeamProfile(rodWidth, rodThickness), z: bigEndRadius },
  { profile: iBeamProfile(rodWidth * 0.8, rodThickness * 0.8), z: rodLength - smallEndRadius },
  { profile: circleProfile(smallEndRadius), z: rodLength }
])
```

**Benefits:**
- Realistic mechanical parts
- Smooth transitions (better for FDM printing)
- Single watertight mesh

---

### 4. Path Sweep

**Problem:** Curved parts (exhaust headers, piping) need profile swept along a path.

**Proposed:**
```typescript
const exhaustPipe = sweep(
  circleProfile(pipeRadius),
  bezierPath([start, control1, control2, end])
)

// Or along arc
const curvedRod = sweep(iBeamProfile, arc(radius, startAngle, endAngle))
```

---

### 5. Polar/Cylindrical Positioning Helpers

**Problem:** Engine geometry is naturally cylindrical (angles + radii), but API uses Cartesian.

**Current:**
```typescript
const pinX = crankThrow * Math.sin(throwAngle)
const pinZ = crankThrow * Math.cos(throwAngle)
crankpin.translate(pinX, yPos, pinZ)
```

**Proposed:**
```typescript
// Position by angle and radius
crankpin.polar(throwAngle, crankThrow, 'xz').translate(0, yPos, 0)

// Or cylindrical (angle, radius, height)
crankpin.cylindrical(throwAngle, crankThrow, yPos)
```

---

### 6. Pattern with Transform Callback

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
  .patternWith(4, (i) => ({
    polar: [crankAngle + crankThrows[i], crankThrow, 'xz'],
    translate: [0, (i + 0.5) * spacing, 0]
  }))
```

---

## Lower Priority

### 7. 2D Profile Operations

**Problem:** Complex extrusion profiles need boolean operations before extruding.

**Proposed:**
```typescript
const profile = ctx.profile()
  .rect(width, height)
  .subtract(circle(holeRadius).at(x, y))
  .fillet(cornerRadius)
  .chamfer(edgeRadius, [0, 1]) // specific corners

extrude(profile, depth)
```

---

### 8. Named Sub-assemblies

**Problem:** Complex builds have many intermediate shapes that are hard to track/debug.

**Proposed:**
```typescript
const piston = buildPiston().name('piston_cyl1')
const rod = buildRod().name('rod_cyl1')

// Later, for debugging:
engine.getByName('piston_cyl1').highlight()
```

---

### 9. Clearance/Interference Checking

**Problem:** Moving assemblies (pistons in bores) need clearance verification.

**Proposed:**
```typescript
const clearance = piston.clearanceTo(bore)
if (clearance < 0.5) {
  console.warn('Tight fit:', clearance)
}

// Or interference check
if (piston.intersects(rod)) {
  throw new Error('Collision detected')
}
```

---

## Summary by Impact

| Feature | Code Reduction | Complexity Reduction | Use Case |
|---------|---------------|---------------------|----------|
| Auto-Connect | ~30% | High | Assembly overlap positioning |
| Overlap Debug | N/A | High | Debugging disconnected parts |
| Loft | N/A | Medium | Transitions, rods |
| Path Sweep | N/A | Medium | Curved parts, piping |
| Polar Positioning | ~15% | Medium | Rotary assemblies |
| Pattern Callback | ~20% | Medium | Variable patterns |

---

## Implementation Notes

These could be added incrementally:
1. **Phase 1:** Auto-connect / overlap helper (high value for assembly work)
2. **Phase 2:** Overlap verification debug helper (pairs with auto-connect)
3. **Phase 3:** Polar positioning helpers (simple, high value)
4. **Phase 4:** Pattern callback (builds on positioning)
5. **Phase 5:** Loft/sweep (depends on Manifold library support)
