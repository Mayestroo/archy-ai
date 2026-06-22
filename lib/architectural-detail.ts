import type { ArchitecturalBuiltIn, ArchitecturalCore, ArchitecturalDetail, ArchitecturalWallSegment, FloorPlan, PlanPoint, Room, RoomPolygon } from "./floorplan-schema";

const EXTERIOR_WALL_THICKNESS = 8;
const INTERIOR_WALL_THICKNESS = 4;
const EPSILON = 2;

export function ensureArchitecturalDetail(floorPlan: FloorPlan): FloorPlan {
  return {
    ...floorPlan,
    architectural: floorPlan.architectural ?? createArchitecturalDetail(floorPlan.rooms),
  };
}

export function createArchitecturalDetail(rooms: Room[]): ArchitecturalDetail {
  const roomPolygons = rooms.map((room, index) => roomPolygon(room, index));
  const wallSegments = collectArchitecturalWallSegments(roomPolygons);
  return {
    version: "wall_graph_v1",
    wallThickness: {
      exterior: EXTERIOR_WALL_THICKNESS,
      interior: INTERIOR_WALL_THICKNESS,
    },
    footprint: footprintPolygon(rooms, wallSegments),
    roomPolygons,
    wallSegments,
    builtIns: createBuiltIns(rooms),
    cores: createCores(rooms),
  };
}

function createCores(rooms: Room[]): ArchitecturalCore[] {
  const cores: ArchitecturalCore[] = [];
  const stair = stairCore(rooms);
  if (stair) cores.push(stair);
  const service = serviceCore(rooms);
  if (service) cores.push(service);
  return cores;
}

function stairCore(rooms: Room[]): ArchitecturalCore | null {
  const garage = rooms.find((room) => room.type === "garage");
  const hallway = rooms.find((room) => room.type === "hallway");
  const living = rooms.find((room) => room.type === "living" || room.type === "studio");
  const anchor = hallway ?? garage ?? living;
  if (!anchor || rooms.length < 9) return null;
  const width = Math.min(90, Math.max(65, Math.round(anchor.width * 0.42)));
  const height = Math.min(150, Math.max(100, Math.round(anchor.height * 0.72)));
  return {
    id: "stair_core_1",
    kind: "stair",
    label: "Stair",
    roomId: anchor.id,
    x: anchor.x + Math.max(10, anchor.width - width - 10),
    y: anchor.y + Math.max(10, Math.round((anchor.height - height) / 2)),
    width,
    height,
  };
}

function serviceCore(rooms: Room[]): ArchitecturalCore | null {
  const wetRooms = rooms.filter((room) => ["bathroom", "ensuite", "laundry", "kitchen"].includes(room.type));
  if (!wetRooms.length) return null;
  const anchor = wetRooms.toSorted((a, b) => a.x + a.y - b.x - b.y)[0];
  const size = Math.min(40, Math.max(25, Math.round(Math.min(anchor.width, anchor.height) * 0.22)));
  return {
    id: "service_core_1",
    kind: "service_shaft",
    label: "SV",
    roomId: anchor.id,
    x: anchor.x + anchor.width - size - 8,
    y: anchor.y + anchor.height - size - 8,
    width: size,
    height: size,
  };
}

function createBuiltIns(rooms: Room[]): ArchitecturalBuiltIn[] {
  return rooms.flatMap((room) => builtInsForRoom(room));
}

function builtInsForRoom(room: Room): ArchitecturalBuiltIn[] {
  switch (room.type) {
    case "bedroom":
    case "master_bedroom":
    case "closet":
      return closetBuiltIns(room);
    case "kitchen":
      return kitchenBuiltIns(room);
    case "bathroom":
    case "ensuite":
      return wetZoneBuiltIns(room);
    case "entry":
    case "hallway":
      return storageBuiltIns(room);
    default:
      return [];
  }
}

function closetBuiltIns(room: Room): ArchitecturalBuiltIn[] {
  if (room.width < 150 || room.height < 120) return [];
  const depth = Math.min(35, Math.max(25, Math.round(Math.min(room.width, room.height) * 0.16)));
  const width = Math.min(room.width - 30, room.type === "master_bedroom" ? 120 : 90);
  return [{
    id: `${room.id}_closet`,
    roomId: room.id,
    kind: "closet",
    label: room.type === "master_bedroom" ? "WIR" : "CL",
    x: room.x + 15,
    y: room.y + 10,
    width,
    height: depth,
  }];
}

function kitchenBuiltIns(room: Room): ArchitecturalBuiltIn[] {
  if (room.width < 140 || room.height < 120) return [];
  const counterDepth = 30;
  const mainRun = {
    id: `${room.id}_counter_run`,
    roomId: room.id,
    kind: "counter" as const,
    label: "Counter",
    x: room.x + 10,
    y: room.y + 10,
    width: Math.max(80, room.width - 20),
    height: counterDepth,
  };
  const sideRun = room.height >= 170 ? {
    id: `${room.id}_cabinet_run`,
    roomId: room.id,
    kind: "cabinet" as const,
    label: "Cabinet",
    x: room.x + 10,
    y: room.y + 10 + counterDepth,
    width: counterDepth,
    height: Math.max(70, room.height - counterDepth - 20),
  } : null;
  return sideRun ? [mainRun, sideRun] : [mainRun];
}

