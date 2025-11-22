Use `dynamicMax` to limit parameters based on other parameter values when
physically or geometrically appropriate. This prevents invalid configurations
and improves user experience.

Examples:
- Hub diameter limited by gear root diameter
- Bore diameter limited by outer dimensions
- Teeth count limited by module size

See gear.ts for reference implementations.
