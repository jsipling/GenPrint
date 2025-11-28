# Generator Update Prompt

You are updating an existing 3D model generator for GenPrint. Walk through the update process step by step with the user, asking questions when decisions need to be made.

**IMPORTANT:** When asking the user questions, ALWAYS use the `AskUserQuestion` tool to present choices. This provides a better UX with clickable options. Structure questions with clear options (2-4 choices) and descriptions for each.

The generator to update is: $ARGUMENTS

## Initial Steps

1. **Read the generator file** - Find and read the generator file matching the argument (check `src/generators/*.generator.ts`)
2. **Read AGENTS.md** - Review the guidelines in `AGENTS.md` for generator patterns and the geo library API
3. **Summarize the current generator** - Present to the user:
   - Generator ID, name, and description
   - Current parameters
   - Current features (what the builderCode does)
   - Display dimensions

## Core Rules

### Visible Geometry Only

This app generates models for 3D printing. **Only create geometry that is visible on the printed model.**

- If a feature wouldn't be visible on the surface of the printed part, don't create it
- Never add geometry just to make something "visible" - if the real-world object has a flat surface, model it as flat
- Holes, bores, and cutouts ARE visible features (they affect the surface)
- Don't model internal features hidden inside solid walls
- Reference real objects: only include features visible on the actual part's exterior

**Before adding any feature, ask yourself: "Would this be visible on the printed model?"**

### 3D Printing Constraints

- Minimum wall thickness: 1.2mm
- Minimum small features: 1.5mm
- All geometry must be connected (single piece)
- Model should be centered on Z=0 for printing

### Code Constraints

- `builderCode` runs as JavaScript at runtime - NO TypeScript syntax (no type annotations like `: boolean`)
- Always validate parameters with fallback defaults
- Use `dynamicMin`/`dynamicMax` when parameters depend on each other

### Use the Geo Library

For new features, prefer the `src/geo/` library for declarative geometry:

```typescript
import { shape, Compiler } from './geo';

// Named parameters only
const base = shape.box({ width: 50, depth: 50, height: 10 });
const hole = shape.cylinder({ diameter: 5, height: 20 });

// Semantic alignment (replaces translate/rotate)
hole.align({ self: 'center', target: base, to: 'center' });

// Boolean operations
const part = base.subtract(hole);

// Compile to Manifold
const compiler = new Compiler(M);
const manifold = compiler.compile(part.getNode());
```

Key features:
- **Semantic anchors:** `top`, `bottom`, `left`, `right`, `front`, `back`, `center`, corners
- **Alignment modes:** `mate` (face-to-face), `flush` (parallel)
- **No memory management:** Compiler handles `.delete()` internally

## Update Process

### Step 1: Understand the Request

After presenting the current generator summary, ask the user:

*[Use AskUserQuestion tool:]*
1. "What would you like to update?" - Options: "Add new feature", "Modify existing feature", "Add/change parameter", "Fix a bug", "Other"

### Step 2: Clarify the Change

Based on the user's selection, gather more details:

**For "Add new feature":**
- Ask what feature they want to add
- Confirm the feature is visible on the exterior surface
- Discuss how it integrates with existing geometry

**For "Modify existing feature":**
- Present list of current features
- Ask which one to modify
- Ask what the modification should be

**For "Add/change parameter":**
- Ask what parameter to add/change
- Discuss appropriate min/max/default values
- Check if it needs `dynamicMin`/`dynamicMax` constraints

**For "Fix a bug":**
- Ask for bug description
- Investigate the issue in the code

### Step 3: Plan the Change

Present a clear plan:
1. What will be modified
2. What tests need to be written/updated
3. Impact on existing functionality

*[Use AskUserQuestion tool:]*
"Does this plan look correct?" - Options: "Yes, proceed", "Needs adjustment", "Cancel"

### Step 4: Implement with TDD

For each change:
1. Write or update the test first
2. Run tests to see them fail (if new functionality)
3. Implement the change
4. Run tests to verify
5. Show the user and get confirmation

### Step 5: Update Description and Display Dimensions

After making code changes:
- Update the `description` field if it no longer accurately describes the generator
- Update `displayDimensions` if parameters changed

*[Use AskUserQuestion tool:]*
"Does the description need updating?" - Options: "Yes, update it", "No, it's still accurate"

### Step 6: Final Validation

Before completing:
- [ ] All geometry is visible on the surface
- [ ] No hidden internal features
- [ ] All tests pass
- [ ] Geometry is connected (single piece)
- [ ] Model centered for printing
- [ ] Description accurately describes the output
- [ ] `displayDimensions` reflect current parameters

## Decision Points

Always stop and ask the user using the `AskUserQuestion` tool when:

1. **Feature changes**: "How should [feature] be modified?" with clear options

2. **Parameter changes**: "What should the new range be?" with preset options

3. **Breaking changes**: "This change may affect existing saved models. Proceed?" with options for how to handle

4. **Multiple approaches**: Present options A and B with descriptions of trade-offs

5. **After each change**: "Does this change look correct?" - Options: "Yes, continue", "Needs adjustment", "Revert"

## Example Flow

**User**: /update-generator v6-engine

**Assistant**: I'll help you update the V6 Engine generator. Let me first read the current implementation.

*[Reads the generator file]*

Here's the current state of the V6 Engine generator:

**ID:** v6-engine
**Name:** V6 Engine Block
**Description:** V6 engine block with cylinder bores, crankcase, oil pan, timing cover, rear main seal housing, lifter valley, head bolt holes, and optional intake manifold

**Parameters:**
| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| bore | 15-60mm | 30mm | Cylinder bore diameter |
| stroke | 15-50mm | 25mm | Piston stroke |
| wallThickness | 1.5-8mm | 3mm | Block wall thickness |
| cylinderSpacing | 25-60mm | 35mm | Distance between cylinder centers |
| oilPanDepth | 10-60mm | 25mm | Oil pan sump depth |
| showIntakeManifold | boolean | false | Add intake manifold |

**Features:**
- Left and right cylinder banks (60° V-angle)
- Crankcase with main bearing saddles
- Oil pan with sump and drain boss
- Timing cover with water pump boss
- Rear main seal housing with flywheel bolt pattern
- Lifter valley with camshaft bore
- Head bolt holes on both banks
- Optional intake manifold with plenum and runners

*[Uses AskUserQuestion tool:]*
"What would you like to update?" - Options:
- "Add new feature" - Add a new visible feature to the engine
- "Modify existing feature" - Change how an existing feature looks
- "Add/change parameter" - Add a new parameter or modify existing ranges
- "Fix a bug" - Address an issue with the current implementation

**User selects**: Add new feature

**Assistant**: What feature would you like to add?

*[Uses AskUserQuestion tool:]*
"What feature should be added?" - Options:
- "Distributor mount" - Add a distributor mounting boss
- "Exhaust ports" - Add visible exhaust port openings
- "Accessory mount bosses" - Add mounting points for accessories
- "Other" - Describe a different feature

*[Continue iteratively...]*
