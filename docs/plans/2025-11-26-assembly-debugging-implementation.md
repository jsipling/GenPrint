# Implementation Plan: Assembly Debugging & overlapWith API

Based on the design document, this plan covers Phase 1 (Enhanced assertConnected) and Phase 2 (overlapWith API).

## Phase 1: Enhanced assertConnected with Part Names

**Goal**: When `assertConnected()` fails after `union()`, report which parts are disconnected by name.

### Phase 1.1: Modify union() to Track Part Names

**Tests to Write FIRST** (in `src/generators/manifold/fluent/__tests__/operations.test.ts`):

```typescript
describe('union() part tracking', () => {
  it('union() returns Shape that tracks input part names', () => {
    const part1 = p.box(10, 10, 10).name('partA')
    const part2 = p.box(10, 10, 10).translate(5, 0, 0).name('partB')
    const result = ops.union(part1, part2)

    expect(result.getTrackedParts()).toContain('partA')
    expect(result.getTrackedParts()).toContain('partB')
    result.delete()
  })

  it('union() preserves unnamed parts as indexed entries', () => {
    const part1 = p.box(10, 10, 10).name('namedPart')
    const part2 = p.box(10, 10, 10).translate(5, 0, 0) // unnamed
    const result = ops.union(part1, part2)

    const tracked = result.getTrackedParts()
    expect(tracked).toContain('namedPart')
    expect(tracked.some(name => name.startsWith('<part '))).toBe(true)
    result.delete()
  })

  it('union() clones parts before merging for later diagnostics', () => {
    const part1 = p.box(10, 10, 10).name('partA')
    const part2 = p.box(10, 10, 10).translate(5, 0, 0).name('partB')
    const result = ops.union(part1, part2)

    const clones = result.getTrackedPartClones()
    expect(clones.size).toBe(2)
    result.delete()
  })
})
```

**Implementation Changes**:

1. **File**: `src/generators/manifold/fluent/Shape.ts`
   - Add private field: `private trackedParts: Map<string, Shape> = new Map()`
   - Add method: `getTrackedParts(): string[]` - returns names of tracked parts
   - Add method: `getTrackedPartClones(): Map<string, Shape>` - returns cloned parts for diagnostics
   - Modify constructor to accept optional trackedParts parameter

2. **File**: `src/generators/manifold/fluent/operations.ts`
   - Modify `union()` function:
     - Before merging, clone each named input part
     - Track part names and their clones in a Map
     - Pass the Map to the resulting Shape constructor
     - Handle unnamed parts with placeholder names like `<part 0>`, `<part 1>`

### Phase 1.2: Enhance assertConnected() to Report Disconnected Parts

**Tests to Write FIRST** (in `src/generators/manifold/fluent/__tests__/Shape.test.ts`):

```typescript
describe('assertConnected with part diagnostics', () => {
  it('assertConnected() passes silently when all parts connected', () => {
    const part1 = p.box(10, 10, 10).name('partA')
    const part2 = p.box(10, 10, 10).translate(5, 0, 0).name('partB')
    const result = ops.union(part1, part2)

    expect(() => result.assertConnected()).not.toThrow()
    result.delete()
  })

  it('assertConnected() lists single disconnected part by name', () => {
    const connected = p.box(10, 10, 10).name('connected')
    const disconnected = p.box(10, 10, 10).translate(50, 0, 0).name('disconnected')
    const result = ops.union(connected, disconnected)

    expect(() => result.assertConnected()).toThrow(/disconnected/i)
    result.delete()
  })

  it('assertConnected() lists multiple disconnected parts', () => {
    const main = p.box(10, 10, 10).name('main')
    const disc1 = p.box(5, 5, 5).translate(50, 0, 0).name('floating1')
    const disc2 = p.box(5, 5, 5).translate(-50, 0, 0).name('floating2')
    const result = ops.union(main, disc1, disc2)

    try {
      result.assertConnected()
      fail('Should have thrown')
    } catch (e) {
      expect(e.message).toContain('floating1')
      expect(e.message).toContain('floating2')
      expect(e.message).not.toContain('main')
    }
    result.delete()
  })

  it('assertConnected() shows placeholder for parts without names', () => {
    const named = p.box(10, 10, 10).name('namedPart')
    const unnamed = p.box(5, 5, 5).translate(50, 0, 0) // no name
    const result = ops.union(named, unnamed)

    expect(() => result.assertConnected()).toThrow(/<part \d+>/)
    result.delete()
  })

  it('assertConnected() error message includes genus', () => {
    const main = p.box(10, 10, 10).name('main')
    const disc = p.box(5, 5, 5).translate(50, 0, 0).name('floating')
    const result = ops.union(main, disc)

    expect(() => result.assertConnected()).toThrow(/genus: -\d+/)
    result.delete()
  })
})
```

