import type { FloorPlan, Room, RoomMaterial } from "./floorplan-schema";

export interface MaterialPreset {
  palette: string;
  floorColor: string;
  wallColor: string;
  accentColor: string;
  floorFinish: string;
  wallFinish: string;
}

const DEFAULT_PRESET: MaterialPreset = {
  palette: "Soft Neutral",
  floorColor: "#f1f5f9",
  wallColor: "#f8fafc",
  accentColor: "#64748b",
  floorFinish: "matte neutral floor",
  wallFinish: "soft white paint",
};

const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
  bathroom: {
    palette: "Spa Tile",
    floorColor: "#dbeafe",
    wallColor: "#f0f9ff",
    accentColor: "#0284c7",
    floorFinish: "porcelain tile",
    wallFinish: "water-resistant light tile",
  },
  bedroom: {
    palette: "Warm Rest",
    floorColor: "#f5e6d3",
    wallColor: "#fff7ed",
    accentColor: "#c2410c",
    floorFinish: "warm timber floor",
    wallFinish: "soft warm paint",
  },
  dining: {
    palette: "Natural Dining",
    floorColor: "#e7d7bf",
    wallColor: "#fffbeb",
    accentColor: "#b45309",
    floorFinish: "oak-look timber floor",
    wallFinish: "warm neutral paint",
  },
  ensuite: {
    palette: "Spa Tile",
    floorColor: "#dbeafe",
    wallColor: "#f0f9ff",
    accentColor: "#0284c7",
    floorFinish: "porcelain tile",
    wallFinish: "water-resistant light tile",
  },
  entry: {
    palette: "Durable Entry",
    floorColor: "#e5e7eb",
    wallColor: "#f9fafb",
    accentColor: "#4b5563",
    floorFinish: "durable stone-look tile",
    wallFinish: "hard-wearing neutral paint",
  },
  garage: {
    palette: "Utility Concrete",
    floorColor: "#cbd5e1",
    wallColor: "#e5e7eb",
    accentColor: "#475569",
    floorFinish: "sealed concrete",
    wallFinish: "painted plasterboard",
  },
  hallway: {
    palette: "Continuous Neutral",
    floorColor: "#eee7dc",
    wallColor: "#fafaf9",
    accentColor: "#78716c",
    floorFinish: "continuous timber-look floor",
    wallFinish: "neutral washable paint",
  },
  closet: {
    palette: "Storage Neutral",
    floorColor: "#ede9fe",
    wallColor: "#faf5ff",
    accentColor: "#7c3aed",
    floorFinish: "continuous timber or carpet floor",
    wallFinish: "light washable paint",
  },
  kitchen: {
    palette: "Clean Stone",
    floorColor: "#e2e8f0",
    wallColor: "#f8fafc",
    accentColor: "#2563eb",
    floorFinish: "large-format tile",
    wallFinish: "light washable paint",
  },
  laundry: {
    palette: "Utility Tile",
    floorColor: "#d1d5db",
    wallColor: "#f3f4f6",
    accentColor: "#6b7280",
    floorFinish: "slip-resistant tile",
    wallFinish: "moisture-resistant paint",
  },
  living: {
    palette: "Warm Lounge",
    floorColor: "#ead7bd",
    wallColor: "#fffaf0",
    accentColor: "#16a34a",
    floorFinish: "engineered timber floor",
    wallFinish: "warm white paint",
  },
  master_bedroom: {
    palette: "Calm Suite",
    floorColor: "#e9d5ff",
    wallColor: "#faf5ff",
    accentColor: "#7e22ce",
    floorFinish: "soft carpet or timber floor",
    wallFinish: "calm muted paint",
  },
  studio: {
    palette: "Flexible Studio",
    floorColor: "#dbeafe",
    wallColor: "#eff6ff",
    accentColor: "#2563eb",
    floorFinish: "light timber-look floor",
    wallFinish: "bright neutral paint",
  },
  study: {
    palette: "Focused Work",
    floorColor: "#e0e7ff",
    wallColor: "#eef2ff",
    accentColor: "#4f46e5",
    floorFinish: "quiet timber or carpet floor",
    wallFinish: "low-glare cool paint",
  },
};

