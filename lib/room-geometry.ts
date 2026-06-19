import { ROOM_TYPE_OPTIONS, type EditableRoomType, type FloorPlan, type Room } from "./floorplan-schema.ts";
import { pruneInvalidFurniture } from "./furniture.ts";
import { pruneInvalidInteriorConcepts } from "./interior-concepts.ts";
import { pruneInvalidMaterials } from "./materials.ts";
import { getOpeningWidthMeters, isValidDoorWall, isValidWindowWall, openingFitsWall } from "./openings.ts";

export const ROOM_GRID_SIZE = 50;
export const MIN_ROOM_SIZE = 100;

export type RoomGeometry = Pick<Room, "x" | "y" | "width" | "height">;
export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface AddRoomResult {
  floorPlan: FloorPlan;
  roomId: string;
}

export interface DeleteRoomResult {
  floorPlan: FloorPlan;
  selectedRoomId: string | null;
}

const DEFAULT_ROOM_SIZES: Record<EditableRoomType, Pick<RoomGeometry, "width" | "height">> = {
  bathroom: { width: 100, height: 100 },
  bedroom: { width: 150, height: 150 },
  dining: { width: 150, height: 150 },
  ensuite: { width: 100, height: 100 },
  entry: { width: 100, height: 100 },
  garage: { width: 200, height: 250 },
  hallway: { width: 100, height: 150 },
  kitchen: { width: 150, height: 150 },
  laundry: { width: 100, height: 100 },
  living: { width: 200, height: 200 },
  master_bedroom: { width: 200, height: 200 },
  studio: { width: 250, height: 250 },
  study: { width: 150, height: 150 },
};

export function snapToGrid(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / ROOM_GRID_SIZE) * ROOM_GRID_SIZE;
}

export function calculateTotalArea(rooms: Room[]): number {
  return Math.round(rooms.reduce((sum, room) => sum + (room.width * room.height) / 2500, 0));
}

export function addRoomToFloorPlan(
  floorPlan: FloorPlan,
  roomType: EditableRoomType,
  anchorRoomId?: string | null,
): AddRoomResult | null {
  const size = DEFAULT_ROOM_SIZES[roomType];
  const anchorRoom = floorPlan.rooms.find((room) => room.id === anchorRoomId) ?? null;
  const geometry = findAvailableRoomGeometry(floorPlan.rooms, size, anchorRoom);
  if (!geometry) return null;

  const room: Room = {
    id: createRoomId(roomType, floorPlan.rooms),
    type: roomType,
    label: createRoomLabel(roomType, floorPlan.rooms),
    ...geometry,
  };
  const rooms = [...floorPlan.rooms, room];

  return {
    floorPlan: {
      ...floorPlan,
      rooms,
      totalArea: calculateTotalArea(rooms),
    },
    roomId: room.id,
  };
}

export function deleteRoomFromFloorPlan(floorPlan: FloorPlan, roomId: string): DeleteRoomResult | null {
  const roomIndex = floorPlan.rooms.findIndex((room) => room.id === roomId);
  if (roomIndex === -1 || floorPlan.rooms.length <= 1) return null;

  const rooms = floorPlan.rooms.filter((room) => room.id !== roomId);
  const selectedRoomId = rooms[Math.min(roomIndex, rooms.length - 1)]?.id ?? null;

  return {
    floorPlan: pruneInvalidInteriorConcepts(pruneInvalidMaterials(pruneInvalidFurniture(pruneInvalidOpenings({
      ...floorPlan,
      rooms,
      doors: (floorPlan.doors ?? []).filter((door) => door.roomId !== roomId),
      windows: (floorPlan.windows ?? []).filter((window) => window.roomId !== roomId),
      furniture: floorPlan.furniture?.filter((item) => item.roomId !== roomId),
      materials: floorPlan.materials?.filter((material) => material.roomId !== roomId),
      interiorConcepts: floorPlan.interiorConcepts?.filter((concept) => concept.roomId !== roomId),
      totalArea: calculateTotalArea(rooms),
    })))),
    selectedRoomId,
  };
}

export function normalizeRoomGeometry(geometry: RoomGeometry): RoomGeometry {
  return {
    x: snapToGrid(geometry.x),
    y: snapToGrid(geometry.y),
    width: Math.max(MIN_ROOM_SIZE, snapToGrid(geometry.width)),
    height: Math.max(MIN_ROOM_SIZE, snapToGrid(geometry.height)),
  };
}

