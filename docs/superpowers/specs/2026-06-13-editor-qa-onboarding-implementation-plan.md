# Editor Q&A Onboarding Implementation Plan

Date: 2026-06-13

## Goal

Build a guided editor onboarding flow inspired by the supplied image artifacts: chat-driven input on the left, visual progress and modal interactions on the canvas, and post-generation tools in the right properties rail.

The selected scope is the full checklist: guided Q&A, canvas checklist, shape picker, room picker, generation progress, refinement mode, style/finish pickers, furniture browser, render scene panel, and user-type branching.

## Reference Findings

The artifacts show one continuous product loop rather than isolated screens.

- Images 1-3: empty editor with chat prompt, answer chips, and centered `Gathering your input` checklist.
- Images 4-8: shape picker modal with footprint presets, live dimensions, front door, garage, and outdoor-space attachments.
- Images 9-15: selected shape and room summaries appear as chat cards, followed by review, extra requirements, and generation progress.
- Images 18-19: generated 2D plan lands in the editor with chat refinements and right-side properties.
- Images 20-23: post-generation style and finish modals use searchable card grids and material/color tabs.
- Image 24: furniture picker uses a hierarchical category browser.
- Image 25: render scene panel includes camera preview, field of view, aspect ratio, prompt, and render action.

## Product States

Use a single editor-level state machine.

- `onboarding`: user is answering guided questions.
- `generating`: final brief has been submitted and the plan is being produced.
- `refining`: plan exists and chat becomes free-text/refinement-first.

Use these onboarding steps.

- `floors`
- `area`
- `shape`
- `rooms`
- `extras`
- `review`

Use these modal states.

- `shape`
- `rooms`
- `style`
- `finish`
- `furniture`
- `render`
- `null`

## Data Model

Add a compact typed answer object owned by `app/editor/page.tsx`.

```ts
type WizardPhase = "onboarding" | "generating" | "refining";
type WizardStep = "floors" | "area" | "shape" | "rooms" | "extras" | "review";
type EditorModal = "shape" | "rooms" | "style" | "finish" | "furniture" | "render" | null;

interface ShapeAttachment {
  type: "garage" | "deck" | "porch";
  label: string;
  side: "top" | "right" | "bottom" | "left";
}

interface ShapeAnswer {
  shapeKey: "rectangle" | "l_shape" | "u_shape" | "t_shape" | "stepped" | "courtyard";
  frontDoorSide: "top" | "right" | "bottom" | "left";
  attachments: ShapeAttachment[];
}

interface WizardAnswers {
  floors?: number;
  area?: { value: number; unit: "sqm" | "sqft" };
  shape?: ShapeAnswer;
  rooms?: Record<string, number>;
  extras?: string[];
}
```

Keep v1 prompt-based generation by compiling `WizardAnswers` into one string and passing it to existing `handleGenerate(prompt)`.

## File-By-File Checklist

### `app/editor/page.tsx`

- Add wizard state: `wizardPhase`, `wizardStep`, `wizardAnswers`, `activeEditorModal`, `compiledWizardPrompt`, and optional `generationStage`.
- Add handlers: `handleWizardAnswer`, `handleWizardNext`, `handleShapeSelected`, `handleRoomsSelected`, `handleWizardGenerate`, and `handleStartNewPlan`.
- Compile answers into a deterministic prompt before calling `handleGenerate`.
- Pass wizard state and handlers to `ChatSidebar`.
- Render a DOM overlay above the canvas area when no plan exists or when generating.
- Render `ShapePickerModal` and `RoomProgramModal` from this page so they can coordinate with both chat and canvas.
- Switch `wizardPhase` to `refining` after `floorPlan` is set successfully.

### `components/editor/ChatSidebar.tsx`

- Replace append-only prompt mirroring as the primary onboarding driver.
- Keep chat transcript rendering, but derive initial guided messages from wizard state.
- Render answer pills for floor choices, quick area presets, and post-generation edit chips.
- Render call-to-action rows for `Choose floor plan shape`, `Choose preferred rooms`, `Generate my floor plan`, and `Add extra requirements`.
- Keep the existing starter templates as a secondary quick-start section.
- After generation, restore free-text input as the main refinement input.
- Avoid duplicate assistant messages by treating wizard state as the source of truth.

### `components/editor/OnboardingProgressOverlay.tsx`

- Add a new DOM overlay component for the center canvas checklist.
- Show `Gathering your input` during onboarding.
- Show completed steps with green checks and pending steps with hollow circles.
- Show `Generation in progress` during generation.
- Show generation stages: drawing outline, optimizing flow, placing furniture, finalizing layout.
- Ensure overlay uses `pointer-events-none` except for any intentionally clickable controls.

### `components/editor/ShapePickerModal.tsx`

- Add a modal matching the supplied shape picker artifacts.
- Show a large dotted-grid preview with a blue footprint outline and light fill.
- Display live area and dimension labels.
- Add base shape presets: rectangle, L-shape, U-shape, T-shape, stepped, courtyard.
- Add front-door placement controls.
- Add garage attachment controls: one-car, two-car, three-car.
- Add outdoor-space controls: deck/balcony and front porch.
- Add snap display/control for future precision.
- Return a `ShapeAnswer` to the editor page on `Use this shape`.

### `components/editor/RoomProgramModal.tsx`

