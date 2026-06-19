import type { ExteriorConceptBrief, ExteriorConceptStyle, FloorPlan, RoomMaterial } from "./floorplan-schema";
import { ensureMaterials } from "./materials.ts";

interface FacadeStylePreset {
  value: ExteriorConceptStyle;
  label: string;
  massing: string;
  materials: string;
  roofline: string;
  detailing: string;
}

export const EXTERIOR_CONCEPT_STYLE_OPTIONS: FacadeStylePreset[] = [
  {
    value: "modern_minimal",
    label: "Modern Minimal",
    massing: "clean rectilinear forms with a calm, low-clutter street presence",
    materials: "smooth render, dark window frames, and restrained timber or stone accents",
    roofline: "flat or very low-pitch roof expression with crisp parapet lines",
    detailing: "recessed entry, simple outdoor lighting, and minimal landscape edging",
  },
  {
    value: "warm_contemporary",
    label: "Warm Contemporary",
    massing: "balanced family-home proportions with warm layered volumes",
    materials: "light render, warm timber battens, stone-look base courses, and soft neutral trims",
    roofline: "low-pitch roof planes with generous eaves and a welcoming entry canopy",
    detailing: "feature entry path, planted edges, and warm exterior lighting",
  },
  {
    value: "scandinavian",
    label: "Scandinavian",
    massing: "simple gabled forms with a bright, compact, functional character",
    materials: "pale cladding, light brick or render, natural timber accents, and charcoal frames",
    roofline: "clean gable roof profile with minimal gutters and simple fascia lines",
    detailing: "covered entry, soft planting, and restrained black metal details",
  },
  {
    value: "luxury_villa",
    label: "Luxury Villa",
    massing: "premium horizontal composition with layered private and public volumes",
    materials: "stone-look walls, large glazing, warm soffits, dark metalwork, and refined render",
    roofline: "broad floating roof planes or refined parapets with deep shadow lines",
    detailing: "statement entry, architectural lighting, privacy screens, and curated landscape zones",
  },
  {
    value: "builder_spec",
    label: "Builder Spec",
    massing: "marketable, efficient street elevation with clear entry and garage hierarchy",
    materials: "cost-conscious render, brick veneer, feature cladding panels, and standard dark frames",
    roofline: "simple buildable roof form with efficient spans and familiar suburban proportions",
    detailing: "display-home entry treatment, durable finishes, and easy-to-build facade articulation",
  },
];

export function applyExteriorConcept(floorPlan: FloorPlan, style: ExteriorConceptStyle): FloorPlan {
  const hydratedPlan = ensureMaterials(floorPlan);
  return {
    ...hydratedPlan,
    exteriorConcept: createExteriorConcept(hydratedPlan, style),
  };
}

function createExteriorConcept(floorPlan: FloorPlan, style: ExteriorConceptStyle): ExteriorConceptBrief {
  const preset = stylePreset(style);
  const stats = getPlanStats(floorPlan);
  const footprint = getFootprintSummary(floorPlan);
  const materialCues = getMaterialCues(floorPlan.materials ?? []);
  const garageCue = stats.garages > 0 ? "integrated garage frontage" : "pedestrian-focused entry frontage";
  const planType = floorPlan.template ? humanize(floorPlan.template) : `${stats.beds}-bed residential concept`;

  return {
    id: `facade_${style}_${Date.now()}`,
    style,
    styleLabel: preset.label,
    title: `${preset.label} Facade Concept`,
    summary: `${preset.label} facade for a ${planType.toLowerCase()} with ${stats.beds} bedrooms, ${stats.baths} bathrooms, ${garageCue}, and a ${footprint.shape} footprint. The elevation uses ${preset.massing} and coordinates with interior cues such as ${materialCues.join(", ")}.`,
    palette: [preset.materials, ...materialCues.slice(0, 3)],
    facadeMoves: [
      `Massing: ${preset.massing}.`,
      `Roofline: ${preset.roofline}.`,
      `Entry: emphasize a clear front-door sequence tied to the ${garageCue}.`,
      `Openings: align glazing rhythm to living, bedroom, and service zones while preserving privacy.`,
      `Details: ${preset.detailing}.`,
    ],
    renderPrompt: buildRenderPrompt(floorPlan, preset, stats, footprint, materialCues, garageCue),
    createdAt: new Date().toISOString(),
  };
}

function buildRenderPrompt(
  floorPlan: FloorPlan,
  preset: FacadeStylePreset,
  stats: ReturnType<typeof getPlanStats>,
  footprint: ReturnType<typeof getFootprintSummary>,
  materialCues: string[],
  garageCue: string,
) {
  return [
    `Exterior architectural facade concept for a single-storey ${stats.beds}-bedroom residential floor plan, ${floorPlan.totalArea || stats.area} square metres, ${footprint.shape} footprint, ${garageCue}.`,
    `Style: ${preset.label}.`,
    `Massing: ${preset.massing}.`,
    `Exterior materials: ${preset.materials}; coordinate with interior finish cues: ${materialCues.join(", ")}.`,
    `Roof and silhouette: ${preset.roofline}.`,
    `Details: ${preset.detailing}.`,
    "Camera: street-level three-quarter architectural exterior view, daylight, realistic proportions, landscaped front setback, no people, no cars unless garage context needs scale, no text overlays.",
  ].join(" ");
}

function getPlanStats(floorPlan: FloorPlan) {
  return {
    area: Math.round(floorPlan.rooms.reduce((sum, room) => sum + (room.width * room.height) / 2500, 0)),
    beds: floorPlan.rooms.filter((room) => room.type === "bedroom" || room.type === "master_bedroom").length,
    baths: floorPlan.rooms.filter((room) => room.type === "bathroom" || room.type === "ensuite").length,
    garages: floorPlan.rooms.filter((room) => room.type === "garage").length,
  };
}

function getFootprintSummary(floorPlan: FloorPlan) {
  const minX = Math.min(...floorPlan.rooms.map((room) => room.x));
  const minY = Math.min(...floorPlan.rooms.map((room) => room.y));
  const maxX = Math.max(...floorPlan.rooms.map((room) => room.x + room.width));
  const maxY = Math.max(...floorPlan.rooms.map((room) => room.y + room.height));
  const width = maxX - minX;
  const height = maxY - minY;
  const ratio = width / Math.max(height, 1);
  const hasOffsetRooms = floorPlan.rooms.some((room) => room.x > minX && room.x + room.width < maxX && room.y > minY && room.y + room.height < maxY);
  const shape = ratio > 1.55 ? "wide street-facing" : ratio < 0.75 ? "narrow-lot" : hasOffsetRooms ? "layered" : "balanced rectangular";
  return { width, height, shape };
}

function getMaterialCues(materials: RoomMaterial[]) {
  const cues = Array.from(new Set(materials.flatMap((material) => [material.palette, material.floorFinish]).filter(Boolean)));
  return cues.length ? cues.slice(0, 4) : ["soft neutral palette", "durable exterior finishes"];
}

function stylePreset(style: ExteriorConceptStyle): FacadeStylePreset {
  return EXTERIOR_CONCEPT_STYLE_OPTIONS.find((option) => option.value === style) ?? EXTERIOR_CONCEPT_STYLE_OPTIONS[0];
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
