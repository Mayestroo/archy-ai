# Core Floor Plan Generation Improvement Plan

Date: 2026-06-13

## Goal

Improve the core floor plan generation engine so generated layouts feel closer to the high-quality reference artifacts: stronger zoning, better room proportions, lower corridor waste, better openings, and furniture-friendly room geometry.

This plan is separate from the editor Q&A onboarding plan. The onboarding plan improves how users describe a brief. This plan improves the actual generated floor plan quality.

## Current Architecture

The active generation path is prompt driven but geometry deterministic.

- `app/api/generate/route.ts` asks Gemini for a template key and per-room hints.
- `lib/layout-engine.ts` maps AI rooms into fixed `PIXEL_TEMPLATES` slots.
- `lib/openings.ts` and `lib/opening-regeneration.ts` generate doors and windows from adjacency heuristics.
- `lib/furniture.ts` and `lib/materials.ts` add deterministic furniture and finish presets after geometry exists.
- `scripts/verify-layout-engine.mjs` verifies validity, but mostly checks correctness rather than architectural quality.

## Current Quality Ceiling

The engine is reliable but too static.

- Geometry is mostly fixed once a template is selected.
- AI-provided `area`, `aspectRatio`, `zone`, and `adjacentTo` hints only lightly influence the output.
- There is no candidate generation or scoring step.
- Door/window placement is heuristic and local, not driven by a whole-plan circulation model.
- `lib/templates.ts` and `PIXEL_TEMPLATES` split template knowledge across two systems.
- Verification catches invalid plans, but not weak plans.

## Target Outcome

Generated plans should look more intentionally designed.

- Public, private, and service zones should be clear.
- Living, dining, and kitchen should have believable flow.
- Bedrooms should have privacy and exterior-wall access when possible.
- Bathrooms, laundry, pantry, and service rooms should cluster logically.
- Corridors should be minimized but still functional.
- Doors should connect useful circulation paths.
- Windows should prioritize good exterior exposure and sensible facade balance.
- Rooms should fit their deterministic furniture presets comfortably.

## Recommended Approach

Keep the deterministic foundation, but upgrade it from single-template placement to candidate-based layout synthesis.

Do not jump straight to a fully freeform solver. A deterministic candidate-and-score engine is the right next step because it keeps outputs valid while substantially improving plan quality.

## Implementation Phases

### Phase 1: Unify Template Knowledge

Create one canonical template/profile layer.

- Decide whether `lib/templates.ts` becomes canonical or whether its useful concepts move into a new active registry.
- Remove drift between `lib/templates.ts` and `PIXEL_TEMPLATES`.
- Add metadata to every profile: footprint family, target area, bedroom range, frontage side, zone order, circulation style, room priority list, supported attachments, and notes.
- Keep existing template keys stable where possible so saved/generated plans continue to make sense.

Recommended new file:

- `lib/layout-profiles.ts`

### Phase 2: Add Footprint And Zone Profiles

Represent templates as footprint families instead of fixed room rectangles only.

- Add footprint families: rectangle, L-shape, narrow-lot, compact unit, open-plan unit, garage-integrated, villa, courtyard-ready.
- Define public/private/service zone regions per profile.
- Define allowed zone variants, mirrored variants, and front-door sides.
- Include future hooks for garage and outdoor-space attachments from the Q&A shape picker.

### Phase 3: Generate Candidate Layouts

For each request, generate multiple valid candidates.

- Start from the best matching profile.
- Generate mirrored variants.
- Generate alternate public/private orientation variants.
- Generate multiple hallway/circulation options.
- Try kitchen/living/dining swaps when adjacency remains valid.
- Try bathroom/laundry/service cluster variants.
- Keep every candidate snapped to the existing grid and minimum room size constraints.

Recommended new file:

- `lib/layout-candidates.ts`

### Phase 4: Score Candidate Layouts

Add a deterministic scoring system and select the best candidate.

Score categories:

- Adjacency satisfaction: kitchen near dining/living, ensuite near master, bathroom near bedrooms, garage near entry/laundry.
- Circulation quality: fewer dead-end corridors, lower corridor area, reasonable hall access.
- Window access: bedrooms and living spaces should get exterior walls.
- Room proportions: penalize extreme aspect ratios unless room type expects them.
- Furniture fit: bedrooms fit bed/wardrobe, living fits sofa/coffee/media, kitchen fits counters, bathrooms fit toilet/vanity/shower.
- Shape fit: selected footprint and user shape preference should match the generated exterior envelope.
- Public/private separation: private bedrooms should not open directly into noisy public spaces unless no better candidate exists.
- Service clustering: bathrooms, laundry, pantry, and kitchen plumbing should prefer compact adjacency.

Recommended new file:

- `lib/layout-scoring.ts`

### Phase 5: Normalize Selected Geometry

After selecting the best candidate, clean geometry before returning a plan.

- Snap edges to the grid.
- Remove sliver spaces.
- Enforce minimum room dimensions.
- Align shared walls.
- Recalculate total area from final geometry.
- Preserve template metadata and generation notes.

Recommended new file:

- `lib/layout-normalize.ts`

### Phase 6: Improve Door And Window Generation

Move openings from simple local heuristics toward whole-plan logic.

- Place entry doors on the selected frontage side where possible.
- Place internal doors along useful circulation paths, not arbitrary shared walls.
- Prefer doors from bedrooms to hallway/service circulation rather than living spaces.
- Put bathroom doors in private/service circulation when possible.
- Prefer kitchen/dining/living connections with wider or more central openings.
- Choose windows using exterior exposure, room type, facade balance, and furniture conflicts.
- Avoid windows on walls that furniture blocks when possible.