export const MATERIAL_PALETTE_OPTIONS: MaterialPreset[] = uniqueMaterialPresets([
  MATERIAL_PRESETS.living,
  MATERIAL_PRESETS.kitchen,
  MATERIAL_PRESETS.bathroom,
  MATERIAL_PRESETS.master_bedroom,
  MATERIAL_PRESETS.bedroom,
  MATERIAL_PRESETS.dining,
  MATERIAL_PRESETS.study,
  MATERIAL_PRESETS.entry,
  MATERIAL_PRESETS.garage,
  MATERIAL_PRESETS.laundry,
  MATERIAL_PRESETS.studio,
  MATERIAL_PRESETS.hallway,
  MATERIAL_PRESETS.closet,
  DEFAULT_PRESET,
]);

export function regenerateMaterials(floorPlan: FloorPlan): FloorPlan {
  return {
    ...floorPlan,
    materials: generateMaterials(floorPlan.rooms),
  };
}

export function ensureMaterials(floorPlan: FloorPlan): FloorPlan {
  if (floorPlan.materials?.length === floorPlan.rooms.length && floorPlan.rooms.every((room) => getRoomMaterial(floorPlan, room.id))) {
    return floorPlan;
  }
  return refreshMaterials(floorPlan);
}

export function refreshMaterials(floorPlan: FloorPlan): FloorPlan {
  const existingByRoomId = new Map((floorPlan.materials ?? []).map((material) => [material.roomId, material]));
  return {
    ...floorPlan,
    materials: floorPlan.rooms.map((room) => {
      const existing = existingByRoomId.get(room.id);
      if (existing?.manual) return existing;
      return { roomId: room.id, ...materialPresetForRoom(room) };
    }),
  };
}

export function applyRoomMaterial(floorPlan: FloorPlan, roomId: string, palette: string): FloorPlan {
  const room = floorPlan.rooms.find((candidate) => candidate.id === roomId);
  if (!room) return floorPlan;

  const preset = materialPresetByPalette(palette) ?? materialPresetForRoom(room);
  const material: RoomMaterial = { roomId, ...preset, manual: true };
  const materials = floorPlan.rooms.map((candidate) => {
    if (candidate.id === roomId) return material;
    return getRoomMaterial(floorPlan, candidate.id) ?? { roomId: candidate.id, ...materialPresetForRoom(candidate) };
  });

  return { ...floorPlan, materials };
}

export function generateMaterials(rooms: Room[]): RoomMaterial[] {
  return rooms.map((room) => ({ roomId: room.id, ...materialPresetForRoom(room) }));
}

export function pruneInvalidMaterials(floorPlan: FloorPlan): FloorPlan {
  if (!floorPlan.materials) return floorPlan;
  const roomIds = new Set(floorPlan.rooms.map((room) => room.id));
  return {
    ...floorPlan,
    materials: floorPlan.materials.filter((material) => roomIds.has(material.roomId)),
  };
}

export function getRoomMaterial(floorPlan: FloorPlan, roomId: string): RoomMaterial | null {
  return floorPlan.materials?.find((material) => material.roomId === roomId) ?? null;
}

export function materialPresetForRoom(room: Pick<Room, "type">): MaterialPreset {
  return MATERIAL_PRESETS[normalizeRoomType(room.type)] ?? DEFAULT_PRESET;
}

export function materialPresetByPalette(palette: string): MaterialPreset | null {
  return MATERIAL_PALETTE_OPTIONS.find((preset) => preset.palette === palette) ?? null;
}

function uniqueMaterialPresets(presets: MaterialPreset[]): MaterialPreset[] {
  const seen = new Set<string>();
  const unique: MaterialPreset[] = [];
  for (const preset of presets) {
    if (seen.has(preset.palette)) continue;
    seen.add(preset.palette);
    unique.push(preset);
  }
  return unique;
}

function normalizeRoomType(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized === "home_office" || normalized === "office" || normalized === "office_room") return "study";
  if (normalized === "wc" || normalized === "guest_wc" || normalized === "powder_room") return "bathroom";
  if (normalized === "lounge") return "living";
  return normalized;
}
