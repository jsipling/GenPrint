# Performance Optimizations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 6 low-risk performance optimizations to improve UI responsiveness and reduce unnecessary computation.

**Architecture:** Pure optimizations with no behavior changes. Memoize sorted arrays, skip redundant frame calculations, batch geometry operations.

**Tech Stack:** React (useMemo, useRef), Three.js/react-three-fiber, Manifold-3d

---

## Task 1: Memoize Sorted Generators in Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx:1` (add useMemo import)
- Modify: `src/components/Sidebar.tsx:209-238` (memoize generators list)

**Step 1: Add useMemo to imports**

Change line 1 from:
```tsx
import { useEffect } from 'react'
```

To:
```tsx
import { useEffect, useMemo } from 'react'
```

**Step 2: Add memoized sorted generators**

Inside the `Sidebar` function (after line 218, before the return), add:

```tsx
  // Memoize sorted generators to avoid re-sorting on every render
  const sortedGenerators = useMemo(
    () => [...generators].sort((a, b) => a.name.localeCompare(b.name)),
    [generators]
  )
```

**Step 3: Use sortedGenerators in JSX**

Change lines 235-237 from:
```tsx
            {[...generators].sort((a, b) => a.name.localeCompare(b.name)).map((gen) => (
              <option key={gen.id} value={gen.id}>{gen.name}</option>
            ))}
```

To:
```tsx
            {sortedGenerators.map((gen) => (
              <option key={gen.id} value={gen.id}>{gen.name}</option>
            ))}
```

**Step 4: Run dev server to verify**

Run: `npm run dev`
Expected: App loads, generator dropdown works correctly

**Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "perf(Sidebar): memoize sorted generators list"
```

---

## Task 2: Memoize Sorted Parameters in Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx:209-276` (memoize parameters list)

**Step 1: Add memoized sorted parameters**

After the `sortedGenerators` useMemo (added in Task 1), add:

```tsx
  // Memoize sorted parameters to avoid re-sorting on every render
  const sortedParameters = useMemo(
    () => [...selectedGenerator.parameters].sort((a, b) => {
      const aHasChildren = isBooleanParam(a) && a.children && a.children.length > 0
      const bHasChildren = isBooleanParam(b) && b.children && b.children.length > 0
      if (aHasChildren && !bHasChildren) return 1
      if (!aHasChildren && bHasChildren) return -1
      return 0
    }),
    [selectedGenerator.parameters]
  )
```

**Step 2: Use sortedParameters in JSX**

Change lines 260-275 from:
```tsx
          {[...selectedGenerator.parameters]
            .sort((a, b) => {
              const aHasChildren = isBooleanParam(a) && a.children && a.children.length > 0
              const bHasChildren = isBooleanParam(b) && b.children && b.children.length > 0
              if (aHasChildren && !bHasChildren) return 1
              if (!aHasChildren && bHasChildren) return -1
              return 0
            })
            .map((param) => (
              <ParameterInput
                key={param.name}
                param={param}
                params={params}
                onParamChange={onParamChange}
              />
            ))}
```

To:
```tsx
          {sortedParameters.map((param) => (
            <ParameterInput
              key={param.name}
              param={param}
              params={params}
              onParamChange={onParamChange}
            />
          ))}
```

**Step 3: Run dev server to verify**

Run: `npm run dev`
Expected: Parameters display correctly, sliders are responsive

**Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "perf(Sidebar): memoize sorted parameters list"
```

---

## Task 3: Cache Camera Distance in DynamicControls

**Files:**
- Modify: `src/components/Viewer.tsx:52-65` (add distance caching)

**Step 1: Add lastDistanceRef and optimize useFrame**

Change the `DynamicControls` function (lines 52-65) from:
```tsx
function DynamicControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  useFrame(({ camera }) => {
    if (controlsRef.current) {
      // Scale pan speed with camera distance (closer = faster relative movement)
      const distance = camera.position.length()
      const basePanSpeed = 0.02
      controlsRef.current.panSpeed = Math.max(0.5, distance * basePanSpeed)
    }
  })

  return <OrbitControls ref={controlsRef} makeDefault zoomSpeed={1.5} />
}
```

To:
```tsx
function DynamicControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const lastDistanceRef = useRef(0)

  useFrame(({ camera }) => {
    if (controlsRef.current) {
      const distance = camera.position.length()
      // Only update pan speed if distance changed by >1%
      if (Math.abs(distance - lastDistanceRef.current) > distance * 0.01) {
        lastDistanceRef.current = distance
        controlsRef.current.panSpeed = Math.max(0.5, distance * 0.02)
      }
    }
  })

  return <OrbitControls ref={controlsRef} makeDefault zoomSpeed={1.5} />
}
```

**Step 2: Run dev server to verify**

Run: `npm run dev`
Expected: Camera controls work smoothly, panning speed still scales with zoom

**Step 3: Commit**

```bash
git add src/components/Viewer.tsx
git commit -m "perf(Viewer): cache camera distance to reduce per-frame work"
```

---

## Task 4: Batch Gear Teeth Union

**Files:**
- Modify: `src/generators/manifold/gearBuilder.ts:6` (add CrossSection to import type)
- Modify: `src/generators/manifold/gearBuilder.ts:159-176` (batch tooth creation)

**Step 1: Verify CrossSection is already imported**

Line 6 should already be:
```tsx
import type { ManifoldToplevel, Manifold, CrossSection } from 'manifold-3d'
```

(No change needed if already present)

**Step 2: Replace individual tooth union loop with batched union**

Change the `gearProfile` function's tooth creation loop (lines 159-176) from:
```tsx
  for (let i = 0; i < teeth; i++) {
    const angle = (360 * i) / teeth

    // Rotate tooth points
    const rotatedPoints: [number, number][] = toothPoints.map(([x, y]) => {
      const rad = (angle * Math.PI) / 180
      return [
        x * Math.cos(rad) - y * Math.sin(rad),
        x * Math.sin(rad) + y * Math.cos(rad)
      ]
    })

    const toothCross = new M.CrossSection([rotatedPoints])
    const newGear = gearCross.add(toothCross)
    gearCross.delete()
    toothCross.delete()
    gearCross = newGear
  }
```

To:
```tsx
  // Batch all teeth and union once (faster than individual unions)
  const toothCrosses: CrossSection[] = []
  for (let i = 0; i < teeth; i++) {
    const angle = (360 * i) / teeth
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    const rotatedPoints: [number, number][] = toothPoints.map(([x, y]) => [
      x * cos - y * sin,
      x * sin + y * cos
    ])

    toothCrosses.push(new M.CrossSection([rotatedPoints]))
  }

  // Single batch union of all teeth
  const allTeeth = M.CrossSection.union(toothCrosses)
  toothCrosses.forEach(t => t.delete())

  const newGear = gearCross.add(allTeeth)
  gearCross.delete()
  allTeeth.delete()
  gearCross = newGear
```

**Step 3: Run dev server and test gear generation**

Run: `npm run dev`
Expected: Select "Spur Gear" generator, adjust tooth count, gear renders correctly

**Step 4: Commit**

```bash
git add src/generators/manifold/gearBuilder.ts
git commit -m "perf(gearBuilder): batch gear teeth union for faster generation"
```

---

## Task 5: More Aggressive Grid Label Reduction

**Files:**
- Modify: `src/components/gridUtils.ts:44` (adjust label interval thresholds)

**Step 1: Update label interval calculation**

Change line 44 from:
```tsx
  const labelInterval = size > 200 ? 50 : (size > 100 ? 20 : 10)
```

To:
```tsx
  const labelInterval = size > 400 ? 100 : (size > 200 ? 50 : (size > 100 ? 20 : 10))
