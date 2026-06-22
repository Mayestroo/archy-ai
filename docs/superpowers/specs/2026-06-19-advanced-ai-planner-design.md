# Advanced AI Planner Design

## Goal

Replace Archy AI's primary template-based generation with a role-aware AI planning pipeline that creates floor plans from architectural constraints, generates multiple spatial candidates, scores them, and uses AI critique to select and explain the best editable plan.

The existing deterministic templates remain only as fallback, regression fixtures, and demo safety nets. The product-facing generation path should no longer be positioned as template selection.

## Product Positioning

Archy AI converts a client brief into architectural constraints, generates multiple layout candidates, scores them by user intent and design rules, then uses AI critique to choose and explain the best editable floor plan.

This supports the pitch claim that Archy AI is not a fixed-template selector.

## Initial Scope

The first release supports all current user segments with role-aware scoring:

- Homeowner
- Architect / Designer
- Real Estate / Builder

"All segments" means the same residential planner adapts priorities for each user role. It does not mean the first release generates every building category for each segment.

The first release is still bounded:

- Single-floor plans only.
- Residential-heavy generation first.
- Studio, compact unit, 1-4 bedroom homes, villa-style homes, and builder/spec homes.
- Garage support.
- Rectangle, L-shape, U-shape, courtyard, narrow-lot, and stepped footprints.
- Existing editor, 2D canvas, 3D preview, save, share, version history, furniture, materials, and export flows continue to use the current `FloorPlan` schema.

Out of scope for the first release:

- Multi-storey layouts.
- Full commercial floor plans.
- Structural engineering validation.
- Building-code compliance certification.
- Real construction drawings such as DXF/DWG.
- AI image rendering.

## Architecture

The new generation path has seven stages.

### 1. Brief Extraction

The AI converts the prompt and user profile into a structured design brief.

The brief includes:

- `userType`: homeowner, architect_designer, or real_estate_builder.
- `projectType`: studio, unit, family_home, villa, builder_spec, or unknown_residential.
- `targetAreaSqm` and acceptable area tolerance.
- `siteShape`: rectangle, l_shape, u_shape, courtyard, narrow_lot, stepped, or inferred.
- `frontDoorSide` when known.
- `rooms`: room type, label, count, target area range, priority, and privacy zone.
- `adjacencyPreferences`: required, preferred, and avoid relationships.
- `mustHave`: hard requirements from the user prompt.
- `niceToHave`: soft preferences.
- `unsupportedRequests`: items outside current scope.

The AI should not return fixed room coordinates.

### 2. Role Profile

The solver receives a role profile that changes scoring priorities.

Homeowner priorities:

- Comfort.
- Family flow.
- Privacy between bedrooms and public spaces.
- Natural light.
- Clear living/kitchen/dining relationship.

Architect / Designer priorities:

- Spatial logic.
- Strong adjacency graph.
- Zoning clarity.
- Editability.
- Explainable design rationale.

Real Estate / Builder priorities:

- Area efficiency.
- Simple footprint.
- Garage/parking integration.
- Sellable room proportions.
- Cost-conscious circulation.

### 3. Candidate Generation

The procedural generator creates multiple layout candidates without using fixed template coordinates.

Candidate generation should:

- Build a footprint from the requested or inferred site shape.
- Allocate public, private, and service zones.
- Place anchor rooms first: entry, living, kitchen, master bedroom, garage when present.
- Place dependent rooms based on adjacency constraints.
- Use grid-snapped geometry compatible with the current editor.
- Produce 20-100 candidates per request, with a lower number for fast MVP mode and a higher number for quality mode.

The generator can use deterministic seeded randomness so the same request can be reproduced in tests.

### 4. Constraint Validation

Each candidate must pass hard validation before scoring.

Hard validation includes:

- No room overlap.
- Rooms remain inside the footprint.
- Minimum width and depth per room type.
- Total area stays within the allowed tolerance when possible.
- Required rooms exist.
- Exterior-window rooms have access to an exterior wall.
- Doors can be generated between connected spaces or exterior walls.
- A circulation path exists from entry to primary public and private zones.

Invalid candidates are discarded or repaired before scoring.

### 5. Scoring Engine

