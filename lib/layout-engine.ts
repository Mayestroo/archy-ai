/**
 * lib/layout-engine.ts
 *
 * The AI interprets intent. This deterministic layer owns geometry, template
 * fallback, slot mapping, and opening placement so generated plans stay valid.
 * 1 grid unit = 50 px = 1 metre.
 */

import type { Door, FloorPlan, Room, WallSide, Window as FPWindow } from "./floorplan-schema";
import { regenerateFurniture } from "./furniture.ts";
import { regenerateMaterials } from "./materials.ts";
import {
  DEFAULT_DOOR_WIDTH_METERS,
  DEFAULT_WINDOW_WIDTH_METERS,
  getAdjacentRooms,
  getExteriorWalls,
  WALL_SIDES,
} from "./openings.ts";

export { regenerateOpenings } from "./opening-regeneration.ts";

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
  template?: string;
  totalArea?: number;
  rooms?: AIRoom[];
  generationNotes?: string[];
  unsupportedFeatures?: string[];
}

export interface GenerateLayoutOptions {
  preferredTemplate?: string;
  generationNotes?: string[];
}

interface Slot {
  /** Matches AIRoom.type. Repeat the same type for multiple rooms. */
  type: string;
  defaultLabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PixelTemplate {
  description: string;
  totalArea: number;
  slots: Slot[];
}

interface RoomPreference {
  hasDoor?: boolean;
  hasWindow?: boolean;
}

const PIXEL_TEMPLATES: Record<string, PixelTemplate> = {
  "3bed_rectangle": {
    description: "Classic 3-bedroom family home",
    totalArea: 140,
    slots: [
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 150 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 100, y:   0, width: 250, height: 150 },
      { type: "ensuite",        defaultLabel: "Ensuite",        x: 350, y:   0, width: 150, height: 150 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 500, y:   0, width: 200, height: 150 },
      { type: "living",         defaultLabel: "Living Room",    x:   0, y: 150, width: 300, height: 200 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x: 300, y: 150, width: 200, height: 200 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 500, y: 150, width: 200, height: 200 },
      { type: "dining",         defaultLabel: "Dining Room",    x:   0, y: 350, width: 300, height: 150 },
      { type: "hallway",        defaultLabel: "Hallway",        x: 300, y: 350, width: 100, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 400, y: 350, width: 100, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 3",      x: 500, y: 350, width: 200, height: 150 },
    ],
  },

  "3bed_open_kitchen": {
    description: "3-bedroom family home with larger kitchen and open-plan dining",
    totalArea: 140,
    slots: [
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 150 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 100, y:   0, width: 250, height: 150 },
      { type: "ensuite",        defaultLabel: "Ensuite",        x: 350, y:   0, width: 150, height: 150 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 500, y:   0, width: 200, height: 150 },
      { type: "living",         defaultLabel: "Living Room",    x:   0, y: 150, width: 250, height: 200 },
      { type: "kitchen",        defaultLabel: "Large Kitchen",  x: 250, y: 150, width: 250, height: 200 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 500, y: 150, width: 200, height: 200 },
      { type: "dining",         defaultLabel: "Dining Room",    x:   0, y: 350, width: 250, height: 150 },
      { type: "hallway",        defaultLabel: "Hallway",        x: 250, y: 350, width: 100, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 350, y: 350, width: 150, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 3",      x: 500, y: 350, width: 200, height: 150 },
    ],
  },

  "3bed_narrow_lot": {
    description: "Narrow-lot 3-bedroom home with linear circulation",
    totalArea: 132,
    slots: [
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 150 },
      { type: "living",         defaultLabel: "Living Room",    x: 100, y:   0, width: 300, height: 150 },
      { type: "dining",         defaultLabel: "Dining",         x:   0, y: 150, width: 200, height: 150 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x: 200, y: 150, width: 200, height: 150 },
      { type: "hallway",        defaultLabel: "Long Hallway",   x:   0, y: 300, width: 100, height: 450 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 100, y: 300, width: 300, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 100, y: 450, width: 100, height: 150 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 200, y: 450, width: 100, height: 150 },
      { type: "ensuite",        defaultLabel: "Ensuite",        x: 300, y: 450, width: 100, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 100, y: 600, width: 150, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 3",      x: 250, y: 600, width: 150, height: 150 },
    ],
  },

  "3bed_l_shape": {
    description: "L-shaped 3-bedroom family home with separated private wing",
    totalArea: 150,
    slots: [
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 150, height: 150 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 150, y:   0, width: 250, height: 150 },
      { type: "ensuite",        defaultLabel: "Ensuite",        x: 400, y:   0, width: 100, height: 150 },
      { type: "living",         defaultLabel: "Living Room",    x:   0, y: 150, width: 300, height: 200 },
      { type: "dining",         defaultLabel: "Dining Room",    x: 300, y: 150, width: 200, height: 200 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 500, y: 150, width: 200, height: 200 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x:   0, y: 350, width: 250, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 250, y: 350, width: 100, height: 150 },
      { type: "hallway",        defaultLabel: "Hallway",        x: 350, y: 350, width: 150, height: 150 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 500, y: 350, width: 100, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 3",      x: 600, y: 350, width: 100, height: 150 },
    ],
  },

  "2bed_apartment": {
    description: "Compact 2-bedroom apartment",
    totalArea: 96,
    slots: [
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 200 },
      { type: "living",         defaultLabel: "Living Room",    x: 100, y:   0, width: 300, height: 200 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 400, y:   0, width: 200, height: 200 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x:   0, y: 200, width: 200, height: 100 },
      { type: "dining",         defaultLabel: "Dining",         x: 200, y: 200, width: 200, height: 100 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 400, y: 200, width: 200, height: 100 },
      { type: "hallway",        defaultLabel: "Hallway",        x:   0, y: 300, width: 150, height: 100 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 150, y: 300, width: 200, height: 100 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 350, y: 300, width: 250, height: 100 },
    ],
  },

