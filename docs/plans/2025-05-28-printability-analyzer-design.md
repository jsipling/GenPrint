# Printability Analyzer Tool Design

## Overview

A CLI tool that analyzes generated 3D geometry for FDM printability issues, providing actionable feedback during generator development. The LLM calls this tool while iterating on generator code to catch issues early.

## CLI Interface

```bash
# Analyze registered generator with default params
npm run analyze:print v8-engine

# With custom parameters
npm run analyze:print v8-engine -- --bore=50 --wallThickness=1.0

# JSON output for programmatic use
npm run analyze:print v8-engine --json

# Specify print orientation (default: Z-up)
npm run analyze:print v8-engine --orientation=Y-up
```

### Output Example (human-readable)

```
Printability Analysis: V8 Engine Block
Parameters: bore=50, wallThickness=1.0, ...
═══════════════════════════════════════════════════════════

CRITICAL ISSUES (2)
───────────────────────────────────────────────────────────
✗ THIN WALL: 0.95mm (min: 1.2mm)
  Location: bottom-center, X: -5 to 5mm, Y: 40-60mm, Z: 0-3mm
  Likely cause: wallThickness=1.0 insufficient for cylinder spacing

✗ OVERHANG: 58° (max: 45°)
  Location: front-left, oil pan transition area
  Region: X: -30 to -20mm, Y: -50 to -40mm, Z: 5-15mm

WARNINGS (1)
───────────────────────────────────────────────────────────
⚠ SMALL FEATURE: 1.2mm detail may not print reliably (min: 1.5mm)
  Location: rear, flywheel bolt bosses

PASSED (3)
───────────────────────────────────────────────────────────
✓ Manifold valid (watertight)
✓ Single connected component
✓ Flat bottom surface for bed adhesion

Summary: 2 critical, 1 warning — NOT PRINT-READY
```

## Architecture

### File Structure

```
scripts/
  analyze-print.ts        # CLI entry point (runs with tsx)
src/
  analysis/
    printabilityAnalyzer.ts   # Main orchestrator
    checks/
      manifoldValidity.ts     # Watertight, genus checks
      connectivity.ts         # Disconnected parts detection
      thinWalls.ts           # Wall thickness analysis
      smallFeatures.ts       # Feature size detection
      overhangs.ts           # Overhang angle analysis
      bedContact.ts          # Flat bottom surface check
    types.ts                 # Issue types, report structure
    locationDescriber.ts     # Converts coords to descriptions
    parameterCorrelator.ts   # Suggests likely parameter causes
```

### Analysis Pipeline

```
Generator + Params
       ↓
   Build Manifold (reuse existing worker code)
       ↓
   Run Analysis Checks (parallel where possible)
       ↓
   Aggregate Issues
       ↓
   Enrich with locations & parameter hints
       ↓
   Format Output (text or JSON)
```

### Key Design Decisions

1. **Reuse manifold worker logic** — The CLI imports the same builder execution that the app uses, ensuring consistency
2. **Checks are modular** — Each check is a separate function returning `Issue[]`, easy to add new checks later
3. **Parallel execution** — Checks that don't depend on each other run concurrently
4. **Threshold configuration** — Uses constants from `printingConstants.ts` (MIN_WALL_THICKNESS, etc.)

## Analysis Algorithms

### Thin Wall Detection

Uses Manifold's `offset()` to detect walls thinner than the minimum:

```typescript
function detectThinWalls(manifold: Manifold, minThickness: number): ThinWallIssue[] {
  // Erode by half the minimum thickness
  const eroded = manifold.offset(-minThickness / 2, /* circular */ true)

  // If erosion causes volume to drop significantly or decompose,
  // there are thin sections
  const originalVolume = manifold.volume()
  const erodedVolume = eroded.volume()

  if (erodedVolume < originalVolume * 0.99) {
    // Find WHERE by comparing the two meshes
    // Regions that disappeared = thin walls
    const thinRegions = findDisappearedRegions(manifold, eroded)
    return thinRegions.map(region => ({
      type: 'thin-wall',
      severity: 'critical',
      measuredThickness: estimateThickness(region),
      boundingBox: region.bbox,
      // ...
    }))
  }
  return []
}
```

### Overhang Detection

Analyze face normals relative to print direction:

```typescript
function detectOverhangs(mesh: Mesh, maxAngle: number = 45): OverhangIssue[] {
  const issues: OverhangIssue[] = []
  const downVector = [0, 0, -1]

  for (const triangle of mesh.triangles) {
    const normal = computeNormal(triangle)
    // Angle from vertical (Z-down)
    const angle = Math.acos(dotProduct(normal, downVector)) * 180 / Math.PI

    if (normal[2] < 0 && angle < (90 - maxAngle)) {
      // This face points downward at a steep angle
      issues.push({
        type: 'overhang',
        angle: 90 - angle,
        centroid: triangleCentroid(triangle),
        // ...
      })
    }
  }

  // Cluster adjacent faces into regions
  return clusterIssues(issues)
}
```

