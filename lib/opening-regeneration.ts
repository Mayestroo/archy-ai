import type { Door, FloorPlan, Room, WallSide, Window as FloorPlanWindow } from "./floorplan-schema.ts";
import {
  DEFAULT_DOOR_WIDTH_METERS,
  DEFAULT_WINDOW_WIDTH_METERS,
  WALL_SIDES,
  clampOpeningPositionForWidth,
  getAdjacentRooms,
  getDoorHinge,
  getDoorSwing,
  getExteriorWalls,
  getOpeningWidthMeters,
  isValidDoorWall,
  isValidWindowWall,
  openingFitsWall,
} from "./openings.ts";

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

export function regenerateOpenings(floorPlan: FloorPlan): FloorPlan {
  const suggested = suggestOpenings(floorPlan.rooms);
  return {
    ...floorPlan,
    doors: mergeDoors(floorPlan.rooms, floorPlan.doors ?? [], suggested.doors),
    windows: mergeWindows(floorPlan.rooms, floorPlan.windows ?? [], suggested.windows),
  };
}

function suggestOpenings(rooms: Room[]): { doors: Door[]; windows: FloorPlanWindow[] } {
  const doors: Door[] = [];
  const windows: FloorPlanWindow[] = [];

  for (const room of rooms) {
    const door = pickDoor(room, rooms);
    if (door) {
      doors.push({
        ...door,
        widthMeters: DEFAULT_DOOR_WIDTH_METERS,
        hinge: "left",
        swing: "inward",
      });
    }

    if (roomShouldHaveWindow(room.type)) {
      const wall = pickWindowWall(room, rooms);
      if (wall) windows.push({ roomId: room.id, wall, position: 0.5, widthMeters: DEFAULT_WINDOW_WIDTH_METERS });
    }
  }

  return { doors, windows };
}

function mergeDoors(rooms: Room[], existingDoors: Door[], suggestedDoors: Door[]): Door[] {
  const doors: Door[] = [];
  const roomIdsWithDoor = new Set<string>();
  const openingKeys = new Set<string>();

  for (const existingDoor of existingDoors) {
    const door = normalizeValidDoor(existingDoor, rooms);
    if (!door) continue;

    const key = openingKey(door);
    if (openingKeys.has(key)) continue;
    openingKeys.add(key);
    roomIdsWithDoor.add(door.roomId);
    doors.push(door);
  }

  for (const suggestedDoor of suggestedDoors) {
    if (roomIdsWithDoor.has(suggestedDoor.roomId)) continue;

    const door = normalizeValidDoor(suggestedDoor, rooms);
    if (!door) continue;

    const key = openingKey(door);
    if (openingKeys.has(key)) continue;
    openingKeys.add(key);
    roomIdsWithDoor.add(door.roomId);
    doors.push(door);
  }

  return doors;
}

function mergeWindows(rooms: Room[], existingWindows: FloorPlanWindow[], suggestedWindows: FloorPlanWindow[]): FloorPlanWindow[] {
  const windows: FloorPlanWindow[] = [];
  const roomIdsWithWindow = new Set<string>();
  const openingKeys = new Set<string>();

  for (const existingWindow of existingWindows) {
    const window = normalizeValidWindow(existingWindow, rooms);
    if (!window) continue;

    const key = openingKey(window);
    if (openingKeys.has(key)) continue;
    openingKeys.add(key);
    roomIdsWithWindow.add(window.roomId);
    windows.push(window);
  }

  for (const suggestedWindow of suggestedWindows) {
    if (roomIdsWithWindow.has(suggestedWindow.roomId)) continue;

    const window = normalizeValidWindow(suggestedWindow, rooms);
    if (!window) continue;

    const key = openingKey(window);
    if (openingKeys.has(key)) continue;
    openingKeys.add(key);
    roomIdsWithWindow.add(window.roomId);
    windows.push(window);
  }

  return windows;
}

function normalizeValidDoor(door: Door, rooms: Room[]): Door | null {
  const room = rooms.find((candidate) => candidate.id === door.roomId);
  if (!room || !isValidDoorWall(room, rooms, door.wall)) return null;

  const widthMeters = getOpeningWidthMeters(door, "door");
  if (!openingFitsWall(room, door.wall, widthMeters)) return null;

  return {
    roomId: door.roomId,
    wall: door.wall,
    position: clampOpeningPositionForWidth(door.position, room, door.wall, widthMeters),
    widthMeters,
    hinge: getDoorHinge(door),
    swing: getDoorSwing(door),
  };
}

function normalizeValidWindow(window: FloorPlanWindow, rooms: Room[]): FloorPlanWindow | null {
  const room = rooms.find((candidate) => candidate.id === window.roomId);
  if (!room || !isValidWindowWall(room, rooms, window.wall)) return null;

  const widthMeters = getOpeningWidthMeters(window, "window");
  if (!openingFitsWall(room, window.wall, widthMeters)) return null;

  return {
    roomId: window.roomId,
    wall: window.wall,
    position: clampOpeningPositionForWidth(window.position, room, window.wall, widthMeters),
    widthMeters,
  };
}

function pickDoor(room: Room, rooms: Room[]): Door | null {
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

  const widestSharedWall = adjacentRooms.toSorted((a, b) => b.overlap - a.overlap)[0];
  return { roomId: room.id, wall: widestSharedWall.wall, position: widestSharedWall.position };
}

function pickWindowWall(room: Room, rooms: Room[]): WallSide | null {
  const roomType = normalizeRoomType(room.type);
  const priorities = WINDOW_WALL_PRIORITY[roomType] ?? ["top", "bottom", "left", "right"];
  return pickExteriorWall(room, rooms, priorities);
}

function pickExteriorWall(room: Room, rooms: Room[], priorities: WallSide[]): WallSide | null {
  const exteriorWalls = getExteriorWalls(room, rooms);
  for (const wall of priorities) {
    if (exteriorWalls.includes(wall)) return wall;
  }
  return exteriorWalls[0] ?? null;
}

function roomShouldHaveWindow(type: string): boolean {
  return ["bedroom", "dining", "kitchen", "living", "master_bedroom", "studio", "study"].includes(normalizeRoomType(type));
}

function normalizeRoomType(type: string): string {
  const normalized = type.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return ROOM_TYPE_ALIASES[normalized] ?? normalized;
}

function openingKey(opening: Door | FloorPlanWindow): string {
  return `${opening.roomId}:${opening.wall}:${opening.position}:${opening.widthMeters ?? "default"}`;
}