function wetZoneBuiltIns(room: Room): ArchitecturalBuiltIn[] {
  if (room.width < 90 || room.height < 90) return [];
  const size = Math.min(70, Math.max(45, Math.min(room.width, room.height) - 30));
  return [{
    id: `${room.id}_wet_zone`,
    roomId: room.id,
    kind: "wet_zone",
    label: "Wet",
    x: room.x + room.width - size - 10,
    y: room.y + 10,
    width: size,
    height: size,
  }];
}

function storageBuiltIns(room: Room): ArchitecturalBuiltIn[] {
  if (room.width < 120 || room.height < 80) return [];
  return [{
    id: `${room.id}_storage`,
    roomId: room.id,
    kind: "storage",
    label: "ST",
    x: room.x + 10,
    y: room.y + room.height - 30,
    width: Math.min(80, room.width - 20),
    height: 22,
  }];
}

export function collectArchitecturalWallSegments(roomPolygons: RoomPolygon[]): ArchitecturalWallSegment[] {
  const seen = new Map<string, ArchitecturalWallSegment>();

  for (const polygon of roomPolygons) {
    for (const coords of polygonEdges(polygon)) {
      const adjacentRoomIds = roomPolygons
        .filter((candidate) => candidate.roomId !== polygon.roomId)
        .flatMap((candidate) => polygonEdges(candidate).filter((edge) => touchesSegment(coords, edge)).map(() => candidate.roomId));
      const exterior = adjacentRoomIds.length === 0;
      const key = segmentKey(coords.x1, coords.y1, coords.x2, coords.y2, exterior);
      const existing = seen.get(key);
      if (existing) {
        existing.roomIds = Array.from(new Set([...existing.roomIds, polygon.roomId, ...adjacentRoomIds]));
        existing.exterior = existing.exterior && exterior;
        existing.thickness = existing.exterior ? EXTERIOR_WALL_THICKNESS : INTERIOR_WALL_THICKNESS;
        continue;
      }

      seen.set(key, {
        id: key,
        ...coords,
        exterior,
        thickness: exterior ? EXTERIOR_WALL_THICKNESS : INTERIOR_WALL_THICKNESS,
        roomIds: Array.from(new Set([polygon.roomId, ...adjacentRoomIds])),
      });
    }
  }

  return [...seen.values()];
}

function polygonEdges(polygon: RoomPolygon): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const edges = [];
  for (let index = 0; index < polygon.points.length; index += 1) {
    const current = polygon.points[index];
    const next = polygon.points[(index + 1) % polygon.points.length];
    if (current.x === next.x && current.y === next.y) continue;
    edges.push({ x1: current.x, y1: current.y, x2: next.x, y2: next.y });
  }
  return edges;
}

function touchesSegment(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): boolean {
  const aVertical = a.x1 === a.x2;
  const bVertical = b.x1 === b.x2;
  if (aVertical !== bVertical) return false;
  if (aVertical) return Math.abs(a.x1 - b.x1) < EPSILON && rangesOverlap(a.y1, a.y2, b.y1, b.y2);
  return Math.abs(a.y1 - b.y1) < EPSILON && rangesOverlap(a.x1, a.x2, b.x1, b.x2);
}

function roomPolygon(room: Room, index: number): RoomPolygon {
  return {
    roomId: room.id,
    points: roomPolygonPoints(room, index),
  };
}

function roomPolygonPoints(room: Room, index: number): PlanPoint[] {
  const notch = notchForRoom(room, index);
  if (!notch) return rectanglePoints(room);

  const { x, y, width, height } = room;
  const right = x + width;
  const bottom = y + height;
  const { depth, length, corner } = notch;

  switch (corner) {
    case "top_right":
      return [
        { x, y },
        { x: right - length, y },
        { x: right - length, y: y + depth },
        { x: right, y: y + depth },
        { x: right, y: bottom },
        { x, y: bottom },
      ];
    case "bottom_right":
      return [
        { x, y },
        { x: right, y },
        { x: right, y: bottom - length },
        { x: right - depth, y: bottom - length },
        { x: right - depth, y: bottom },
        { x, y: bottom },
      ];
    case "bottom_left":
      return [
        { x, y },
        { x: right, y },
        { x: right, y: bottom },
        { x: x + length, y: bottom },
        { x: x + length, y: bottom - depth },
        { x, y: bottom - depth },
      ];
    case "top_left":
      return [
        { x: x + depth, y },
        { x: right, y },
        { x: right, y: bottom },
        { x, y: bottom },
        { x, y: y + length },
        { x: x + depth, y: y + length },
      ];
  }
}

function rectanglePoints(room: Room): PlanPoint[] {
  return [
    { x: room.x, y: room.y },
    { x: room.x + room.width, y: room.y },
    { x: room.x + room.width, y: room.y + room.height },
    { x: room.x, y: room.y + room.height },
  ];
}

