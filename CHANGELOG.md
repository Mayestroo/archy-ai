# Changelog

All notable changes to Archy AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added signup user segmentation with three roles: Homeowner, Architect / Designer, and Real Estate / Builder.
- Added `profiles.user_type` and `floor_plans.user_type` so user segment can power onboarding, analytics, pricing, and future recommendations.
- Added role-based starter briefs on the dashboard and editor sidebar.
- Added stronger AI floor plan generation behavior with deterministic refinement support.
- Added deterministic support for common edits: add bedroom, remove bedroom, larger kitchen, convert bedroom to study/office, and unsupported-feature notes.
- Added selected template metadata and generation notes to floor plans.
- Added improved door/window placement based on room adjacency and exterior walls.
- Added a larger-kitchen 3-bedroom template variant.
- Added a lightweight floor plan verification script: `npm run test:floorplans`.
- Added Room Editing v1 in the editor:
  - Click a room in the 2D canvas to select it.
  - Highlight selected room on the canvas.
  - Select rooms from the Properties sidebar.
  - Edit selected room label.
  - Edit selected room type.
  - Edited plans flow through 2D view, 3D preview, PDF export, and save.
- Added Door/Window Editing v2 in the editor:
  - Click doors/windows in the 2D canvas to select them.
  - Add doors and windows to the selected room from the Properties sidebar.
  - Edit selected opening wall and snapped wall position.
  - Delete selected doors/windows.
  - Guard windows to exterior walls and doors to shared/exterior walls.
  - Edited windows now appear in PDF export.
- Added Room Geometry Editing v3 in the editor:
  - Drag rooms directly on the 2D canvas.
  - Resize selected rooms with eight edge/corner handles.
  - Snap manual geometry edits to the 50px / 1m grid.
  - Reject geometry edits that overlap another room.
  - Enforce a 2m minimum room width/depth.
  - Recalculate total floor area after room geometry changes.
  - Prune invalid windows after geometry changes while keeping valid doors/windows.
- Added Room Count Editing v4 in the editor:
  - Add rooms from the Properties sidebar by choosing a room type.
  - Place added rooms in the nearest valid non-overlapping snapped slot.
  - Select newly added rooms automatically for immediate editing.
  - Delete selected rooms while keeping at least one room in the plan.
  - Remove doors/windows tied to deleted rooms.
  - Recalculate total floor area after add/delete actions.
