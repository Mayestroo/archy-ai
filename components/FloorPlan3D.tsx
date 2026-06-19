"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import type { FloorPlan, Room, Door, FurnitureItem, FurnitureType, Window as FPWindow } from "@/lib/floorplan-schema";
import { getRoomMaterial } from "@/lib/materials";
import { getOpeningWidthMeters } from "@/lib/openings";

interface FloorPlan3DProps {
  floorPlan: FloorPlan;
}

const PALETTE = [
  "#5D5DFF",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#84cc16",
];

// 50px = 1m in the schema. We convert to metres in 3D.
const PX_PER_M = 50;
const WALL_HEIGHT = 2.8; // m
const WALL_THICKNESS = 0.1; // m

export default function FloorPlan3D({ floorPlan }: FloorPlan3DProps) {
  const center = useMemo(() => {
    if (!floorPlan?.rooms?.length) return { cx: 0, cz: 0, span: 10 };
    const xs = floorPlan.rooms.map((r) => r.x / PX_PER_M);
    const ys = floorPlan.rooms.map((r) => r.y / PX_PER_M);
    const xe = floorPlan.rooms.map((r) => (r.x + r.width) / PX_PER_M);
    const ye = floorPlan.rooms.map((r) => (r.y + r.height) / PX_PER_M);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xe);
    const maxY = Math.max(...ye);
    return {
      cx: (minX + maxX) / 2,
      cz: (minY + maxY) / 2,
      span: Math.max(maxX - minX, maxY - minY),
    };
  }, [floorPlan]);

  const cameraDistance = Math.max(center.span * 1.3, 12);

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{
          position: [center.cx + cameraDistance * 0.7, cameraDistance * 0.8, center.cz + cameraDistance * 0.7],
          fov: 50,
        }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={["#0a0a0a"]} />
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[center.cx + 10, 20, center.cz + 10]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <hemisphereLight args={["#ffffff", "#404040", 0.4]} />

          <Grid
            args={[200, 200]}
            cellSize={1}
            cellThickness={0.6}
            cellColor="#222"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#444"
            position={[center.cx, 0, center.cz]}
            infiniteGrid
            fadeDistance={80}
          />

          {floorPlan.rooms.map((room, i) => (
            <RoomMesh
              key={room.id}
              room={room}
              color={PALETTE[i % PALETTE.length]}
              floorColor={getRoomMaterial(floorPlan, room.id)?.floorColor}
              wallColor={getRoomMaterial(floorPlan, room.id)?.wallColor}
              doors={floorPlan.doors?.filter((d) => d.roomId === room.id) ?? []}
              windows={floorPlan.windows?.filter((w) => w.roomId === room.id) ?? []}
              furniture={floorPlan.furniture?.filter((item) => item.roomId === room.id) ?? []}
            />
          ))}

          <OrbitControls
            target={[center.cx, 0, center.cz]}
            enableDamping
            dampingFactor={0.08}
            minDistance={3}
            maxDistance={200}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />

          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
}

interface RoomMeshProps {
  room: Room;
  color: string;
  floorColor?: string;
  wallColor?: string;
  doors: Door[];
  windows: FPWindow[];
  furniture: FurnitureItem[];
}

