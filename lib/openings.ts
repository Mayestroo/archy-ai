import type {
  Door,
  DoorHinge,
  DoorSwing,
  FloorPlan,
  Room,
  WallSide,
  Window as FloorPlanWindow,
} from "./floorplan-schema";

export const WALL_SIDES: WallSide[] = ["top", "bottom", "left", "right"];
export const OPENING_POSITION_STEP = 0.05;
export const OPENING_WIDTH_STEP_METERS = 0.1;
export const CANVAS_UNITS_PER_METER = 50;
export const DEFAULT_DOOR_WIDTH_METERS = 0.9;
export const DEFAULT_WINDOW_WIDTH_METERS = 1.2;
export const MIN_OPENING_WIDTH_METERS = 0.5;
export const MAX_OPENING_WIDTH_METERS = 3;

export const DOOR_HINGES: DoorHinge[] = ["left", "right"];
export const DOOR_SWINGS: DoorSwing[] = ["inward", "outward"];

export type OpeningKind = "door" | "window";
export type Opening = Door | FloorPlanWindow;
export interface OpeningPatch {
  wall?: WallSide;
  position?: number;
  widthMeters?: number;
  hinge?: DoorHinge;
  swing?: DoorSwing;
}

export interface OpeningSelection {
  kind: OpeningKind;
  index: number;
}

export interface AdjacentRoom {
  room: Room;
  wall: WallSide;
  overlap: number;
  position: number;
}

export function getOpenings(floorPlan: FloorPlan, kind: OpeningKind): Opening[] {
  return kind === "door" ? floorPlan.doors ?? [] : floorPlan.windows ?? [];
}

export function isWallSide(value: string): value is WallSide {
  return WALL_SIDES.includes(value as WallSide);
}

export function isDoorHinge(value: string): value is DoorHinge {
  return DOOR_HINGES.includes(value as DoorHinge);
}

export function isDoorSwing(value: string): value is DoorSwing {
  return DOOR_SWINGS.includes(value as DoorSwing);
}

export function clampOpeningPosition(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  const clamped = Math.min(Math.max(value, 0), 1);
  return Number((Math.round(clamped / OPENING_POSITION_STEP) * OPENING_POSITION_STEP).toFixed(2));
}

export function getDoorHinge(door: Door): DoorHinge {
  return door.hinge && isDoorHinge(door.hinge) ? door.hinge : "left";
}

export function getDoorSwing(door: Door): DoorSwing {
  return door.swing && isDoorSwing(door.swing) ? door.swing : "inward";
}

export function getOpeningWidthMeters(opening: Opening, kind: OpeningKind): number {
  return clampOpeningWidthMeters(
    opening.widthMeters,
    kind,
    kind === "door" ? DEFAULT_DOOR_WIDTH_METERS : DEFAULT_WINDOW_WIDTH_METERS,
  );
}

export function getOpeningWidthPixels(opening: Opening, kind: OpeningKind): number {
  return getOpeningWidthMeters(opening, kind) * CANVAS_UNITS_PER_METER;
}

export function getWallLengthMeters(room: Room, wall: WallSide): number {
  return (wall === "top" || wall === "bottom" ? room.width : room.height) / CANVAS_UNITS_PER_METER;
}

export function clampOpeningWidthMeters(
  value: number | undefined,
  kind: OpeningKind,
  fallback = kind === "door" ? DEFAULT_DOOR_WIDTH_METERS : DEFAULT_WINDOW_WIDTH_METERS,
): number {
  const raw = Number.isFinite(value) ? Number(value) : fallback;
  const clamped = Math.min(Math.max(raw, MIN_OPENING_WIDTH_METERS), MAX_OPENING_WIDTH_METERS);
  return Number((Math.round(clamped / OPENING_WIDTH_STEP_METERS) * OPENING_WIDTH_STEP_METERS).toFixed(1));
}

