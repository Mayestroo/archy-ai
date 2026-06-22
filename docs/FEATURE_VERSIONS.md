# Feature Versions

This file tracks Archy AI feature versions so future v1, v2, and v3 improvements build on a clear baseline. When a feature version changes, update this file together with `CHANGELOG.md` and the docs changelog files.

## Generation

### AI Room Specification v1
Status: Complete
Includes:
- Per-room area, aspect ratio, zone, and adjacency hints from the AI.
- AI adjacency hints used as tiebreakers for door placement.
- AI zone hints used for window placement preferences.
- Refinement prompts preserve and report room area, zone, and adjacency data.

Future:
- Proportional room scaling within template bounds.
- Full constraint solver for area/adjacency optimization.
- Zone-based template generation.

### AI Template Expansion v1
Status: Complete
Includes:
- Deterministic 1-bed, 2-bed, 3-bed, and 4-bed residential templates.
- Prompt-based template inference for narrow lots, L-shaped homes, compact units, open-plan homes, and garage/spec homes.
- Area approximation notes for fixed-template generation.

Future:
- Office, cafe, retail, and small commercial templates.
- Better constraint scoring for adjacency, privacy, circulation, and natural light.
- Multi-storey model support after single-floor editing remains stable.

## Editing

### Room Editing v1
Status: Complete
Includes:
- Select rooms in the 2D canvas and Properties sidebar.
- Edit selected room labels and room types.
- Flow edited rooms through 2D, 3D, exports, and saving.

Future:
- Multi-select rooms.
- Bulk room type and label workflows.

### Room Geometry Editing v3
Status: Complete
Includes:
- Drag rooms directly on the 2D canvas.
- Resize selected rooms with edge and corner handles.
- Snap geometry to the 1m grid.
- Prevent room overlaps and enforce minimum room size.

Future:
- Wall-level editing.
- Freeform polygon room shapes.

### Room Count Editing v4
Status: Complete
Includes:
- Add rooms by type from the Properties sidebar.
- Place new rooms in the nearest valid snapped slot.
- Delete rooms while keeping at least one room in the plan.

Future:
- Room duplication.
- Align and distribute controls.

### Editing History v5
Status: Complete
Includes:
- Undo/redo for successful edit operations.
- Keyboard shortcuts for undo and redo.
- History reset when loading or generating a new plan.

Future:
- Named checkpoints.
- Visual diff between history states.

### Invalid Edit Feedback v6
Status: Complete
Includes:
- Transient constraint notices for invalid room/opening edits.
- Canvas highlight for blocked geometry edits.
- Explanations for overlap, minimum size, final-room deletion, and invalid openings.

Future:
- Inline fix suggestions.
- Constraint heatmaps.

## Openings

### Door/Window Editing v2
Status: Complete
Includes:
- Select, add, edit, and delete doors/windows.
- Edit wall and snapped wall position.
- Guard windows to exterior walls and doors to shared/exterior walls.

Future:
- Multi-opening selection.
- Opening schedule export.

### Opening Details Editing v7
Status: Complete
Includes:
- Edit door/window width.
- Edit door hinge and swing.
- Render door swing arcs in 2D and use edited widths in 3D cutouts and exports.

Future:
- Door/window style libraries.
- Sliding, bifold, and double-door types.

### Opening Regeneration v1
Status: Complete
Includes:
- Manual action to rebuild suggested doors/windows from room geometry.
- Preserve valid manual openings where possible.
- Remove invalid openings and add missing suggested openings.

Future:
- Smarter circulation and privacy scoring.
- Optional auto-regeneration after geometry edits.

## Exports

### Professional Export v1
Status: Complete
Includes:
- Shared PDF/PNG export utility.
- Branded title block, project summary, room schedule, legend, grid, doors, windows, furniture, materials, and concept summaries.

Future:
- Multiple sheet layouts.
- Project branding controls.

### Dimension Annotations v1
Status: Complete
Includes:
- Room width/depth annotations in PDF and PNG exports.
- Scale bars in PDF and PNG exports.
- Selected-room dimensions in the 2D editor canvas.

Future:
- Exterior building dimensions.
- Opening and wall segment dimensions.

### Client Export Templates v1
Status: Complete
Includes:
- Presentation, Technical, and Real Estate export templates.
- Shared template selection for PDF and PNG exports.
- Template controls in editor and public shared preview.

Future:
- Brandable templates.
- Role-specific default templates.

### High-Resolution Render Export v1
Status: Complete
Includes:
- Standard, High Resolution, and Print export qualities.
- Larger PNG export sizes for presentation and print workflows.
- A3 landscape print PDF mode.
- Richer metadata for furniture count, concept count, and selected quality.

Future:
- True image rendering.
- Ray-traced room and exterior views.
- DXF/DWG export research.

