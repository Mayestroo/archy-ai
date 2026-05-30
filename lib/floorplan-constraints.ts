/**
 * lib/floorplan-constraints.ts
 *
 * Architectural constraint rules for AI floor plan generation.
 * These rules are used both to guide the AI prompt and to
 * validate/score generated floor plans.
 */

// ── RULE 1: Zone Separation ────────────────────────────────────────────────────
// Rooms are grouped into mutually exclusive zones. Private and public zones
// must never be interleaved — they should occupy entirely separate sides.

export type ZoneType = "private" | "public" | "service";

export const ROOM_ZONES: Record<string, ZoneType> = {
  // Public zone — LEFT side
  living:         "public",
  dining:         "public",
  kitchen:        "public",
  entry:          "public",
  // Private zone — RIGHT side (all bedrooms + wet rooms)
  bedroom:        "private",
  master_bedroom: "private",
  ensuite:        "private",
  bathroom:       "private",
  // Service zone — FAR RIGHT strip
  hallway:        "service",
  laundry:        "service",
  storage:        "service",
  garage:         "service",
};

/**
 * Returns true if the two room types belong to incompatible zones
 * (i.e., one is public and the other is private).
 */
export function zonesConflict(typeA: string, typeB: string): boolean {
  const zA = ROOM_ZONES[typeA];
  const zB = ROOM_ZONES[typeB];
  if (!zA || !zB) return false;
  return (zA === "private" && zB === "public") ||
         (zA === "public"  && zB === "private");
}

// ── RULE 2: Must-Be-Adjacent ───────────────────────────────────────────────────
// These pairs MUST share a wall (or be directly connected via a short passage).

export const MUST_BE_ADJACENT: Record<string, string[]> = {
  kitchen:        ["dining"],
  master_bedroom: ["ensuite"],
  laundry:        ["bathroom"],
  living:         ["dining", "entry"],
  entry:          ["living", "hallway"],
};

// ── RULE 3: Never-Adjacent ─────────────────────────────────────────────────────
// These pairs must NEVER share a wall.

export const NEVER_ADJACENT: Record<string, string[]> = {
  bedroom:  ["kitchen", "living"],
  bathroom: ["kitchen"],
};

/**
 * Returns true if pairing these two room types is explicitly forbidden.
 */
export function adjacencyForbidden(typeA: string, typeB: string): boolean {
  for (const [base, disallowed] of Object.entries(NEVER_ADJACENT)) {
    if (typeA === base && disallowed.includes(typeB)) return true;
    if (typeB === base && disallowed.includes(typeA)) return true;
  }
  return false;
}

// ── RULE 4: Fixed Grid System ──────────────────────────────────────────────────
// All spatial measurements are in pixels, where 1 grid unit = 50 px = 1 meter.

export const GRID_SIZE       = 50;  // px — 1 metre
export const MIN_ROOM_UNITS  = 2;   // 2×2 grid units minimum
export const MIN_ROOM_PX     = MIN_ROOM_UNITS * GRID_SIZE;   // 100 px
export const MAX_HALLWAY_WIDTH_UNITS = 1;                    // 1 grid unit = 50 px

/** Snap a value to the nearest grid boundary. */
export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

/** Returns true if the dimension satisfies the minimum room size rule. */
export function meetsMinSize(width: number, height: number): boolean {
  return width >= MIN_ROOM_PX && height >= MIN_ROOM_PX;
}

/** Returns true if the hallway width is within the allowed maximum. */
export function hallwayWidthValid(width: number, height: number): boolean {
  const narrower = Math.min(width, height);
  return narrower <= MAX_HALLWAY_WIDTH_UNITS * GRID_SIZE;
}

// ── RULE 5: House Shape ────────────────────────────────────────────────────────
// The layout must always begin as a bounding rectangle that is completely
// filled before any protrusions (wings) are allowed.

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes the bounding rectangle that tightly wraps all rooms.
 */
export function computeBoundingRect(
  rooms: Array<{ x: number; y: number; width: number; height: number }>
): BoundingRect {
  if (rooms.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  const minX = Math.min(...rooms.map(r => r.x));
  const minY = Math.min(...rooms.map(r => r.y));
  const maxX = Math.max(...rooms.map(r => r.x + r.width));
  const maxY = Math.max(...rooms.map(r => r.y + r.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Approximates how completely rooms fill their bounding rectangle.
 * A value of 1.0 means the layout is a perfect, gapless rectangle.
 * Values below ~0.85 indicate significant empty space / L-shapes.
 */
export function fillRatio(
  rooms: Array<{ width: number; height: number }>
): number {
  const totalRoomArea = rooms.reduce((acc, r) => acc + r.width * r.height, 0);
  const bbox = computeBoundingRect(
    rooms.map(r => ({ ...r, x: 0, y: 0 })) // only care about sizes here
  );
  const bboxArea = bbox.width * bbox.height;
  return bboxArea > 0 ? totalRoomArea / bboxArea : 0;
}

// ── Prompt fragment helpers ────────────────────────────────────────────────────
// These strings can be injected directly into the AI system prompt.

export const CONSTRAINT_PROMPT = `
ARCHITECTURAL CONSTRAINT RULES (MANDATORY):

RULE 1 — STRICT ZONE SEPARATION (no exceptions):
  • PUBLIC zone  (LEFT side):     living, dining, kitchen, entry ONLY.
  • PRIVATE zone (RIGHT side):    bedroom, master_bedroom, bathroom, ensuite ONLY.
  • SERVICE zone (FAR RIGHT strip): laundry, storage, hallway, garage ONLY.
  bathroom and ensuite MUST be private. hallway MUST be service.
  DO NOT mix zones. Zones must never be interleaved.

RULE 2 — MUST-BE-ADJACENT PAIRS (shared wall required):
  • kitchen ↔ dining
  • master_bedroom ↔ ensuite
  • living ↔ dining AND living ↔ entry
  • entry ↔ hallway

RULE 3 — NEVER-ADJACENT PAIRS (no shared wall):
  • bedroom and kitchen
  • bedroom and living
  • bathroom and kitchen

RULE 4 — MINIMUM ROOM SIZES:
  • entry: ≥ 6 sqm  • hallway: ≥ 6 sqm  • bathroom: ≥ 5 sqm  • laundry: ≥ 4 sqm
  • bedroom: ≥ 10 sqm  • master_bedroom: ≥ 14 sqm  • living: ≥ 18 sqm

RULE 5 — GRID SYSTEM:
  • Every coordinate and dimension MUST be a multiple of 50 (= 1 metre).
  • No room may be smaller than 100 × 100 px (2 × 2 grid units).

RULE 6 — HOUSE SHAPE:
  • Start with a bounding rectangle.
  • Fill the rectangle completely (all rooms share walls, zero gaps).
  • Only add wings (L-shapes) after the base rectangle is fully filled.
`.trim();
