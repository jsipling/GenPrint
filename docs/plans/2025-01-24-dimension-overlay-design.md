# Dimension Overlay in Viewer

## Overview

A small, always-visible info panel in the top-right corner of the viewer that displays:

1. **Overall dimensions** - Width × Depth × Height computed from bounding box
2. **Key features** - Generator-defined dimensions like hole diameters, wall thickness, shaft length

**Target user:** 3D printing hobbyist without CAD skills who wants to:
- Verify the model will fit their print bed
- Confirm key functional dimensions match their requirements
- Get this info at a glance without interaction

## Data Architecture

### New `displayDimensions` field on generators

```typescript
// In generator definition
displayDimensions: [
  { label: 'Bore', param: 'boreDiameter', format: '⌀{value}mm' },
  { label: 'Wall', param: 'wallThickness' },
  { label: 'Shaft', param: 'shaftLength' },
]
```

### Data flow

1. Generator defines which params to highlight via `displayDimensions`
2. Worker computes bounding box during mesh generation using Manifold's native `boundingBox()` method
3. Worker returns `MeshData` + `boundingBox` + passes through `displayDimensions` config
4. Viewer receives dimensions and renders the panel

### Type definitions

```typescript
interface DisplayDimension {
  label: string        // "Bore", "Wall"
  param: string        // Key into params object (supports nested: "bore.diameter")
  format?: string      // Optional: "⌀{value}mm"
}

interface BoundingBox {
  min: [number, number, number]
  max: [number, number, number]
}
```

## UI Component

`DimensionPanel` component - A React component rendered as an overlay on the viewer:

```
┌─────────────────────┐
│ 📐 Dimensions       │
├─────────────────────┤
│ 45 × 30 × 20 mm     │  ← Bounding box (W × D × H)
├─────────────────────┤
│ Bore      ⌀8mm      │  ← From displayDimensions
│ Wall      2mm       │
│ Height    15mm      │
└─────────────────────┘
```

**Styling:**
- Semi-transparent dark background (matches existing UI)
- Monospace font for dimensions (easy to read numbers)
- Compact - doesn't dominate the view
- Always visible (no toggle)

**Position:** Absolute positioned within the viewer container, top-right with small margin.

**Loading state:** Shows "—" placeholder while model is building, then updates when mesh arrives.

## Implementation Changes

| File | Change |
|------|--------|
| `src/generators/types.ts` | Add `DisplayDimension` type and `displayDimensions` field to generator type |
| `src/workers/manifold.worker.ts` | Compute bounding box via Manifold, include in response |
| `src/hooks/useManifold.ts` | Pass through bounding box and displayDimensions to caller |
| `src/components/Viewer.tsx` | Add `DimensionPanel` component, receive dimension data as props |
| Each generator file | Add `displayDimensions` array (can be done incrementally) |

**Incremental rollout:** Generators without `displayDimensions` just show bounding box. Feature dimensions appear as generators are updated.

## Testing

**Unit tests:**
- `DimensionPanel` renders bounding box correctly
- `DimensionPanel` renders feature dimensions with formatting
- `DimensionPanel` handles missing `displayDimensions` gracefully (shows only bounding box)
- Bounding box calculation in worker matches expected values

**Edge cases handled:**
- **No displayDimensions defined:** Panel shows only bounding box
- **Model still loading:** Show "—" placeholders
- **Very small/large numbers:** Format to 1 decimal place (e.g., "0.5mm" or "150.0mm")
- **Nested params:** `displayDimensions` can reference nested param paths like `"bore.diameter"`

## Out of Scope

- Toggle visibility
- Dimension lines drawn on model
- Interactive measurement tool
- Export dimensions to file
