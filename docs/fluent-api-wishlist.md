# Fluent API Wishlist

Feature requests based on building complex mechanical assemblies (V8 engine generator).

---

## High Priority

### 1. Coordinate Frames / Reference Systems

**Problem:** Building angled assemblies (V-engine banks, gearboxes) requires recalculating positions repeatedly with sin/cos.

**Current:**
```typescript
const halfAngleRad = (bankAngle / 2) * Math.PI / 180
const cylX = -bankExtent * 0.5 * Math.sin(halfAngleRad)
const cylZ = totalHeight - bankExtent * 0.5 * Math.cos(halfAngleRad)
piston.translate(cylX, yPos, cylZ)
// Repeat for rod, wrist pin, etc.
```

**Proposed:**
```typescript
const leftBank = ctx.frame()
  .rotate(bankAngle / 2, 0, 0)
  .translate(0, 0, blockDepth)

// All children inherit the frame's transform
piston.inFrame(leftBank).translate(0, yPos, pistonOffset)
rod.inFrame(leftBank).translate(0, yPos, rodOffset)
```

**Benefits:**
- Define coordinate system once, reuse everywhere
- Cleaner code, fewer bugs
- Natural for mechanical assemblies

---

### 2. Attach Points / Assembly Joints

**Problem:** Mechanical parts connect at specific points (wrist pin, crankpin, bearing). Currently requires manual position math.

**Current:**
```typescript
const wristZ = pistonZ - pistonHeight * 0.2 * Math.cos(halfAngleRad)
const wristX = pistonX - pistonHeight * 0.2 * Math.sin(halfAngleRad)
rod.translate(wristX, yPos, 0)
```

**Proposed:**
```typescript
// Define attachment points when building
const piston = buildPiston()
  .definePoint('wristPin', [0, 0, -pistonHeight * 0.2])
  .definePoint('crown', [0, 0, pistonHeight / 2])

const rod = buildRod()
  .definePoint('smallEnd', [0, 0, rodLength])
  .definePoint('bigEnd', [0, 0, 0])

// Attach by name
rod.attach('smallEnd').to(piston, 'wristPin')
```

**Benefits:**
- Self-documenting assemblies
- Automatic positioning
- Easier to modify (change attachment point, all connections update)

---

### 3. Mirror with Union

**Problem:** V-configurations and symmetric parts require building both sides or duplicating logic.

**Current:**
```typescript
const leftComponents = buildBankComponents(true)   // isLeftBank = true
const rightComponents = buildBankComponents(false) // Duplicated logic with sign flips
union(leftComponents, rightComponents)
```

**Proposed:**
```typescript
// Build one side, mirror-union creates both
buildBankComponents().mirrorUnion('yz')

// Or with offset
buildBankComponents().mirrorUnion('yz', { offset: valleyWidth })
```

**Benefits:**
- 50% less code for symmetric assemblies
- Guaranteed symmetry (no copy-paste errors)

---

## Medium Priority

### 4. Loft Between Profiles

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

### 5. Path Sweep

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

### 6. Polar/Cylindrical Positioning Helpers

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

### 7. Pattern with Transform Callback

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

### 8. 2D Profile Operations

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

### 9. Named Sub-assemblies

**Problem:** Complex builds have many intermediate shapes that are hard to track/debug.

**Proposed:**
```typescript
const piston = buildPiston().name('piston_cyl1')
const rod = buildRod().name('rod_cyl1')

// Later, for debugging:
engine.getByName('piston_cyl1').highlight()
```

---

### 10. Clearance/Interference Checking

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
| Coordinate Frames | ~40% | High | Any angled assembly |
| Attach Points | ~30% | High | Mechanical linkages |
| Mirror Union | ~25% | Medium | Symmetric parts |
| Loft | N/A | Medium | Transitions, rods |
| Polar Positioning | ~15% | Medium | Rotary assemblies |
| Pattern Callback | ~20% | Medium | Variable patterns |

---

## Implementation Notes

These could be added incrementally:
1. **Phase 1:** Polar positioning helpers (simple, high value)
2. **Phase 2:** Mirror union (medium complexity)
3. **Phase 3:** Coordinate frames (requires architecture thought)
4. **Phase 4:** Attach points (builds on frames)
5. **Phase 5:** Loft/sweep (depends on Manifold library support)