- Added Editing History v5 in the editor:
  - Track undo/redo history for successful floor plan edits.
  - Undo/redo room label/type edits, geometry edits, room add/delete, and opening edits.
  - Add Undo and Redo controls to the editor header.
  - Add keyboard shortcuts: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl/Cmd+Y`.
  - Reset edit history when loading or generating a new floor plan.
- Added Invalid Edit Feedback v6 in the editor:
  - Show a transient constraint notice when geometry edits are rejected.
  - Flash the affected room on the canvas when a move/resize/add/delete constraint fails.
  - Explain failed room placement, final-room deletion, and invalid opening wall edits.
  - Show minimum-size feedback when resize handles hit the 2m room size floor.
  - Keep undo/redo history limited to successful edits.
- Added Opening Details Editing v7 in the editor:
  - Store optional door/window opening widths with defaults for existing plans.
  - Edit selected door/window width in metres from the Properties sidebar.
  - Edit selected door hinge side and inward/outward swing direction.
  - Render door swing arcs and open leaf lines in the 2D canvas.
  - Use edited opening widths in 2D canvas, PDF export, and 3D wall cutouts.
  - Validate opening widths against the selected wall length.
- Added Professional Export v1:
  - Replaced the old inline PDF export with a shared export utility.
  - Added branded landscape PDF export with a title block, project summary, room schedule, legend, grid, doors, windows, and swing arcs.
  - Added PNG export with matching project metadata, room schedule, legend, doors, windows, and swing arcs.
  - Added PDF and PNG export actions to the Properties sidebar.
  - Made the top editor export control functional for PDF and PNG exports.
- Added Dimension Annotations v1:
  - Added room width/depth annotations to professional PDF export.
  - Added matching room width/depth annotations to PNG export.
  - Added scale bars to PDF and PNG exports.
  - Added selected-room width/depth dimension guides on the 2D editor canvas.
- Added Shareable Client Preview Links v1:
  - Added secure public share tokens for saved floor plans.
  - Added owner controls to create, copy, regenerate, and revoke share links.
  - Added dashboard share controls for saved plan cards.
  - Added editor sidebar share controls with save-before-sharing guidance.
  - Added read-only public preview pages at `/share/[token]`.
  - Reused the existing 2D canvas and professional PDF/PNG export utilities on public preview pages.
- Added Plan Version History v1:
  - Added immutable saved-plan version snapshots.
  - Create a numbered version every time a plan is saved.
  - Show recent saved versions in the editor Properties sidebar.
  - Restore a previous version into the editor without automatically saving it.
  - Keep public share links pointed at the latest saved plan only.
- Added Opening Regeneration v1:
  - Added a manual editor action to regenerate suggested doors/windows from current room geometry.
  - Preserve valid manually edited doors/windows where possible.
  - Remove invalid openings tied to missing rooms, non-exterior windows, invalid walls, or openings that no longer fit.
  - Add missing suggested doors and windows after room moves, resizes, adds, or deletes.
  - Route regeneration through existing undo/redo history.
- Added AI Template Expansion v1:
  - Added five deterministic residential template variants: narrow-lot 3-bedroom, L-shaped 3-bedroom, compact 2-bedroom unit, open-plan 1-bedroom, and builder-friendly 4-bedroom with garage.
  - Improved prompt-based template inference for narrow lots, townhouses, L-shaped/courtyard homes, compact units, open-plan 1-bedroom homes, and builder/spec homes with garages.
  - Added generation notes when explicit area requests are approximated by the nearest fixed deterministic template.
  - Updated starter prompts to exercise the new residential variants.
  - Expanded floor plan verifier coverage for new template selection paths.
- Added Client Export Templates v1:
  - Added Presentation, Technical, and Real Estate export templates.
  - Reused the same template selection for PDF and PNG exports.
  - Added export template controls to the editor Properties sidebar and public shared preview page.
  - Kept all export rendering centralized in the shared floor plan export utility.
- Added Furniture Placement Suggestions v1:
  - Added deterministic furniture suggestions for bedrooms, living rooms, dining rooms, kitchens, bathrooms, laundries, studies, studios, entries, and garages.
  - Store furniture as room-relative floor plan data so furniture follows room moves.
  - Regenerate furniture automatically after room geometry/type/count edits.
  - Added a manual Regenerate furniture action in the Properties sidebar.
  - Render furniture in the 2D canvas, 3D preview, public share pages, and PDF/PNG exports.
  - Expanded the floor plan verifier to validate furniture for every deterministic template.
- Added Room Materials / Colors / Finishes v1:
  - Added deterministic room material presets by room type.
  - Store room material palettes with floor color, wall color, accent color, floor finish, and wall finish.
  - Backfill material presets for older saved/shared plans at display and export time.
  - Regenerate materials automatically after room geometry/type/count edits.
  - Added a manual Regenerate materials action in the Properties sidebar.
  - Render material-aware colors in 2D canvas, 3D floors/walls, shared previews, and PDF/PNG exports.
  - Expanded the floor plan verifier to validate material presets for every deterministic template.
- Added Manual Material Picker v2:
  - Added selected-room material palette editing in the Properties sidebar.
  - Let users choose from deterministic palettes such as Warm Lounge, Clean Stone, Spa Tile, Calm Suite, and Utility Concrete.
  - Mark manually selected room materials and preserve them during automatic material refreshes.
  - Keep Regenerate materials as a full reset back to room-type defaults.
  - Added verifier coverage for manual material overrides and refresh preservation.
- Added Interior Concept Rendering v1:
  - Added saved room-level interior concept briefs without requiring an image generation service.
  - Added selected-room concept style presets: Warm Minimal, Modern Neutral, Scandinavian, Luxury Contemporary, and Builder Display.
  - Generate render-ready concept briefs from room dimensions, furniture, material palette, floor finish, wall finish, and room type.
  - Added an Interior Concept panel in the Properties sidebar with a client-facing summary, palette chips, and render prompt.
  - Show saved interior concept cards on public shared preview pages.
  - Include a compact interior concept summary in PDF and PNG export panels when concept briefs exist.
  - Added verifier coverage for concept brief creation and deleted-room concept pruning.
- Added High-Resolution Render Export v1:
  - Added Standard, High Resolution, and Print export quality options.
  - Added larger PNG output modes for presentation screens and print workflows.
  - Added Print-quality PDF export on a larger landscape sheet.
  - Added export quality selectors to the editor Properties sidebar and public shared preview page.
  - Added richer export panel metadata for furniture count, concept count, and selected quality.
  - Kept Standard export behavior as the default for existing PDF/PNG actions.
- Added Exterior Facade Concepts v1:
  - Added whole-plan facade concept briefs without requiring an image generation service.
  - Added facade style presets: Modern Minimal, Warm Contemporary, Scandinavian, Luxury Villa, and Builder Spec.
  - Generate facade concept briefs from plan footprint, room layout, template, materials, and area.
  - Added an Exterior Concept panel in the Properties sidebar with style selector, summary, material cues, and render prompts.
  - Show a facade concept card on public shared preview pages.
  - Include a compact exterior concept summary in PDF and PNG export panels when a facade brief exists.
  - Added verifier coverage for exterior concept brief creation.
 - Added AI Room Specification v1:
   - The AI now returns per-room area, aspect ratio, zone, and adjacency hints instead of just type and label.
   - Door placement now uses AI adjacency hints as tiebreakers when choosing between adjacent rooms.
   - Window placement now uses AI zone hints to prefer private-side exterior walls for bedrooms.
   - Refinement prompts preserve zone, adjacency, area, and aspect ratio for existing rooms.
   - The refinement prompt now shows room areas in sqm for the current floor plan.
- Added Editor Q&A Onboarding Phase 1:
  - Added a guided Q&A wizard that replaces the blank editor with step-by-step questions: floors, area, shape, rooms, extras, and review.
  - Added `lib/editor-onboarding.ts` with typed wizard definitions, step metadata, prompt compiler, and user-type-aware phrasing.
  - Added `OnboardingProgressOverlay` — a canvas-centered checklist showing completed/pending steps during onboarding and animated stage progress during generation.
  - Added `ShapePickerModal` — 6 shape presets (rectangle, L, U, T, stepped, courtyard) with front door side selector and garage/deck/porch attachments.
  - Added `RoomProgramModal` — categorized room count controls with minus/plus, reset, and confirm actions for office, pantry, bedroom, kitchen, laundry, walk-in, dining, living, bathrooms, and walk-in closet.
  - Rewrote `ChatSidebar` to render the guided Q&A flow during onboarding and fall back to free-text refinement chat after generation.
  - Added wizard state machine in the editor page (`wizardPhase`, `wizardStep`, `wizardAnswers`, `activeEditorModal`, `generationStage`).
  - Added client-side generation stage progression (drawing outline → optimizing flow → placing furniture → finalizing layout) while the API call is in flight.
  - Floor selection locks higher floor counts with tooltip explanation for v1.

- Added Editor Style Picker Modal:
  - Searchable style card grid with interior (Warm Minimal, Modern Neutral, Scandinavian, Luxury Contemporary, Builder Display) and exterior (Modern Minimal, Warm Contemporary, Scandinavian, Luxury Villa, Builder Spec) scope toggle.
  - Each card shows style name, description, and palette swatches.
  - Connects to existing interior/exterior concept creation handlers.
- Added Finish Picker Modal:
  - Material/Colour tabs with category filter (Tile, Wood, Wall Panel, Brick, Concrete, Paint) and search input.
  - Material palette card grid with floor/wall/accent color swatches.
  - Colour tab with 12 preset color swatches.
  - Applies selected palette to the selected room via material system.
- Added Furniture Browser:
  - Left sidebar with 7 furniture categories (Bedroom, Bathroom, Living Room, Kitchen & Dining, Office, Entry & Laundry, Garage & Storage).
  - Right grid with subcategory items showing icon, label, description, and hover "Add to plan" action.
  - Selecting an item adds the corresponding room type to the plan.
- Added Render Scene Panel:
  - Scene/Renders tabs with camera preview stub, FOV slider (30-120°), aspect ratio selector (16:9, 4:3, 3:2, 1:1, 9:16), render prompt input, and disabled render button.
  - Placed in the Properties sidebar under the Render section.

### Changed

- Canvas background changed from line grid to dotted grid pattern.
- Canvas default theme changed from dark to light.
- Added theme toggle (light/dark mode switcher) to header and editor.
- Dashboard now shows role-specific starter templates instead of a generic empty state only.
- Editor chat now shows role-specific starter briefs before the first plan is generated.
- Saved plans now snapshot the creator's user segment for future reporting.
- The layout engine now owns template fallback, room mapping, plan notes, and smarter openings more explicitly.

### Verified

- `npm run lint`
- `npm run build`
- `npm run test:floorplans`

## Current Product Capabilities

- AI prompt-to-floor-plan generation with per-room zone and adjacency hints for smarter door/window placement.
- Deterministic layout engine with fixed valid templates.
- Expanded residential template library with multiple 1-bed, 2-bed, 3-bed, and 4-bed variants.
- 2D blueprint canvas.
- Interactive 3D preview.
- Chat-based refinement loop.
- Room label/type editing.
- Room drag/resize editing with grid snapping and overlap prevention.
- Room add/delete editing with automatic snapped placement.
- Door/window selection, add, edit, and delete controls.
- Door/window width details and 2D door swing arcs.
- Manual door/window regeneration after geometry edits.
- Undo/redo editing history.
- Invalid-edit feedback for room and opening constraints.
- Professional PDF and PNG export with summary panels and room schedules.
- High-resolution and print-quality export options for client presentation outputs.
- Export template selection for Presentation, Technical, and Real Estate outputs.
- Deterministic furniture suggestions in 2D, 3D, shared previews, and exports.
- Deterministic room material and finish presets in 2D, 3D, shared previews, and exports.
- Manual selected-room material palette editing.
- Room-level interior concept briefs with render-ready prompts and shared preview cards.
- Whole-plan exterior facade concepts with style presets and render prompts.
- Dimension annotations and scale bars in exports.
- Shareable read-only client preview links.
- Persisted saved-plan version history.
- Dashboard with saved plans.
- Save/delete plans with Supabase.
- Google OAuth authentication.
- Signup role segmentation.
- Referral and credits foundation.
- Billing page and Pro waitlist foundation.
- Profile page with avatar upload.
- Blog, reviews, privacy, and terms pages.

## Future Improvements

### Editing

- Select multiple rooms and align/distribute them.

### AI Generation

- Office, cafe, retail, and small commercial templates.
- Zone-based template generation (moving beyond fixed pixel slots).
- Full constraint solver for adjacency, privacy, circulation, and natural light.
- Better AI explanations for tradeoffs after refinements.
- Multi-storey model support later, after single-floor editing is stable.

### Professional Output

- DXF/DWG export research.

### Interior, Exterior, And Landscape

- Basic garden/path/pool landscape concepts.

### Business And Analytics

- Stripe billing and paid credits.
- Role-based onboarding emails and pricing.
- Track conversion by user type.
- Team/client collaboration.
- B2B API exploration for real estate and design workflows.
