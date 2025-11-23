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
