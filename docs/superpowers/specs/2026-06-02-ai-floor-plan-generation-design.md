# AI Floor Plan Generation Improvements

## Goal

Improve Archy AI's floor plan generation without replacing the whole architecture. The first implementation should make prompt-following and refinements more honest and more useful while preserving the deterministic, gap-free layout pipeline.

## Current Problems

- The model only chooses one of a few fixed templates and labels rooms.
- Refinement prompts imply rooms can be resized or added freely, but room positions and sizes are hardcoded.
- Architectural constraint helpers exist but are not meaningfully connected to generation.
- Doors and windows are placed naively, usually on the same wall for every room.
- Unsupported requests can silently produce a generic layout instead of a useful error or limitation message.

## Design

Keep the two-stage pipeline:

- AI interprets intent and returns structured JSON.
- Deterministic code selects and builds the actual floor plan.

The AI response should include structured intent such as template choice, room labels, requested edits, and unsupported features. The deterministic layer should own room geometry, template fallback, refinement behavior, door placement, window placement, and validation.

## Scope

The first implementation will support these practical improvements:

- Preserve the selected template on the returned `FloorPlan`.
- Make existing refinement requests deterministic where possible: larger/smaller room labels, converting bedrooms to study/office, and adding/removing bedrooms by switching templates.
- Detect unsupported refinements such as balconies instead of pretending they were applied.
- Choose better template fallbacks from prompt keywords when the model returns invalid or incomplete JSON.
- Generate doors and windows from room adjacency and exterior walls instead of fixed walls.
- Add a small verification path for the deterministic layout engine.

## Non-Goals

- Full freeform room packing.
- Multi-storey floor plans.
- Editable drag-and-drop room geometry.
- Building-code compliance.
- Real construction documentation.

## Data Flow

1. Client posts a prompt and optional current floor plan to `/api/generate`.
2. API asks Gemini for structured floor plan intent.
3. API validates/parses the model response and falls back to local intent parsing if needed.
4. Layout engine selects a compatible template and maps rooms into deterministic slots.
5. Layout engine places doors/windows using adjacency and exterior walls.
6. Validator checks geometry and recalculates area.
7. API returns the cleaned floor plan and any generation notes.

## Error Handling

- Missing prompt remains a `400`.
- Missing API key remains a `500`.
- Unsupported user requests should return a successful plan when the plan can still be improved, plus a note in the enhanced prompt.
- If all model calls fail, the API should still use the existing error path rather than inventing a layout without user visibility.

## Testing

Add deterministic checks for the layout engine:

- Generated plans contain no overlapping rooms.
- Template metadata is preserved.
- Door/window references point to existing rooms.
- Refinement-friendly room labels and types are preserved by slot mapping.
