Use `dynamicMax` and `dynamicMin` to limit parameters based on other parameter
values when physically or geometrically appropriate. This prevents invalid
configurations and improves user experience.

## dynamicMax (upper limit)
Use when a parameter can't exceed a value derived from other parameters.

Examples:
- Inner diameter limited by outer diameter (must leave wall thickness)
- Hub diameter limited by gear root diameter
- Fillet radius limited by arm length

## dynamicMin (lower limit)
Use when a parameter must be at least a value derived from other parameters.

Examples:
- Outer diameter must accommodate inner diameter + wall
- Hub diameter must fit bore diameter + wall
- Knob diameter must fit hex socket + grip features

See gear.ts, spacer.ts, and washer.ts for reference implementations.