  "2bed_compact_unit": {
    description: "Very compact 2-bedroom unit with minimized corridor area",
    totalArea: 72,
    slots: [
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 100 },
      { type: "living",         defaultLabel: "Living",         x: 100, y:   0, width: 200, height: 100 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 300, y:   0, width: 200, height: 150 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x:   0, y: 100, width: 150, height: 150 },
      { type: "dining",         defaultLabel: "Dining",         x: 150, y: 100, width: 150, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 300, y: 150, width: 200, height: 100 },
      { type: "hallway",        defaultLabel: "Hallway",        x:   0, y: 250, width: 150, height: 150 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 150, y: 250, width: 150, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 300, y: 250, width: 200, height: 150 },
    ],
  },

  "4bed_villa": {
    description: "Spacious 4-bedroom villa with garage",
    totalArea: 180,
    slots: [
      { type: "entry",          defaultLabel: "Grand Entry",    x:   0, y:   0, width: 150, height: 200 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 150, y:   0, width: 350, height: 200 },
      { type: "ensuite",        defaultLabel: "Ensuite",        x: 500, y:   0, width: 150, height: 200 },
      { type: "bathroom",       defaultLabel: "Main Bathroom",  x: 650, y:   0, width: 200, height: 200 },
      { type: "bathroom",       defaultLabel: "Guest WC",       x: 850, y:   0, width: 150, height: 200 },
      { type: "living",         defaultLabel: "Living Room",    x:   0, y: 200, width: 400, height: 150 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x: 400, y: 200, width: 250, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 650, y: 200, width: 200, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 3",      x: 850, y: 200, width: 150, height: 150 },
      { type: "dining",         defaultLabel: "Dining Room",    x:   0, y: 350, width: 300, height: 100 },
      { type: "garage",         defaultLabel: "Garage",         x: 300, y: 350, width: 250, height: 100 },
      { type: "hallway",        defaultLabel: "Hallway",        x: 550, y: 350, width: 100, height: 100 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 650, y: 350, width: 150, height: 100 },
      { type: "bedroom",        defaultLabel: "Bedroom 4",      x: 800, y: 350, width: 200, height: 100 },
    ],
  },

  "4bed_with_garage": {
    description: "Builder-friendly 4-bedroom home with integrated garage",
    totalArea: 176,
    slots: [
      { type: "garage",         defaultLabel: "Garage",         x:   0, y:   0, width: 250, height: 200 },
      { type: "entry",          defaultLabel: "Entry",          x: 250, y:   0, width: 150, height: 200 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 400, y:   0, width: 250, height: 200 },
      { type: "ensuite",        defaultLabel: "Ensuite",        x: 650, y:   0, width: 100, height: 200 },
      { type: "bathroom",       defaultLabel: "Main Bathroom",  x: 750, y:   0, width: 150, height: 200 },
      { type: "living",         defaultLabel: "Living Room",    x:   0, y: 200, width: 300, height: 200 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x: 300, y: 200, width: 200, height: 200 },
      { type: "bedroom",        defaultLabel: "Bedroom 2",      x: 500, y: 200, width: 200, height: 200 },
      { type: "bedroom",        defaultLabel: "Bedroom 3",      x: 700, y: 200, width: 200, height: 200 },
      { type: "dining",         defaultLabel: "Dining Room",    x:   0, y: 400, width: 250, height: 150 },
      { type: "hallway",        defaultLabel: "Hallway",        x: 250, y: 400, width: 150, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 400, y: 400, width: 100, height: 150 },
      { type: "bedroom",        defaultLabel: "Bedroom 4",      x: 500, y: 400, width: 200, height: 150 },
      { type: "bathroom",       defaultLabel: "Guest WC",       x: 700, y: 400, width: 200, height: 150 },
    ],
  },

  "studio": {
    description: "Efficient studio apartment with open-plan living",
    totalArea: 63,
    slots: [
      { type: "studio",   defaultLabel: "Living / Bedroom", x:   0, y:   0, width: 300, height: 250 },
      { type: "kitchen",  defaultLabel: "Kitchenette",      x: 300, y:   0, width: 150, height: 250 },
      { type: "entry",    defaultLabel: "Entry",            x:   0, y: 250, width: 150, height: 100 },
      { type: "bathroom", defaultLabel: "Bathroom",         x: 150, y: 250, width: 200, height: 100 },
      { type: "laundry",  defaultLabel: "Laundry",          x: 350, y: 250, width: 100, height: 100 },
    ],
  },

  "1bed_unit": {
    description: "1-bedroom unit for singles or couples",
    totalArea: 80,
    slots: [
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 250 },
      { type: "living",         defaultLabel: "Living Room",    x: 100, y:   0, width: 250, height: 250 },
      { type: "master_bedroom", defaultLabel: "Master Bedroom", x: 350, y:   0, width: 150, height: 250 },
      { type: "kitchen",        defaultLabel: "Kitchen",        x:   0, y: 250, width: 150, height: 150 },
      { type: "dining",         defaultLabel: "Dining",         x: 150, y: 250, width: 150, height: 150 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 300, y: 250, width: 100, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 400, y: 250, width: 100, height: 150 },
    ],
  },

  "1bed_open_plan": {
    description: "1-bedroom open-plan unit for singles or couples",
    totalArea: 84,
    slots: [
      { type: "entry",          defaultLabel: "Entry",          x:   0, y:   0, width: 100, height: 150 },
      { type: "living",         defaultLabel: "Open Living",    x: 100, y:   0, width: 300, height: 150 },
      { type: "master_bedroom", defaultLabel: "Bedroom",        x: 400, y:   0, width: 200, height: 200 },
      { type: "kitchen",        defaultLabel: "Open Kitchen",   x:   0, y: 150, width: 150, height: 200 },
      { type: "dining",         defaultLabel: "Dining",         x: 150, y: 150, width: 250, height: 200 },
      { type: "bathroom",       defaultLabel: "Bathroom",       x: 400, y: 200, width: 100, height: 150 },
      { type: "laundry",        defaultLabel: "Laundry",        x: 500, y: 200, width: 100, height: 150 },
    ],
  },
};