export function moveRoomGeometry(room: Room, x: number, y: number): RoomGeometry {
  return normalizeRoomGeometry({
    x,
    y,
    width: room.width,
    height: room.height,
  });
}

export function resizeRoomGeometry(
  room: Room,
  handle: ResizeHandle,
  relativeX: number,
  relativeY: number,
): RoomGeometry {
  let x = room.x;
  let y = room.y;
  let width = room.width;
  let height = room.height;

  if (handle.includes("w")) {
    const left = Math.min(snapToGrid(relativeX), room.width - MIN_ROOM_SIZE);
    x = room.x + left;
    width = room.width - left;
  }

  if (handle.includes("e")) {
    width = Math.max(MIN_ROOM_SIZE, snapToGrid(relativeX));
  }

  if (handle.includes("n")) {
    const top = Math.min(snapToGrid(relativeY), room.height - MIN_ROOM_SIZE);
    y = room.y + top;
    height = room.height - top;
  }

  if (handle.includes("s")) {
    height = Math.max(MIN_ROOM_SIZE, snapToGrid(relativeY));
  }

  return normalizeRoomGeometry({ x, y, width, height });
}

export function roomsOverlap(a: RoomGeometry, b: RoomGeometry): boolean {
  return !(
    b.x >= a.x + a.width
    || b.x + b.width <= a.x
    || b.y >= a.y + a.height
    || b.y + b.height <= a.y
  );
}

export function isValidRoomGeometry(room: Room, rooms: Room[]): boolean {
  if (room.width < MIN_ROOM_SIZE || room.height < MIN_ROOM_SIZE) return false;

  return rooms.every((other) => other.id === room.id || !roomsOverlap(room, other));
}

export function applyRoomGeometry(
  floorPlan: FloorPlan,
  roomId: string,
  geometry: RoomGeometry,
): FloorPlan | null {
  const existingRoom = floorPlan.rooms.find((room) => room.id === roomId);
  if (!existingRoom) return null;

  const nextRoom = { ...existingRoom, ...normalizeRoomGeometry(geometry) };
  if (!isValidRoomGeometry(nextRoom, floorPlan.rooms)) return null;

  const rooms = floorPlan.rooms.map((room) => (room.id === roomId ? nextRoom : room));
  return pruneInvalidInteriorConcepts(pruneInvalidMaterials(pruneInvalidFurniture(pruneInvalidOpenings({
    ...floorPlan,
    rooms,
    totalArea: calculateTotalArea(rooms),
  }))));
}

export function pruneInvalidOpenings(floorPlan: FloorPlan): FloorPlan {
  const doors = (floorPlan.doors ?? []).filter((door) => {
    const room = floorPlan.rooms.find((candidate) => candidate.id === door.roomId);
    return room
      && isValidDoorWall(room, floorPlan.rooms, door.wall)
      && openingFitsWall(room, door.wall, getOpeningWidthMeters(door, "door"));
  });

  const windows = (floorPlan.windows ?? []).filter((window) => {
    const room = floorPlan.rooms.find((candidate) => candidate.id === window.roomId);
    return room
      && isValidWindowWall(room, floorPlan.rooms, window.wall)
      && openingFitsWall(room, window.wall, getOpeningWidthMeters(window, "window"));
  });

  return { ...floorPlan, doors, windows };
}

