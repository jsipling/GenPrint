# Performance Optimizations Design

Low-risk, low-complexity performance improvements for GenPrint.

## Goals

- Improve UI responsiveness during parameter changes
- Reduce unnecessary computation per frame
- Batch geometry operations where possible
- No added complexity or behavior changes

## Changes

### 1. Memoize Sorted Lists in Sidebar (Sidebar.tsx)

**Problem**: Generator and parameter arrays are copied and sorted on every render, including during slider drags.

**Solution**: Wrap in `useMemo`:
```tsx
const sortedGenerators = useMemo(() =>
  [...generators].sort((a, b) => a.name.localeCompare(b.name)),
  [generators]
)

const sortedParameters = useMemo(() =>
  [...selectedGenerator.parameters].sort((a, b) => {
    const aHasChildren = isBooleanParam(a) && a.children && a.children.length > 0
    const bHasChildren = isBooleanParam(b) && b.children && b.children.length > 0
    if (aHasChildren && !bHasChildren) return 1
    if (!aHasChildren && bHasChildren) return -1
    return 0
  }),
  [selectedGenerator.parameters]
)
```

**Impact**: Eliminates array allocation + sort on every keystroke/slider drag.

---

### 2. Cache Camera Distance in DynamicControls (Viewer.tsx)

**Problem**: `camera.position.length()` (which calls Math.sqrt) runs 60x/second even when camera isn't moving.

**Solution**: Track last distance and skip updates when unchanged:
```tsx
const lastDistanceRef = useRef(0)

useFrame(({ camera }) => {
  if (controlsRef.current) {
    const distance = camera.position.length()
    if (Math.abs(distance - lastDistanceRef.current) > distance * 0.01) {
      lastDistanceRef.current = distance
      controlsRef.current.panSpeed = Math.max(0.5, distance * 0.02)
    }
  }
})
```

**Impact**: Skips Math.sqrt and property assignment most frames.

---

### 3. Batch Gear Teeth Union (gearBuilder.ts)

**Problem**: Each gear tooth is unioned individually in a loop (N operations for N teeth).

**Solution**: Collect all teeth, union once:
```tsx
const toothCrosses: CrossSection[] = []
for (let i = 0; i < teeth; i++) {
  const rotatedPoints = toothPoints.map(([x, y]) => {
    const rad = (angle * Math.PI) / 180
    return [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)]
  })
  toothCrosses.push(new M.CrossSection([rotatedPoints]))
}

const allTeeth = M.CrossSection.union(toothCrosses)
toothCrosses.forEach(t => t.delete())
const newGear = gearCross.add(allTeeth)
gearCross.delete()
allTeeth.delete()
gearCross = newGear
```

**Impact**: Reduces N union operations to 1 for gears with 15-40 teeth.

---

### 4. Reduce Grid Labels for Large Models (gridUtils.ts)

**Problem**: Large models generate many measurement labels, each creating DOM elements.

**Solution**: More aggressive label reduction:
```tsx
// Before
const labelInterval = size > 200 ? 50 : (size > 100 ? 20 : 10)

// After
const labelInterval = size > 400 ? 100 : (size > 200 ? 50 : (size > 100 ? 20 : 10))
```

**Impact**: Fewer DOM elements for large model grids.

---

### 5. Cache URL State at Init (App.tsx)

**Problem**: `getUrlState()` parses URL twice during component initialization.

**Solution**: Parse once outside useState:
```tsx
const initialUrlState = getUrlState()

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
  return initialUrlState.params ? { ...defaults, ...initialUrlState.params } : defaults
})
```

**Impact**: Minor - cleaner initialization.

---

### 6. Simplify Cache Key (useManifold.ts)

**Problem**: Creates intermediate object just to stringify for cache key.

**Solution**: Build string directly:
```tsx
// Before
const cacheKey = hashCode(JSON.stringify({ generatorId, params, circularSegments }))

// After
const cacheKey = hashCode(`${generatorId}:${circularSegments}:${JSON.stringify(params)}`)
```

**Impact**: Minor - skips one object allocation.

---

## Implementation Order

1. Sidebar.tsx - memoize sorted lists
2. Viewer.tsx - cache camera distance
3. gearBuilder.ts - batch teeth union
4. gridUtils.ts - label interval
5. App.tsx - cache URL state
6. useManifold.ts - simplify cache key

## Testing

- Verify slider interaction feels smooth
- Test gear generation with various tooth counts
- Confirm large gridfinity bins render grid correctly
- Check URL sharing still works
