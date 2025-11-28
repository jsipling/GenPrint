# Printability Analyzer Tool Design

## Overview

A CLI tool that functions as a **geometry unit test** for generated 3D models. Designed for agent-driven development loops where Claude Code iterates on generator code until all printability checks pass.

**Design Philosophy:** This is a CI/CD pipeline step, not a human debugging tool. Output is JSON-only, optimized for LLM context windows and direct code correlation.

## CLI Interface

```bash
# Standard analysis (JSON output only)
npm run analyze:print v8-engine

# With custom parameters
npm run analyze:print v8-engine -- --bore=50 --wallThickness=1.0

# Isolate analysis to a specific region (debugging complex parts)
npm run analyze:print v8-engine --isolate-region="10,20,-5,5,0,10"
```

## Output Schema

All output is a single JSON object. No ASCII art, no human-readable descriptions.

```typescript
interface AnalysisResult {
  status: 'PASS' | 'FAIL' | 'ERROR'

  // Global geometry stats for scale understanding
  stats: {
    volume: number              // mm³
    surfaceArea: number         // mm²
    bbox: {
      min: [number, number, number]  // [x, y, z]
      max: [number, number, number]
    }
    centerOfMass: [number, number, number]
    triangleCount: number
  }

  // Issues grouped by type (reduces repeated keys, saves tokens)
  issues: {
    thinWalls: ThinWallIssue[]
    smallFeatures: SmallFeatureIssue[]
    disconnected: DisconnectedIssue[]
  }

  // Heuristic parameter-to-issue mapping
  parameterCorrelations: ParameterCorrelation[]

  // Only present if status === 'ERROR'
  error?: {
    type: 'GEOMETRY_CRASH' | 'INVALID_INPUT' | 'TIMEOUT' | 'INTERNAL'
    message: string
    recoverable: boolean
  }
}
```

### Issue Types

```typescript
interface ThinWallIssue {
  measured: number           // Actual thickness in mm
  required: number           // Minimum required (from constants)
  bbox: BBox                 // Exact coordinates
  axisAlignment: 'X' | 'Y' | 'Z' | 'None'  // Helps identify cube() vs cylinder()
  estimatedVolume: number    // mm³ - size of the thin region
}

interface SmallFeatureIssue {
  size: number               // Smallest dimension in mm
  required: number           // Minimum for reliable printing
  bbox: BBox
  axisAlignment: 'X' | 'Y' | 'Z' | 'None'
}

interface DisconnectedIssue {
  componentCount: number     // Total disconnected parts
  components: Array<{
    volume: number
    bbox: BBox
    isFloating: boolean      // Not touching bed
  }>
}

interface BBox {
  min: [number, number, number]
  max: [number, number, number]
}
```

### Parameter Correlation

```typescript
interface ParameterCorrelation {
  parameterName: string
  currentValue: number
  correlatedIssueCount: number
  correlatedIssueTypes: string[]  // e.g., ['thinWalls', 'smallFeatures']
  suggestion: {
    action: 'increase' | 'decrease'
    targetValue: number
    confidence: 'high' | 'medium' | 'low'
    reasoning: string  // Brief explanation for agent context
  }
}
```

## Example Output

```json
{
  "status": "FAIL",
  "stats": {
    "volume": 12450.5,
    "surfaceArea": 3200.8,
    "bbox": { "min": [-25, -30, 0], "max": [25, 30, 45] },
    "centerOfMass": [0.5, -2.1, 22.3],
    "triangleCount": 4820
  },
  "issues": {
    "thinWalls": [
      {
        "measured": 0.95,
        "required": 1.2,
        "bbox": { "min": [-5, 40, 0], "max": [5, 60, 3] },
        "axisAlignment": "Z",
        "estimatedVolume": 28.5
      }
    ],
    "smallFeatures": [],
    "disconnected": null
  },
  "parameterCorrelations": [
    {
      "parameterName": "wallThickness",
      "currentValue": 1.0,
      "correlatedIssueCount": 1,
      "correlatedIssueTypes": ["thinWalls"],
      "suggestion": {
        "action": "increase",
        "targetValue": 1.3,
        "confidence": "high",
        "reasoning": "Wall at Z:0-3 measures 0.95mm, parameter controls wall generation"
      }
    }
  ]
}
```

## Error Handling

The tool must **never** output a stack trace. All failures return valid JSON.

```json
{
  "status": "ERROR",
  "stats": null,
  "issues": null,
  "parameterCorrelations": null,
  "error": {
    "type": "GEOMETRY_CRASH",
    "message": "Boolean operation failed. Likely coplanar faces or self-intersection in region X:10-15",
    "recoverable": false
  }
}
```

Error types:
- `GEOMETRY_CRASH`: Manifold operation failed (non-manifold input, coplanar faces)
- `INVALID_INPUT`: Generator not found, invalid parameters
- `TIMEOUT`: Analysis exceeded time limit
- `INTERNAL`: Unexpected error (should be rare)

## Architecture

### File Structure

```
scripts/
  analyze-print.ts           # CLI entry point
src/
  analysis/
    printabilityAnalyzer.ts  # Main orchestrator
    checks/
      manifoldValidity.ts    # Watertight checks
      connectivity.ts        # Disconnected parts
      thinWalls.ts          # Wall thickness
      smallFeatures.ts      # Feature size
    types.ts                # All TypeScript interfaces
    featureAlignment.ts     # Detect axis-aligned features
    parameterCorrelator.ts  # Map issues to parameters
    outputFormatter.ts      # JSON serialization (deterministic)
```

### Key Design Principles

1. **Reliability > Speed**: False positives cause agent regressions. Algorithms are conservative.

