# 100% Test Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve 100% test coverage for GenPrint codebase with meaningful tests that catch regressions and document behavior.

**Architecture:** Hybrid property + snapshot testing for geometry builders, unit tests for utilities, integration tests for hooks/components. All builder tests use real manifold WASM.

**Tech Stack:** Vitest, @testing-library/react, manifold-3d WASM, jsdom

---

## Task 1: Complete Test Infrastructure

**Files:**
- Modify: `src/test/geometryHelpers.ts`
- Delete: `src/test/explore-api.test.ts` (cleanup exploration file)

**Step 1: Clean up exploration test file**

```bash
rm src/test/explore-api.test.ts
```

**Step 2: Run all tests to verify infrastructure**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Commit infrastructure**

```bash
git add src/test/ src/generators/manifold/spacerBuilder.test.ts
git commit -m "test: add manifold test infrastructure and spacer tests"
```

---

## Task 2: Washer Builder Tests

**Files:**
- Create: `src/generators/manifold/washerBuilder.test.ts`

**Step 1: Write washer test file**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildWasher } from './washerBuilder'

describe('washerBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  it('generates valid geometry with default params', () => {
    const params = { outer_diameter: 12, inner_diameter: 6, thickness: 1.5 }
    const washer = buildWasher(M, params)
    expectValid(washer)
    washer.delete()
  })

  it('respects outer diameter dimension', () => {
    const params = { outer_diameter: 20, inner_diameter: 6, thickness: 1.5 }
    const washer = buildWasher(M, params)
    expectDimensions(washer, { width: 20, depth: 20 })
    washer.delete()
  })

  it('respects thickness dimension', () => {
    const params = { outer_diameter: 12, inner_diameter: 6, thickness: 3 }
    const washer = buildWasher(M, params)
    expectDimensions(washer, { height: 3 })
    washer.delete()
  })

  it('clamps inner diameter to maintain wall thickness', () => {
    const params = { outer_diameter: 12, inner_diameter: 11, thickness: 1.5 }
    const washer = buildWasher(M, params)
    expectValid(washer)
    expect(washer.volume()).toBeGreaterThan(0)
    washer.delete()
  })

  it('matches geometry snapshot', () => {
    const params = { outer_diameter: 12, inner_diameter: 6, thickness: 1.5 }
    const washer = buildWasher(M, params)
    expect(getGeometryFingerprint(washer)).toMatchSnapshot()
    washer.delete()
  })
})
```

**Step 2: Run test to verify**

Run: `npx vitest run src/generators/manifold/washerBuilder.test.ts`
Expected: All 5 tests pass

**Step 3: Commit**

```bash
git add src/generators/manifold/washerBuilder.test.ts
git commit -m "test: add washer builder tests"
```

---

## Task 3: Box Builder Tests

**Files:**
- Create: `src/generators/manifold/boxBuilder.test.ts`

**Step 1: Write box test file**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildBox } from './boxBuilder'

describe('boxBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    width: 60, depth: 40, height: 30,
    wall_thickness: 2, bottom_thickness: 2,
    corner_radius: 3, include_lid: false,
    lid_height: 10, lid_clearance: 0.3, lid_lip_height: 5,
    dividers_x: 0, dividers_y: 0,
    finger_grip: false, stackable: false
  }

  it('generates valid geometry with default params', () => {
    const box = buildBox(M, defaultParams)
    expectValid(box)
    box.delete()
  })

  it('respects width/depth/height dimensions', () => {
    const box = buildBox(M, { ...defaultParams, width: 80, depth: 50, height: 40 })
    expectDimensions(box, { width: 80, depth: 50, height: 40 })
    box.delete()
  })

  it('generates lid when include_lid is true', () => {
    const withLid = buildBox(M, { ...defaultParams, include_lid: true })
    const withoutLid = buildBox(M, { ...defaultParams, include_lid: false })
    // Lid adds volume (separate piece next to box)
    expect(withLid.volume()).toBeGreaterThan(withoutLid.volume())
    withLid.delete()
    withoutLid.delete()
  })

  it('generates dividers when specified', () => {
    const withDividers = buildBox(M, { ...defaultParams, dividers_x: 2, dividers_y: 1 })
    const withoutDividers = buildBox(M, { ...defaultParams, dividers_x: 0, dividers_y: 0 })
    // Dividers add volume
    expect(withDividers.volume()).toBeGreaterThan(withoutDividers.volume())
    withDividers.delete()
    withoutDividers.delete()
  })

  it('generates finger grip when enabled', () => {
    const withGrip = buildBox(M, { ...defaultParams, finger_grip: true })
    const withoutGrip = buildBox(M, { ...defaultParams, finger_grip: false })
    // Finger grip subtracts volume
    expect(withGrip.volume()).toBeLessThan(withoutGrip.volume())
    withGrip.delete()
    withoutGrip.delete()
  })

  it('generates stackable lip when enabled', () => {
    const stackable = buildBox(M, { ...defaultParams, stackable: true })
    const notStackable = buildBox(M, { ...defaultParams, stackable: false })
    // Stackable adds bottom lip volume
    expect(stackable.volume()).toBeGreaterThan(notStackable.volume())
    stackable.delete()
    notStackable.delete()
  })

  it('clamps corner radius to valid range', () => {
    const params = { ...defaultParams, corner_radius: 100 } // Exceeds limits
    const box = buildBox(M, params)
    expectValid(box)
    box.delete()
  })

  it('matches geometry snapshot', () => {
    const box = buildBox(M, defaultParams)
    expect(getGeometryFingerprint(box)).toMatchSnapshot()
    box.delete()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/generators/manifold/boxBuilder.test.ts`
