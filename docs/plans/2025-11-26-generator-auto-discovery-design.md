# Generator Auto-Discovery Design

## Problem

Adding a new generator requires editing 4 files:
1. `src/generators/<name>.ts` — generator definition
2. `src/generators/manifold/<name>Builder.ts` — geometry code
3. `src/generators/index.ts` — manual import + array entry
4. `src/workers/manifold.worker.ts` — manual import + registry entry

Files 3 and 4 are pure boilerplate wiring.

## Solution

Single-file generators with auto-discovery. Drop in one `*.generator.ts` file and it works.

## Design

### Generator File Format

Each generator is a single `*.generator.ts` file with a default export:

```typescript
// src/generators/cableClip.generator.ts
import type { Generator } from './types'

export default {
  id: 'cable_clip',
  name: 'Cable Clip',
  description: 'A C-shaped clip for organizing cables',

  parameters: [
    { type: 'number', name: 'cable_diameter', label: 'Cable Diameter',
      min: 2, max: 25, default: 6, step: 0.5, unit: 'mm' },
    // ... more parameters
  ],

  displayDimensions: [
    { label: 'Cable', param: 'cable_diameter', format: '⌀{value}mm' }
  ],

  builderCode: `
    const cableDiameter = Number(params['cable_diameter']) || 6
    const mainTube = tube(10, cableDiameter / 2 + 2, cableDiameter / 2)
    // ... fluent API geometry code ...
    return clip
  `
} satisfies Generator
```

Key points:
- Default export for clean auto-discovery
- `builderCode` is a string using fluent API (has access to destructured `ctx` methods and `params`)
- `satisfies Generator` provides type checking

### Auto-Discovery

**`src/generators/index.ts`:**

```typescript
import type { Generator } from './types'

// Vite auto-discovers all *.generator.ts files
const modules = import.meta.glob('./*.generator.ts', { eager: true })

export const generators: Generator[] = Object.values(modules)
  .map((m: any) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name))

export * from './types'
```

**`src/workers/manifold.worker.ts`:**

- Remove all hardcoded builder imports
- Remove the `generatorRegistry` Map
- Use `executeUserBuilder` for ALL generators
- Receive `builderCode` in message instead of looking up by ID

### Type Changes

Update `Generator` type in `types.ts`:

```typescript
export interface Generator {
  id: string
  name: string
  description: string
  parameters: ParameterDef[]
  displayDimensions?: DisplayDimension[]
  builderCode: string  // replaces builderId and type:'manifold'
}
```

Remove:
- `type: 'manifold'` distinction
- `builderId` field

### Worker Message Flow

**Current:**
```
UI → useManifold(generatorId, params) → worker receives generatorId
                                      → looks up builder by ID
                                      → runs builder function
```

**New:**
```
UI → useManifold(generator, params) → worker receives builderCode
                                    → runs executeUserBuilder(builderCode, params)
```

Changes:
- `useManifold` accepts full `Generator` object
- Passes `generator.builderCode` to worker
- Merge `BuildRequest` and `BuildUserGeneratorRequest` into one type

## Migration

### Files to Delete
- `src/generators/manifold/*Builder.ts` (9 files)

### Files to Keep
- `src/generators/manifold/fluent/` — fluent API
- `src/generators/manifold/printingConstants.ts` — shared constants

### Migration Steps
1. Update `Generator` type
2. Update worker to use `builderCode` for all builds
3. Update `useManifold` hook
4. Update `index.ts` with glob import
5. Convert each generator one at a time:
   - Create `<name>.generator.ts` with merged content
   - Delete old `<name>.ts` and `<name>Builder.ts`
6. Delete empty `manifold/` builder files

## Result

To add a new generator:
1. Create `src/generators/myThing.generator.ts`
2. Done.