```

**Step 2: Run dev server and test with large model**

Run: `npm run dev`
Expected: Select "Gridfinity Bin", set grid_x=4, grid_y=4. Grid has fewer labels but remains readable.

**Step 3: Commit**

```bash
git add src/components/gridUtils.ts
git commit -m "perf(gridUtils): reduce label count for large grids"
```

---

## Task 6: Cache URL State at Init

**Files:**
- Modify: `src/App.tsx:52-68` (cache getUrlState result)

**Step 1: Cache the URL state before useState calls**

Change lines 51-68 from:
```tsx
  // Initialize from URL or defaults
  const [selectedGenerator, setSelectedGenerator] = useState(() => {
    const urlState = getUrlState()
    if (urlState.generatorId) {
      const gen = generators.find(g => g.id === urlState.generatorId)
      if (gen) return gen
    }
    return initialGenerator
  })
  const [params, setParams] = useState<ParameterValues>(() => {
    const urlState = getUrlState()
    const gen = urlState.generatorId
      ? generators.find(g => g.id === urlState.generatorId) || initialGenerator
      : initialGenerator
    const defaults = getDefaultParams(gen)
    // Merge URL params with defaults (URL params override)
    return urlState.params ? { ...defaults, ...urlState.params } : defaults
  })
```

To:
```tsx
  // Parse URL once at init (avoid double parsing)
  const initialUrlState = getUrlState()

  // Initialize from URL or defaults
  const [selectedGenerator, setSelectedGenerator] = useState(() => {
    if (initialUrlState.generatorId) {
      const gen = generators.find(g => g.id === initialUrlState.generatorId)
      if (gen) return gen
    }
    return initialGenerator
  })
  const [params, setParams] = useState<ParameterValues>(() => {
    const gen = initialUrlState.generatorId
      ? generators.find(g => g.id === initialUrlState.generatorId) || initialGenerator
      : initialGenerator
    const defaults = getDefaultParams(gen)
    // Merge URL params with defaults (URL params override)
    return initialUrlState.params ? { ...defaults, ...initialUrlState.params } : defaults
  })
```

**Step 2: Run dev server and test URL sharing**

Run: `npm run dev`
Expected:
1. Adjust some parameters
2. Copy the URL
3. Open in new tab
4. Parameters should be restored from URL

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "perf(App): cache URL state to avoid double parsing on init"
```

---

## Task 7: Simplify Cache Key

**Files:**
- Modify: `src/hooks/useManifold.ts:220` (simplify cache key string)

**Step 1: Change cache key construction**

Change line 220 from:
```tsx
    const cacheKey = hashCode(JSON.stringify({ generatorId, params, circularSegments }))
```

To:
```tsx
    const cacheKey = hashCode(`${generatorId}:${circularSegments}:${JSON.stringify(params)}`)
```

**Step 2: Run dev server to verify caching still works**

Run: `npm run dev`
Expected: Adjust a parameter, then return to previous value - should see "Manifold cache hit" in console (dev mode)

**Step 3: Commit**

```bash
git add src/hooks/useManifold.ts
git commit -m "perf(useManifold): simplify cache key construction"
```

---

## Final Verification

**Step 1: Run type check**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 2: Manual testing checklist**

- [ ] Generator dropdown works and is sorted
- [ ] Parameter sliders are responsive
- [ ] Camera pan/zoom controls work smoothly
- [ ] Gear generator produces correct shapes
- [ ] Large gridfinity bins show readable grid
- [ ] URL sharing preserves parameters
- [ ] Cache hits work (check console in dev mode)

---

## Summary

| Task | File | Change |
|------|------|--------|
| 1 | Sidebar.tsx | Memoize sorted generators |
| 2 | Sidebar.tsx | Memoize sorted parameters |
| 3 | Viewer.tsx | Cache camera distance |
| 4 | gearBuilder.ts | Batch gear teeth union |
| 5 | gridUtils.ts | Aggressive label reduction |
| 6 | App.tsx | Cache URL state |
| 7 | useManifold.ts | Simplify cache key |