Valid candidates receive a score breakdown.

Core score dimensions:

- Area fit.
- Room proportion quality.
- Adjacency satisfaction.
- Privacy zoning.
- Circulation efficiency.
- Natural light opportunity.
- Wet-room clustering.
- Buildability / footprint simplicity.
- Role fit.

The scoring engine returns both a total score and a readable breakdown for debugging and AI critique. The initial UI does not need to expose full internal scores.

### 6. AI Critic

The top candidates are summarized and sent to the AI critic.

The critic selects the best candidate by considering:

- User prompt intent.
- Role profile.
- Score breakdown.
- Tradeoffs between candidates.
- Unsupported or approximated requirements.

The critic returns:

- Selected candidate ID.
- User-facing explanation.
- Short generation notes.
- Optional retry instruction if all candidates are weak.

The critic cannot invent geometry. It can only select from solver-produced candidates or request a bounded retry.

### 7. Final Plan Assembly

The selected candidate is converted into the existing `FloorPlan` schema.

Final assembly adds:

- Doors and windows using existing opening regeneration logic where possible.
- Furniture suggestions.
- Material presets.
- Interior and exterior concept compatibility.
- Generation notes and planner rationale.

The editor should receive a normal editable `FloorPlan`, so existing save, share, version history, export, and 3D preview flows continue to work.

## Fallback Strategy

Templates remain available only as fallback.

Fallback triggers:

- Brief extraction fails.
- No candidate passes validation.
- AI critic fails to select a candidate.
- Generation times out.

Fallback output must include a generation note such as: "Used deterministic fallback because the planner could not produce a valid custom layout." This note should be visible internally and can be shown in a softer user-facing form.

## API Behavior

The existing `/api/generate` route should become an orchestrator rather than a template selector.

Request inputs:

- Prompt.
- Current floor plan for refinements.
- User type when available.
- Generation mode: fast or quality.

Response outputs:

- `floorPlan` using the current schema.
- `enhancedPrompt` or planner summary.
- `generationNotes`.
- Optional `plannerRationale` for future UI use.

Refinements should use the same planner path when the requested change affects layout. Simple deterministic edits can still use existing fast handlers when they are safer and predictable.

## Error Handling

The planner should fail gracefully.

User-facing errors should avoid technical detail and explain what the user can change.

Examples:

- "This request needs multi-storey planning, which is not supported yet. I generated a single-floor approximation."
- "The requested area is too small for all requested rooms. I generated the closest valid layout."
- "The planner could not produce a valid custom layout, so a safe fallback was used."

Internal logs should include failed stage, candidate counts, validation failures, and selected fallback reason.

## Testing

Testing should focus on deterministic confidence, not pixel-perfect snapshots.

Required tests:

- Brief extraction coercion handles missing and malformed AI fields.
- Candidate generator creates valid non-overlapping rooms for each supported project type.
- Constraint validation rejects overlap, out-of-footprint rooms, missing required rooms, and windowless exterior-required rooms.
- Scoring prefers layouts that satisfy adjacency and role priorities.
- Role profiles produce meaningfully different rankings for the same brief.
- AI critic selection is bounded to candidate IDs returned by the solver.
- Fallback activates when candidate generation fails.
- Existing `npm run test:floorplans` remains available for fallback templates.

## Migration Plan

Phase 1: Add planner data types and brief extraction.

Phase 2: Add procedural candidate generator and validator behind a feature flag.

Phase 3: Add scoring and role profiles.

Phase 4: Add AI critic selection and bounded retry.

Phase 5: Route `/api/generate` through the planner, with template fallback.

Phase 6: Expand tests and tune scoring with real prompt examples.

Phase 7: Update product copy to remove template-based positioning.

## Success Criteria

The feature is successful when:

- New generation does not depend on fixed template room coordinates in the primary path.
- The same prompt can produce a valid custom layout through constraints and scoring.
- Generated plans remain editable in the current editor.
- Exports, 2D, 3D, save, share, and version history continue to work.
- The system can explain why a layout was selected.
- Fallback templates are only used for failures or explicit debug mode.
- The pitch claim can honestly state that Archy AI generates from constraints rather than selecting fixed templates.
