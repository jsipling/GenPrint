# Fluent Geometry API for AI-Assisted Generator Creation

## Goal

Enable end users to create generators by describing them to an AI, which generates TypeScript code using a fluent, chainable helper API instead of raw Manifold calls.

**Target usage:**
```typescript
const result = cylinder(10, 5)
  .subtract(hole(8, 5))
  .fillet(1)
  .translate(0, 0, 2)
```

## Architecture Overview

```
User Description → AI → TypeScript (Fluent API) → Validation → Worker → Manifold → Geometry
```

### Components to Build

1. **Fluent Shape API** (`src/generators/manifold/fluent/Shape.ts`)
2. **Primitive Helpers** (`src/generators/manifold/fluent/primitives.ts`)
3. **Operation Helpers** (`src/generators/manifold/fluent/operations.ts`)
4. **Validation Layer** (`src/generators/manifold/fluent/validator.ts`)
5. **AI Integration** (future: chat UI, prompt engineering)
6. **Dynamic Generator Loading** (user-created generators)

---

## Phase 1: Fluent Shape API

### Shape Class Design

```typescript
// src/generators/manifold/fluent/Shape.ts
import type { ManifoldToplevel, Manifold } from 'manifold-3d'

export class Shape {
  private manifold: Manifold
  private M: ManifoldToplevel

  constructor(M: ManifoldToplevel, manifold: Manifold) {
    this.M = M
    this.manifold = manifold
  }

  // CSG Operations (return new Shape, auto-cleanup old)
  add(other: Shape): Shape
  subtract(other: Shape): Shape
  intersect(other: Shape): Shape

  // Transforms (return new Shape)
  translate(x: number, y: number, z: number): Shape
  rotate(x: number, y: number, z: number): Shape
  scale(x: number, y?: number, z?: number): Shape
  mirror(axis: 'x' | 'y' | 'z'): Shape

  // Modifications
  fillet(radius: number, edges?: number[]): Shape  // If Manifold supports
  chamfer(distance: number): Shape
  shell(thickness: number): Shape

  // Patterns
  linearPattern(count: number, spacing: number, axis: 'x' | 'y' | 'z'): Shape
  circularPattern(count: number, radius: number, axis: 'x' | 'y' | 'z'): Shape

  // Utilities
  clone(): Shape
  getBoundingBox(): BoundingBox
  getVolume(): number

  // Internal: Get raw Manifold (for final build output)
  _getManifold(): Manifold
  _cleanup(): void  // Free WASM memory
}
```

### Memory Management Strategy

The fluent API must handle Manifold's manual memory management automatically:

```typescript
add(other: Shape): Shape {
  const result = this.manifold.add(other.manifold)
  // Clean up inputs after CSG (they're consumed)
  this.manifold.delete()
  other.manifold.delete()
  return new Shape(this.M, result)
}
```

**Key insight:** Each operation returns a NEW Shape and cleans up the inputs. The final Shape is returned and cleaned up by the worker after mesh extraction.

---

## Phase 2: Primitive Helpers

### Primitives Module

```typescript
// src/generators/manifold/fluent/primitives.ts

// Factory function that creates primitive helpers bound to a Manifold instance
export function createPrimitives(M: ManifoldToplevel) {
  return {
    // Basic shapes
    box(width: number, depth: number, height: number, centered?: boolean): Shape,
    cylinder(height: number, radius: number, segments?: number): Shape,
    sphere(radius: number, segments?: number): Shape,
    cone(height: number, bottomRadius: number, topRadius: number): Shape,

    // Printing-optimized shapes
    roundedBox(width: number, depth: number, height: number, radius: number): Shape,
    tube(height: number, outerRadius: number, innerRadius: number): Shape,

    // Holes (convenience - just cylinders with extra height for clean subtraction)
    hole(diameter: number, depth: number): Shape,
    counterboredHole(diameter: number, depth: number, headDiameter: number, headDepth: number): Shape,
    countersunkHole(diameter: number, depth: number, headDiameter: number): Shape,

    // 2D to 3D
    extrude(profile: [number, number][], height: number): Shape,
    revolve(profile: [number, number][], angle?: number): Shape,
  }
}
```

### Usage Example

```typescript
function buildCableClip(M: ManifoldToplevel, params: Params): Manifold {
  const { box, cylinder, hole } = createPrimitives(M)

  const base = box(30, 20, 5)
  const clip = cylinder(10, 6).translate(15, 10, 5)
  const cableChannel = cylinder(12, 5).translate(15, 10, 5)
  const mountHole1 = hole(4, 10).translate(5, 10, 0)
  const mountHole2 = hole(4, 10).translate(25, 10, 0)

  return base
    .add(clip)
    .subtract(cableChannel)
    .subtract(mountHole1)
    .subtract(mountHole2)
    ._getManifold()
}
```