function notchForRoom(room: Room, index: number): { corner: "top_right" | "bottom_right" | "bottom_left" | "top_left"; depth: number; length: number } | null {
  if (!canHaveNotch(room)) return null;
  const depth = Math.min(50, Math.floor(Math.min(room.width, room.height) * 0.18 / 25) * 25);
  const length = Math.min(100, Math.floor(Math.max(room.width, room.height) * 0.28 / 25) * 25);
  if (depth < 25 || length < 50) return null;
  const corners = ["top_right", "bottom_right", "bottom_left", "top_left"] as const;
  return { corner: corners[index % corners.length], depth, length };
}

function canHaveNotch(room: Room): boolean {
  if (room.width < 200 || room.height < 150) return false;
  return ["living", "kitchen", "dining", "entry", "hallway", "studio", "garage"].includes(room.type);
}

function footprintPolygon(rooms: Room[], wallSegments: ArchitecturalWallSegment[]): PlanPoint[] {
  const outline = traceExteriorOutline(wallSegments);
  if (outline.length >= 4) return outline;

  if (!rooms.length) return [];
  const minX = Math.min(...rooms.map((room) => room.x));
  const minY = Math.min(...rooms.map((room) => room.y));
  const maxX = Math.max(...rooms.map((room) => room.x + room.width));
  const maxY = Math.max(...rooms.map((room) => room.y + room.height));
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function traceExteriorOutline(wallSegments: ArchitecturalWallSegment[]): PlanPoint[] {
  const exteriorSegments = wallSegments.filter((segment) => segment.exterior);
  if (exteriorSegments.length < 4) return [];

  const adjacency = new Map<string, ArchitecturalWallSegment[]>();
  for (const segment of exteriorSegments) {
    const start = pointKey(segment.x1, segment.y1);
    const end = pointKey(segment.x2, segment.y2);
    adjacency.set(start, [...(adjacency.get(start) ?? []), segment]);
    adjacency.set(end, [...(adjacency.get(end) ?? []), segment]);
  }

  const startKey = [...adjacency.keys()].sort((a, b) => {
    const pointA = parsePointKey(a);
    const pointB = parsePointKey(b);
    return pointA.y - pointB.y || pointA.x - pointB.x;
  })[0];
  if (!startKey) return [];

  const points: PlanPoint[] = [];
  const used = new Set<string>();
  let currentKey = startKey;
  let previousKey: string | null = null;

  for (let guard = 0; guard < exteriorSegments.length + 2; guard++) {
    points.push(parsePointKey(currentKey));
    const nextSegment = (adjacency.get(currentKey) ?? [])
      .filter((segment) => !used.has(segment.id))
      .sort((a, b) => turnPreference(currentKey, previousKey, a) - turnPreference(currentKey, previousKey, b))[0];
    if (!nextSegment) break;

    used.add(nextSegment.id);
    const nextKey = otherEndpointKey(nextSegment, currentKey);
    previousKey = currentKey;
    currentKey = nextKey;
    if (currentKey === startKey) break;
  }

  if (currentKey !== startKey || used.size < Math.max(4, Math.floor(exteriorSegments.length * 0.5))) return [];
  return simplifyCollinear(points);
}

function simplifyCollinear(points: PlanPoint[]): PlanPoint[] {
  return points.filter((point, index) => {
    const prev = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    return !((prev.x === point.x && point.x === next.x) || (prev.y === point.y && point.y === next.y));
  });
}

function turnPreference(currentKey: string, previousKey: string | null, segment: ArchitecturalWallSegment): number {
  if (!previousKey) return segment.x1 === segment.x2 ? 1 : 0;
  const current = parsePointKey(currentKey);
  const previous = parsePointKey(previousKey);
  const next = parsePointKey(otherEndpointKey(segment, currentKey));
  const incoming = { x: current.x - previous.x, y: current.y - previous.y };
  const outgoing = { x: next.x - current.x, y: next.y - current.y };
  const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
  if (cross > 0) return 0;
  if (cross === 0) return 1;
  return 2;
}

function otherEndpointKey(segment: ArchitecturalWallSegment, key: string): string {
  const start = pointKey(segment.x1, segment.y1);
  return start === key ? pointKey(segment.x2, segment.y2) : start;
}

function pointKey(x: number, y: number): string {
  return `${Math.round(x)}:${Math.round(y)}`;
}

function parsePointKey(key: string): PlanPoint {
  const [x, y] = key.split(":").map(Number);
  return { x, y };
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  return Math.max(Math.min(a1, a2), Math.min(b1, b2)) < Math.min(Math.max(a1, a2), Math.max(b1, b2)) - EPSILON;
}

function segmentKey(x1: number, y1: number, x2: number, y2: number, exterior: boolean): string {
  const ax = Math.round(Math.min(x1, x2));
  const ay = Math.round(Math.min(y1, y2));
  const bx = Math.round(Math.max(x1, x2));
  const by = Math.round(Math.max(y1, y2));
  return `${exterior ? "ext" : "int"}:${ax}:${ay}:${bx}:${by}`;
}