const ROOM_TYPE_ALIASES: Record<string, string> = {
  home_office: "study",
  office: "study",
  office_room: "study",
  study_room: "study",
  wc: "bathroom",
  guest_wc: "bathroom",
  powder_room: "bathroom",
  lounge: "living",
};

const DEFAULT_DOOR_NEIGHBORS = ["hallway", "entry", "living", "dining", "kitchen"];

const DOOR_NEIGHBOR_PRIORITY: Record<string, string[]> = {
  bathroom: ["hallway", "bedroom", "master_bedroom"],
  bedroom: ["hallway", "entry", "living"],
  dining: ["living", "kitchen", "entry"],
  ensuite: ["master_bedroom", "hallway"],
  garage: ["entry", "hallway", "laundry"],
  kitchen: ["dining", "living", "hallway"],
  laundry: ["hallway", "bathroom", "garage", "kitchen"],
  living: ["entry", "dining", "kitchen"],
  master_bedroom: ["ensuite", "hallway", "entry"],
  studio: ["entry", "kitchen"],
  study: ["hallway", "entry", "living"],
};

const WINDOW_WALL_PRIORITY: Record<string, WallSide[]> = {
  bedroom: ["top", "right", "bottom", "left"],
  dining: ["bottom", "left", "top", "right"],
  kitchen: ["top", "bottom", "left", "right"],
  living: ["bottom", "left", "top", "right"],
  master_bedroom: ["top", "right", "bottom", "left"],
  studio: ["top", "left", "bottom", "right"],
  study: ["top", "right", "bottom", "left"],
};