**Implementation Changes**:

1. **File**: `src/generators/manifold/fluent/Shape.ts`
   - Modify `assertConnected()` method:
     - If genus < 0 and tracked parts exist:
       - For each tracked part clone, check if it overlaps with the merged body
       - Parts that don't overlap are considered disconnected
       - Collect disconnected part names
       - Throw error with format: `"Disconnected parts: partA, partB (genus: -4)"`
     - If no tracked parts, use current behavior (just report genus)
   - Add private helper: `findDisconnectedFromTracked(): string[]`

---

## Phase 2: overlapWith API

**Goal**: Provide a simpler API that separates positioning (user's job) from overlap adjustment (API's job).

### Phase 2.1: Core overlapWith with Explicit Direction

**Tests to Write FIRST** (in `src/generators/manifold/fluent/__tests__/Shape.test.ts`):

```typescript
describe('overlapWith', () => {
  describe('explicit direction', () => {
    it('overlapWith shifts shape to achieve overlap in +x direction', () => {
      const target = p.box(20, 20, 20) // centered at origin
      const part = p.box(10, 10, 10).translate(20, 0, 0) // outside right face

      const result = part.overlapWith(target, 2, '+x')

      // Target right face at x=10, part left face should be at x=10-2=8
      const bbox = result.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(8, 1)

      target.delete()
      result.delete()
    })

    it('overlapWith shifts shape to achieve overlap in -x direction', () => {
      const target = p.box(20, 20, 20)
      const part = p.box(10, 10, 10).translate(-20, 0, 0) // outside left face

      const result = part.overlapWith(target, 2, '-x')

      // Target left face at x=-10, part right face should be at x=-10+2=-8
      const bbox = result.getBoundingBox()
      expect(bbox.max[0]).toBeCloseTo(-8, 1)

      target.delete()
      result.delete()
    })

    it('overlapWith does not consume target', () => {
      const target = p.box(20, 20, 20)
      const part = p.box(10, 10, 10).translate(20, 0, 0)

      part.overlapWith(target, 2, '+x')

      // Target should still be usable
      expect(target.getVolume()).toBeCloseTo(8000, 0)
      target.delete()
    })

    it('overlapWith returns chainable Shape', () => {
      const target = p.box(20, 20, 20)
      const part = p.box(10, 10, 10).translate(20, 0, 0)

      const result = part
        .overlapWith(target, 2, '+x')
        .name('overlappedPart')
        .translate(0, 5, 0)

      expect(result.getName()).toBe('overlappedPart')
      target.delete()
      result.delete()
    })

    it('overlapWith preserves existing shape name', () => {
      const target = p.box(20, 20, 20)
      const part = p.box(10, 10, 10).translate(20, 0, 0).name('myPart')

      const result = part.overlapWith(target, 2, '+x')

      expect(result.getName()).toBe('myPart')
      target.delete()
      result.delete()
    })

    it('overlapWith no shift when already overlapping enough', () => {
      const target = p.box(20, 20, 20)
      const part = p.box(10, 10, 10).translate(8, 0, 0) // already overlaps by 2mm

      const originalBbox = part.clone().getBoundingBox()
      const result = part.overlapWith(target, 2, '+x')

      const bbox = result.getBoundingBox()
      expect(bbox.min[0]).toBeCloseTo(originalBbox.min[0], 1)

      target.delete()
      result.delete()
    })
  })
})
```

**Implementation Changes**:

