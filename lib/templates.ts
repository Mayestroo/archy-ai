/**
 * lib/templates.ts
 *
 * Canonical floor plan templates used to guide AI generation.
 * All measurements are in METERS. The AI layer converts to pixels (1m = 50px).
 *
 * Zone origins are relative to the bounding box top-left corner.
 * Room "portion" values within a zone must sum to 1.0.
 */

export type RoomType =
  | "living"
  | "dining"
  | "kitchen"
  | "bedroom"
  | "master_bedroom"
  | "bathroom"
  | "ensuite"
  | "hallway"
  | "laundry"
  | "entry"
  | "garage"
  | "studio";

export interface ZoneDef {
  x: number;       // meters from bounding box left
  y: number;       // meters from bounding box top
  width: number;   // meters
  height: number;  // meters
}

export interface RoomDef {
  type: RoomType;
  zone: "public" | "private" | "service";
  portion: number; // fraction of zone area this room takes (0–1)
  label?: string;  // override display label if needed
}

export interface FloorPlanTemplate {
  description: string;
  totalArea: number;            // sqm
  boundingBox: { width: number; height: number }; // meters
  zones: {
    public?: ZoneDef;
    private?: ZoneDef;
    service?: ZoneDef;
  };
  rooms: RoomDef[];
  notes?: string;
}

// ── Templates ──────────────────────────────────────────────────────────────────

