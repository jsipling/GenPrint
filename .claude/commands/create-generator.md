# Generator Creation Prompt

You are creating a new 3D model generator for GenPrint, an app that creates printable 3D models. Walk through the creation process step by step with the user, asking questions when decisions need to be made.

**IMPORTANT:** When asking the user questions, ALWAYS use the `AskUserQuestion` tool to present choices. This provides a better UX with clickable options. Structure questions with clear options (2-4 choices) and descriptions for each.

You are creating a generator for: $ARGUMENTS

## Core Rules

### Visible Geometry Only

This app generates models for 3D printing. **Only create geometry that is visible on the printed model.**

- If a feature wouldn't be visible on the surface of the printed part, don't create it
- Never add geometry just to make something "visible" - if the real-world object has a flat surface, model it as flat
- Holes, bores, and cutouts ARE visible features (they affect the surface)
- Don't model internal features hidden inside solid walls
- Reference real objects: only include features visible on the actual part's exterior

**Before creating any feature, ask yourself: "Would this be visible on the printed model?"**

### 3D Printing Constraints

- **Flat base required:** Model must have a flat bottom surface at Z=0 to sit on the print bed
- **No floating geometry:** All parts must connect to the base—no mid-air or disconnected sections
- Minimum wall thickness: 1.2mm
- Minimum small features: 1.5mm
- All geometry must be connected (single piece)
- Model should be centered on Z=0 for printing

### Code Constraints

- `builderCode` runs as JavaScript at runtime - NO TypeScript syntax (no type annotations like `: boolean`)
- Always validate parameters with fallback defaults

### Use the Geo Library

Generators use the geo library via the `geo` context in builderCode:

```javascript
// In builderCode - geo is provided by the worker sandbox

// Create shapes (centered at origin)
var base = geo.shape.box({ width: 50, depth: 50, height: 10 })
var hole = geo.shape.cylinder({ diameter: 5, height: 20 })

// Transform methods
hole.translate(0, 0, 5)  // Move in X, Y, Z
hole.rotate(90, 0, 0)    // Rotate in degrees (Euler XYZ)

// Semantic alignment
hole.align({ self: 'center', target: base, to: 'center' })

// Boolean operations
var part = base.subtract(hole)

// Return the Shape - worker auto-compiles to Manifold
return part
```

Key features:
- **Primitives:** `geo.shape.box({ width, depth, height })`, `geo.shape.cylinder({ diameter, height })`
- **Transforms:** `.translate(x, y, z)`, `.rotate(rx, ry, rz)` - chainable
- **Semantic anchors:** `top`, `bottom`, `left`, `right`, `front`, `back`, `center`, corners
- **Alignment modes:** `mate` (face-to-face), `flush` (parallel)
- **Boolean ops:** `.union(other)`, `.subtract(other)`, `.intersect(other)`
- **Patterns:** `geo.linearPattern(shape, count, spacing, 'x'|'y'|'z')`, `geo.circularPattern(shape, count, radius, 'x'|'y'|'z')`
- **No memory management:** Worker handles `.delete()` automatically

## Creation Process

Walk through these steps with the user. **Stop and ask questions when decisions are needed.**

### Step 1: Understand the Object

Ask the user:
1. What real-world object are we modeling?
2. What is the primary purpose of this model? (display, functional, educational)
3. What size range should it support?

Research or discuss what the object looks like in real life. Identify which features are **visible on the exterior surface**.

### Step 2: List Visible Features

Create a list of features that would be visible on the printed model. For each potential feature, ask:
- Is this visible on the surface of the real object?
- Does this affect the exterior shape?

**Present the list to the user and ask them to confirm or modify it.**

Example for a V8 engine block:
- Cylinder banks (visible V-shape) ✓
- Cylinder bores (visible holes in deck) ✓
- Oil pan (visible exterior shape) ✓
- Head bolt holes (visible holes in deck) ✓
- Internal water passages (NOT visible) ✗
- Internal oil galleries (NOT visible) ✗

### Step 3: Define Parameters

For each adjustable dimension, ask the user:
1. Should this be user-adjustable?
2. What are sensible min/max values?
3. What's a good default?

**Present proposed parameters and get user approval before proceeding.**

### Step 4: Plan the Build Order

Determine the order of operations:
1. What is the base shape?
2. What features are added (protrusions)?
3. What features are subtracted (holes, cutouts)?

**Review the build order with the user.**

### Step 5: Implement Incrementally

For each feature:
1. Write the test first (TDD)
2. Implement the feature
3. Run tests to verify
4. Show the user and get confirmation before moving to the next feature

**After each feature, ask: "Does this look correct? Should we proceed to the next feature?"**

### Step 6: Final Validation

Before completing:
- [ ] All geometry is visible on the surface
- [ ] No hidden internal features
- [ ] All tests pass
- [ ] Geometry is connected (single piece)
- [ ] Model centered for printing
- [ ] Description accurately describes the output

## Decision Points

Always stop and ask the user using the `AskUserQuestion` tool when:

1. **Feature inclusion**: "Should the model include [feature]?" with options like "Yes - include it", "No - omit it", "Simplified version"

2. **Parameter ranges**: "What range should [parameter] have?" with preset options or allow custom input

3. **Design tradeoffs**: Present options A and B with descriptions of trade-offs

4. **Realism vs simplicity**: "How detailed should [feature] be?" with options like "Detailed", "Simplified", "Omit"

5. **After each major feature**: "Does [feature] look correct?" with options like "Yes, continue", "Needs adjustment", "Remove it"

## Example Flow

**User**: Create a generator for a gear

**Assistant**: I'll help you create a gear generator. Let me walk through this step by step.

*[Uses AskUserQuestion tool with two questions:]*
1. "What type of gear?" - Options: "Spur gear (straight teeth)", "Helical gear (angled teeth)", "Bevel gear (conical)"
2. "What's the primary purpose?" - Options: "Functional (must mesh)", "Decorative (visual only)"

**User selects**: Spur gear, Decorative

**Assistant**: Got it - a decorative spur gear. For a decorative gear, we can simplify the tooth profile while keeping the visual appearance.

For a spur gear, these features are visible on the surface:
1. Gear teeth (the main visual feature)
2. Center bore (hole for shaft)
3. Hub (raised center section) - optional
4. Spokes or solid web (connects hub to teeth)

*[Uses AskUserQuestion tool:]*
1. "Web style?" - Options: "Solid web", "Spokes (4)", "Spokes (6)"
2. "Hub style?" - Options: "Flush with web", "Protruding hub"

**User selects**: Solid web, Flush

**Assistant**: Perfect. So we'll have: teeth around the perimeter, solid web, center bore, no protruding hub.

I propose these user-adjustable parameters:

| Parameter | Min | Max | Default | Description |
|-----------|-----|-----|---------|-------------|
| Module | 1 | 5 | 2 | Tooth size (mm) |
| Teeth | 8 | 60 | 20 | Number of teeth |
| Width | 3 | 30 | 10 | Gear thickness (mm) |
| Bore | 2 | 20 | 6 | Center hole diameter (mm) |

*[Uses AskUserQuestion tool:]*
"Do these parameters look right?" - Options: "Yes, proceed", "Add more parameters", "Adjust ranges"

*[Continue iteratively...]*