export function clampOpeningWidthForWall(
  value: number | undefined,
  kind: OpeningKind,
  room: Room,
  wall: WallSide,
): number {
  const wallLength = getWallLengthMeters(room, wall);
  const maxWidth = Math.min(MAX_OPENING_WIDTH_METERS, Math.max(wallLength, 0));
  if (maxWidth <= MIN_OPENING_WIDTH_METERS) return Number(maxWidth.toFixed(1));
  return Math.min(clampOpeningWidthMeters(value, kind), Number(maxWidth.toFixed(1)));
}

export function clampOpeningPositionForWidth(
  value: number,
  room: Room,
  wall: WallSide,
  widthMeters: number,
): number {
  const wallLength = getWallLengthMeters(room, wall);
  if (wallLength <= 0 || widthMeters >= wallLength) return 0.5;

  const halfWidthFraction = widthMeters / wallLength / 2;
  const clamped = Math.min(Math.max(value, halfWidthFraction), 1 - halfWidthFraction);
  return clampOpeningPosition(clamped);
}

export function openingFitsWall(room: Room, wall: WallSide, widthMeters: number): boolean {
  return widthMeters > 0 && widthMeters <= getWallLengthMeters(room, wall);
}

export function getAdjacentRooms(room: Room, rooms: Room[]): AdjacentRoom[] {
  const adjacentRooms: AdjacentRoom[] = [];
  for (const other of rooms) {
    if (other.id === room.id) continue;
    const adjacent = getSharedWall(room, other);
    if (adjacent) adjacentRooms.push({ room: other, ...adjacent });
  }
  return adjacentRooms;
}

export function getExteriorWalls(room: Room, rooms: Room[]): WallSide[] {
  const adjacentWalls = new Set(getAdjacentRooms(room, rooms).map((adjacent) => adjacent.wall));
  return WALL_SIDES.filter((wall) => !adjacentWalls.has(wall));
}

export function getDoorWallOptions(room: Room, rooms: Room[]): WallSide[] {
  const adjacentWalls = new Set(getAdjacentRooms(room, rooms).map((adjacent) => adjacent.wall));
  const exteriorWalls = new Set(getExteriorWalls(room, rooms));
  return WALL_SIDES.filter((wall) => adjacentWalls.has(wall) || exteriorWalls.has(wall));
}

export function getWindowWallOptions(room: Room, rooms: Room[]): WallSide[] {
  return getExteriorWalls(room, rooms);
}

export function isValidDoorWall(room: Room, rooms: Room[], wall: WallSide): boolean {
  return getDoorWallOptions(room, rooms).includes(wall);
}

export function isValidWindowWall(room: Room, rooms: Room[], wall: WallSide): boolean {
  return getWindowWallOptions(room, rooms).includes(wall);
}

function getSharedWall(room: Room, other: Room): Omit<AdjacentRoom, "room"> | null {
  const epsilon = 0.1;

  if (Math.abs(room.x + room.width - other.x) < epsilon) {
    return verticalSharedWall(room, other, "right");
  }
  if (Math.abs(room.x - (other.x + other.width)) < epsilon) {
    return verticalSharedWall(room, other, "left");
  }
  if (Math.abs(room.y + room.height - other.y) < epsilon) {
    return horizontalSharedWall(room, other, "bottom");
  }
  if (Math.abs(room.y - (other.y + other.height)) < epsilon) {
    return horizontalSharedWall(room, other, "top");
  }

  return null;
}

function verticalSharedWall(room: Room, other: Room, wall: WallSide): Omit<AdjacentRoom, "room"> | null {
  const start = Math.max(room.y, other.y);
  const end = Math.min(room.y + room.height, other.y + other.height);
  const overlap = end - start;
  if (overlap <= 0) return null;
  const center = start + overlap / 2;
  return { wall, overlap, position: clamp((center - room.y) / room.height) };
}

function horizontalSharedWall(room: Room, other: Room, wall: WallSide): Omit<AdjacentRoom, "room"> | null {
  const start = Math.max(room.x, other.x);
  const end = Math.min(room.x + room.width, other.x + other.width);
  const overlap = end - start;
  if (overlap <= 0) return null;
  const center = start + overlap / 2;
  return { wall, overlap, position: clamp((center - room.x) / room.width) };
}

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