export function generateLayout(aiResponse: AIResponse, options: GenerateLayoutOptions = {}): FloorPlan {
  const requestedTemplate = aiResponse.template;
  const templateKey = selectTemplateKey(requestedTemplate, options.preferredTemplate);
  const tpl = PIXEL_TEMPLATES[templateKey];
  const notes = collectNotes(aiResponse, options, requestedTemplate, templateKey);

  return buildPlan(templateKey, tpl, aiResponse.rooms ?? [], notes);
}

export function inferTemplateFromText(text: string, fallback = "3bed_rectangle"): string {
  const lower = text.toLowerCase();
  if (/\bstudio\b/.test(lower)) return "studio";

  const bedroomCount = parseBedroomCount(lower);
  if (!bedroomCount) return isKnownTemplate(fallback) ? fallback : "3bed_rectangle";

  if (bedroomCount === 1 && mentionsOpenPlan(lower)) {
    return "1bed_open_plan";
  }

  if (bedroomCount === 2 && mentionsCompactUnit(lower)) {
    return "2bed_compact_unit";
  }

  if (bedroomCount === 3 && mentionsNarrowLot(lower)) {
    return "3bed_narrow_lot";
  }

  if (bedroomCount === 3 && mentionsLShape(lower)) {
    return "3bed_l_shape";
  }

  if (bedroomCount === 3 && mentionsLargeKitchen(lower)) {
    return "3bed_open_kitchen";
  }

  if (bedroomCount >= 4 && mentionsBuilderGarage(lower)) {
    return "4bed_with_garage";
  }

  return templateForBedroomCount(bedroomCount);
}

export function templateForBedroomCount(count: number): string {
  if (count <= 0) return "studio";
  if (count === 1) return "1bed_unit";
  if (count === 2) return "2bed_apartment";
  if (count === 3) return "3bed_rectangle";
  return "4bed_villa";
}

export function countSleepingRooms(rooms: Array<{ type: string }>): number {
  return rooms.filter((room) => isSleepingRoomType(room.type)).length;
}

export function isKnownTemplate(template: string | undefined): template is string {
  return !!template && Object.prototype.hasOwnProperty.call(PIXEL_TEMPLATES, template);
}

export function listPixelTemplates(): { key: string; description: string; totalArea: number }[] {
  return Object.entries(PIXEL_TEMPLATES).map(([key, template]) => ({
    key,
    description: template.description,
    totalArea: template.totalArea,
  }));
}

function buildPlan(templateKey: string, template: PixelTemplate, aiRooms: AIRoom[], notes: string[]): FloorPlan {
  const { rooms, preferences } = mapSlotsToRooms(template.slots, aiRooms);
  const { doors, windows } = generateDoorsAndWindows(rooms, preferences, aiRooms);
  const uniqueNotes = uniqueNonEmpty(notes);

  return regenerateFurniture(regenerateMaterials({
    rooms,
    doors,
    windows,
    totalArea: template.totalArea,
    template: templateKey,
    ...(uniqueNotes.length ? { generationNotes: uniqueNotes } : {}),
  }));
}

