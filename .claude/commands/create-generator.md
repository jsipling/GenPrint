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

- Minimum wall thickness: 1.2mm
- Minimum small features: 1.5mm
- Each part must be connected (single piece) - multi-part generators have multiple connected parts
- Model should sit on Z=0 for printing (lowest point at Z=0)

### Code Constraints

- `builderCode` runs as JavaScript at runtime - NO TypeScript syntax (no type annotations like `: boolean`)
- Always validate parameters with fallback defaults

### Connectivity Strategy (Critical)

**Build from solid to hollow.** Internal features (posts, bosses, ribs) must be unioned with the main body BEFORE subtracting cavities.

**Wrong approach** (creates disconnected parts):
```javascript
// 1. Create shell by subtracting cavity
var shell = outerBox.subtract(innerCavity)
// 2. Add internal features - FAILS: features float in empty space
shell = shell.add(post)
```

**Correct approach** (ensures connectivity):
```javascript
// 1. Start with solid outer shape
var solid = outerBox
// 2. Add internal features while still solid
solid = solid.add(post1).add(post2).add(rib)
// 3. THEN carve out the hollow
var shell = solid.subtract(innerCavity)
```

**Why this matters:** When you subtract a cavity first, internal features added later sit in empty space with no volumetric overlap to the shell walls or floor.

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

### Step 4: Identify Distinct Parts (Multi-Part Highlighting)

Ask the user if the model has logical components that should be **separately highlightable** when hovering:

*[Use AskUserQuestion tool:]*
"Does this model have distinct parts that should highlight separately on hover?" - Options:
- "Yes, multiple parts" - e.g., engine block + oil pan + timing cover
- "No, single piece" - The entire model highlights as one

**If multiple parts:**
- List the proposed parts (e.g., "Engine Block", "Oil Pan", "Timing Cover")
- Each part should be built separately (not unioned together)
- Each part can have its own dimensions displayed on hover

**Return format for multi-part generators:**
```javascript
return [
  {
    name: 'Part Name',
    manifold: partManifold,
    dimensions: [{ label: 'Size', param: 'size', format: '{value}mm' }],
    params: { size: 50 }
  },
  // ... more parts
]
```

### Step 5: Plan the Build Order

Determine the order of operations:
1. What is the base shape?
2. What features are added (protrusions)?
3. What features are subtracted (holes, cutouts)?
4. If multi-part: which parts are built separately vs combined?

**Review the build order with the user.**

### Step 6: Implement Incrementally

For each feature:
1. Write the test first (TDD)
2. Implement the feature
3. Run tests to verify
4. Show the user and get confirmation before moving to the next feature

**After each feature, ask: "Does this look correct? Should we proceed to the next feature?"**

### Step 7: Run Printability Analyzer

After implementation is complete, run the printability analyzer to verify the generator produces valid geometry:

```bash
npm run analyze:print <generator-id>
```

The analyzer will check for:
- **Thin walls** - Walls below 1.2mm minimum
- **Small features** - Features below 1.5mm minimum
- **Disconnected geometry** - Multiple separate components

**If the analyzer reports FAIL:**
1. Review the issues in the JSON output
2. Check `parameterCorrelations` to see which parameters may be causing problems
3. Fix the geometry issues
4. Re-run the analyzer until it returns PASS

**Test edge cases:**
```bash
# Test with minimum parameter values
npm run analyze:print <generator-id> --param=minValue

# Test with maximum parameter values
npm run analyze:print <generator-id> --param=maxValue
```

### Step 8: Final Validation

Before completing:
- [ ] All geometry is visible on the surface
- [ ] No hidden internal features
- [ ] All tests pass
- [ ] Printability analyzer returns PASS
- [ ] Geometry is connected (each part is single piece)
- [ ] Model centered for printing (lowest Z at 0)
- [ ] Description accurately describes the output
- [ ] If multi-part: each part has name, manifold, and appropriate dimensions

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
