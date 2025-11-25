Use Test Driven Development

The terminology used in this app should be that of a 3D Model Engineer.

We should always strive to keep things simple and clean.  Implementing new
features properly instead of tacking them on.  Always consider refactoring if it
helps us achieve these goals better.

## 3D Printing Optimization

All geometry must be optimized for FDM 3D printing:

- **Minimum wall thickness:** 1.2mm (never below for structural parts)
- **Corner segments:** 8 per 90° arc for 4mm radius (~0.03mm deviation)
- **Small features:** Minimum 1.5mm for reliable printing
- **Hole cylinders:** 16 segments for smooth circles
- **Batch CSG operations:** Union/subtract multiple shapes at once, not sequentially
- **Tooth/gear profiles:** Minimum 1mm thickness at pitch circle

The exported STL must be printable - preview rendering uses the same geometry.

### Segment Count Rationale

- **Corners (8 per 90°):** At 4mm radius, yields ~0.03mm deviation—below FDM nozzle precision (~0.4mm). More segments waste triangles without visible improvement.
- **Holes (16 segments):** Holes must be round for mechanical fit (shafts, bearings, screws). Flat spots cause binding. Higher count ensures smooth rotation.
- **Rule of thumb:** Structural approximations use fewer segments; functional/visible surfaces use more.

## Geometry Validity

All generated geometry must be manifold (watertight):

- No self-intersecting faces
- No holes or gaps in the mesh
- No degenerate triangles (zero area)
- Use `expectValid()` in tests to verify manifold status
- Manifold library enforces this—if a CSG operation produces invalid geometry, fix the inputs rather than working around it

## Precision & Tolerance

- **Vertex precision:** 0.001mm is sufficient. FDM resolution is ~0.1mm layer height, so finer precision is noise.
- **Coordinate values:** Avoid unnecessarily precise floats (e.g., prefer `5` over `4.999999`).
- **Comparison tolerance:** When comparing distances, use 0.01mm epsilon—smaller differences are below print resolution.

## Error Handling

Parameter validation strategy:

1. **UI layer:** Use `dynamicMin`/`dynamicMax` to prevent invalid inputs before they reach builders
2. **Builder layer:** Silently clamp out-of-range values to safe defaults—always produce valid geometry
3. **Dev warnings:** Use `console.warn` in dev mode for edge cases that may cause print issues (e.g., thin walls)
4. **Never throw:** Builders should never throw exceptions for parameter issues. Invalid input → valid fallback geometry.