export const TEMPLATES: Record<string, FloorPlanTemplate> = {

  // ── 3-Bedroom Family Home (Rectangle) ────────────────────────────────────────
  "3bed_rectangle": {
    description: "Classic 3-bedroom family home in a clean rectangle",
    totalArea: 150,
    boundingBox: { width: 15, height: 10 },
    zones: {
      public:  { x: 0,  y: 0, width: 7,  height: 10 },
      private: { x: 7,  y: 0, width: 6,  height: 10 },
      service: { x: 13, y: 0, width: 2,  height: 10 },
    },
    rooms: [
      // Public zone (LEFT) — portions sum to 1.0
      { type: "entry",          zone: "public",  portion: 0.10, label: "Entry" },
      { type: "living",         zone: "public",  portion: 0.38, label: "Living Room" },
      { type: "dining",         zone: "public",  portion: 0.22, label: "Dining Room" },
      { type: "kitchen",        zone: "public",  portion: 0.30, label: "Kitchen" },
      // Private zone (RIGHT) — bedrooms + wet rooms — portions sum to 1.0
      { type: "master_bedroom", zone: "private", portion: 0.30, label: "Master Bedroom" },
      { type: "ensuite",        zone: "private", portion: 0.10, label: "Ensuite" },
      { type: "bedroom",        zone: "private", portion: 0.22, label: "Bedroom 2" },
      { type: "bedroom",        zone: "private", portion: 0.22, label: "Bedroom 3" },
      { type: "bathroom",       zone: "private", portion: 0.16, label: "Bathroom" },
      // Service zone (FAR RIGHT strip) — portions sum to 1.0
      { type: "laundry",        zone: "service", portion: 0.50, label: "Laundry" },
      { type: "hallway",        zone: "service", portion: 0.50, label: "Hallway" },
    ],
    notes: "Public on west, private (bedrooms+bathrooms) in centre, service strip on east.",
  },

  // ── 2-Bedroom Apartment ───────────────────────────────────────────────────────
  "2bed_apartment": {
    description: "Compact 2-bedroom apartment, optimised for urban density",
    totalArea: 80,
    boundingBox: { width: 10, height: 8 },
    zones: {
      public:  { x: 0, y: 0, width: 5,  height: 8 },
      private: { x: 5, y: 0, width: 3,  height: 8 },
      service: { x: 8, y: 0, width: 2,  height: 8 },
    },
    rooms: [
      // Public zone (LEFT) — living areas
      { type: "entry",          zone: "public",  portion: 0.10, label: "Entry" },
      { type: "living",         zone: "public",  portion: 0.45, label: "Living / Lounge" },
      { type: "dining",         zone: "public",  portion: 0.25, label: "Dining" },
      { type: "kitchen",        zone: "public",  portion: 0.20, label: "Kitchen" },
      // Private zone (RIGHT) — bedrooms + bathroom
      { type: "master_bedroom", zone: "private", portion: 0.45, label: "Master Bedroom" },
      { type: "bedroom",        zone: "private", portion: 0.35, label: "Bedroom 2" },
      { type: "bathroom",       zone: "private", portion: 0.20, label: "Bathroom" },
      // Service zone (FAR RIGHT)
      { type: "laundry",        zone: "service", portion: 0.55, label: "Laundry" },
      { type: "hallway",        zone: "service", portion: 0.45, label: "Hallway" },
    ],
    notes: "Open-plan kitchen/dining/living on left. Bedrooms+bathroom on right. Service strip far right.",
  },

  // ── 4-Bedroom Villa (L-Shape) ─────────────────────────────────────────────────
  "4bed_villa": {
    description: "Spacious 4-bedroom villa with L-shaped layout and garage",
    totalArea: 250,
    boundingBox: { width: 20, height: 14 },
    zones: {
      public:  { x: 0,  y: 0, width: 9, height: 14 },
      private: { x: 9,  y: 0, width: 9, height: 14 },
      service: { x: 18, y: 0, width: 2, height: 14 },
    },
    rooms: [
      // Public zone (LEFT) — living areas + garage
      { type: "entry",          zone: "public",  portion: 0.07, label: "Grand Entry" },
      { type: "living",         zone: "public",  portion: 0.30, label: "Living Room" },
      { type: "dining",         zone: "public",  portion: 0.20, label: "Dining Room" },
      { type: "kitchen",        zone: "public",  portion: 0.22, label: "Kitchen" },
      { type: "garage",         zone: "public",  portion: 0.21, label: "Garage" },
      // Private zone (RIGHT) — ALL bedrooms + bathrooms
      { type: "master_bedroom", zone: "private", portion: 0.23, label: "Master Bedroom" },
      { type: "ensuite",        zone: "private", portion: 0.08, label: "Ensuite" },
      { type: "bedroom",        zone: "private", portion: 0.17, label: "Bedroom 2" },
      { type: "bedroom",        zone: "private", portion: 0.17, label: "Bedroom 3" },
      { type: "bedroom",        zone: "private", portion: 0.14, label: "Bedroom 4" },
      { type: "bathroom",       zone: "private", portion: 0.12, label: "Main Bathroom" },
      { type: "bathroom",       zone: "private", portion: 0.09, label: "Guest WC" },
      // Service zone (FAR RIGHT strip)
      { type: "laundry",        zone: "service", portion: 0.55, label: "Laundry" },
      { type: "hallway",        zone: "service", portion: 0.45, label: "Hallway" },
    ],
    notes: "Public zone left, private (bedrooms+bathrooms) centre-right, service strip far right.",
  },

  // ── Studio Apartment ──────────────────────────────────────────────────────────
  "studio": {
    description: "Efficient studio apartment — single open-plan living space",
    totalArea: 35,
    boundingBox: { width: 7, height: 5 },
    zones: {
      // Studios are largely open-plan; we treat it as a single public zone
      public:  { x: 0, y: 0, width: 5, height: 5 },
      service: { x: 5, y: 0, width: 2, height: 5 },
    },
    rooms: [
      // Public zone — 25 sqm open plan
      { type: "studio",   zone: "public",  portion: 0.60, label: "Living / Bedroom" },
      { type: "kitchen",  zone: "public",  portion: 0.24, label: "Kitchenette" },
      { type: "entry",    zone: "public",  portion: 0.16, label: "Entry / Hall" },
      // Service zone — 10 sqm
      { type: "bathroom", zone: "service", portion: 0.60, label: "Bathroom" },
      { type: "laundry",  zone: "service", portion: 0.40, label: "Laundry" },
    ],
    notes: "No separation between sleeping and living areas. Wet areas grouped on east wall.",
  },
};

// ── Helper: pixel conversion ───────────────────────────────────────────────────

const PX_PER_METER = 50;

/** Convert a template bounding box from meters to pixels. */
export function templateToPixels(template: FloorPlanTemplate) {
  const convert = (v: number) => v * PX_PER_METER;
  return {
    ...template,
    boundingBox: {
      width:  convert(template.boundingBox.width),
      height: convert(template.boundingBox.height),
    },
    zones: Object.fromEntries(
      Object.entries(template.zones).map(([k, z]) => [
        k,
        z ? {
          x:      convert(z.x),
          y:      convert(z.y),
          width:  convert(z.width),
          height: convert(z.height),
        } : undefined,
      ])
    ),
  };
}

/** Get a template by key, or undefined if not found. */
export function getTemplate(key: string): FloorPlanTemplate | undefined {
  return TEMPLATES[key];
}

/** List all available template keys and their descriptions. */
export function listTemplates(): { key: string; description: string; totalArea: number }[] {
  return Object.entries(TEMPLATES).map(([key, t]) => ({
    key,
    description: t.description,
    totalArea:   t.totalArea,
  }));
}
