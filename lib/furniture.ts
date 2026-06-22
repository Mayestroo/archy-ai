import type { FloorPlan, FurnitureItem, FurnitureType, Room } from "./floorplan-schema";

const ROOM_MARGIN = 10;
const MIN_FURNITURE_SIZE = 16;

interface FurnitureSpec {
  type: FurnitureType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: FurnitureItem["rotation"];
}

export function regenerateFurniture(floorPlan: FloorPlan): FloorPlan {
  return {
    ...floorPlan,
    furniture: generateFurniture(floorPlan.rooms),
  };
}

export function ensureFurniture(floorPlan: FloorPlan): FloorPlan {
  return floorPlan.furniture?.length ? floorPlan : regenerateFurniture(floorPlan);
}

export function generateFurniture(rooms: Room[]): FurnitureItem[] {
  return rooms.flatMap((room) => furnitureForRoom(room));
}

export function pruneInvalidFurniture(floorPlan: FloorPlan): FloorPlan {
  if (!floorPlan.furniture) return floorPlan;

  const furniture = (floorPlan.furniture ?? []).filter((item) => {
    const room = floorPlan.rooms.find((candidate) => candidate.id === item.roomId);
    return room && furnitureFitsRoom(item, room);
  });

  return { ...floorPlan, furniture };
}

export function furnitureFitsRoom(item: FurnitureItem, room: Room): boolean {
  return Number.isFinite(item.x)
    && Number.isFinite(item.y)
    && Number.isFinite(item.width)
    && Number.isFinite(item.height)
    && item.width > 0
    && item.height > 0
    && item.x >= 0
    && item.y >= 0
    && item.x + item.width <= room.width
    && item.y + item.height <= room.height;
}

function furnitureForRoom(room: Room): FurnitureItem[] {
  const specs = furnitureSpecsForRoom(room);
  return specs.flatMap((spec, index) => createFurnitureItem(room, spec, index) ?? []);
}

function furnitureSpecsForRoom(room: Room): FurnitureSpec[] {
  const type = normalizeRoomType(room.type);

  if (type === "master_bedroom") return bedroomSpecs(room, true);
  if (type === "bedroom") return bedroomSpecs(room, false);
  if (type === "living") return livingSpecs(room);
  if (type === "dining") return diningSpecs(room);
  if (type === "kitchen") return kitchenSpecs(room);
  if (type === "bathroom" || type === "ensuite") return bathroomSpecs(room);
  if (type === "laundry") return laundrySpecs(room);
  if (type === "study") return studySpecs(room);
  if (type === "studio") return studioSpecs(room);
  if (type === "garage") return garageSpecs(room);
  if (type === "entry") return entrySpecs(room);
  if (type === "closet") return closetSpecs(room);

  return [];
}

function bedroomSpecs(room: Room, master: boolean): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width >= 90 && room.height >= 100) {
    const bedW = Math.min(master ? 100 : 80, room.width - 28);
    const bedH = Math.min(105, room.height - 28);
    specs.push({
      type: "bed",
      label: master ? "Queen Bed" : "Bed",
      x: (room.width - bedW) / 2,
      y: room.height - bedH - 14,
      width: bedW,
      height: bedH,
    });
  }

  if (room.width >= 120 && room.height >= 135) {
    specs.push({
      type: "wardrobe",
      label: "Wardrobe",
      x: room.width - 40,
      y: 12,
      width: 28,
      height: Math.min(90, room.height - 24),
    });
  }

  if (master && room.width >= 170 && room.height >= 150) {
    specs.push({ type: "storage", label: "Dresser", x: 14, y: 14, width: 62, height: 28 });
  }

  return specs;
}

function livingSpecs(room: Room): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width >= 130 && room.height >= 110) {
    const sofaW = Math.min(130, room.width - 34);
    specs.push({ type: "sofa", label: "Sofa", x: (room.width - sofaW) / 2, y: room.height - 48, width: sofaW, height: 34 });
  }
  if (room.width >= 150 && room.height >= 150) {
    specs.push({ type: "coffee_table", label: "Coffee", x: room.width / 2 - 32, y: room.height / 2 - 18, width: 64, height: 36 });
  }
  if (room.width >= 120 && room.height >= 120) {
    specs.push({ type: "media_console", label: "Media", x: room.width / 2 - 45, y: 12, width: 90, height: 20 });
  }
  return specs;
}

function diningSpecs(room: Room): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width < 95 || room.height < 95) return specs;

  const tableW = Math.min(90, room.width - 36);
  const tableH = Math.min(58, room.height - 36);
  specs.push({ type: "dining_table", label: "Dining", x: (room.width - tableW) / 2, y: (room.height - tableH) / 2, width: tableW, height: tableH });

  if (room.width >= 140 && room.height >= 120) {
    specs.push({ type: "chair", label: "Chair", x: room.width / 2 - 14, y: Math.max(10, (room.height - tableH) / 2 - 26), width: 28, height: 22 });
    specs.push({ type: "chair", label: "Chair", x: room.width / 2 - 14, y: Math.min(room.height - 32, (room.height + tableH) / 2 + 4), width: 28, height: 22 });
  }

  return specs;
}