2. **Deterministic Output**: Issues are sorted by coordinate (X, then Y, then Z). Same input always produces identical output.

3. **Crash Safety**: All Manifold operations wrapped in try-catch. Errors become JSON responses.

4. **Token Efficiency**:
   - Group issues by type (no repeated `type` keys)
   - Use arrays not objects where possible
   - Omit null/empty fields where schema allows

5. **Code Correlation**: Output includes data that maps directly to code:
   - `axisAlignment` → helps identify `cube()` vs `cylinder()` calls
   - `normal` vectors → reveals face orientation
   - Exact `bbox` coordinates → correlate with `translate()` calls

## Analysis Algorithms

### Thin Wall Detection

```typescript
function detectThinWalls(manifold: Manifold, minThickness: number): ThinWallIssue[] {
  // Step 1: Quick volume check (cheap)
  const eroded = manifold.offset(-minThickness / 2, true)
  const originalVolume = manifold.volume()
  const erodedVolume = eroded.volume()

  if (erodedVolume >= originalVolume * 0.99) {
    eroded.delete()
    return []
  }

  // Step 2: Boolean difference to locate thin regions
  const thinParts = manifold.subtract(eroded)
  eroded.delete()

  // Step 3: Decompose and analyze each region
  const regions = thinParts.decompose()

  return regions
    .map(region => {
      const bbox = region.boundingBox()
      return {
        measured: estimateThickness(region),
        required: minThickness,
        bbox: { min: bbox.min, max: bbox.max },
        axisAlignment: detectAxisAlignment(bbox),
        estimatedVolume: region.volume(),
      }
    })
    .sort(sortByCoordinate)  // Deterministic ordering
}

function detectAxisAlignment(bbox: BBox): 'X' | 'Y' | 'Z' | 'None' {
  const dims = [
    bbox.max[0] - bbox.min[0],
    bbox.max[1] - bbox.min[1],
    bbox.max[2] - bbox.min[2],
  ]
  const minDim = Math.min(...dims)
  const maxDim = Math.max(...dims)

  // If one dimension is much smaller than others, it's aligned to that axis
  if (minDim < maxDim * 0.2) {
    const idx = dims.indexOf(minDim)
    return ['X', 'Y', 'Z'][idx] as 'X' | 'Y' | 'Z'
  }
  return 'None'
}
```

### Parameter Correlation

```typescript
function correlateParameters(
  issues: AllIssues,
  params: ParameterDef[],
  values: Record<string, number>
): ParameterCorrelation[] {
  const correlations: ParameterCorrelation[] = []

  // Thin wall correlation
  if (issues.thinWalls.length > 0) {
    const thicknessParams = params.filter(p =>
      p.name.includes('thickness') ||
      p.name.includes('wall') ||
      p.name.includes('Width')
    )

    for (const param of thicknessParams) {
      const currentVal = values[param.name]
      if (currentVal < MIN_WALL_THICKNESS * 1.2) {
        correlations.push({
          parameterName: param.name,
          currentValue: currentVal,
          correlatedIssueCount: issues.thinWalls.length,
          correlatedIssueTypes: ['thinWalls'],
          suggestion: {
            action: 'increase',
            targetValue: Math.ceil(MIN_WALL_THICKNESS * 1.1 * 10) / 10,
            confidence: 'high',
            reasoning: `Current ${currentVal}mm below minimum ${MIN_WALL_THICKNESS}mm`,
          },
        })
      }
    }
  }

  // Sort by correlation count (most impactful first)
  return correlations.sort((a, b) => b.correlatedIssueCount - a.correlatedIssueCount)
}
```

## Agent Workflow Integration

The tool is designed for iterative loops:

```
┌─────────────────────────────────────────────────────────┐
│  Agent generates/modifies generator code                │
│                        ↓                                │
│  npm run analyze:print <generator> → JSON               │
│                        ↓                                │
│  status === 'PASS' ?                                    │
│     YES → Done                                          │
│     NO  → Read parameterCorrelations                    │
│           Apply suggested fixes                         │
│           Loop back to analyze                          │
└─────────────────────────────────────────────────────────┘
```

### Debugging Complex Parts

Use `--isolate-region` to focus analysis:

```bash
# Agent reasoning: "Issues seem concentrated in the upper section"
npm run analyze:print engine --isolate-region="0,50,0,50,30,60"
```

## Testing Strategy

1. **Determinism tests**: Same input → identical JSON output (byte-for-byte)
2. **False positive tests**: Valid geometry must return `status: 'PASS'`
3. **Error handling tests**: Invalid inputs return proper error JSON, never crash
4. **Correlation accuracy tests**: Known parameter issues correctly identified

```typescript
describe('determinism', () => {
  it('produces identical output for identical input', () => {
    const result1 = analyze('test-cube', { size: 10 })
    const result2 = analyze('test-cube', { size: 10 })
    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2))
  })
})

describe('error handling', () => {
  it('returns JSON for geometry crashes', () => {
    // Self-intersecting geometry
    const result = analyze('broken-geometry', {})
    expect(result.status).toBe('ERROR')
    expect(result.error?.type).toBe('GEOMETRY_CRASH')
    expect(() => JSON.parse(JSON.stringify(result))).not.toThrow()
  })
})
```

## Implementation Priorities

| Priority | Item | Rationale |
|----------|------|-----------|
| P0 | Crash safety | Agent can't recover from stack traces |
| P0 | Deterministic output | Non-determinism confuses agent loops |
| P1 | Thin wall detection | Most common printability issue |
| P1 | Disconnected component detection | Floating parts won't print |
| P1 | Parameter correlation | Enables automated fixes |
| P2 | Small feature detection | Features below print resolution |
| P2 | --isolate-region | Debugging complex parts |