function RoomMesh({ room, color, floorColor, wallColor, doors, windows, furniture }: RoomMeshProps) {
  const x = room.x / PX_PER_M;
  const z = room.y / PX_PER_M;
  const w = room.width / PX_PER_M;
  const d = room.height / PX_PER_M;
  const cx = x + w / 2;
  const cz = z + d / 2;

  return (
    <group>
      {/* Floor */}
      <mesh receiveShadow position={[cx, 0.005, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floorColor ?? color} opacity={floorColor ? 0.82 : 0.35} transparent roughness={0.9} />
      </mesh>

      {furniture.map((item) => (
        <FurnitureMesh key={item.id} room={room} item={item} />
      ))}

      {/* Walls — split each side around the opening if any */}
      <Wall
        side="top"
        start={[x, 0, z]}
        length={w}
        axis="x"
        openings={wallOpenings("top", doors, windows)}
        color={wallColor}
      />
      <Wall
        side="bottom"
        start={[x, 0, z + d]}
        length={w}
        axis="x"
        openings={wallOpenings("bottom", doors, windows)}
        color={wallColor}
      />
      <Wall
        side="left"
        start={[x, 0, z]}
        length={d}
        axis="z"
        openings={wallOpenings("left", doors, windows)}
        color={wallColor}
      />
      <Wall
        side="right"
        start={[x + w, 0, z]}
        length={d}
        axis="z"
        openings={wallOpenings("right", doors, windows)}
        color={wallColor}
      />
    </group>
  );
}

function FurnitureMesh({ room, item }: { room: Room; item: FurnitureItem }) {
  const width = Math.max(item.width / PX_PER_M, 0.1);
  const depth = Math.max(item.height / PX_PER_M, 0.1);
  const height = furnitureHeight(item.type);
  const x = (room.x + item.x) / PX_PER_M + width / 2;
  const z = (room.y + item.y) / PX_PER_M + depth / 2;

  return (
    <mesh castShadow receiveShadow position={[x, height / 2, z]}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={furnitureColor(item.type)} roughness={0.72} metalness={0.03} />
    </mesh>
  );
}

function furnitureHeight(type: FurnitureType): number {
  if (type === "bed" || type === "sofa") return 0.45;
  if (type === "coffee_table") return 0.32;
  if (type === "dining_table" || type === "desk" || type === "kitchen_island") return 0.75;
  if (type === "chair" || type === "toilet" || type === "washer") return 0.5;
  if (type === "wardrobe" || type === "storage") return 1.4;
  if (type === "kitchen_counter" || type === "vanity") return 0.9;
  if (type === "shower") return 1.9;
  if (type === "car") return 1.25;
  return 0.6;
}

function furnitureColor(type: FurnitureType): string {
  const colors: Record<FurnitureType, string> = {
    bed: "#facc15",
    wardrobe: "#a78bfa",
    sofa: "#22c55e",
    coffee_table: "#14b8a6",
    media_console: "#6366f1",
    dining_table: "#fb923c",
    chair: "#a8a29e",
    kitchen_counter: "#60a5fa",
    kitchen_island: "#3b82f6",
    toilet: "#f8fafc",
    vanity: "#38bdf8",
    shower: "#67e8f9",
    washer: "#cbd5e1",
    desk: "#e879f9",
    car: "#94a3b8",
    storage: "#d1d5db",
  };
  return colors[type] ?? "#d1d5db";
}

interface WallProps {
  side: "top" | "bottom" | "left" | "right";
  start: [number, number, number];
  length: number;
  axis: "x" | "z";
  openings: { pos: number; width: number }[];
  color?: string;
}

function Wall({ start, length, axis, openings, color = "#e5e7eb" }: WallProps) {
  // Build segments around openings
  const cuts = openings
    .map((o) => ({
      from: Math.max(0, length * o.pos - o.width / 2),
      to: Math.min(length, length * o.pos + o.width / 2),
    }))
    .sort((a, b) => a.from - b.from);

  const segments: { from: number; to: number }[] = [];
  let cursor = 0;
  for (const c of cuts) {
    if (c.from > cursor) segments.push({ from: cursor, to: c.from });
    cursor = Math.max(cursor, c.to);
  }
  if (cursor < length) segments.push({ from: cursor, to: length });
  if (cuts.length === 0) segments.push({ from: 0, to: length });

  return (
    <>
      {segments.map((seg, i) => {
        const segLen = seg.to - seg.from;
        if (segLen <= 0.01) return null;
        const off = seg.from + segLen / 2;
        const pos: [number, number, number] =
          axis === "x"
            ? [start[0] + off, WALL_HEIGHT / 2, start[2]]
            : [start[0], WALL_HEIGHT / 2, start[2] + off];
        const size: [number, number, number] =
          axis === "x"
            ? [segLen, WALL_HEIGHT, WALL_THICKNESS]
            : [WALL_THICKNESS, WALL_HEIGHT, segLen];
        return (
          <mesh key={i} position={pos} castShadow receiveShadow>
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        );
      })}
    </>
  );
}

function wallOpenings(wall: Door["wall"], doors: Door[], windows: FPWindow[]) {
  return [
    ...doors
      .filter((door) => door.wall === wall)
      .map((door) => ({ pos: door.position, width: getOpeningWidthMeters(door, "door") })),
    ...windows
      .filter((window) => window.wall === wall)
      .map((window) => ({ pos: window.position, width: getOpeningWidthMeters(window, "window") })),
  ];
}