Expected: All 8 tests pass

**Step 3: Commit**

```bash
git add src/generators/manifold/boxBuilder.test.ts
git commit -m "test: add box builder tests"
```

---

## Task 4: Bracket Builder Tests

**Files:**
- Create: `src/generators/manifold/bracketBuilder.test.ts`

**Step 1: Write bracket test file**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildBracket } from './bracketBuilder'

describe('bracketBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    width: 20, arm_length: 40, thickness: 4,
    hole_diameter: 5, fillet_radius: 8,
    hole_count_arm_1: 2, hole_count_arm_2: 2,
    add_rib: false, rib_thickness: 3
  }

  it('generates valid geometry with default params', () => {
    const bracket = buildBracket(M, defaultParams)
    expectValid(bracket)
    bracket.delete()
  })

  it('respects width dimension', () => {
    const bracket = buildBracket(M, { ...defaultParams, width: 30 })
    expectDimensions(bracket, { depth: 30 })
    bracket.delete()
  })

  it('subtracts mounting holes', () => {
    const withHoles = buildBracket(M, { ...defaultParams, hole_count_arm_1: 2, hole_count_arm_2: 2 })
    const noHoles = buildBracket(M, { ...defaultParams, hole_count_arm_1: 0, hole_count_arm_2: 0 })
    expect(withHoles.volume()).toBeLessThan(noHoles.volume())
    withHoles.delete()
    noHoles.delete()
  })

  it('adds rib when enabled', () => {
    const withRib = buildBracket(M, { ...defaultParams, add_rib: true })
    const noRib = buildBracket(M, { ...defaultParams, add_rib: false })
    expect(withRib.volume()).toBeGreaterThan(noRib.volume())
    withRib.delete()
    noRib.delete()
  })

  it('handles zero fillet radius', () => {
    const bracket = buildBracket(M, { ...defaultParams, fillet_radius: 0 })
    expectValid(bracket)
    bracket.delete()
  })

  it('matches geometry snapshot', () => {
    const bracket = buildBracket(M, defaultParams)
    expect(getGeometryFingerprint(bracket)).toMatchSnapshot()
    bracket.delete()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/generators/manifold/bracketBuilder.test.ts`
Expected: All 6 tests pass

**Step 3: Commit**

```bash
git add src/generators/manifold/bracketBuilder.test.ts
git commit -m "test: add bracket builder tests"
```

---

## Task 5: Hook Builder Tests

**Files:**
- Create: `src/generators/manifold/hookBuilder.test.ts`

**Step 1: Write hook test file**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildHook } from './hookBuilder'

describe('hookBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    width: 20, hook_depth: 30, hook_height: 40, thickness: 5, hole_diameter: 4
  }

  it('generates valid geometry with default params', () => {
    const hook = buildHook(M, defaultParams)
    expectValid(hook)
    hook.delete()
  })

  it('respects dimensions', () => {
    const hook = buildHook(M, { ...defaultParams, width: 30, hook_height: 50 })
    expectDimensions(hook, { depth: 30 })
    hook.delete()
  })

  it('generates without hole when diameter is 0', () => {
    const withHole = buildHook(M, { ...defaultParams, hole_diameter: 4 })
    const noHole = buildHook(M, { ...defaultParams, hole_diameter: 0 })
    expect(noHole.volume()).toBeGreaterThan(withHole.volume())
    withHole.delete()
    noHole.delete()
  })

  it('matches geometry snapshot', () => {
    const hook = buildHook(M, defaultParams)
    expect(getGeometryFingerprint(hook)).toMatchSnapshot()
    hook.delete()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/generators/manifold/hookBuilder.test.ts`
Expected: All 4 tests pass

**Step 3: Commit**

```bash
git add src/generators/manifold/hookBuilder.test.ts
git commit -m "test: add hook builder tests"
```

---

## Task 6: Gear Builder Tests

**Files:**
- Create: `src/generators/manifold/gearBuilder.test.ts`

**Step 1: Write gear test file**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildGear } from './gearBuilder'

describe('gearBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    teeth: 20, module: 2, height: 10,
    bore_diameter: 8, pressure_angle: 20,
    tolerance: 0.1, tip_sharpness: 0.1,
    include_hub: false, hub_diameter: 20, hub_height: 5
  }

  it('generates valid geometry with default params', () => {
    const gear = buildGear(M, defaultParams)
    expectValid(gear)
    gear.delete()
  })

  it('generates more teeth with higher count', () => {
    const gear20 = buildGear(M, { ...defaultParams, teeth: 20 })
    const gear30 = buildGear(M, { ...defaultParams, teeth: 30 })
    // More teeth = larger gear = more volume
    expect(gear30.volume()).toBeGreaterThan(gear20.volume())
    gear20.delete()
    gear30.delete()
  })

  it('generates hub when enabled', () => {
    const withHub = buildGear(M, { ...defaultParams, include_hub: true })
    const noHub = buildGear(M, { ...defaultParams, include_hub: false })
    expect(withHub.volume()).toBeGreaterThan(noHub.volume())
    withHub.delete()
    noHub.delete()
  })

  it('clamps bore diameter to safe value', () => {
    const gear = buildGear(M, { ...defaultParams, bore_diameter: 100 }) // Too large
    expectValid(gear)
    gear.delete()
  })

  it('handles minimum teeth count', () => {
    const gear = buildGear(M, { ...defaultParams, teeth: 8 })
    expectValid(gear)
    gear.delete()
  })

  it('handles solid gear (no bore)', () => {
    const gear = buildGear(M, { ...defaultParams, bore_diameter: 0 })
    expectValid(gear)
    gear.delete()
  })

  it('matches geometry snapshot', () => {
    const gear = buildGear(M, defaultParams)
    expect(getGeometryFingerprint(gear)).toMatchSnapshot()
    gear.delete()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/generators/manifold/gearBuilder.test.ts`
Expected: All 7 tests pass

**Step 3: Commit**

```bash
git add src/generators/manifold/gearBuilder.test.ts
git commit -m "test: add gear builder tests"
```

---

## Task 7: ThumbKnob Builder Tests

**Files:**
- Create: `src/generators/manifold/thumbKnobBuilder.test.ts`

**Step 1: Write thumbKnob test file**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildThumbKnob } from './thumbKnobBuilder'

describe('thumbKnobBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    screw_size: 'M5', knob_diameter: 25, height: 12, style: 'Knurled', tolerance: 0.2
  }

  it('generates valid geometry with default params', () => {
    const knob = buildThumbKnob(M, defaultParams)
    expectValid(knob)
    knob.delete()
  })

  it('generates knurled style', () => {
    const knob = buildThumbKnob(M, { ...defaultParams, style: 'Knurled' })
    expectValid(knob)
    knob.delete()
  })

  it('generates lobed style', () => {
    const knob = buildThumbKnob(M, { ...defaultParams, style: 'Lobed' })
    expectValid(knob)
    knob.delete()
  })

  it('generates hexagonal style', () => {
    const knob = buildThumbKnob(M, { ...defaultParams, style: 'Hexagonal' })
    expectValid(knob)
    knob.delete()
  })

  it('handles different screw sizes', () => {
    for (const size of ['M3', 'M4', 'M5', 'M6', 'M8']) {
      const knob = buildThumbKnob(M, { ...defaultParams, screw_size: size })
      expectValid(knob)
      knob.delete()
    }
  })

  it('enforces minimum knob diameter for hex socket', () => {
    // Small knob should still produce valid geometry (clamped internally)
    const knob = buildThumbKnob(M, { ...defaultParams, knob_diameter: 10 })
    expectValid(knob)
    knob.delete()
  })

  it('matches geometry snapshot', () => {
    const knob = buildThumbKnob(M, defaultParams)
    expect(getGeometryFingerprint(knob)).toMatchSnapshot()
    knob.delete()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/generators/manifold/thumbKnobBuilder.test.ts`
Expected: All 7 tests pass

**Step 3: Commit**

```bash
git add src/generators/manifold/thumbKnobBuilder.test.ts
git commit -m "test: add thumbKnob builder tests"
```

---

## Task 8: Gridfinity Builder Tests

**Files:**
- Create: `src/generators/manifold/gridfinityBuilder.test.ts`

**Step 1: Write gridfinity test file**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, expectDimensions, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildGridfinityBin } from './gridfinityBuilder'

describe('gridfinityBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    grid_x: 2, grid_y: 2, grid_z: 3,
    lip_style: 'normal', enable_magnets: false, enable_screws: false,
    dividers_x: 0, dividers_y: 0, finger_slide: false
  }

  it('generates valid geometry with default params', () => {
    const bin = buildGridfinityBin(M, defaultParams)
    expectValid(bin)
    bin.delete()
  })

  it('respects grid unit dimensions (42mm pitch)', () => {
    const bin = buildGridfinityBin(M, { ...defaultParams, grid_x: 1, grid_y: 1 })
    // 1x1 bin should be ~42mm - tolerance
    expectDimensions(bin, { width: 41.5, depth: 41.5 })
    bin.delete()
  })

  it('generates magnet holes when enabled', () => {
    const withMagnets = buildGridfinityBin(M, { ...defaultParams, enable_magnets: true })
    const noMagnets = buildGridfinityBin(M, { ...defaultParams, enable_magnets: false })
    expect(withMagnets.volume()).toBeLessThan(noMagnets.volume())
    withMagnets.delete()
    noMagnets.delete()
  })

  it('generates screw holes when enabled', () => {
    const withScrews = buildGridfinityBin(M, { ...defaultParams, enable_screws: true })
    const noScrews = buildGridfinityBin(M, { ...defaultParams, enable_screws: false })
    expect(withScrews.volume()).toBeLessThan(noScrews.volume())
    withScrews.delete()
    noScrews.delete()
  })

  it('generates dividers when specified', () => {
    const withDividers = buildGridfinityBin(M, { ...defaultParams, dividers_x: 1, dividers_y: 1 })
    const noDividers = buildGridfinityBin(M, { ...defaultParams, dividers_x: 0, dividers_y: 0 })
    expect(withDividers.volume()).toBeGreaterThan(noDividers.volume())
    withDividers.delete()
    noDividers.delete()
  })

  it('handles different lip styles', () => {
    for (const style of ['normal', 'reduced', 'minimum', 'none']) {
      const bin = buildGridfinityBin(M, { ...defaultParams, lip_style: style })
      expectValid(bin)
      bin.delete()
    }
  })

  it('handles minimum 1x1x1 bin', () => {
    const bin = buildGridfinityBin(M, { ...defaultParams, grid_x: 1, grid_y: 1, grid_z: 1 })
    expectValid(bin)
    bin.delete()
  })

  it('matches geometry snapshot', () => {
    const bin = buildGridfinityBin(M, defaultParams)
    expect(getGeometryFingerprint(bin)).toMatchSnapshot()
    bin.delete()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/generators/manifold/gridfinityBuilder.test.ts`
Expected: All 8 tests pass

**Step 3: Commit**

```bash
git add src/generators/manifold/gridfinityBuilder.test.ts
git commit -m "test: add gridfinity builder tests"
```

---

## Task 9: Sign Builder Tests

**Files:**
- Create: `src/generators/manifold/signBuilder.test.ts`

**Step 1: Write sign test file**

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import type { ManifoldToplevel } from 'manifold-3d'
import { getManifold, setCircularSegments } from '../../test/manifoldSetup'
import { expectValid, getGeometryFingerprint } from '../../test/geometryHelpers'
import { buildSign } from './signBuilder'

describe('signBuilder', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
    setCircularSegments(M, 32)
  })

  const defaultParams = {
    text: 'HELLO', text_size: 12, text_depth: 2, padding: 5, base_depth: 2, corner_radius: 2
  }

  it('generates valid geometry with default params', () => {
    const sign = buildSign(M, defaultParams)
    expectValid(sign)
    sign.delete()
  })

  it('handles different text', () => {
    const sign = buildSign(M, { ...defaultParams, text: 'TEST' })
    expectValid(sign)
    sign.delete()
  })

  it('sanitizes invalid characters', () => {
    const sign = buildSign(M, { ...defaultParams, text: 'hello@#$%' }) // lowercase + invalid chars
    expectValid(sign)
    sign.delete()
  })

  it('handles special characters', () => {
    const sign = buildSign(M, { ...defaultParams, text: 'HI! WORLD.' })
    expectValid(sign)
    sign.delete()
  })

  it('handles numbers', () => {
    const sign = buildSign(M, { ...defaultParams, text: '12345' })
    expectValid(sign)
    sign.delete()
  })

  it('handles empty text (defaults to TEXT)', () => {
    const sign = buildSign(M, { ...defaultParams, text: '' })
    expectValid(sign)
    sign.delete()
  })

  it('matches geometry snapshot', () => {
    const sign = buildSign(M, defaultParams)
    expect(getGeometryFingerprint(sign)).toMatchSnapshot()
    sign.delete()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/generators/manifold/signBuilder.test.ts`
Expected: All 7 tests pass

**Step 3: Commit**

```bash
git add src/generators/manifold/signBuilder.test.ts
git commit -m "test: add sign builder tests"
```

---

## Task 10: StrokeFont Tests

**Files:**
- Create: `src/generators/manifold/strokeFont.test.ts`

**Step 1: Write strokeFont test file**

```typescript
import { describe, it, expect } from 'vitest'
import { STROKE_FONT, DOTTED_CHARS, getCharWidth, getCharSpacing } from './strokeFont'

describe('strokeFont', () => {
  it('defines all uppercase letters A-Z', () => {
    for (let i = 65; i <= 90; i++) {
      const char = String.fromCharCode(i)
      expect(STROKE_FONT[char]).toBeDefined()
      expect(Array.isArray(STROKE_FONT[char])).toBe(true)
    }
  })

  it('defines all digits 0-9', () => {
    for (let i = 0; i <= 9; i++) {
      expect(STROKE_FONT[String(i)]).toBeDefined()
    }
  })

  it('defines special characters', () => {
    expect(STROKE_FONT[' ']).toBeDefined()
    expect(STROKE_FONT['!']).toBeDefined()
    expect(STROKE_FONT['.']).toBeDefined()
    expect(STROKE_FONT['-']).toBeDefined()
  })

  it('marks dotted characters correctly', () => {
    expect(DOTTED_CHARS).toContain('!')
    expect(DOTTED_CHARS).toContain('.')
    expect(DOTTED_CHARS).not.toContain('A')
  })

  it('returns consistent char width', () => {
    expect(getCharWidth()).toBe(4)
  })

  it('returns consistent char spacing', () => {
    expect(getCharSpacing()).toBe(0.7)
  })

  it('all paths have valid structure', () => {
    for (const [char, paths] of Object.entries(STROKE_FONT)) {
      expect(Array.isArray(paths)).toBe(true)
      for (const path of paths) {
        expect(Array.isArray(path)).toBe(true)
        for (const point of path) {
          expect(Array.isArray(point)).toBe(true)
          expect(point).toHaveLength(2)
          expect(typeof point[0]).toBe('number')
          expect(typeof point[1]).toBe('number')
        }
      }
    }
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/generators/manifold/strokeFont.test.ts`
Expected: All 7 tests pass

**Step 3: Commit**

```bash
git add src/generators/manifold/strokeFont.test.ts
git commit -m "test: add strokeFont tests"
```

---

## Task 11: Generator Definition Tests

**Files:**
- Modify: `src/generators/types.test.ts` (extend existing)

**Step 1: Read current types.test.ts**

Run: `cat src/generators/types.test.ts`

**Step 2: Add generator definition tests**

Append to existing file:

```typescript
import { generators } from './index'

describe('generators', () => {
  it('exports all 9 generators', () => {
    expect(generators).toHaveLength(9)
  })

  it('all generators have required fields', () => {
    for (const gen of generators) {
      expect(gen.id).toBeDefined()
      expect(gen.name).toBeDefined()
      expect(gen.parameters).toBeDefined()
      expect(gen.generateGeometry).toBeDefined()
      expect(gen.builderId).toBeDefined()
    }
  })

  it('all generator IDs are unique', () => {
    const ids = generators.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all generators have valid default parameters', () => {
    for (const gen of generators) {
      for (const param of gen.parameters) {
        expect(param.default).toBeDefined()
        if (param.type === 'number') {
          expect(typeof param.default).toBe('number')
          expect(param.default).toBeGreaterThanOrEqual(param.min)
          expect(param.default).toBeLessThanOrEqual(param.max)
        }
      }
    }
  })

  it('dynamicMax functions return valid numbers', () => {
    for (const gen of generators) {
      const params: Record<string, number> = {}
      for (const param of gen.parameters) {
        if (param.type === 'number') {
          params[param.name] = param.default
        }
      }

      for (const param of gen.parameters) {
        if (param.type === 'number' && param.dynamicMax) {
          const result = param.dynamicMax(params)
          expect(typeof result).toBe('number')
          expect(result).toBeGreaterThan(0)
        }
      }
    }
  })

  it('dynamicMin functions return valid numbers', () => {
    for (const gen of generators) {
      const params: Record<string, number> = {}
      for (const param of gen.parameters) {
        if (param.type === 'number') {
          params[param.name] = param.default
        }
      }

      for (const param of gen.parameters) {
        if (param.type === 'number' && param.dynamicMin) {
          const result = param.dynamicMin(params)
          expect(typeof result).toBe('number')
        }
      }
    }
  })
})
```

**Step 3: Run tests**

Run: `npx vitest run src/generators/types.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/generators/types.test.ts
git commit -m "test: add generator definition tests"
```

---

## Task 12: meshToStl Tests

**Files:**
- Create: `src/lib/meshToStl.test.ts`

**Step 1: Write meshToStl test file**

```typescript
import { describe, it, expect } from 'vitest'
import { meshToStl } from './meshToStl'

describe('meshToStl', () => {
  // Simple triangle mesh (1 face)
  const simpleMesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2])
  }

  // Two triangles (forming a quad)
  const quadMesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3])
  }

  it('returns a Blob', () => {
    const result = meshToStl(simpleMesh)
    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('application/octet-stream')
  })

  it('generates correct binary size for single triangle', () => {
    const result = meshToStl(simpleMesh)
    // 80 header + 4 count + 50 per triangle
    expect(result.size).toBe(80 + 4 + 50)
  })

  it('generates correct binary size for two triangles', () => {
    const result = meshToStl(quadMesh)
    expect(result.size).toBe(80 + 4 + 100)
  })

  it('handles empty mesh', () => {
    const emptyMesh = {
      positions: new Float32Array([]),
      normals: new Float32Array([]),
      indices: new Uint32Array([])
    }
    const result = meshToStl(emptyMesh)
    expect(result.size).toBe(80 + 4) // Just header and zero count
  })

  it('binary content has correct header', async () => {
    const result = meshToStl(simpleMesh)
    const buffer = await result.arrayBuffer()
    const header = new TextDecoder().decode(buffer.slice(0, 40))
    expect(header).toContain('Binary STL')
  })

  it('binary content has correct triangle count', async () => {
    const result = meshToStl(quadMesh)
    const buffer = await result.arrayBuffer()
    const view = new DataView(buffer)
    const triangleCount = view.getUint32(80, true) // Little-endian
    expect(triangleCount).toBe(2)
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run src/lib/meshToStl.test.ts`
Expected: All 6 tests pass

**Step 3: Commit**

```bash
git add src/lib/meshToStl.test.ts
git commit -m "test: add meshToStl tests"
```

---

## Task 13: Increase Sidebar Coverage

**Files:**
- Modify: `src/components/Sidebar.test.tsx`

**Step 1: Read current Sidebar.test.tsx to understand existing tests**

Run: `cat src/components/Sidebar.test.tsx`

**Step 2: Add tests for uncovered branches**

Focus on: dynamic constraints, disabled states, parameter sorting, all input types

**Step 3: Run tests and verify coverage increase**

Run: `npx vitest run --coverage src/components/Sidebar.test.tsx`

**Step 4: Commit**

```bash
git add src/components/Sidebar.test.tsx
git commit -m "test: increase Sidebar coverage"
```

---

## Task 14: Increase App Coverage

**Files:**
- Modify: `src/App.test.tsx`

**Step 1: Read current App.test.tsx**

**Step 2: Add tests for uncovered branches**

Focus on: URL state parsing, error handling, download functionality, mobile menu

**Step 3: Run tests and verify coverage increase**

**Step 4: Commit**

```bash
git add src/App.test.tsx
git commit -m "test: increase App coverage"
```

---

## Task 15: Final Coverage Verification

**Step 1: Run full test suite with coverage**

Run: `npx vitest run --coverage`

**Step 2: Verify all tests pass**

Expected: All tests pass, coverage at or near 100%

**Step 3: If gaps remain, identify and add targeted tests**

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: achieve 100% test coverage"
```

---

## Execution Summary

| Task | Files | Tests | Complexity |
|------|-------|-------|------------|
| 1 | Infrastructure cleanup | - | Low |
| 2 | washerBuilder | 5 | Low |
| 3 | boxBuilder | 8 | Medium |
| 4 | bracketBuilder | 6 | Medium |
| 5 | hookBuilder | 4 | Low |
| 6 | gearBuilder | 7 | High |
| 7 | thumbKnobBuilder | 7 | Medium |
| 8 | gridfinityBuilder | 8 | High |
| 9 | signBuilder | 7 | Medium |
| 10 | strokeFont | 7 | Low |
| 11 | Generator definitions | 6 | Low |
| 12 | meshToStl | 6 | Low |
| 13 | Sidebar coverage | ~5 | Medium |
| 14 | App coverage | ~5 | Medium |
| 15 | Verification | - | Low |

**Total: ~80 new tests across 15 tasks**