### Small Feature Detection

Similar erosion approach — features that vanish under small erosion are too small to print reliably.

## Location Description

Converts raw coordinates into human-readable descriptions:

```typescript
function describeLocation(bbox: BoundingBox, modelBbox: BoundingBox): string {
  const center = getCentroid(bbox)
  const modelCenter = getCentroid(modelBbox)

  const parts: string[] = []

  // Vertical position
  const zRatio = (center[2] - modelBbox.min[2]) / (modelBbox.max[2] - modelBbox.min[2])
  if (zRatio < 0.33) parts.push('bottom')
  else if (zRatio > 0.66) parts.push('top')
  else parts.push('middle')

  // Front/back (Y axis)
  const yRatio = (center[1] - modelBbox.min[1]) / (modelBbox.max[1] - modelBbox.min[1])
  if (yRatio < 0.33) parts.push('front')
  else if (yRatio > 0.66) parts.push('rear')

  // Left/right (X axis)
  if (center[0] < modelCenter[0] - tolerance) parts.push('left')
  else if (center[0] > modelCenter[0] + tolerance) parts.push('right')
  else parts.push('center')

  return parts.join('-')  // e.g., "bottom-front-left"
}
```

## Parameter Correlation

Suggests which parameters might cause an issue:

```typescript
function correlateToParameters(
  issue: Issue,
  params: ParameterDef[],
  values: ParameterValues
): ParameterHint[] {
  const hints: ParameterHint[] = []

  if (issue.type === 'thin-wall') {
    // Look for thickness-related parameters
    const thicknessParams = params.filter(p =>
      p.name.includes('thickness') ||
      p.name.includes('wall') ||
      p.description?.toLowerCase().includes('thickness')
    )
    for (const p of thicknessParams) {
      if (values[p.name] < MIN_WALL_THICKNESS * 1.5) {
        hints.push({
          param: p.name,
          currentValue: values[p.name],
          suggestion: `Increase to at least ${MIN_WALL_THICKNESS}mm`,
          confidence: 'high'
        })
      }
    }
  }

  if (issue.type === 'overhang') {
    // Look for angle-related parameters
    const angleParams = params.filter(p =>
      p.name.includes('angle') || p.unit === '°'
    )
    // Suggest reducing angles that might cause overhangs
  }

  return hints
}
```

## Data Types

```typescript
// src/analysis/types.ts

type IssueSeverity = 'critical' | 'warning' | 'info'
type IssueType = 'thin-wall' | 'overhang' | 'small-feature' |
                 'disconnected' | 'non-manifold' | 'no-bed-contact'

interface Issue {
  type: IssueType
  severity: IssueSeverity
  message: string
  location: {
    description: string      // "bottom-front-left"
    boundingBox: BoundingBox // exact coords
  }
  details: Record<string, number | string>  // type-specific data
  parameterHints: ParameterHint[]
}

interface ParameterHint {
  param: string
  currentValue: number | string
  suggestion: string
  confidence: 'high' | 'medium' | 'low'
}

interface PrintabilityReport {
  generator: string
  parameters: ParameterValues
  timestamp: string
  issues: Issue[]
  passed: string[]           // names of checks that passed
  summary: {
    critical: number
    warnings: number
    printReady: boolean
  }
}
```

## Testing Strategy

1. **Unit tests for each check** — Test with known-problematic geometry
2. **Integration tests** — Run against existing generators at edge-case params
3. **Snapshot tests** — Ensure analysis output is stable
4. **False-positive tests** — Verify good geometry doesn't trigger warnings

```typescript
// Example test
describe('thinWalls', () => {
  it('detects wall below minimum thickness', async () => {
    const thinBox = M.Manifold.cube([10, 10, 5]).subtract(
      M.Manifold.cube([9, 9, 5]).translate([0.5, 0.5, 0])  // 0.5mm walls
    )
    const issues = detectThinWalls(thinBox, 1.2)
    expect(issues).toHaveLength(4)  // 4 thin walls
    expect(issues[0].severity).toBe('critical')
  })

  it('passes geometry with adequate walls', async () => {
    const thickBox = M.Manifold.cube([10, 10, 5]).subtract(
      M.Manifold.cube([6, 6, 5]).translate([2, 2, 0])  // 2mm walls
    )
    const issues = detectThinWalls(thickBox, 1.2)
    expect(issues).toHaveLength(0)
  })
})
```

## Checks Summary

| Check | Difficulty | Method |
|-------|------------|--------|
| Disconnected parts | Easy | `manifold.decompose()` |
| Manifold validity | Easy | Already enforced by library |
| Overhang angles | Medium | Analyze face normals vs Z-axis |
| Flat bottom for bed | Medium | Check minZ faces |
| Thin walls | Hard | Erosion via `offset()` + region comparison |
| Small features | Hard | Erosion-based detection |
