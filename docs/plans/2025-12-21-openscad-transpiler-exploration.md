# OpenSCAD Transpiler Exploration Findings

**Date:** 2025-12-21
**Status:** Exploration Complete
**Purpose:** Investigate codebase architecture for implementing OpenSCAD to Manifold-3D transpiler

---

## 1. How Does the Current AI to Manifold Code Generation Work?

### Current Architecture Flow

```
User Sketch + Prompt
        |
        v
+-----------------------------------+
|   imageToGeometryService.ts       |
|   - Sends image + prompt to Gemini|
|   - Receives JSON with builderCode|
|   - Validates JavaScript syntax   |
|   - Auto-retries on syntax errors |
+-----------------------------------+
        |
        v (returns GeometryAnalysis)
+-----------------------------------+
|   useImageToModel.ts / hook       |
|   - Sends builderCode to worker   |
+-----------------------------------+
        |
        v (via postMessage)
+-----------------------------------+
|   manifold.worker.ts              |
|   - Executes builder code         |
|   - Returns MeshData for Three.js |
+-----------------------------------+
```

### Key Files and Their Roles

| File | Purpose |
|------|---------|
| `/src/services/imageToGeometryService.ts` | AI service that analyzes images, generates builder code, validates syntax, handles retries |
| `/src/prompts/manifoldBuilder.prompt.md` | Prompt template with Manifold-3D API reference |
| `/src/workers/manifold.worker.ts` | Executes builder code in sandboxed context with Manifold-3D |
| `/src/workers/types.ts` | TypeScript interfaces for worker communication |
| `/src/services/imageToGeometryTypes.ts` | Types for geometry analysis request/response |

### Builder Code Execution in Worker

The worker executes builder code via `new Function()`:

```typescript
// From manifold.worker.ts executeUserBuilder()
const fn = new Function(
  'M',                    // ManifoldToplevel
  'cq',                   // CadQuery factory
  'MIN_WALL_THICKNESS',   // Printing constant
  'MIN_FEATURE_SIZE',     // Printing constant
  'params',               // User parameters
  `
    ${builderCode}
  `
)

const result = fn(M, cq, MIN_WALL_THICKNESS, MIN_FEATURE_SIZE, params)
```

### Expected Return Types

Builder code must return one of:
1. **Single Manifold** - `M.Manifold.cube([10,10,10])`
2. **Workplane** - `cq.Workplane('XY').box(10,10,10)` (extracts via `.val()`)
3. **Named Parts Array** - `[{ name: 'Part', manifold: M.Manifold.cube([10,10,10]) }]`

---

## 2. Where Should the OpenSCAD Parser and Transpiler Live?

### Recommended Structure

```
src/
  openscad/
    index.ts              # Public exports (parse, transpile, OpenSCADError)
    types.ts              # AST node types, token types
    errors.ts             # OpenSCADParseError, OpenSCADTranspileError
    Lexer.ts              # Tokenizer for OpenSCAD
    Parser.ts             # Recursive descent parser -> AST
    Transpiler.ts         # AST -> Manifold JavaScript code
    __tests__/
      Lexer.test.ts
      Parser.test.ts
      Transpiler.test.ts
      integration.test.ts  # End-to-end OpenSCAD -> Manifold tests
```

### Rationale

1. **Parallel to `/src/cadquery/`** - Follows existing pattern for domain-specific modules
2. **Clear separation of concerns** - Lexer, Parser, Transpiler are distinct phases
3. **Testable in isolation** - Each component can be unit tested independently
4. **Does not modify worker** - Transpilation happens before sending to worker

### Integration Point

The transpiler will be called from `imageToGeometryService.ts`:

```typescript
// Proposed flow in imageToGeometryService.ts
import { transpileOpenSCAD, OpenSCADParseError } from '../openscad'

// After receiving OpenSCAD from AI:
try {
  const manifoldCode = transpileOpenSCAD(openscadCode, { fn: 32 })
  // Validate and proceed with manifoldCode
} catch (err) {
  if (err instanceof OpenSCADParseError) {
    // Retry with parse error context
  }
}
```

---

## 3. What Changes Are Needed to the AI Prompt Template?

### Current Prompt Location
`/src/prompts/manifoldBuilder.prompt.md`

### Proposed Changes