function findAvailableRoomGeometry(
  rooms: Room[],
  size: Pick<RoomGeometry, "width" | "height">,
  anchorRoom: Room | null,
): RoomGeometry | null {
  const normalizedSize = normalizeRoomGeometry({ x: 0, y: 0, ...size });
  if (rooms.length === 0) return normalizedSize;

  const bounds = getRoomBounds(rooms);
  const anchor = anchorRoom ?? {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
  const candidates = uniqueCandidateGeometries([
    ...preferredRoomCandidates(normalizedSize, anchorRoom, bounds),
    ...scanRoomCandidates(normalizedSize, bounds),
  ]).toSorted((a, b) => distanceToRoom(a, anchor) - distanceToRoom(b, anchor));

  return candidates.find((candidate) => isValidRoomGeometry({ ...candidate, id: "new", type: "new", label: "New" }, rooms)) ?? null;
}

function preferredRoomCandidates(
  size: RoomGeometry,
  anchorRoom: Room | null,
  bounds: ReturnType<typeof getRoomBounds>,
): RoomGeometry[] {
  const candidates: RoomGeometry[] = [
    { ...size, x: bounds.maxX, y: bounds.minY },
    { ...size, x: bounds.minX, y: bounds.maxY },
    { ...size, x: bounds.minX - size.width, y: bounds.minY },
    { ...size, x: bounds.minX, y: bounds.minY - size.height },
  ];

  if (anchorRoom) {
    candidates.unshift(
      { ...size, x: anchorRoom.x + anchorRoom.width, y: anchorRoom.y },
      { ...size, x: anchorRoom.x, y: anchorRoom.y + anchorRoom.height },
      { ...size, x: anchorRoom.x - size.width, y: anchorRoom.y },
      { ...size, x: anchorRoom.x, y: anchorRoom.y - size.height },
    );
  }

  return candidates.map(normalizeRoomGeometry);
}

function scanRoomCandidates(size: RoomGeometry, bounds: ReturnType<typeof getRoomBounds>): RoomGeometry[] {
  const candidates: RoomGeometry[] = [];
  const maxRoomSpan = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, size.width, size.height);
  const maxRing = Math.ceil(maxRoomSpan / ROOM_GRID_SIZE) + 8;

  for (let ring = 0; ring <= maxRing; ring++) {
    const minX = bounds.minX - ring * ROOM_GRID_SIZE - size.width;
    const maxX = bounds.maxX + ring * ROOM_GRID_SIZE;
    const minY = bounds.minY - ring * ROOM_GRID_SIZE - size.height;
    const maxY = bounds.maxY + ring * ROOM_GRID_SIZE;

    for (let x = minX; x <= maxX; x += ROOM_GRID_SIZE) {
      candidates.push(normalizeRoomGeometry({ ...size, x, y: minY }));
      candidates.push(normalizeRoomGeometry({ ...size, x, y: maxY }));
    }

    for (let y = minY + ROOM_GRID_SIZE; y <= maxY - ROOM_GRID_SIZE; y += ROOM_GRID_SIZE) {
      candidates.push(normalizeRoomGeometry({ ...size, x: minX, y }));
      candidates.push(normalizeRoomGeometry({ ...size, x: maxX, y }));
    }
  }

  return candidates;
}

function uniqueCandidateGeometries(candidates: RoomGeometry[]): RoomGeometry[] {
  const seen = new Set<string>();
  const unique: RoomGeometry[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.x}:${candidate.y}:${candidate.width}:${candidate.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

function getRoomBounds(rooms: Room[]) {
  const minX = Math.min(...rooms.map((room) => room.x));
  const minY = Math.min(...rooms.map((room) => room.y));
  const maxX = Math.max(...rooms.map((room) => room.x + room.width));
  const maxY = Math.max(...rooms.map((room) => room.y + room.height));
  return { minX, minY, maxX, maxY };
}

function distanceToRoom(geometry: RoomGeometry, room: Pick<Room, "x" | "y" | "width" | "height">): number {
  const centerX = geometry.x + geometry.width / 2;
  const centerY = geometry.y + geometry.height / 2;
  const roomCenterX = room.x + room.width / 2;
  const roomCenterY = room.y + room.height / 2;
  return Math.abs(centerX - roomCenterX) + Math.abs(centerY - roomCenterY);
}

function createRoomId(roomType: EditableRoomType, rooms: Room[]): string {
  const base = `manual_${sanitizeRoomToken(roomType)}`;
  const roomIds = new Set(rooms.map((room) => room.id));
  let index = rooms.filter((room) => room.type === roomType).length + 1;
  let id = `${base}_${index}`;

  while (roomIds.has(id)) {
    index += 1;
    id = `${base}_${index}`;
  }

  return id;
}

function createRoomLabel(roomType: EditableRoomType, rooms: Room[]): string {
  const baseLabel = ROOM_TYPE_OPTIONS.find((option) => option.value === roomType)?.label ?? humanizeRoomType(roomType);
  const count = rooms.filter((room) => room.type === roomType).length;
  return count === 0 ? baseLabel : `${baseLabel} ${count + 1}`;
}

function sanitizeRoomToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "room";
}

function humanizeRoomType(value: string): string {
  return sanitizeRoomToken(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