---

## Phase 3: Printing-Aware Helpers

### Operations Module

```typescript
// src/generators/manifold/fluent/operations.ts

export function createOperations(M: ManifoldToplevel) {
  return {
    // Combine multiple shapes efficiently
    union(...shapes: Shape[]): Shape,
    difference(base: Shape, ...tools: Shape[]): Shape,
    intersection(...shapes: Shape[]): Shape,

    // Patterns
    linearArray(shape: Shape, count: number, spacing: [number, number, number]): Shape,
    polarArray(shape: Shape, count: number, axis: 'x' | 'y' | 'z', radius?: number): Shape,
    gridArray(shape: Shape, countX: number, countY: number, spacingX: number, spacingY: number): Shape,

    // Printing helpers
    addFillet(shape: Shape, edges: 'bottom' | 'top' | 'all', radius: number): Shape,
    addChamfer(shape: Shape, edges: 'bottom' | 'top' | 'all', distance: number): Shape,
    makeShell(shape: Shape, thickness: number): Shape,

    // Constraints (clamp to printing limits)
    ensureMinWall(thickness: number): number,  // Returns max(thickness, 1.2)
    ensureMinFeature(size: number): number,     // Returns max(size, 1.5)
  }
}
```

---

## Phase 4: Builder Context

### Builder Context Class

Wraps primitives + operations into a single context for AI-generated code:

```typescript
// src/generators/manifold/fluent/BuilderContext.ts

export class BuilderContext {
  private M: ManifoldToplevel
  readonly primitives: ReturnType<typeof createPrimitives>
  readonly ops: ReturnType<typeof createOperations>
  readonly constants: typeof printingConstants

  constructor(M: ManifoldToplevel) {
    this.M = M
    this.primitives = createPrimitives(M)
    this.ops = createOperations(M)
    this.constants = printingConstants
  }

  // Convenience re-exports for cleaner generated code
  box = (...args) => this.primitives.box(...args)
  cylinder = (...args) => this.primitives.cylinder(...args)
  hole = (...args) => this.primitives.hole(...args)
  // ... etc
}
```

### AI-Generated Builder Template

```typescript
// What AI generates:
export function buildUserGenerator(ctx: BuilderContext, params: Record<string, any>): Manifold {
  const { box, cylinder, hole } = ctx
  const { ensureMinWall } = ctx.ops

  const width = Number(params.width) || 50
  const wall = ensureMinWall(Number(params.wall_thickness) || 2)

  // ... geometry code ...

  return result._getManifold()
}
```

---

## Phase 5: Validation Layer

### Static Analysis (Optional, Future)

For security, we could parse generated code and validate:
- Only uses approved Shape methods
- No file system access
- No network access
- No eval/Function constructor

```typescript
// src/generators/manifold/fluent/validator.ts

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateBuilderCode(code: string): ValidationResult {
  // Parse with TypeScript compiler API or acorn
  // Walk AST and check for:
  // - Only approved identifiers (Shape methods, primitives, etc.)
  // - No dangerous patterns (eval, Function, import, require, fetch)
  // - Parameter access patterns
}
```

### Runtime Sandbox (Simpler Approach)

Run generated code in a restricted context:

```typescript
// In worker, execute generated builder
function executeUserBuilder(
  code: string,
  M: ManifoldToplevel,
  params: Record<string, any>
): Manifold {
  const ctx = new BuilderContext(M)

  // Create a sandboxed function
  // Only expose ctx, params - no globals
  const fn = new Function('ctx', 'params', code)

  return fn(ctx, params)
}
```

---

## Phase 6: Dynamic Generator Registration

### User Generator Storage

```typescript
// src/generators/userGenerators.ts

interface UserGeneratorDef {
  id: string
  name: string
  description: string
  parameters: ParameterDef[]
  builderCode: string  // The generated TypeScript
  createdAt: Date
  source: 'ai' | 'manual'
}

// Stored in localStorage or IndexedDB
export const userGeneratorStore = {
  save(gen: UserGeneratorDef): void,
  load(id: string): UserGeneratorDef | null,
  list(): UserGeneratorDef[],
  delete(id: string): void,
}
```

### Worker Integration

Update worker to handle dynamic generators:

```typescript
// In manifold.worker.ts

onmessage = async (event) => {
  if (data.type === 'build-user-generator') {
    const { id, builderCode, params } = data

    const ctx = new BuilderContext(manifoldModule)
    const fn = new Function('ctx', 'params', `
      const { box, cylinder, hole, union } = ctx
      const { ensureMinWall } = ctx.ops
      ${builderCode}
    `)

    const manifold = fn(ctx, params)
    // ... convert to mesh and return
  }
}
```