**Option A: Separate OpenSCAD Prompt Template**

Create `/src/prompts/openscadBuilder.prompt.md`:

```markdown
You are a 3D modeling expert that converts images into OpenSCAD code.

## Your Task
1. **Describe** what you see
2. **Generate** OpenSCAD code using ONLY the supported subset
3. **Extract** configurable parameters
4. **Name** the model appropriately

## Supported OpenSCAD Subset

### Primitives
- `cube([x, y, z], center=false)`
- `sphere(r, $fn=32)`
- `cylinder(h, r1, r2, center=false, $fn=32)`
- `circle(r, $fn=32)` - for 2D (must extrude)
- `square([x, y], center=false)` - for 2D
- `polygon(points)` - for 2D

### Transformations
- `translate([x, y, z])`
- `rotate([x, y, z])`
- `scale([x, y, z])` or `scale(factor)`
- `mirror([x, y, z])`

### Boolean Operations
- `union() { ... }`
- `difference() { ... }`
- `intersection() { ... }`

### Extrusion
- `linear_extrude(height, center=false, twist=0, slices=1, scale=1)`
- `rotate_extrude(angle=360, $fn=32)`

### Special Variables
- `$fn` - Fragment number (clamped to 16-128, default 32)

## IMPORTANT Limitations
- No `for` loops (expand manually)
- No `if/else` conditionals
- No modules or functions
- No `hull()` or `minkowski()`
- No `import()` or `use`
- No variables (use parameters directly)
...
```

**Option B: Model-Selectable Prompt Switching**

Modify `imageToGeometryService.ts` to accept a format flag:

```typescript
type OutputFormat = 'manifold' | 'openscad'

function createImageToGeometryService(
  apiKey: string,
  modelId: GeometryModelId,
  outputFormat: OutputFormat = 'manifold'
)
```

### Recommendation

Start with **Option A** (separate prompt) for clarity. The service can later support both formats.

---

## 4. How Does the Manifold Worker Execute Builder Code?

### Worker Interface

From `/src/workers/types.ts`:

```typescript
interface BuildRequest {
  type: 'build'
  id: number
  builderCode: string           // JavaScript code string
  params: ParameterValues       // { width: 50, height: 20, ... }
  circularSegments: number      // Quality setting (maps to $fn)
}

interface BuildResponse {
  type: 'build-result'
  id: number
  success: boolean
  meshData?: MeshData           // Positions, normals, indices
  boundingBox?: BoundingBox
  parts?: NamedPart[]           // For multi-part models
  error?: string
  timing?: number
}
```

### Transpiler Output Requirements

The transpiler must produce JavaScript code that:

1. **Uses only available variables**: `M`, `cq`, `MIN_WALL_THICKNESS`, `MIN_FEATURE_SIZE`, `params`
2. **Returns valid Manifold object** (or array of named parts)
3. **Uses Manifold-3D API correctly** (see `/src/prompts/manifoldBuilder.prompt.md`)

### Example Transpilation

**OpenSCAD Input:**
```openscad
$fn = 32;
difference() {
  cube([50, 50, 20], center=true);
  cylinder(h=25, r=10, center=true);
}
```

**Expected Manifold JavaScript Output:**
```javascript
const box = M.Manifold.cube([50, 50, 20], true);
const hole = M.Manifold.cylinder(25, 10, 10, 32, true);
const result = box.subtract(hole);
return result;
```

### Circular Segments Handling

Worker sets segments globally before execution:
```typescript
manifoldModule.setCircularSegments(circularSegments)
```

The transpiler should:
1. Extract `$fn` from OpenSCAD code
2. Clamp to 16-128 range (default 32)
3. Pass individual segment counts to cylinder/sphere calls

---

## 5. What Existing Patterns Can We Reuse?

### Retry Logic with Error Context

From `imageToGeometryService.ts`:

```typescript
const MAX_RETRIES = 2

while (retryCount <= MAX_RETRIES) {
  const result = await callGeminiApi(request, previousError)

  if (result.success) {
    return { success: true, analysis: result.analysis }
  }

  // Only retry on code validation errors
  if (result.isCodeValidationError && retryCount < MAX_RETRIES) {
    retryCount++
    previousError = result.error  // Pass error context to next attempt
    continue
  }

  return { success: false, error: result.error }
}
```