function mapSlotsToRooms(slots: Slot[], aiRooms: AIRoom[]): { rooms: Room[]; preferences: Record<string, RoomPreference> } {
  const queues: Record<string, AIRoom[]> = {};
  for (const room of aiRooms) {
    const normalizedType = normalizeRoomType(room.type);
    (queues[normalizedType] ??= []).push({ ...room, type: normalizedType });
  }

  const slotCount: Record<string, number> = {};
  const preferences: Record<string, RoomPreference> = {};

  const rooms = slots.map((slot) => {
    const idx = slotCount[slot.type] ?? 0;
    slotCount[slot.type] = idx + 1;
    const fallbackId = `${slot.type}_${idx + 1}`;

    const aiRoom = consumeRoomForSlot(slot, queues);
    const roomType = aiRoom && roomFitsSlot(slot.type, aiRoom.type) ? aiRoom.type : slot.type;
    const id = sanitizeId(aiRoom?.id, fallbackId);

    preferences[id] = {
      hasDoor: aiRoom?.hasDoor,
      hasWindow: aiRoom?.hasWindow,
    };

    const room: Room = {
      id,
      type: roomType,
      label: aiRoom?.label || slot.defaultLabel,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
    };

    return room;
  });

  return { rooms, preferences };
}

function consumeRoomForSlot(slot: Slot, queues: Record<string, AIRoom[]>): AIRoom | undefined {
  const exact = queues[slot.type];
  if (exact?.length) return exact.shift();

  if (slot.type === "bedroom") {
    const study = queues.study;
    if (study?.length) return study.shift();
  }

  return undefined;
}



function generateDoorsAndWindows(
  rooms: Room[],
  preferences: Record<string, RoomPreference>,
  aiRooms?: AIRoom[],
): { doors: Door[]; windows: FPWindow[] } {
  const doors: Door[] = [];
  const windows: FPWindow[] = [];
  const aiRoomMap = new Map<string, AIRoom>();
  if (aiRooms) {
    for (const ar of aiRooms) {
      aiRoomMap.set(ar.id, ar);
    }
  }

  for (const room of rooms) {
    const preference = preferences[room.id];
    const aiRoom = aiRoomMap.get(room.id);
    if (preference?.hasDoor ?? true) {
      const door = pickDoor(room, rooms, aiRoom?.adjacentTo);
      if (door) doors.push({
        ...door,
        widthMeters: DEFAULT_DOOR_WIDTH_METERS,
        hinge: "left",
        swing: "inward",
      });
    }

    if (preference?.hasWindow ?? roomShouldHaveWindow(room.type)) {
      const wall = pickWindowWall(room, rooms, aiRoom?.zone);
      if (wall) windows.push({ roomId: room.id, wall, position: 0.5, widthMeters: DEFAULT_WINDOW_WIDTH_METERS });
    }
  }

  return { doors, windows };
}

function pickDoor(room: Room, rooms: Room[], adjacentTo?: string[]): Door | null {
  if (normalizeRoomType(room.type) === "entry") {
    const exteriorWall = pickExteriorWall(room, rooms, ["left", "top", "bottom", "right"]);
    if (exteriorWall) return { roomId: room.id, wall: exteriorWall, position: 0.5 };
  }

  const adjacentRooms = getAdjacentRooms(room, rooms);
  if (!adjacentRooms.length) {
    const exteriorWall = pickExteriorWall(room, rooms, WALL_SIDES);
    return exteriorWall ? { roomId: room.id, wall: exteriorWall, position: 0.5 } : null;
  }

  const roomType = normalizeRoomType(room.type);
  const priorities = DOOR_NEIGHBOR_PRIORITY[roomType] ?? DEFAULT_DOOR_NEIGHBORS;

  for (const preferredType of priorities) {
    const match = adjacentRooms.find((adjacent) => normalizeRoomType(adjacent.room.type) === preferredType);
    if (match) return { roomId: room.id, wall: match.wall, position: match.position };
  }

  if (adjacentTo?.length) {
    for (const targetId of adjacentTo) {
      const match = adjacentRooms.find((adjacent) => adjacent.room.id === targetId);
      if (match) return { roomId: room.id, wall: match.wall, position: match.position };
    }
  }

  const widestSharedWall = adjacentRooms.toSorted((a, b) => b.overlap - a.overlap)[0];
  return { roomId: room.id, wall: widestSharedWall.wall, position: widestSharedWall.position };
}

function pickWindowWall(room: Room, rooms: Room[], zone?: "public" | "private" | "service"): WallSide | null {
  const roomType = normalizeRoomType(room.type);
  const priorities = WINDOW_WALL_PRIORITY[roomType] ?? ["top", "bottom", "left", "right"];

  if (zone === "private") {
    const reversed: WallSide[] = [...priorities].reverse();
    return pickExteriorWall(room, rooms, reversed);
  }

  return pickExteriorWall(room, rooms, priorities);
}

