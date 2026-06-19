import type { FloorPlan, FurnitureItem, InteriorConceptBrief, InteriorConceptStyle, Room, RoomMaterial } from "./floorplan-schema";
import { ensureFurniture } from "./furniture.ts";
import { ensureMaterials, getRoomMaterial } from "./materials.ts";

interface ConceptStylePreset {
  value: InteriorConceptStyle;
  label: string;
  mood: string;
  lighting: string;
  detailing: string;
}

export const INTERIOR_CONCEPT_STYLE_OPTIONS: ConceptStylePreset[] = [
  {
    value: "warm_minimal",
    label: "Warm Minimal",
    mood: "quiet, tactile, uncluttered, and welcoming",
    lighting: "soft indirect lighting with warm highlights",
    detailing: "simple built-ins, natural textures, and restrained decor",
  },
  {
    value: "modern_neutral",
    label: "Modern Neutral",
    mood: "clean, balanced, practical, and contemporary",
    lighting: "bright natural light with crisp ambient lighting",
    detailing: "simple profiles, neutral surfaces, and practical storage",
  },
  {
    value: "scandinavian",
    label: "Scandinavian",
    mood: "light, airy, calm, and functional",
    lighting: "diffuse daylight with warm task lighting",
    detailing: "pale timber, soft textiles, and minimal black accents",
  },
  {
    value: "luxury_contemporary",
    label: "Luxury Contemporary",
    mood: "polished, refined, layered, and premium",
    lighting: "architectural lighting with feature pendants and subtle wall washing",
    detailing: "stone-look finishes, metallic accents, and tailored furniture",
  },
  {
    value: "builder_display",
    label: "Builder Display",
    mood: "marketable, bright, durable, and move-in ready",
    lighting: "clear presentation lighting with broad natural brightness",
    detailing: "cost-conscious finishes, display-home styling, and buyer-friendly staging",
  },
];

export function applyInteriorConcept(floorPlan: FloorPlan, roomId: string, style: InteriorConceptStyle): FloorPlan {
  const hydratedPlan = ensureFurniture(ensureMaterials(floorPlan));
  const concept = createInteriorConcept(hydratedPlan, roomId, style);
  if (!concept) return floorPlan;

  return {
    ...hydratedPlan,
    interiorConcepts: [
      ...(hydratedPlan.interiorConcepts ?? []).filter((item) => item.roomId !== roomId),
      concept,
    ],
  };
}

export function getRoomInteriorConcept(floorPlan: FloorPlan, roomId: string): InteriorConceptBrief | null {
  return floorPlan.interiorConcepts?.find((concept) => concept.roomId === roomId) ?? null;
}

export function pruneInvalidInteriorConcepts(floorPlan: FloorPlan): FloorPlan {
  if (!floorPlan.interiorConcepts) return floorPlan;
  const roomIds = new Set(floorPlan.rooms.map((room) => room.id));
  return {
    ...floorPlan,
    interiorConcepts: floorPlan.interiorConcepts.filter((concept) => roomIds.has(concept.roomId)),
  };
}

function createInteriorConcept(floorPlan: FloorPlan, roomId: string, style: InteriorConceptStyle): InteriorConceptBrief | null {
  const room = floorPlan.rooms.find((candidate) => candidate.id === roomId);
  if (!room) return null;

  const preset = stylePreset(style);
  const material = getRoomMaterial(floorPlan, room.id);
  const furniture = (floorPlan.furniture ?? []).filter((item) => item.roomId === room.id);
  const roomSize = `${formatMeters(room.width)} x ${formatMeters(room.height)}`;
  const furnitureNames = furniture.map((item) => humanizeFurniture(item));
  const furnitureSummary = furnitureNames.length ? furnitureNames.join(", ") : "open flexible furnishing zone";
  const materialSummary = material
    ? `${material.palette}: ${material.floorFinish}, ${material.wallFinish}`
    : "soft neutral material palette";
  const roomType = humanize(room.type);

  return {
    id: `${sanitize(room.id)}_${style}_${Date.now()}`,
    roomId: room.id,
    style,
    styleLabel: preset.label,
    title: `${room.label} - ${preset.label} Concept`,
    summary: `${room.label} is treated as a ${preset.mood} ${roomType.toLowerCase()} using ${materialSummary}. The ${roomSize} footprint is staged around ${furnitureSummary}.`,
    palette: material
      ? [material.palette, material.floorFinish, material.wallFinish, preset.lighting]
      : ["Soft Neutral", "matte neutral floor", "soft white paint", preset.lighting],
    furniturePlan: furnitureNames.length
      ? furnitureNames.map((name) => `${name} positioned to keep circulation clear and support the room's primary use.`)
      : ["Keep the centre of the room flexible and use perimeter storage to preserve circulation."],
    renderPrompt: buildRenderPrompt(room, preset, material, furniture, roomSize),
    createdAt: new Date().toISOString(),
  };
}

function buildRenderPrompt(
  room: Room,
  preset: ConceptStylePreset,
  material: RoomMaterial | null,
  furniture: FurnitureItem[],
  roomSize: string,
) {
  const materialText = material
    ? `${material.palette} palette with ${material.floorFinish}, ${material.wallFinish}, and ${material.accentColor} accent cues`
    : "soft neutral finishes with light walls and matte flooring";
  const furnitureText = furniture.length
    ? furniture.map((item) => humanizeFurniture(item)).join(", ")
    : "minimal loose furniture and clear circulation";

  return [
    `Interior concept render for ${room.label}, a ${humanize(room.type).toLowerCase()} measuring ${roomSize}.`,
    `Style: ${preset.label}; mood: ${preset.mood}.`,
    `Materials: ${materialText}.`,
    `Furniture and layout: ${furnitureText}.`,
    `Lighting: ${preset.lighting}.`,
    `Details: ${preset.detailing}.`,
    "Camera: wide-angle eye-level architectural interior view, realistic proportions, clean composition, no people, no text overlays.",
  ].join(" ");
}

function stylePreset(style: InteriorConceptStyle): ConceptStylePreset {
  return INTERIOR_CONCEPT_STYLE_OPTIONS.find((option) => option.value === style) ?? INTERIOR_CONCEPT_STYLE_OPTIONS[0];
}

function humanizeFurniture(item: FurnitureItem) {
  return item.label || humanize(item.type);
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMeters(canvasUnits: number) {
  const meters = canvasUnits / 50;
  return `${Number.isInteger(meters) ? meters.toFixed(0) : meters.toFixed(1)}m`;
}

function sanitize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "room";
}