---

## Phase 7: AI Integration (Future)

### System Prompt for AI

```markdown
You are a 3D geometry generator for GenPrint. Generate TypeScript code using the fluent Shape API.

Available primitives:
- box(width, depth, height, centered?)
- cylinder(height, radius, segments?)
- hole(diameter, depth) - for subtraction
- roundedBox(width, depth, height, cornerRadius)
- tube(height, outerRadius, innerRadius)

Available operations:
- shape.add(other) - union
- shape.subtract(other) - difference
- shape.translate(x, y, z)
- shape.rotate(x, y, z) - degrees
- union(...shapes), difference(base, ...tools)

Printing constraints:
- Minimum wall: 1.2mm
- Minimum feature: 1.5mm
- Holes: use hole() helper for clean subtraction

Output format:
Return only the body of a builder function. Parameters are available in `params`.

Example:
```typescript
const width = Number(params.width) || 50
const base = box(width, 30, 5)
const mountHole = hole(4, 10)
return base.subtract(mountHole.translate(width/2, 15, 0))._getManifold()
```
```

### Chat UI Flow

1. User describes generator in natural language
2. AI generates builder code + parameter definitions
3. Code is validated (syntax, safety)
4. Live preview renders the geometry
5. User iterates ("make it wider", "add more holes")
6. User saves to their generator library

---

## Implementation Order

### Milestone 1: Core Fluent API
1. [ ] `Shape` class with CSG operations
2. [ ] Memory management (auto-cleanup)
3. [ ] Transform methods (translate, rotate, scale)
4. [ ] Unit tests for Shape class

### Milestone 2: Primitives
1. [ ] Basic primitives (box, cylinder, sphere)
2. [ ] Printing-optimized primitives (roundedBox, tube)
3. [ ] Hole helpers (hole, counterbored, countersunk)
4. [ ] Unit tests for primitives

### Milestone 3: Operations & Patterns
1. [ ] Union/difference/intersection helpers
2. [ ] Linear and polar arrays
3. [ ] Printing constraint helpers
4. [ ] Unit tests

### Milestone 4: Builder Context
1. [ ] `BuilderContext` class
2. [ ] Integration with worker
3. [ ] Test with manually-written fluent builders
4. [ ] Convert one existing builder (e.g., bracket) to fluent API as proof

### Milestone 5: Dynamic Generators
1. [ ] User generator storage (localStorage/IndexedDB)
2. [ ] Worker support for dynamic code execution
3. [ ] UI for listing/selecting user generators
4. [ ] Basic code editor for manual creation

### Milestone 6: AI Integration
1. [ ] System prompt design
2. [ ] Chat UI component
3. [ ] AI API integration (Claude/OpenAI)
4. [ ] Iteration flow (refine based on feedback)
5. [ ] Parameter extraction from AI response

### Milestone 7: Validation & Safety
1. [ ] Static code analysis (optional)
2. [ ] Runtime sandbox hardening
3. [ ] Error handling and user feedback
4. [ ] Geometry validation (manifold check)

---

## Open Questions

1. **Fillet/chamfer support:** Manifold-3d may not have built-in fillet. Options:
   - Skip fillet in fluent API
   - Implement as manual geometry construction
   - Wait for upstream Manifold support

2. **Parameter inference:** Should AI also generate ParameterDef[] from the description?
   - Pro: Complete generator in one shot
   - Con: More complex prompting, more error-prone

3. **Code editing vs. regeneration:** When user says "make it wider":
   - Regenerate entire builder from scratch?
   - AI edits existing code?
   - Probably regenerate - simpler and more reliable

4. **Storage location:** localStorage vs IndexedDB vs file system (via File System Access API)
   - localStorage: Simple, 5MB limit
   - IndexedDB: More complex, larger storage
   - File System: User owns files, but requires permissions

5. **Sharing generators:** Export/import of user generators?
   - JSON file download/upload
   - URL sharing (encode in URL?)
   - Future: community library

---

## File Structure

```
src/generators/manifold/fluent/
├── Shape.ts              # Core Shape class
├── primitives.ts         # box, cylinder, hole, etc.
├── operations.ts         # union, patterns, etc.
├── BuilderContext.ts     # Combined context for builders
├── validator.ts          # Code validation
├── index.ts              # Public exports
└── __tests__/
    ├── Shape.test.ts
    ├── primitives.test.ts
    └── operations.test.ts

src/generators/
├── userGenerators.ts     # Storage for user-created generators
└── userGeneratorTypes.ts # TypeScript types

src/workers/
└── manifold.worker.ts    # Updated for dynamic execution

src/components/
└── AIGeneratorChat/      # Future: Chat UI for AI generation
    ├── AIGeneratorChat.tsx
    └── useAIGenerator.ts
```