- Add a modal matching the `Add rooms` artifact.
- Group rows by floor.
- Use rows with an icon, room label, minus button, count, and plus button.
- Include default room types: office, pantry, bedroom, kitchen, laundry, walk-in, dining room, living room, full bathroom.
- Add `Add room`, `Reset`, and `Use these rooms` actions.
- Return a room-count map to the editor page.

### `components/editor/PropertiesSidebar.tsx`

- Keep current room/edit/export functionality intact.
- Add post-generation entry points for style, finishes, furniture, and rendering.
- Open style and finish modals through editor-level modal state or local panel state.
- Keep these controls hidden or disabled until a floor plan exists.

### `components/editor/StylePickerModal.tsx`

- Add searchable style card grid.
- Include style cards aligned with existing concepts: modern neutral, Scandinavian, luxury contemporary, warm minimal, builder display.
- Return selected style to existing interior/exterior concept helpers where practical.

### `components/editor/FinishPickerModal.tsx`

- Add `Material` and `Colour` tabs.
- Add category dropdown and search input.
- Use card grid for tile, wood, wall panel, brick, concrete, and paint swatches.
- Connect selection to existing material palette logic where possible.

### `components/editor/FurnitureBrowser.tsx`

- Add hierarchical picker like the reference.
- Categories: Accessories, Bedroom, Bathroom, Outdoors, Entry & Laundry, Living Room, Office, Kitchen & Dining, Garage & Storage.
- Subcategories include bed, nightstand, dresser, toilet, vanity, shower, sofa, coffee table, dining table, desk, car, storage.
- Start as a browser/selection UI; defer manual placement if needed.

### `components/editor/RenderScenePanel.tsx`

- Add camera/scene panel matching the final artifact.
- Show preview area, scene/renders tabs, field of view, aspect ratio, prompt input, attach button, and render action.
- Keep render action as a stub or future integration unless image generation is ready.

### `lib/editor-onboarding.ts`

- Add pure helper functions for wizard definitions and prompt compilation.
- Export step metadata, floor options, room defaults, shape presets, and `compileWizardPrompt(answers, userType)`.
- Keep this logic outside React components so it is testable.

## Prompt Compilation

Generate a concise but explicit prompt like:

```txt
Create a 1-floor 120 sqm residential floor plan with an L-shaped footprint, front door on the bottom side, a one-car garage on the right side, and a rear deck. Include 3 bedrooms, 2 full bathrooms, kitchen, dining room, living room, laundry, pantry, office, and walk-in closet. Prefer efficient circulation, open kitchen-living connection, and clear public/private zoning. Additional requirements: connect the mudroom to the entrance.
```

## User-Type Branching

Use existing `UserType` values.

- `homeowner`: simpler wording, comfort and lifestyle prompts.
- `architect_designer`: zoning, adjacency, circulation, and presentation prompts.
- `real_estate_builder`: marketability, buildability, buyer appeal, and fast presentation prompts.

Keep the first implementation mostly shared, with copy and prompt compilation adjusted by user type.

## Floor Locking

The reference shows multi-floor options locked.

- V1 should show higher floor counts disabled if multi-storey generation is not supported yet.
- Disabled floor options should explain why through a tooltip or helper text.
- If billing entitlement is later wired, replace hardcoded lock logic with entitlement data.

## Generation Progress

Because `/api/generate` currently returns only after completion, generation stages should be client-side progress states while waiting.

- Start at `drawing_plan_outline`.
- Advance to `optimizing_flow` after a short delay.
- Advance to `placing_furniture` after a short delay.
- Advance to `finalizing_layout` until the API returns.
- On success, show the generated plan and switch to `refining`.
- On failure, keep the transcript and return to the review step with the error visible.

## Testing Checklist

- Empty editor starts the guided onboarding flow.
- Starter templates still work as shortcuts.
- Floor selection updates checklist progress.
- Locked floor options cannot be selected.
- Area input accepts valid numeric values and rejects empty/invalid values.
- Shape modal opens, previews presets, accepts attachments, and returns a summary.
- Room modal opens, updates counts, resets, and returns a summary.
- Prompt compilation includes floors, area, shape, attachments, rooms, extras, and user-type tone.
- Generation calls existing `/api/generate` successfully.
- Generation progress overlay appears while loading.
- Generated plan switches chat into refinement mode.
- Existing undo/redo, room editing, save/share, export, and version history still work.
- `npm run build` passes.
- `npm run test:floorplans` passes.

## Implementation Order

1. Add `lib/editor-onboarding.ts` with typed step definitions and prompt compiler.
2. Add editor-level wizard state and pass it into `ChatSidebar`.
3. Add `OnboardingProgressOverlay` in the center canvas area.
4. Convert `ChatSidebar` from starter-first to guided-flow-first.
5. Add `ShapePickerModal` and wire it to the shape step.
6. Add `RoomProgramModal` and wire it to the rooms step.
7. Add prompt compilation and generation handoff.
8. Add generation progress state and refinement transition.
9. Add style and finish picker modals.
10. Add furniture browser hierarchy.
11. Add render scene panel.
12. Run build and floor plan verifier.

## Out Of Scope For First Pass

- True multi-storey floor plan generation.
- Real paid entitlement checks for locked floor counts.
- Real image rendering API integration.
- Manual drag-and-drop placement from the furniture browser.
- Persisting the full chat transcript to Supabase.