**Apply to OpenSCAD:** Parse errors become `isCodeValidationError` triggers for retry.

### Code Validation Pattern

```typescript
function validateBuilderCode(code: string): { valid: boolean; error?: string } {
  try {
    new Function('M', ...BUILDER_RESERVED_CONSTANTS, 'params', code)
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unknown syntax error'
    }
  }
}
```

**Apply to OpenSCAD:** Add OpenSCAD parse validation before transpilation.

### Error Context in Prompts

```typescript
function buildErrorContext(previousError: string | undefined): string {
  if (!previousError) return ''

  return `
## IMPORTANT: Previous Attempt Failed

Your previous code had this error: "${previousError}"

Please fix this error in your new response. Common issues:
- ...
`
}
```

**Apply to OpenSCAD:** Include line/column info from parse errors.

### Error Class Hierarchy (from `/src/cadquery/errors.ts`)

```typescript
export class CadQueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CadQueryError'
  }
}

export class SelectorError extends CadQueryError { ... }
export class GeometryError extends CadQueryError { ... }
```

**Apply to OpenSCAD:**
```typescript
export class OpenSCADError extends Error { ... }
export class OpenSCADParseError extends OpenSCADError {
  line: number
  column: number
  found: string
  expected: string[]
}
export class OpenSCADTranspileError extends OpenSCADError { ... }
```

---

## 6. Edge Cases and Failure Modes

### Parser Edge Cases

| Case | Handling |
|------|----------|
| Nested boolean operations | Track depth, generate temp variables |
| Chained transformations | Apply in correct order (inner-to-outer) |
| Empty blocks `union() {}` | Return empty/no-op |
| Unsupported `$fn` values | Clamp to [16, 128] |
| 2D operations without extrude | Error: "2D shapes must be extruded" |
| Negative dimensions | Pass through (Manifold handles) |
| Missing semicolons | Parser should be lenient or report clearly |
| Trailing commas | Accept for robustness |
| Comments `//` and `/* */` | Strip during lexing |

### Transpilation Edge Cases

| Case | Handling |
|------|----------|
| `cube(10)` (single number) | Convert to `cube([10, 10, 10])` |
| `cylinder(h=10, d=5)` | Convert diameter to radius |
| `scale(2)` | Convert to `scale([2, 2, 2])` |
| `rotate_extrude()` + profile | Ensure profile passes through Y-axis |
| `linear_extrude(twist=...)` | Map to Manifold's `twistDegrees` param |
| `center=true` for 2D | Handle for `square` and `circle` |

### AI Generation Failure Modes

| Mode | Mitigation |
|------|------------|
| Unsupported OpenSCAD features | Include "NOT SUPPORTED" list in prompt |
| Variables used | Prompt: "No variables, use params['name']" |
| Loops/conditionals | Prompt: "Expand manually, no control flow" |
| Missing required extrusion | Prompt: "All 2D must be extruded" |
| Invalid polygon (< 3 points) | Parser error with helpful message |

### Runtime Failure Modes

| Mode | Mitigation |
|------|------------|
| Generated code has JS syntax error | Validate with `new Function()` before sending to worker |
| Manifold operation fails | Worker catches and returns error |
| Zero-volume result | Check `manifold.isEmpty()` before returning |

---

## 7. Testing Approach

### Test Structure (Vitest)

Following existing patterns from `/src/cadquery/__tests__/` and `/src/services/imageToGeometryService.test.ts`:

```
src/openscad/__tests__/
  Lexer.test.ts          # Token generation tests
  Parser.test.ts         # AST structure tests
  Transpiler.test.ts     # Code generation tests
  integration.test.ts    # Full pipeline tests
  fixtures/              # Sample OpenSCAD files
    simple-cube.scad
    boolean-operations.scad
    extrusion.scad
    parameters.scad
```

### Lexer Tests

```typescript
describe('Lexer', () => {
  it('tokenizes primitives', () => {
    const tokens = lex('cube([10, 20, 30]);')
    expect(tokens).toEqual([
      { type: 'IDENTIFIER', value: 'cube', line: 1, column: 1 },
      { type: 'LPAREN', value: '(', line: 1, column: 5 },
      { type: 'LBRACKET', value: '[', line: 1, column: 6 },
      { type: 'NUMBER', value: '10', line: 1, column: 7 },
      // ...
    ])
  })

  it('handles $fn special variable', () => { ... })
  it('skips comments', () => { ... })
  it('reports error position for invalid characters', () => { ... })
})
```