Files to update:

- `lib/openings.ts`
- `lib/opening-regeneration.ts`
- `lib/layout-engine.ts`

### Phase 7: Strengthen AI Contract

Keep the AI output JSON compatible, but ask for more useful planning hints.

Add or emphasize fields:

- `priority`: high/medium/low room importance.
- `privacy`: public/semi_private/private/service.
- `daylightPriority`: high/medium/low.
- `nearEntry`: boolean.
- `plumbingGroup`: kitchen/bath/laundry/none.
- `preferredZone`: public/private/service.

The deterministic engine should remain authoritative. AI hints should guide scoring, not directly create geometry.

File to update:

- `app/api/generate/route.ts`

### Phase 8: Improve Refinements

Route common refinements through the same candidate/scoring pipeline.

Refinements to support better:

- Add bedroom.
- Remove bedroom.
- Convert bedroom to study.
- Larger kitchen.
- More open-plan living.
- Narrow-lot layout.
- Builder-friendly garage layout.
- Better privacy between bedrooms and living spaces.
- Move service rooms closer together.

Files to update:

- `app/api/generate/route.ts`
- `lib/layout-engine.ts`
- New candidate/scoring helpers.

### Phase 9: Add Quality Benchmarks

Expand verification beyond validity.

Existing checks should remain:

- No room overlaps.
- Valid openings.
- Valid furniture.
- Valid materials.

New checks should include:

- Every bedroom has exterior exposure when the footprint allows it.
- Living room has exterior exposure.
- Kitchen is adjacent or near dining/living.
- Ensuite is adjacent or near master bedroom.
- Bathroom is reachable from bedrooms through sensible circulation.
- Corridor area stays below an acceptable ratio for each profile.
- Furniture fits each room after geometry changes.
- Door count and window count are reasonable by room type.
- Selected template/profile matches prompt intent.

File to update:

- `scripts/verify-layout-engine.mjs`

## File-By-File Checklist

### `lib/layout-engine.ts`

- Replace direct single-template build path with candidate generation and scoring.
- Keep `generateLayout()` public API stable.
- Keep current templates working during migration.
- Call normalization before furniture/material regeneration.
- Preserve `generationNotes` and `template` metadata.

### `lib/layout-profiles.ts`

- Add canonical layout profile definitions.
- Include shape family, zone map, default room program, frontage, circulation, and scoring metadata.
- Migrate useful ideas from `lib/templates.ts` and `PIXEL_TEMPLATES`.

### `lib/layout-candidates.ts`

- Generate candidate room rectangles from a layout profile and AI/user room hints.
- Support mirrored and frontage-flipped variants.
- Support profile-specific zone alternatives.
- Return candidates without side effects.

### `lib/layout-scoring.ts`

- Score each candidate using adjacency, circulation, exposure, proportion, furniture, and shape-fit metrics.
- Return score breakdowns for debugging and future UI diagnostics.
- Keep scoring deterministic.

### `lib/layout-normalize.ts`

- Snap candidate geometry to grid.
- Align shared walls.
- Recalculate total area.
- Reject or repair invalid candidates.

### `lib/openings.ts`

- Add helpers for circulation-aware shared-wall ranking.
- Add room-type window priorities with exterior exposure scoring.
- Avoid openings that conflict with tiny wall lengths.

### `lib/opening-regeneration.ts`

- Preserve valid manual openings.
- Regenerate missing openings using improved scoring.
- Prune invalid windows after geometry changes.

### `lib/furniture.ts`

- Expose furniture fit helpers for layout scoring.
- Add fit checks per room type so candidate scoring can penalize impossible furniture layouts.

### `app/api/generate/route.ts`

- Update AI prompt to produce stronger room intent hints.
- Keep JSON schema backward compatible.
- Route deterministic refinements through improved generation where possible.

### `scripts/verify-layout-engine.mjs`

- Add quality assertions.
- Add benchmark prompts that represent target artifact-like quality.
- Check template/profile selection results for common prompts.

## Quality Metrics

Track these metrics per generated plan.

- `adjacencyScore`
- `circulationScore`
- `windowAccessScore`
- `roomProportionScore`
- `furnitureFitScore`
- `serviceClusterScore`
- `privacyScore`
- `shapeFitScore`
- `totalScore`

Expose score breakdowns internally for debugging, but do not show them in the product UI initially.

## Migration Strategy

Use an incremental migration to avoid breaking generation.

1. Add layout profiles alongside existing templates.
2. Add scoring helpers and run them against current generated plans without changing output.
3. Add candidate generation for one profile, likely `3bed_l_shape` or `3bed_rectangle`.
4. Enable candidate selection for that profile only.
5. Expand to 1-bed, 2-bed, 3-bed, 4-bed, garage, compact, and narrow-lot profiles.
6. Retire stale template paths only after tests cover the new profile engine.

## Success Criteria

The generation core is improved when:

- Same prompt can produce better candidate-selected geometry without manual edits.
- Reference-style prompts create plans with clear zoning and low corridor waste.
- Rooms are more furniture-friendly.
- Bedrooms and living spaces reliably get exterior exposure.
- Open-plan requests produce stronger living/kitchen/dining flow.
- Garage requests attach logically to entry/service zones.
- Regression tests catch visually weak but technically valid plans.
- Existing build and floor plan verification still pass.

## Out Of Scope For First Pass

- Full freeform architectural solver.
- Multi-storey generation.
- Structural engineering constraints.
- Real-time AI layout streaming.
- Image-based reverse engineering of the reference plans.
- Generating construction-ready drawings.
