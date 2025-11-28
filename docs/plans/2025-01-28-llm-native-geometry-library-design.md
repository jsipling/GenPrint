# LLM-Native 3D Geometry Library Design

## Problem Statement

LLMs struggle with 3D geometry libraries like Manifold due to:
1. **Geometric errors** — Non-manifold geometry, zero-thickness walls, non-intersecting subtractions
2. **Transform confusion** — Wrong order of rotate/translate, coordinate system mistakes
3. **Memory management** — Forgetting `.delete()` on intermediates, WASM lifecycle issues
4. **API misuse** — Wrong parameter order, mixing up width/depth/height

## Solution: Declarative Semantic Geometry

A TypeScript library that:
- Uses **semantic anchors** instead of coordinate math
- Builds a **lazy instruction graph** (no computation until `.render()`)
- Compiles to **Manifold** for actual CSG (proven, fast, guaranteed manifold)
- Provides **auto-validation** and **LLM-friendly error messages**

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  LLM / User Code                                    │
│  (Pure TypeScript, no WASM interaction)             │
├─────────────────────────────────────────────────────┤
│  Shape API                                          │
│  - Box, Cylinder, etc. with named parameters        │
│  - .align() with semantic anchors                   │
│  - .subtract(), .union(), .intersect()              │
├─────────────────────────────────────────────────────┤
│  Instruction Graph (JSON-serializable IR)           │
│  - GeoNode tree representing operations             │
│  - Validation layer (checks before execution)       │
├─────────────────────────────────────────────────────┤
│  Compiler                                           │
│  - Traverses graph, emits Manifold commands         │
│  - Single batch execution (one worker roundtrip)    │
├─────────────────────────────────────────────────────┤
│  Manifold WASM                                      │
│  - Executes CSG operations                          │
│  - Returns final mesh                               │
└─────────────────────────────────────────────────────┘
```

## API Design

### Primitives (Named Parameters Only)

```typescript
const box = shape.box({ width: 50, depth: 50, height: 10 });
const hole = shape.cylinder({ diameter: 5, height: 20 });
```

Never positional: `box(50, 50, 10)` is forbidden.

### Anchors (Point + Direction)

Every shape has automatic semantic anchors:

- **Faces**: `top`, `bottom`, `left`, `right`, `front`, `back`
- **Centers**: `center`, `centerTop`, `centerBottom`
- **Corners**: `corner('top-left-front')`

Anchors include both position AND normal direction:

```typescript
type Anchor = {
  position: [number, number, number];
  direction: [number, number, number]; // Normal vector
  name: string;
};
```

### Custom Anchors (Components)

```typescript
const piBoard = new Component({
  shape: boardShape,
  anchors: {
    usbPort: { position: [10, 0, 5], direction: [1, 0, 0] },
    mountingHole1: { position: [2, 2, 0], direction: [0, 0, 1] }
  }
});
```

### The `align()` Method

Replaces `translate()` + `rotate()` with semantic intent:

```typescript
screw.align({
  self: 'head-bottom',     // Anchor on this shape
  target: piBoard,         // Reference shape
  to: 'mountingHole1',     // Anchor on target
  mode: 'mate',            // DEFAULT: vectors oppose (face-to-face)
  offset: { z: -2 }        // Optional: sink 2mm
});
```

#### Alignment Modes

- **`mate`** (default): Vectors oppose (180°). Used for stacking, inserting, attaching.
- **`flush`**: Vectors align (parallel). Used for edge alignment, coplanar faces.

This terminology matches CAD systems (SolidWorks, Onshape) and exists in LLM training data.

### Boolean Operations

```typescript
const part = box.subtract(hole);
const assembly = base.union(bracket);
const overlap = partA.intersect(partB);
```

### Rendering

```typescript
const mesh = await part.render(); // Triggers compilation + Manifold execution
```

## Instruction Graph (IR)

JSON-serializable tree structure:

```typescript
type GeoNode =
  | { type: 'primitive', shape: 'box', width: number, depth: number, height: number }
  | { type: 'primitive', shape: 'cylinder', diameter: number, height: number }
  | { type: 'operation', op: 'union' | 'subtract' | 'intersect', children: GeoNode[] }
  | { type: 'transform', child: GeoNode, matrix: Matrix4x4 };
```

## Auto-Validation Layer

Before sending to Manifold, the compiler checks:

1. **Floating parts**: Union of non-intersecting shapes → warning
2. **Zero-thickness walls**: Subtraction leaving < 0.4mm wall → warning
3. **Non-intersecting subtraction**: Subtraction tool doesn't overlap target → warning (skip operation)

## Example: LLM-Generated Code

```typescript
import { shape, Boolean } from '@genprint/geo';

// 1. Declare shapes (stateless, no WASM)
const base = shape.box({ width: 50, depth: 50, height: 10 });
const hole = shape.cylinder({ diameter: 5, height: 20 });

// 2. Align (semantic, no coordinate math)
hole.align({
  self: 'center',
  target: base,
  to: 'center'
});

// 3. Boolean operation
const part = base.subtract(hole);

// 4. Render (single WASM roundtrip)
const mesh = await part.render();
```

## Project Structure

Monorepo approach (extract later):

```
src/
  geo/
    types.ts      # GeoNode, Anchor, Vector3, Matrix4x4
    math.ts       # Alignment math (mate vs flush transforms)
    Shape.ts      # Abstract base class
    primitives/
      Box.ts
      Cylinder.ts
    Compiler.ts   # GeoNode → Manifold execution
    index.ts      # Public API exports
```

## Implementation Phases

### Phase 1: Core Types & Math
- `types.ts`: GeoNode discriminated union, Anchor type
- `math.ts`: Matrix operations, `calculateAlignmentTransform()`

### Phase 2: Shape API
- `Shape.ts`: Abstract base with `.align()`, `.getNode()`, `.getAnchor()`
- `Box.ts`, `Cylinder.ts`: Concrete primitives with standard anchors

### Phase 3: Compiler
- `Compiler.ts`: Tree traversal, Manifold command generation
- Integration with existing worker infrastructure

### Phase 4: Validation Layer
- Pre-render checks for common LLM errors
- Warning system (non-blocking, informative)

### Phase 5: GenPrint Integration
- Migrate existing generators to new API
- Validate real-world usage patterns

## Success Criteria

1. LLM can generate valid geometry without coordinate math
2. Zero `.delete()` calls in user code
3. Single WASM roundtrip per render
4. All current GenPrint generators expressible in new API