1. **File**: `src/generators/manifold/fluent/Shape.ts`
   - Add new method: `overlapWith(target: Shape, amount: number, direction?: Direction): Shape`
   - Implementation with explicit direction:
     - Get bounding boxes of both shapes
     - Calculate gap between shapes along specified axis
     - Shift this shape to close gap and achieve specified overlap
     - Return new translated Shape (preserve name, attachment points)

### Phase 2.2: Auto-Direction Detection

**Tests to Write FIRST**:

```typescript
describe('overlapWith auto-direction', () => {
  it('auto-detects +x direction when part is to the right of target', () => {
    const target = p.box(20, 20, 20)
    const part = p.box(10, 10, 10).translate(20, 0, 0) // clearly to the right

    const result = part.overlapWith(target, 2) // no direction specified

    const bbox = result.getBoundingBox()
    expect(bbox.min[0]).toBeCloseTo(8, 1)

    target.delete()
    result.delete()
  })

  it('auto-detects -z direction when part is below target', () => {
    const target = p.box(20, 20, 20)
    const part = p.box(10, 10, 10).translate(0, 0, -20) // clearly below

    const result = part.overlapWith(target, 2)

    const bbox = result.getBoundingBox()
    expect(bbox.max[2]).toBeCloseTo(-8, 1)

    target.delete()
    result.delete()
  })

  it('throws on ambiguous position (equidistant faces)', () => {
    const target = p.box(20, 20, 20)
    // Part positioned at corner - equidistant from right and front faces
    const part = p.box(10, 10, 10).translate(15, 15, 0)

    expect(() => part.overlapWith(target, 2)).toThrow(/ambiguous direction/i)

    target.delete()
    part.delete()
  })

  it('ambiguous error suggests explicit directions', () => {
    const target = p.box(20, 20, 20)
    const part = p.box(10, 10, 10).translate(15, 15, 0)

    try {
      part.overlapWith(target, 2)
      fail('Should have thrown')
    } catch (e) {
      expect(e.message).toMatch(/\+x|\-x|\+y|\-y|\+z|\-z/)
    }

    target.delete()
    part.delete()
  })

  it('explicit direction overrides auto-detection', () => {
    const target = p.box(20, 20, 20)
    // Part clearly to the right, but we force -y
    const part = p.box(10, 10, 10).translate(20, -20, 0)

    const result = part.overlapWith(target, 2, '-y')

    const bbox = result.getBoundingBox()
    expect(bbox.max[1]).toBeCloseTo(-8, 1)

    target.delete()
    result.delete()
  })
})
```

**Implementation Changes**:

1. **File**: `src/generators/manifold/fluent/Shape.ts`
   - Add private helper: `detectOverlapDirection(target: Shape): Direction`
     - Calculate distance from this shape to each face of target
     - Find closest face
     - Check for ambiguity (multiple faces at similar distance)
     - Return direction or throw actionable error
   - Update `overlapWith()` to call `detectOverlapDirection()` when direction not specified

---

## Files to Modify Summary

**Phase 1**:
1. `src/generators/manifold/fluent/Shape.ts` - Add trackedParts, enhance assertConnected
2. `src/generators/manifold/fluent/operations.ts` - Modify union() to track parts
3. `src/generators/manifold/fluent/__tests__/operations.test.ts` - Tests for union tracking
4. `src/generators/manifold/fluent/__tests__/Shape.test.ts` - Tests for assertConnected

**Phase 2**:
1. `src/generators/manifold/fluent/Shape.ts` - Add overlapWith method
2. `src/generators/manifold/fluent/__tests__/Shape.test.ts` - Tests for overlapWith

**Documentation**:
1. `docs/fluent-api.md` - Document overlapWith, update assertConnected docs

---

## Backwards Compatibility

- `union()`: Same signature, tracking is internal
- `assertConnected()`: Same signature, enhanced error messages are additive
- `overlapWith()`: New method, no breaking changes
- `connectTo()`: Kept unchanged

---

## Implementation Order

1. Phase 1.1: Modify union() to track parts (tests first)
2. Phase 1.2: Enhance assertConnected() (tests first)
3. Phase 2.1: Add overlapWith with explicit direction (tests first)
4. Phase 2.2: Add auto-direction detection (tests first)
5. Update documentation

Each phase committed separately after tests pass.
