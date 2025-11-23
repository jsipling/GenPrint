# Bug Hunt Report - 2025-11-23

Comprehensive bug analysis across GenPrint codebase covering geometry builders, UI components, parameter validation, and worker integration.

## Critical Bugs (Must Fix)

### Geometry Issues

| Status | Bug | File | Line | Issue |
|--------|-----|------|------|-------|
| [ ] | Hook L-shape overlap | `hookBuilder.ts` | 28-38 | Back plate and hook arm overlap at origin instead of forming clean L-shape - creates non-manifold geometry |
| [ ] | ThumbKnob hex socket | `thumbKnobBuilder.ts` | 146-147 | Hex socket extends below z=0, creating geometry outside expected bounds |
| [ ] | ThumbKnob through hole gap | `thumbKnobBuilder.ts` | 155-156 | Gap between hex socket and through hole creates thin wall violating 1.2mm minimum |

### Parameter Validation

| Status | Bug | File | Line | Issue |
|--------|-----|------|------|-------|
| [ ] | Bracket rib_thickness | `bracket.ts` | 73 | Min is 1mm but AGENTS.md requires 1.2mm minimum |
| [ ] | Bracket fillet_radius | `bracket.ts` | 43-49 | Can exceed bracket width, creating impossible geometry |
| [ ] | Hook hole_diameter | `hook.ts` | 35-43 | Can exceed thickness (8mm hole in 4mm thickness) |

### Worker/Async

| Status | Bug | File | Line | Issue |
|--------|-----|------|------|-------|
| [ ] | Promise never rejected | `useManifold.ts` | 246-270 | Build errors resolve to `null` instead of rejecting - breaks error handling semantics |
| [ ] | Worker init failure silent | `manifold.worker.ts` | 68-70 | WASM init failure not communicated - UI hangs forever on "loading" |

## High Severity Bugs

### Geometry/Printing Constraints

| Status | Bug | File | Line | Issue |
|--------|-----|------|------|-------|
| [ ] | Spacer wall thickness | `spacerBuilder.ts` | 24-26 | Allows 1mm walls, below 1.2mm AGENTS.md minimum |
| [ ] | Washer wall thickness | `washerBuilder.ts` | 24-26 | Same issue - allows 1mm walls |
| [ ] | SignBuilder coordinates | `signBuilder.ts` | 29 | Non-rounded rectangles use absolute coords while rounded use centered - causes misalignment |
| [ ] | GearBuilder bore height | `gearBuilder.ts` | 249 | Bore can extend beyond gear+hub height, creating non-manifold geometry |
| [ ] | Box corner_radius vs height | `box.ts` | 38-45 | Corner radius can exceed box height (21mm radius on 10mm tall box) |

### UI/React Issues

| Status | Bug | File | Line | Issue |
|--------|-----|------|------|-------|
| [ ] | Material memory leak | `Viewer.tsx` | 181-182 | `meshLambertMaterial` recreated every render without disposal - GPU memory leak |
| [ ] | Missing error boundary | `App.tsx` | top level | No error boundary wrapping app - crashes unrecoverable |
| [ ] | Params race condition | `App.tsx` | 168 | Missing `params` dependency - parameter changes before WASM init are lost |

### Worker Issues

| Status | Bug | File | Line | Issue |
|--------|-----|------|------|-------|
| [ ] | Runtime errors not propagated | `useManifold.ts` | 158-161 | Worker crashes during builds hang promises indefinitely |
| [ ] | Superseded builds leak | `useManifold.ts` | 239-241 | Handlers not cleaned up when builds superseded - memory leak |

## Medium Severity Bugs

| Status | Bug | File | Line | Issue |
|--------|-----|------|------|-------|
| [ ] | Sequential CSG | `boxBuilder.ts` | 140-143 | Dividers added sequentially, violates AGENTS.md batch rule |
| [ ] | Box lid clearance | `boxBuilder.ts` | 193-200 | Lid inner cavity same as box - no clearance for fit |
| [ ] | Bracket hole positions | `bracketBuilder.ts` | 113-114 | No validation holes stay within arm bounds |
| [ ] | StrokeFont dots | `strokeFont.ts` | 181-186 | Potential duplicate dots for punctuation |
| [ ] | Viewer FileReader cleanup | `Viewer.tsx` | 250-311 | Missing cleanup when `stlBlob` becomes null |
| [ ] | Geometry disposal timing | `Viewer.tsx` | 237-240 | Disposed during possible active render |
| [ ] | No build timeout | `useManifold.ts` | - | No timeout for hung worker builds |
| [ ] | Bracket hole overlap | `bracket.ts` | 53-62 | 10 holes on 15mm arm = overlapping holes |

## Low Severity Bugs

| Status | Bug | File | Issue |
|--------|-----|------|-------|
| [ ] | Finger grip edge case | `boxBuilder.ts` | Degenerate shapes with tiny boxes |
| [ ] | Knurled profile robustness | `thumbKnobBuilder.ts` | Edge cases in knurl calculation |
| [ ] | Gear tip_sharpness | `gear.ts` | Can create fragile teeth without warning |
| [ ] | Washer inner range misleading | `washer.ts` | UI shows max 90mm but actual is dynamic |
| [ ] | Grid recalculation | `Viewer.tsx` | Unnecessary function call every render |

## Summary

| Priority | Count |
|----------|-------|
| Critical | 8 |
| High | 10 |
| Medium | 8 |
| Low | 5 |
| **Total** | **31** |

## Verification Notes

These bugs were identified through static analysis. Before fixing, each should be verified by:
1. Reading the actual code to confirm the issue exists
2. Writing a failing test that demonstrates the bug
3. Fixing the bug and ensuring the test passes

## Recommended Fix Order

1. **Critical geometry bugs** - hookBuilder, thumbKnobBuilder (invalid STLs)
2. **Critical async bugs** - worker init failure, promise rejection (system hangs)
3. **High UI bugs** - material leak, error boundary (memory/stability)
4. **High constraint violations** - wall thickness minimums (printability)
5. **Medium/Low** - as time permits
