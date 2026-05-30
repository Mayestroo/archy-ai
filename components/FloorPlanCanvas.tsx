"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Line, Group } from "react-konva";
import type Konva from "konva";
import type { FloorPlan } from "@/lib/floorplan-schema";

interface FloorPlanCanvasProps {
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
  "#f97316",
  "#14b8a6",
];

const PADDING = 60;
const DOOR_GAP = 30;
const WINDOW_GAP = 40;

interface ViewOverride {
  key: string;
  scale: number;
  x: number;
  y: number;
}

export default function FloorPlanCanvas({ floorPlan }: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [viewOverride, setViewOverride] = useState<ViewOverride | null>(null);

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Compute bounding box of the plan
  const bbox = useMemo(() => {
    if (!floorPlan?.rooms?.length) {
      return { x: 0, y: 0, w: 800, h: 600 };
    }
    const xs = floorPlan.rooms.map((r) => r.x);
    const ys = floorPlan.rooms.map((r) => r.y);
    const xe = floorPlan.rooms.map((r) => r.x + r.width);
    const ye = floorPlan.rooms.map((r) => r.y + r.height);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      x: minX,
      y: minY,
      w: Math.max(...xe) - minX,
      h: Math.max(...ye) - minY,
    };
  }, [floorPlan]);

  const fitKey = `${size.w}:${size.h}:${bbox.x}:${bbox.y}:${bbox.w}:${bbox.h}`;

  const fittedView = useMemo(() => {
    if (!size.w || !size.h || !bbox.w || !bbox.h) {
      return { scale: 1, x: 0, y: 0 };
    }
    const sx = (size.w - PADDING * 2) / bbox.w;
    const sy = (size.h - PADDING * 2) / bbox.h;
    const next = Math.min(sx, sy);
    return {
      scale: next,
      x: (size.w - bbox.w * next) / 2 - bbox.x * next,
      y: (size.h - bbox.h * next) / 2 - bbox.y * next,
    };
  }, [size, bbox]);

  const activeView = viewOverride?.key === fitKey ? viewOverride : { key: fitKey, ...fittedView };
  const scale = activeView.scale;
  const stagePos = { x: activeView.x, y: activeView.y };

  const colorFor = (i: number) => PALETTE[i % PALETTE.length];

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.05;
    const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    setViewOverride({
      key: fitKey,
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }

  function resetView() {
    setViewOverride(null);
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable
        onWheel={handleWheel}
        onDragEnd={(e) => setViewOverride({ key: fitKey, scale, x: e.target.x(), y: e.target.y() })}
      >
        {/* Grid */}
        <Layer listening={false}>
          <GridLayer bbox={bbox} />
        </Layer>

        {/* Rooms */}
        <Layer>
          {floorPlan.rooms.map((room, i) => {
            const color = colorFor(i);
            return (
              <Group key={room.id}>
                <Rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  fill={color}
                  opacity={0.12}
                  stroke={color}
                  strokeWidth={2 / scale}
                />
                <Text
                  x={room.x}
                  y={room.y + room.height / 2 - 10}
                  width={room.width}
                  text={room.label}
                  align="center"
                  fontSize={Math.min(18, room.width / 8)}
                  fontStyle="bold"
                  fill="#111"
                />
                <Text
                  x={room.x}
                  y={room.y + room.height / 2 + 8}
                  width={room.width}
                  text={`${Math.round(((room.width * room.height) / 2500))} m²`}
                  align="center"
                  fontSize={Math.min(12, room.width / 12)}
                  fill="#555"
                />
              </Group>
            );
          })}

          {/* Doors */}
          {floorPlan.doors?.map((door, i) => {
            const room = floorPlan.rooms.find((r) => r.id === door.roomId);
            if (!room) return null;
            const { x1, y1, x2, y2 } = openingCoords(room, door.wall, door.position, DOOR_GAP);
            return (
              <Line
                key={`door-${i}`}
                points={[x1, y1, x2, y2]}
                stroke="#fff"
                strokeWidth={6 / scale}
                lineCap="round"
              />
            );
          })}

          {/* Windows */}
          {floorPlan.windows?.map((win, i) => {
            const room = floorPlan.rooms.find((r) => r.id === win.roomId);
            if (!room) return null;
            const { x1, y1, x2, y2 } = openingCoords(room, win.wall, win.position, WINDOW_GAP);
            return (
              <Line
                key={`win-${i}`}
                points={[x1, y1, x2, y2]}
                stroke="#06b6d4"
                strokeWidth={4 / scale}
                dash={[6, 4]}
              />
            );
          })}
        </Layer>
      </Stage>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-card border border-border rounded-xl shadow-md overflow-hidden">
        <button
          onClick={() => setViewOverride({ key: fitKey, scale: scale * 1.15, ...stagePos })}
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
          aria-label="Zoom in"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => setViewOverride({ key: fitKey, scale: scale / 1.15, ...stagePos })}
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-secondary transition-colors border-t border-border"
          aria-label="Zoom out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={resetView}
          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-secondary transition-colors border-t border-border"
          aria-label="Reset view"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function openingCoords(
  room: { x: number; y: number; width: number; height: number },
  wall: "top" | "bottom" | "left" | "right",
  position: number,
  gap: number
) {
  const p = Math.min(Math.max(position, 0), 1);
  if (wall === "top") {
    const cx = room.x + room.width * p;
    return { x1: cx - gap / 2, y1: room.y, x2: cx + gap / 2, y2: room.y };
  }
  if (wall === "bottom") {
    const cx = room.x + room.width * p;
    return {
      x1: cx - gap / 2,
      y1: room.y + room.height,
      x2: cx + gap / 2,
      y2: room.y + room.height,
    };
  }
  if (wall === "left") {
    const cy = room.y + room.height * p;
    return { x1: room.x, y1: cy - gap / 2, x2: room.x, y2: cy + gap / 2 };
  }
  // right
  const cy = room.y + room.height * p;
  return {
    x1: room.x + room.width,
    y1: cy - gap / 2,
    x2: room.x + room.width,
    y2: cy + gap / 2,
  };
}

function GridLayer({ bbox }: { bbox: { x: number; y: number; w: number; h: number } }) {
  const step = 50; // 1 m
  const lines: React.ReactNode[] = [];
  const startX = Math.floor(bbox.x / step) * step - step * 4;
  const endX = Math.ceil((bbox.x + bbox.w) / step) * step + step * 4;
  const startY = Math.floor(bbox.y / step) * step - step * 4;
  const endY = Math.ceil((bbox.y + bbox.h) / step) * step + step * 4;
  for (let x = startX; x <= endX; x += step) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, startY, x, endY]}
        stroke="#cbd5e1"
        strokeWidth={0.5}
        opacity={0.4}
      />
    );
  }
  for (let y = startY; y <= endY; y += step) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[startX, y, endX, y]}
        stroke="#cbd5e1"
        strokeWidth={0.5}
        opacity={0.4}
      />
    );
  }
  return <>{lines}</>;
}
