# Test Coverage Design

## Goals

- **Refactoring confidence** - Safety net for restructuring code
- **Regression catching** - Ensure geometry changes don't break existing shapes
- **Documentation** - Tests as living documentation of expected behavior

Target: 100% test coverage

## Current State

- 52% statement coverage, 46% branch coverage
- UI components well-tested (70-80%)
- Generator definitions mostly untested (6-33%)
- Manifold builders completely untested (0%)
- meshToStl untested (0%)

## Approach: Hybrid Property + Snapshot Testing

### Property-Based Assertions
- Mesh is watertight (no holes)
- Volume within expected range
- Bounding box matches parameters

### Geometry Snapshots
- Compact fingerprint: vertex count + volume + bounding box
- Catches visual regressions without huge snapshot files
- Deterministic and diff-friendly

## Test Infrastructure

### Manifold Setup (`src/test/manifoldSetup.ts`)
Shared WASM initialization, loaded once per test file via `beforeAll`.

### Geometry Helpers (`src/test/geometryHelpers.ts`)
- `expectWatertight(mesh)` - verifies mesh has no holes
- `expectVolumeApprox(mesh, expected, tolerance)` - volume within range
- `expectBoundingBox(mesh, { min, max })` - dimensions match parameters
- `getGeometryFingerprint(mesh)` - compact snapshot format

## Test Structure

### Builder Tests (10 files)
Each builder test file includes:
1. Basic generation - default params produce valid geometry
2. Parameter variations - key params affect output correctly
3. Edge cases - min/max values, boundary conditions
4. Snapshot - geometry fingerprint for regression

Complexity tiers:
- Simple (~3 tests): spacerBuilder, washerBuilder
- Medium (~5 tests): boxBuilder, bracketBuilder, hookBuilder
- Complex (~8 tests): gearBuilder, thumbKnobBuilder, gridfinityBuilder, signBuilder, strokeFont

### Generator Definition Tests
Generic validation pattern for all generators:
- Default parameters are valid
- dynamicMin/dynamicMax constraints work
- generateGeometry delegates correctly

### Utility Tests
- `meshToStl.ts` - round-trip test (mesh -> STL -> parse)
- `useManifold.ts` - mock worker, test state transitions
- Component edge cases - error states, uncovered branches

## New Files

```
src/test/
  manifoldSetup.ts
  geometryHelpers.ts
src/generators/manifold/
  spacerBuilder.test.ts
  washerBuilder.test.ts
  boxBuilder.test.ts
  bracketBuilder.test.ts
  hookBuilder.test.ts
  gearBuilder.test.ts
  thumbKnobBuilder.test.ts
  gridfinityBuilder.test.ts
  signBuilder.test.ts
  strokeFont.test.ts
src/lib/
  meshToStl.test.ts
```

## Estimated Scope

- ~60-80 new tests
- 10 new builder test files
- 2 infrastructure files
- 1 utility test file
