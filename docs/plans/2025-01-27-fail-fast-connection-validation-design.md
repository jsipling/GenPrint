# Fail-Fast Connection Validation (Historical Document - Fluent API Removed)

**Note:** This document describes a historical design for the fluent API, which has been removed from GenPrint. Generators now use direct Manifold operations.

## Problem

Currently, components can be added to an assembly without being connected to any existing component. Disconnected geometry is only detected at `.build()` time via `assertConnected()`, making debugging difficult for AI-generated code.

## Solution

Add fail-fast validation to `.add()` and `union()` that checks connectivity at call time rather than build time.

## Design

### Core Behavior Change

When `.add(other)` is called:

1. Check if `this` and `other` share volume (overlap) or touch (bounding boxes adjacent within tolerance)
2. If connected: proceed with union
3. If disconnected: throw immediately with actionable error message

```typescript
// Current: silently creates disconnected geometry
block.add(floatingPart)  // No error until .build()

// New: validates at call time
block.add(floatingPart)  // Throws immediately if no overlap
```

### Error Message

```
Error: Shape does not connect to assembly.
  - No overlap or contact detected
  - Use .overlapWith(target, amount) to position with overlap
  - Use .connectTo(target, options) for precise positioning
  - Or use .add(shape, { skipConnectionCheck: true }) for intentional gaps
```

### Escape Hatch

For intentionally disconnected geometry (patterns, exploded views):

```typescript
block.add(floatingPart, { skipConnectionCheck: true })
```

## Connection Methods

Existing methods for positioning shapes to connect:

### `.overlapWith(target, amount, direction?)`

Adjusts position to achieve specified overlap:

```typescript
const exhaustPipe = cylinder(30, 5)
  .translate(40, 0, 0)
  .overlapWith(block, 2, '+x')

block.add(exhaustPipe)  // Passes validation
```

### `.connectTo(target, options)`

More control over connection point:

```typescript
const boss = cylinder(10, 5)
  .connectTo(block, {
    overlap: 2,
    direction: '+z',
    at: [10, 20, 0]
  })

block.add(boss)  // Passes validation
```

## Impact on `union()`

All shapes in a union must form one connected assembly:

```typescript
// Throws: "union() contains disconnected parts. Part at index 2
//          does not connect to any other part."
union(partA, partB, floatingPartC)
```

Algorithm:
1. Build connectivity graph (which shapes overlap/touch which)
2. Check graph is fully connected (all shapes reachable from first)
3. If not, identify and report disconnected parts

### Operations That Skip Validation

- `linearPattern()` / `circularPattern()` - pattern copies may not touch
- `gridArray()` / `polarArray()` - same
- `difference()` / `subtract()` - removing material, not adding

## Implementation

### Files to Modify

1. **`src/generators/manifold/fluent/Shape.ts`** - Add validation to `.add()`
2. **`src/generators/manifold/fluent/operations.ts`** - Add validation to `union()`, `unionAll()`
3. **`docs/fluent-api.md`** - Document new behavior

### Shape.ts Changes

```typescript
add(other: Shape, options?: { skipConnectionCheck?: boolean }): Shape {
  this.ensureNotConsumed('add()')
  other.ensureNotConsumed('add()')

  if (!options?.skipConnectionCheck) {
    if (!this.touches(other) && !this.overlaps(other)) {
      throw new Error(
        'Shape does not connect to assembly.\n' +
        '  - No overlap or contact detected\n' +
        '  - Use .overlapWith(target, amount) to position with overlap\n' +
        '  - Use .connectTo(target, options) for precise positioning\n' +
        '  - Or use .add(shape, { skipConnectionCheck: true }) for intentional gaps'
      )
    }
  }

  // Existing union logic...
}
```

### operations.ts Changes

```typescript
function validateConnectivity(shapes: Shape[]): void {
  if (shapes.length <= 1) return

  // Build adjacency list
  const connected: boolean[][] = shapes.map(() => shapes.map(() => false))
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      if (shapes[i].touches(shapes[j]) || shapes[i].overlaps(shapes[j])) {
        connected[i][j] = true
        connected[j][i] = true
      }
    }
  }

  // BFS from first shape
  const visited = new Set<number>([0])
  const queue = [0]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (let i = 0; i < shapes.length; i++) {
      if (connected[current][i] && !visited.has(i)) {
        visited.add(i)
        queue.push(i)
      }
    }
  }

  // Find disconnected
  const disconnected = shapes
    .map((_, i) => i)
    .filter(i => !visited.has(i))

  if (disconnected.length > 0) {
    throw new Error(
      `union() contains disconnected parts. ` +
      `Part(s) at index ${disconnected.join(', ')} do not connect to the assembly.`
    )
  }
}
```

## Backwards Compatibility

Existing generators that position shapes correctly before `.add()` will continue to work. Tests that intentionally create disconnected geometry need the escape hatch.

## Performance

- `.touches()`: O(1) bounding box comparison
- `.overlaps()`: Single CSG intersection operation
- Acceptable overhead for one check per `.add()` call