function kitchenSpecs(room: Room): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width >= room.height) {
    specs.push({ type: "kitchen_counter", label: "Counter", x: 10, y: 10, width: room.width - 20, height: 30 });
    if (room.width >= 170 && room.height >= 130) {
      specs.push({ type: "kitchen_island", label: "Island", x: room.width / 2 - 45, y: room.height / 2 - 18, width: 90, height: 36 });
    }
  } else {
    specs.push({ type: "kitchen_counter", label: "Counter", x: 10, y: 10, width: 30, height: room.height - 20 });
    if (room.width >= 130 && room.height >= 170) {
      specs.push({ type: "kitchen_island", label: "Island", x: room.width / 2 - 18, y: room.height / 2 - 45, width: 36, height: 90 });
    }
  }
  return specs;
}

function bathroomSpecs(room: Room): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width >= 85 && room.height >= 85) {
    specs.push({ type: "shower", label: "Shower", x: room.width - 55, y: 10, width: 45, height: 45 });
  }
  if (room.width >= 80 && room.height >= 90) {
    specs.push({ type: "toilet", label: "WC", x: 12, y: room.height - 52, width: 30, height: 40 });
  }
  if (room.width >= 90 && room.height >= 80) {
    specs.push({ type: "vanity", label: "Vanity", x: 12, y: 12, width: 48, height: 24 });
  }
  return specs;
}

function laundrySpecs(room: Room): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width >= 70 && room.height >= 70) {
    specs.push({ type: "washer", label: "Washer", x: 12, y: 12, width: 36, height: 36 });
  }
  if (room.width >= 110 && room.height >= 80) {
    specs.push({ type: "storage", label: "Bench", x: 56, y: 14, width: room.width - 68, height: 24 });
  }
  return specs;
}

function studySpecs(room: Room): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width >= 90 && room.height >= 90) {
    const deskW = Math.min(86, room.width - 28);
    specs.push({ type: "desk", label: "Desk", x: (room.width - deskW) / 2, y: 12, width: deskW, height: 34 });
    specs.push({ type: "chair", label: "Chair", x: room.width / 2 - 15, y: 54, width: 30, height: 28 });
  }
  return specs;
}

function studioSpecs(room: Room): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width >= 160 && room.height >= 140) {
    specs.push({ type: "bed", label: "Bed", x: room.width - 92, y: 14, width: 78, height: 96 });
    specs.push({ type: "sofa", label: "Sofa", x: 16, y: room.height - 48, width: Math.min(115, room.width - 124), height: 34 });
    specs.push({ type: "coffee_table", label: "Coffee", x: 46, y: room.height - 92, width: 56, height: 30 });
  }
  return specs;
}

function garageSpecs(room: Room): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width >= 110 && room.height >= 80) {
    specs.push({
      type: "car",
      label: "Car",
      x: room.width / 2 - Math.min(170, room.width - 34) / 2,
      y: room.height / 2 - Math.min(88, room.height - 24) / 2,
      width: Math.min(170, room.width - 34),
      height: Math.min(88, room.height - 24),
    });
  }
  if (room.width >= 140 && room.height >= 100) {
    specs.push({ type: "storage", label: "Storage", x: 12, y: 12, width: 64, height: 24 });
  }
  return specs;
}

function entrySpecs(room: Room): FurnitureSpec[] {
  const specs: FurnitureSpec[] = [];
  if (room.width >= 75 && room.height >= 70) {
    specs.push({ type: "storage", label: "Console", x: 12, y: 12, width: Math.min(70, room.width - 24), height: 22 });
  }
  return specs;
}

function closetSpecs(room: Room): FurnitureSpec[] {
  if (room.width < 80 || room.height < 80) return [];
  return [{
    type: "wardrobe",
    label: "Storage",
    x: 12,
    y: 12,
    width: Math.min(42, room.width - 24),
    height: Math.max(40, room.height - 24),
  }];
}

function createFurnitureItem(room: Room, spec: FurnitureSpec, index: number): FurnitureItem | null {
  const margin = Math.min(ROOM_MARGIN, room.width / 8, room.height / 8);
  const maxWidth = Math.max(0, room.width - margin * 2);
  const maxHeight = Math.max(0, room.height - margin * 2);
  const width = Math.min(spec.width, maxWidth);
  const height = Math.min(spec.height, maxHeight);

  if (width < MIN_FURNITURE_SIZE || height < MIN_FURNITURE_SIZE) return null;

  return {
    id: `${sanitizeId(room.id)}_${spec.type}_${index + 1}`,
    roomId: room.id,
    type: spec.type,
    label: spec.label,
    x: Math.round(clampPosition(spec.x, width, room.width, margin)),
    y: Math.round(clampPosition(spec.y, height, room.height, margin)),
    width: Math.round(width),
    height: Math.round(height),
    ...(spec.rotation ? { rotation: spec.rotation } : {}),
  };
}

function clampPosition(value: number, itemSize: number, roomSize: number, margin: number): number {
  const min = margin;
  const max = roomSize - itemSize - margin;
  if (max < min) return Math.max(0, (roomSize - itemSize) / 2);
  return Math.min(Math.max(value, min), max);
}

function normalizeRoomType(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized === "home_office" || normalized === "office" || normalized === "office_room") return "study";
  if (normalized === "wc" || normalized === "guest_wc" || normalized === "powder_room") return "bathroom";
  if (normalized === "lounge") return "living";
  if (normalized === "walk_in" || normalized === "walk_in_closet" || normalized === "closet" || normalized === "pantry") return "closet";
  return normalized;
}

function sanitizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "room";
}
