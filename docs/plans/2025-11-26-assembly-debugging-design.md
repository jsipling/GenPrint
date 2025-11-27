# Assembly Debugging & Overlap API Design

Design for improving assembly debugging and adding a simpler overlap positioning API based on user feedback from V8 engine generator development.

## Problem Statement

### Current Pain Points

1. **Disconnect debugging is blind**: `assertConnected()` reports "genus: -4" but not which parts caused the disconnection. After `union()`, individual parts are consumed and unavailable for inspection.

2. **`connectTo` is confusing**: The API conflates positioning, alignment, and overlap into one operation. Users abandon it for manual positioning because:
   - `at` parameter semantics unclear (offset from center, not surface position)
   - Assumes shapes start at origin
   - Hard to predict final position without trial/error

### What Works Well

- `mirrorUnion` - Excellent for symmetric parts
- Basic primitives + chaining
- `assertConnected()` concept is sound, just needs better diagnostics

## Design

### 1. Enhanced Union + assertConnected

**Goal**: When `assertConnected()` fails, report which parts are disconnected by name.

**Approach**: `union()` clones parts before merging to preserve names for diagnostics.

```typescript
const parts = [
  block.name('block'),
  oilPan.name('oilPan'),
  collector.name('leftCollector'),  // <-- will be disconnected
  outlet.name('leftOutlet')         // <-- will be disconnected
]

const engine = union(...parts).assertConnected()
// Error: "Disconnected parts: leftCollector, leftOutlet (genus: -4)"
```

**Implementation Notes**:
- Clone each named part before union
- After union, check genus
- If disconnected, test each original part for overlap with merged body
- Report non-overlapping parts by name
- Performance: Cloning ~20-50 parts is negligible vs CSG union cost
- No opt-in required for typical generator scale

**Error Message Format**:
```
Shape has disconnected parts: partName1, partName2 (genus: -4)
```

### 2. New `overlapWith()` API

**Goal**: Separate positioning (user's job) from overlap adjustment (API's job).

**Mental Model**:
1. User positions part in world coordinates (derived from design features)
2. API shifts part minimally to achieve specified overlap

```typescript
// User positions part (world coords, their mental model)
const pipe = cylinder(30, 5)
  .rotate(0, 90, 0)
  .translate(-blockWidth/2 - 15, pipeY, exhaustZ)

// Declare overlap relationship (separate concern)
pipe.overlapWith(block, 2)        // Auto-detect direction
pipe.overlapWith(block, 2, '+x')  // Explicit direction when needed
```

**Direction Detection**:
- Default: Nearest-surface detection
- Find closest surface pair between shapes
- Shift along axis to close gap + achieve overlap
- Fail loudly on ambiguity:
  ```
  overlapWith: ambiguous direction (part equidistant from 'left' and 'bottom').
  Specify direction: .overlapWith(block, 2, '+x') or .overlapWith(block, 2, '+z')
  ```

**Semantics**:
- Returns new shifted Shape (chainable)
- Target is NOT consumed (read-only reference, like `.overlaps()`)
- Direction options: `'-x' | '+x' | '-y' | '+y' | '-z' | '+z'`

```typescript
// Chainable
const pipe = cylinder(30, 5)
  .translate(...)
  .overlapWith(block, 2)
  .name('exhaustPipe')

// Target remains usable
const part1 = foo.overlapWith(block, 2)
const part2 = bar.overlapWith(block, 2)  // block still valid
```

### 3. connectTo Disposition

- **Keep** existing `connectTo` API (don't break existing code)
- **Document** `overlapWith` as preferred approach for new code
- **Consider deprecation** later if `overlapWith` proves sufficient

### 4. debugOverlaps (Deferred)

Post-union diagnostics via enhanced `assertConnected` are sufficient.

`ctx.debugOverlaps(parts)` could be added later if users need pre-union overlap graph inspection for very complex assemblies.

## API Summary

### New Methods

```typescript
interface Shape {
  /**
   * Shift this shape to overlap with target by specified amount.
   * Auto-detects direction via nearest-surface analysis.
   * Target is not consumed.
   *
   * @param target - Shape to overlap with
   * @param amount - Overlap amount in mm
   * @param direction - Optional explicit direction (+x, -x, +y, -y, +z, -z)
   * @returns New shifted Shape
   * @throws If direction is ambiguous and not specified
   */
  overlapWith(
    target: Shape,
    amount: number,
    direction?: Direction
  ): Shape
}
```

### Enhanced Behavior

```typescript
// union() now tracks part names internally
const result = union(...parts)

// assertConnected() reports disconnected parts by name
result.assertConnected()
// Error: "Disconnected parts: partA, partB (genus: -4)"
```

## Implementation Phases

| Phase | Feature | Effort |
|-------|---------|--------|
| 1 | Enhanced assertConnected with part names | Medium |
| 2 | overlapWith with auto-direction | Medium |
| 3 | Document as preferred over connectTo | Low |

## Test Cases

### Enhanced assertConnected

1. All parts connected → passes silently
2. One part disconnected → error lists that part
3. Multiple disconnected → error lists all
4. Unnamed parts → error shows "unnamed" or index
5. Mixed named/unnamed → shows available names

### overlapWith

1. Clear direction (part outside face) → auto-detects correctly
2. Ambiguous position → throws actionable error
3. Explicit direction → uses specified direction
4. Already overlapping enough → no shift
5. Target not consumed → can reuse target
6. Chainable → returns Shape for further operations

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Clone parts in union | Default on | Negligible cost at typical scale |
| overlapWith direction | Nearest-surface | Matches "close this gap" mental model |
| Ambiguity handling | Fail loudly | Better than silent wrong choice |
| connectTo | Keep, don't deprecate yet | Backwards compatibility |