function pickExteriorWall(room: Room, rooms: Room[], priorities: WallSide[]): WallSide | null {
  const exteriorWalls = getExteriorWalls(room, rooms);
  for (const wall of priorities) {
    if (exteriorWalls.includes(wall)) return wall;
  }
  return exteriorWalls[0] ?? null;
}

function selectTemplateKey(requestedTemplate: string | undefined, preferredTemplate: string | undefined): string {
  if (isKnownTemplate(requestedTemplate)) return requestedTemplate;
  if (isKnownTemplate(preferredTemplate)) return preferredTemplate;
  return "3bed_rectangle";
}

function collectNotes(
  aiResponse: AIResponse,
  options: GenerateLayoutOptions,
  requestedTemplate: string | undefined,
  templateKey: string,
): string[] {
  const notes = [
    ...(options.generationNotes ?? []),
    ...(aiResponse.generationNotes ?? []),
  ];

  if (requestedTemplate && requestedTemplate !== templateKey && !isKnownTemplate(requestedTemplate)) {
    notes.push(`Unsupported template "${requestedTemplate}" was replaced with "${templateKey}".`);
  }

  if (aiResponse.unsupportedFeatures?.length) {
    notes.push(`Unsupported request not applied: ${aiResponse.unsupportedFeatures.join(", ")}.`);
  }

  return notes;
}

function normalizeRoomType(type: string): string {
  const normalized = type.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return ROOM_TYPE_ALIASES[normalized] ?? normalized;
}

function roomFitsSlot(slotType: string, roomType: string): boolean {
  if (slotType === roomType) return true;
  return slotType === "bedroom" && roomType === "study";
}

function roomShouldHaveWindow(type: string): boolean {
  return ["bedroom", "dining", "kitchen", "living", "master_bedroom", "studio", "study"].includes(normalizeRoomType(type));
}

function isSleepingRoomType(type: string): boolean {
  const normalized = normalizeRoomType(type);
  return normalized === "bedroom" || normalized === "master_bedroom";
}

function sanitizeId(value: string | undefined, fallback: string): string {
  const sanitized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || fallback;
}

function parseBedroomCount(text: string): number | null {
  const numericMatch = text.match(/\b([1-4])\s*(?:bed|beds|bedroom|bedrooms)\b/);
  if (numericMatch) return Number(numericMatch[1]);

  const wordMatches: Array<[RegExp, number]> = [
    [/\bone\s+(?:bed|bedroom|bedrooms)\b/, 1],
    [/\btwo\s+(?:bed|bedroom|bedrooms)\b/, 2],
    [/\bthree\s+(?:bed|bedroom|bedrooms)\b/, 3],
    [/\bfour\s+(?:bed|bedroom|bedrooms)\b/, 4],
  ];

  for (const [pattern, count] of wordMatches) {
    if (pattern.test(text)) return count;
  }

  return null;
}

function mentionsLargeKitchen(text: string): boolean {
  return /\b(?:large|larger|bigger|open|expanded)\b.{0,24}\bkitchen\b/.test(text)
    || /\bkitchen\b.{0,24}\b(?:large|larger|bigger|open|expanded)\b/.test(text);
}

function mentionsNarrowLot(text: string): boolean {
  return /\b(?:narrow|skinny|slim|long)\s+(?:lot|block|site|home|house)\b/.test(text)
    || /\b(?:terrace|townhouse|row\s*house|narrow-lot)\b/.test(text);
}

function mentionsLShape(text: string): boolean {
  return /\bl[-\s]?shaped?\b/.test(text)
    || /\bl\s+shape\b/.test(text)
    || /\b(?:courtyard|corner\s+lot|side\s+garden|wraparound)\b/.test(text);
}

function mentionsCompactUnit(text: string): boolean {
  return /\b(?:very\s+compact|compact|small|tiny|efficient|dense|minimal\s+corridor|minimized\s+corridor|feasibility|unit)\b/.test(text);
}

function mentionsOpenPlan(text: string): boolean {
  return /\b(?:open[-\s]?plan|loft|open\s+living|combined\s+kitchen|combined\s+living|couple)\b/.test(text);
}

function mentionsBuilderGarage(text: string): boolean {
  return /\b(?:garage|carport|parking|builder|spec\s+home|buildable|marketable)\b/.test(text)
    && !/\b(?:villa|premium|luxury|upscale|estate)\b/.test(text);
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
