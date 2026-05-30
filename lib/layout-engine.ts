/**
 * lib/layout-engine.ts  (v3 – hardcoded pixel slots)
 *
 * The AI decides:  template key  +  room labels.
 * This file decides:  EVERY pixel coordinate (hardcoded, never calculated).
 *
 * Result: zero gaps, zero overlaps, guaranteed.
 * 1 grid unit = 50 px = 1 metre.
 */

import type { FloorPlan, Room, Door, Window as FPWindow } from "@/lib/floorplan-schema";

// ── Types returned by the AI ──────────────────────────────────────────────────

export interface AIRoom {
  id: string;
  type: string;
  label: string;
  area?: number;
  aspectRatio?: number;
  zone?: "public" | "private" | "service";
  adjacentTo?: string[];
  hasWindow?: boolean;
  hasDoor?: boolean;
}

export interface AIResponse {
  template: string;
  totalArea: number;
  rooms: AIRoom[];
}

// ── Slot definition ───────────────────────────────────────────────────────────

interface Slot {
  /** Matches AIRoom.type. Repeat the same type for multiple rooms (e.g. two "bedroom" slots). */
  type: string;
  defaultLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Hardcoded templates ───────────────────────────────────────────────────────
//
// Rules for every template:
//   • All rows have the SAME total width  →  zero horizontal gaps.
//   • Rows stack directly  →  zero vertical gaps.
//   • Every x / width is a multiple of 50 (1 m grid).

const PIXEL_TEMPLATES: Record<string, { totalArea: number; slots: Slot[] }> = {

  // ══════════════════════════════════════════════════════════════════════════
  // 3-BEDROOM FAMILY HOME  ·  700 × 500 px  (14 m × 10 m ≈ 140 sqm)
  // Row 1 (y=0,   h=150): Entry | Master Bed | Ensuite | Bathroom
  // Row 2 (y=150, h=200): Living | Kitchen | Bedroom 2
  // Row 3 (y=350, h=150): Dining | Hallway | Laundry | Bedroom 3
  // ══════════════════════════════════════════════════════════════════════════
  "3bed_rectangle": {
    totalArea: 140,
    slots: [
      // Row 1 ─────────────────────────────────────────── width = 700
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 150 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 100, y:   0, width: 250, height: 150 },
      { type: "ensuite",        defaultLabel: "Ensuite",        x: 350, y:   0, width: 150, height: 150 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 500, y:   0, width: 200, height: 150 },
      // Row 2 ─────────────────────────────────────────── width = 700
      { type: "living",         defaultLabel: "Living Room",    x:   0, y: 150, width: 300, height: 200 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x: 300, y: 150, width: 200, height: 200 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 500, y: 150, width: 200, height: 200 },
      // Row 3 ─────────────────────────────────────────── width = 700
      { type: "dining",         defaultLabel: "Dining Room",    x:   0, y: 350, width: 300, height: 150 },
      { type: "hallway",        defaultLabel: "Hallway",        x: 300, y: 350, width: 100, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 400, y: 350, width: 100, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 3",      x: 500, y: 350, width: 200, height: 150 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 2-BEDROOM APARTMENT  ·  600 × 400 px  (12 m × 8 m ≈ 96 sqm)
  // Row 1 (y=0,   h=200): Entry | Living | Master Bed
  // Row 2 (y=200, h=100): Kitchen | Dining | Bedroom 2
  // Row 3 (y=300, h=100): Hallway | Bathroom | Laundry
  // ══════════════════════════════════════════════════════════════════════════
  "2bed_apartment": {
    totalArea: 96,
    slots: [
      // Row 1 ─────────────────────────────────────────── width = 600
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 200 },
      { type: "living",         defaultLabel: "Living Room",    x: 100, y:   0, width: 300, height: 200 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 400, y:   0, width: 200, height: 200 },
      // Row 2 ─────────────────────────────────────────── width = 600
      { type: "kitchen",        defaultLabel: "Kitchen",        x:   0, y: 200, width: 200, height: 100 },
      { type: "dining",         defaultLabel: "Dining",         x: 200, y: 200, width: 200, height: 100 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 400, y: 200, width: 200, height: 100 },
      // Row 3 ─────────────────────────────────────────── width = 600
      { type: "hallway",        defaultLabel: "Hallway",        x:   0, y: 300, width: 150, height: 100 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 150, y: 300, width: 200, height: 100 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 350, y: 300, width: 250, height: 100 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 4-BEDROOM VILLA  ·  1000 × 450 px  (20 m × 9 m ≈ 225 sqm)
  // Row 1 (y=0,   h=200): Entry | Master Bed | Ensuite | Bathroom | Guest WC
  // Row 2 (y=200, h=150): Living | Kitchen | Bedroom 2 | Bedroom 3
  // Row 3 (y=350, h=100): Dining | Garage | Hallway | Laundry | Bedroom 4
  // ══════════════════════════════════════════════════════════════════════════
  "4bed_villa": {
    totalArea: 225,
    slots: [
      // Row 1 ─────────────────────────────────────────── width = 1000
      { type: "entry",          defaultLabel: "Grand Entry",    x:   0, y:   0, width: 150, height: 200 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 150, y:   0, width: 350, height: 200 },
      { type: "ensuite",        defaultLabel: "Ensuite",        x: 500, y:   0, width: 150, height: 200 },
      { type: "bathroom",       defaultLabel: "Main Bathroom",  x: 650, y:   0, width: 200, height: 200 },
      { type: "bathroom",       defaultLabel: "Guest WC",       x: 850, y:   0, width: 150, height: 200 },
      // Row 2 ─────────────────────────────────────────── width = 1000
      { type: "living",         defaultLabel: "Living Room",    x:   0, y: 200, width: 400, height: 150 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x: 400, y: 200, width: 250, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 650, y: 200, width: 200, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 3",      x: 850, y: 200, width: 150, height: 150 },
      // Row 3 ─────────────────────────────────────────── width = 1000
      { type: "dining",         defaultLabel: "Dining Room",    x:   0, y: 350, width: 300, height: 100 },
      { type: "garage",         defaultLabel: "Garage",         x: 300, y: 350, width: 250, height: 100 },
      { type: "hallway",        defaultLabel: "Hallway",        x: 550, y: 350, width: 100, height: 100 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 650, y: 350, width: 150, height: 100 },
      { type: "bedroom",        defaultLabel: "Bedroom 4",      x: 800, y: 350, width: 200, height: 100 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STUDIO APARTMENT  ·  450 × 350 px  (9 m × 7 m ≈ 63 sqm)
  // Row 1 (y=0,   h=250): Open-plan living/bed | Kitchenette
  // Row 2 (y=250, h=100): Entry | Bathroom | Laundry
  // ══════════════════════════════════════════════════════════════════════════
  "studio": {
    totalArea: 63,
    slots: [
      // Row 1 ─────────────────────────────────────────── width = 450
      { type: "studio",   defaultLabel: "Living / Bedroom", x:   0, y:   0, width: 300, height: 250 },
      { type: "kitchen",  defaultLabel: "Kitchenette",      x: 300, y:   0, width: 150, height: 250 },
      // Row 2 ─────────────────────────────────────────── width = 450
      { type: "entry",    defaultLabel: "Entry",            x:   0, y: 250, width: 150, height: 100 },
      { type: "bathroom", defaultLabel: "Bathroom",         x: 150, y: 250, width: 200, height: 100 },
      { type: "laundry",  defaultLabel: "Laundry",          x: 350, y: 250, width: 100, height: 100 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 1-BEDROOM UNIT  ·  500 × 400 px  (10 m × 8 m ≈ 80 sqm)
  // Row 1 (y=0,   h=250): Entry | Living | Master Bed
  // Row 2 (y=250, h=150): Kitchen | Dining | Bathroom | Laundry
  // ══════════════════════════════════════════════════════════════════════════
  "1bed_unit": {
    totalArea: 80,
    slots: [
      // Row 1 ─────────────────────────────────────────── width = 500
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 250 },
      { type: "living",         defaultLabel: "Living Room",    x: 100, y:   0, width: 250, height: 250 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 350, y:   0, width: 150, height: 250 },
      // Row 2 ─────────────────────────────────────────── width = 500
      { type: "kitchen",        defaultLabel: "Kitchen",        x:   0, y: 250, width: 150, height: 150 },
      { type: "dining",         defaultLabel: "Dining",         x: 150, y: 250, width: 150, height: 150 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 300, y: 250, width: 100, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 400, y: 250, width: 100, height: 150 },
    ],
  },
};

// ── Slot→Room mapper ──────────────────────────────────────────────────────────

/**
 * Maps hardcoded slots to AI-supplied labels.
 *
 * For each slot type, we consume AI rooms of that type in order.
 * If the AI provided no room for a slot, the slot's defaultLabel is used.
 * If the AI provided more rooms than there are slots, the extras are ignored.
 */
function mapSlotsToRooms(slots: Slot[], aiRooms: AIRoom[]): Room[] {
  // Build a queue per type from the AI response
  const queues: Record<string, AIRoom[]> = {};
  for (const r of aiRooms) {
    (queues[r.type] ??= []).push(r);
  }
  // Counters so we can give stable IDs to duplicate-type slots
  const slotCount: Record<string, number> = {};

  return slots.map((slot) => {
    const idx = slotCount[slot.type] ?? 0;
    slotCount[slot.type] = idx + 1;

    const aiRoom = queues[slot.type]?.[idx];
    const id    = aiRoom?.id    ?? `${slot.type}_${idx + 1}`;
    const label = aiRoom?.label ?? slot.defaultLabel;

    return { id, type: slot.type, label, x: slot.x, y: slot.y, width: slot.width, height: slot.height };
  });
}

// ── Door & window placement ───────────────────────────────────────────────────

function generateDoorsAndWindows(
  rooms: Room[],
  aiRooms: AIRoom[],
): { doors: Door[]; windows: FPWindow[] } {
  const doors: Door[]    = [];
  const windows: FPWindow[] = [];

  // Build a quick lookup by id
  const aiById: Record<string, AIRoom> = {};
  for (const r of aiRooms) aiById[r.id] = r;

  for (const room of rooms) {
    const ai = aiById[room.id];
    if (ai?.hasDoor ?? true) {
      doors.push({ roomId: room.id, wall: "left", position: 0.5 });
    }
    if (ai?.hasWindow ?? (room.type === "living" || room.type === "bedroom" || room.type === "master_bedroom" || room.type === "studio")) {
      windows.push({ roomId: room.id, wall: "top", position: 0.5 });
    }
  }

  return { doors, windows };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function generateLayout(aiResponse: AIResponse): FloorPlan {
  const tpl = PIXEL_TEMPLATES[aiResponse.template];
  if (!tpl) {
    // Fallback: use 3bed_rectangle if the model hallucinated an unknown key
    const fallback = PIXEL_TEMPLATES["3bed_rectangle"]!;
    return buildPlan(fallback.slots, aiResponse, fallback.totalArea);
  }
  return buildPlan(tpl.slots, aiResponse, tpl.totalArea);
}

function buildPlan(slots: Slot[], aiResponse: AIResponse, templateArea: number): FloorPlan {
  const rooms = mapSlotsToRooms(slots, aiResponse.rooms);
  const { doors, windows } = generateDoorsAndWindows(rooms, aiResponse.rooms);
  return {
    rooms,
    doors,
    windows,
    totalArea: aiResponse.totalArea || templateArea,
  };
}

/** List all available template keys (used by the system prompt builder). */
export function listPixelTemplates(): { key: string; description: string; totalArea: number }[] {
  return [
    { key: "3bed_rectangle", description: "Classic 3-bedroom family home",           totalArea: 140 },
    { key: "2bed_apartment", description: "Compact 2-bedroom apartment",             totalArea:  96 },
    { key: "4bed_villa",     description: "Spacious 4-bedroom villa with garage",    totalArea: 225 },
    { key: "studio",         description: "Efficient studio apartment (open-plan)",   totalArea:  63 },
    { key: "1bed_unit",      description: "1-bedroom unit, ideal for singles/couples", totalArea: 80 },
  ];
}