### Parser Tests

```typescript
describe('Parser', () => {
  it('parses cube primitive', () => {
    const ast = parse('cube([10, 20, 30], center=true);')
    expect(ast).toEqual({
      type: 'Program',
      statements: [{
        type: 'PrimitiveCall',
        name: 'cube',
        args: {
          size: [10, 20, 30],
          center: true
        }
      }]
    })
  })

  it('parses nested boolean operations', () => { ... })
  it('parses transformation chains', () => { ... })
  it('throws OpenSCADParseError with position for invalid syntax', () => { ... })
})
```

### Transpiler Tests

```typescript
describe('Transpiler', () => {
  it('transpiles cube to Manifold code', () => {
    const ast = parse('cube([10, 20, 30], center=true);')
    const code = transpile(ast)
    expect(code).toContain('M.Manifold.cube([10, 20, 30], true)')
    expect(code).toContain('return')
  })

  it('transpiles difference with correct operand order', () => {
    const ast = parse('difference() { cube([10,10,10]); cylinder(h=10, r=3); }')
    const code = transpile(ast)
    // First child is base, rest are tools
    expect(code).toContain('.subtract(')
  })
})
```

### Integration Tests

```typescript
describe('OpenSCAD to Manifold integration', () => {
  let M: ManifoldToplevel

  beforeAll(async () => {
    M = await getManifold()
  })

  it('produces valid Manifold from simple cube', () => {
    const scad = 'cube([50, 50, 20], center=true);'
    const code = transpileOpenSCAD(scad)

    // Execute in same context as worker
    const fn = new Function('M', 'params', code)
    const result = fn(M, {})

    expect(result.isEmpty()).toBe(false)
    const bbox = result.boundingBox()
    expect(bbox.max[0] - bbox.min[0]).toBeCloseTo(50, 1)

    result.delete()
  })

  it('handles $fn parameter correctly', () => {
    const scad = 'sphere(r=10, $fn=64);'
    const code = transpileOpenSCAD(scad)
    expect(code).toContain('64')  // Should use explicit segment count
  })
})
```

### Error Message Tests

```typescript
describe('Error messages', () => {
  it('provides helpful parse error for unsupported feature', () => {
    expect(() => parse('for (i = [0:10]) cube([i, i, i]);'))
      .toThrow(OpenSCADParseError)

    try {
      parse('for (i = [0:10]) cube([i, i, i]);')
    } catch (e) {
      expect(e.message).toContain('for loops are not supported')
      expect(e.line).toBe(1)
    }
  })
})
```

---

## Summary of Findings

### Architecture Decision Points

1. **Transpilation Location:** Before worker, in `imageToGeometryService.ts` or dedicated hook
2. **AST Design:** Simple tree structure sufficient for supported subset
3. **Error Handling:** Rich parse errors with line/column for retry context

### Reusable Components

- Retry logic from `imageToGeometryService.ts`
- Error class hierarchy from `cadquery/errors.ts`
- Code validation pattern with `new Function()`
- Test structure from existing `__tests__` directories

### Critical Success Factors

1. **Limited Scope:** Only support documented OpenSCAD subset
2. **Clear Errors:** Parse errors must be actionable for AI retry
3. **Correct Mapping:** Manifold API differs slightly from OpenSCAD (e.g., `cylinder` params)
4. **$fn Handling:** Respect but clamp segment counts

### Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| AI generates unsupported OpenSCAD | High | Strong "NOT SUPPORTED" list in prompt |
| Complex nested transformations | Medium | Thorough test suite |
| Polygon winding order issues | Low | Test with manifold validation |
| Performance for complex models | Low | Transpilation is string manipulation |

---

## Next Steps (Not Implementation Plan)

This exploration answers the investigation questions. When ready to implement:

1. Design AST node types for supported subset
2. Define token types for lexer
3. Write parser grammar (recursive descent)
4. Map OpenSCAD operations to Manifold API
5. Create AI prompt template for OpenSCAD output
6. Integrate transpiler with existing retry logic

**DO NOT PROCEED TO IMPLEMENTATION UNTIL PLAN IS APPROVED**
