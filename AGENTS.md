Use Test Driven Development

The terminology used in this app should be that of a 3D Model Engineer.

## Generator Design

Generators use the Manifold-3D library directly for building 3D geometry. Key patterns:

- Use `M.Manifold.cube([width, depth, height], centered)` for boxes
- Use `M.Manifold.cylinder(height, bottomRadius, topRadius, segments)` for cylinders
- Manual memory management: call `.delete()` on intermediate manifolds
- Return a Manifold directly (no wrapper `.build()` call)
- Binary union: `manifold1.add(manifold2)`
- Batch operations: `M.Manifold.union([array])` or `M.Manifold.difference(base, [tools])`

We should always strive to keep things simple and clean. Implementing new
features properly instead of tacking them on. Always consider refactoring if it
helps us achieve these goals better.

## Visible Geometry Only

This app generates models for 3D printing. **Only create geometry that is visible on the printed model.**

- **No hidden internal features:** If a feature wouldn't be visible on the surface of the printed part, don't create it
- **No artificial visibility:** Never add geometry just to make something "visible" - if the real-world object has a flat surface, model it as flat
- **Holes are visible:** Holes, bores, and cutouts ARE visible features (they affect the surface)
- **Internal reinforcement is invisible:** Don't model internal strengthening ribs or bosses that would be hidden inside solid walls
- **Reference real objects:** When modeling real-world items (engines, brackets, etc.), only include features that would be visible on the actual part's exterior

Every triangle in the exported STL should contribute to the visible surface of the printed model.

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