## Sharing And Versions

### Shareable Client Preview Links v1
Status: Complete
Includes:
- Secure public share tokens for saved floor plans.
- Owner controls to create, copy, regenerate, and revoke share links.
- Read-only public preview pages.

Future:
- Password-protected links.
- Link analytics.

### Plan Version History v1
Status: Complete
Includes:
- Immutable saved-plan version snapshots.
- Recent version list in editor Properties sidebar.
- Restore previous versions without auto-saving them.

Future:
- Version comparison.
- Named milestones.

## Furniture And Materials

### Furniture Placement Suggestions v1
Status: Complete
Includes:
- Deterministic furniture suggestions by room type.
- Room-relative furniture data.
- 2D symbols, 3D blocks, shared preview rendering, and PDF/PNG export rendering.
- Manual Regenerate furniture action.

Future:
- Manual furniture editing.
- Furniture rotation.
- Furniture libraries.

### Room Materials / Colors / Finishes v1
Status: Complete
Includes:
- Deterministic room material presets by room type.
- Floor color, wall color, accent color, floor finish, and wall finish data.
- Material-aware 2D, 3D, shared preview, and PDF/PNG rendering.

Future:
- Material libraries.
- Cost and specification data.

### Manual Material Picker v2
Status: Complete
Includes:
- Selected-room material palette picker.
- Manual material override preservation during automatic refreshes.
- Regenerate materials action to reset to room-type defaults.

Future:
- Custom colors.
- Per-surface editing.

## Concepts

### Interior Concept Rendering v1
Status: Complete
Includes:
- Room-level interior concept briefs without image generation.
- Style presets, concept summaries, palette cues, furniture direction, and render-ready prompts.
- Shared preview cards and compact PDF/PNG export summaries.

Future:
- Real image generation.
- Multiple concepts per room.
- Side-by-side concept comparison.

### Exterior Facade Concepts v1
Status: Complete
Includes:
- Whole-plan facade concept briefs without image generation.
- Facade style presets, material cues, massing notes, roofline direction, and render-ready prompts.
- Editor facade concept panel, shared preview card, and compact PDF/PNG export summaries.

Future:
- Real exterior image generation.
- Multiple facade options per plan.
- Landscape and streetscape concepts.

## Roles And Onboarding

### Role-Based Onboarding v1
Status: Complete
Includes:
- Signup user segmentation for Homeowner, Architect / Designer, and Real Estate / Builder.
- Role-specific starter prompts on dashboard and editor sidebar.
- User type persisted to profiles and saved plans.

Future:
- Role-based onboarding emails.
- Role-specific pricing and analytics.

### Guided Onboarding Wizard v1
Status: Complete
Includes:
- Step-by-step Q&A wizard with floors, area, shape, rooms, extras, and review steps.
- Canvas progress overlay showing completed/pending steps during onboarding.
- Shape picker modal with 6 footprint presets, front door side, and attachments.
- Room program modal with categorized room count controls.
- Client-side generation stage progression during API calls.
- Higher floor counts locked with tooltip explanation.

Future:
- Floor entitlement check for multi-storey unlocking.
- Real image generation from concept briefs.
- Furniture browser and manual placement.
- Render scene panel with camera controls.
- Going back to previous wizard steps.

### Style Picker Modal v1
Status: Complete
Includes:
- Searchable style card grid with interior/exterior scope toggle.
- Style cards: Warm Minimal, Modern Neutral, Scandinavian, Luxury Contemporary, Builder Display (interior); Modern Minimal, Warm Contemporary, Scandinavian, Luxury Villa, Builder Spec (exterior).
- Each card shows name, description, and palette swatches.
- Connects to existing interior/exterior concept creation handlers.

Future:
- Preview images for each style.
- Custom style creation.

### Finish Picker Modal v1
Status: Complete
Includes:
- Material/Colour tabs with category filter and search.
- Material palette card grid with floor/wall/accent color swatches.
- Colour tab with 12 preset color swatches.
- Applies selected palette to selected room.

Future:
- Custom color picker.
- Per-surface (floor/wall/accent) finish editing.

### Furniture Browser v1
Status: Complete
Includes:
- 7 furniture categories with left sidebar navigation.
- Subcategory items with icon, label, description, and add action.
- Clicking an item adds the corresponding room type to the plan.

Future:
- Manual furniture placement.
- Furniture rotation and scaling.
- Full furniture library with drag-and-drop.

### Render Scene Panel v1
Status: Complete
Includes:
- Scene/Renders tabs in Properties sidebar.
- Camera preview stub area.
- FOV slider (30-120°) and aspect ratio selector.
- Render prompt input.
- Disabled render button (stub for future image generation).

Future:
- Real image rendering integration.
- Render history and comparison.
