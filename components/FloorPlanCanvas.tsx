"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Line, Group, Circle, Ellipse, Path } from "react-konva";
import type Konva from "konva";
import type { ArchitecturalBuiltIn, ArchitecturalCore, Door, FloorPlan, FurnitureItem, Room } from "@/lib/floorplan-schema";
import { createArchitecturalDetail } from "@/lib/architectural-detail";
import { getRoomMaterial } from "@/lib/materials";
import { CANVAS_UNITS_PER_METER, getDoorHinge, getDoorSwing, getOpeningWidthPixels, type OpeningSelection } from "@/lib/openings";
import {
  MIN_ROOM_SIZE,
  moveRoomGeometry,
  resizeRoomGeometry,
  type ResizeHandle,
  type RoomGeometry,
} from "@/lib/room-geometry";

interface FloorPlanCanvasProps {
  floorPlan: FloorPlan;
  selectedRoomId?: string | null;
  selectedOpening?: OpeningSelection | null;
  onSelectRoom?: (roomId: string) => void;
  onSelectOpening?: (selection: OpeningSelection) => void;
  onUpdateRoomGeometry?: (roomId: string, geometry: RoomGeometry) => boolean;
  geometryFeedback?: { id: number; roomId: string } | null;
  onRoomGeometryFeedback?: (roomId: string, message: string) => void;
}

const PALETTE = [
  "#5D5DFF", "#10b981", "#f59e0b", "#ef4444", "#06b6d4",
  "#8b5cf6", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
];

const PADDING = 60;
const MIN_ROOM_MESSAGE = `Minimum size reached: rooms stay at least ${MIN_ROOM_SIZE / 50}m wide/deep.`;
const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const RESIZE_CURSORS: Record<ResizeHandle, string> = {
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
  ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
};

const WALL_COLOR = "#1a1a2e";
const EXTERIOR_STROKE = 4;
const INTERIOR_STROKE = 1.5;

interface ViewOverride {
  key: string;
  scale: number;
  x: number;
  y: number;
}

export default function FloorPlanCanvas({
  floorPlan,
  selectedRoomId,
  selectedOpening,
  onSelectRoom,
  onSelectOpening,
  onUpdateRoomGeometry,
  geometryFeedback,
  onRoomGeometryFeedback,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [viewOverride, setViewOverride] = useState<ViewOverride | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    function checkTheme() {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const bbox = useMemo(() => {
    if (!floorPlan?.rooms?.length) return { x: 0, y: 0, w: 800, h: 600 };
    const xs = floorPlan.rooms.map((r) => r.x);
    const ys = floorPlan.rooms.map((r) => r.y);
    const xe = floorPlan.rooms.map((r) => r.x + r.width);
    const ye = floorPlan.rooms.map((r) => r.y + r.height);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return { x: minX, y: minY, w: Math.max(...xe) - minX, h: Math.max(...ye) - minY };
  }, [floorPlan]);

  const fitKey = `${size.w}:${size.h}:${bbox.x}:${bbox.y}:${bbox.w}:${bbox.h}`;

  const fittedView = useMemo(() => {
    if (!size.w || !size.h || !bbox.w || !bbox.h) return { scale: 1, x: 0, y: 0 };
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

  const wallSegments = useMemo(
    () => floorPlan.architectural?.wallSegments ?? createArchitecturalDetail(floorPlan.rooms).wallSegments,
    [floorPlan.architectural?.wallSegments, floorPlan.rooms],
  );
  const builtIns = useMemo(
    () => floorPlan.architectural?.builtIns ?? createArchitecturalDetail(floorPlan.rooms).builtIns,
    [floorPlan.architectural?.builtIns, floorPlan.rooms],
  );
  const cores = useMemo(
    () => floorPlan.architectural?.cores ?? createArchitecturalDetail(floorPlan.rooms).cores,
    [floorPlan.architectural?.cores, floorPlan.rooms],
  );

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.05;
    const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    setViewOverride({ key: fitKey, scale: newScale, x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
  }

  function resetView() { setViewOverride(null); }

  function setStageCursor(cursor: string) {
    const container = stageRef.current?.container();
    if (container) container.style.cursor = cursor;
  }

  function handleOpeningSelect(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, selection: OpeningSelection) {
    e.cancelBubble = true;
    onSelectOpening?.(selection);
  }

  function handleRoomSelect(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, roomId: string) {
    e.cancelBubble = true;
    onSelectRoom?.(roomId);
  }

  function handleRoomDragStart(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, roomId: string) {
    e.cancelBubble = true;
    onSelectRoom?.(roomId);
    setStageCursor("move");
  }

  function handleRoomDragEnd(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, room: Room) {
    e.cancelBubble = true;
    const target = e.target;
    const nextGeometry = moveRoomGeometry(room, target.x(), target.y());
    target.position({ x: room.x, y: room.y });
    onUpdateRoomGeometry?.(room.id, nextGeometry);
  }

  function handleResizeStart(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, roomId: string) {
    e.cancelBubble = true;
    onSelectRoom?.(roomId);
  }

  function handleResizeEnd(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, room: Room, handle: ResizeHandle) {
    e.cancelBubble = true;
    const target = e.target;
    const attemptedMinimum = resizeAttemptWasTooSmall(room, handle, target.x(), target.y());
    const nextGeometry = resizeRoomGeometry(room, handle, target.x(), target.y());
    const center = resizeHandleCenter(handle, room);
    target.position(center);
    const accepted = onUpdateRoomGeometry?.(room.id, nextGeometry) ?? false;
    if (accepted && attemptedMinimum) onRoomGeometryFeedback?.(room.id, MIN_ROOM_MESSAGE);
  }

  return (
    <div ref={containerRef} className={`w-full h-full relative ${isDark ? "bg-[#1a1a1a]" : "bg-[#ebebeb]"}`}>
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
        onDragEnd={(e) => {
          if (e.target !== e.currentTarget) return;
          setViewOverride({ key: fitKey, scale, x: e.target.x(), y: e.target.y() });
        }}
      >
        <Layer listening={false}>
          <Rect x={-5000} y={-5000} width={10000} height={10000} fill={isDark ? "#1a1a1a" : "#ebebeb"} />
          <GridLayer bbox={bbox} size={size} stagePos={stagePos} scale={scale} isDark={isDark} />
        </Layer>

        <Layer>
          {/* Room fills */}
          {floorPlan.rooms.map((room, i) => {
            const color = colorFor(i);
            const material = getRoomMaterial(floorPlan, room.id);
            const roomFill = material?.floorColor ?? `${color}10`;
            return (
              <Line
                key={room.id}
                points={roomPolygonPoints(floorPlan, room)}
                closed
                fill={roomFill}
                listening={false}
              />
            );
          })}

          {/* All walls — deduplicated */}
          {wallSegments.map((seg, i) => (
            <Line
              key={`wall-${i}`}
              points={[seg.x1, seg.y1, seg.x2, seg.y2]}
              stroke={WALL_COLOR}
              strokeWidth={(seg.thickness ?? (seg.exterior ? EXTERIOR_STROKE : INTERIOR_STROKE)) / scale}
              lineCap="square"
              listening={false}
            />
          ))}

          {/* Built-ins */}
          {builtIns.map((builtIn) => (
            <BuiltInSymbol key={builtIn.id} builtIn={builtIn} scale={scale} />
          ))}

          {/* Service/stair cores */}
          {cores.map((core) => (
            <CoreSymbol key={core.id} core={core} scale={scale} />
          ))}

          {/* Doors */}
          {floorPlan.doors?.map((door, i) => {
            const room = floorPlan.rooms.find((r) => r.id === door.roomId);
            if (!room) return null;
            const widthPixels = getOpeningWidthPixels(door, "door");
            const { x1, y1, x2, y2 } = openingCoords(room, door.wall, door.position, widthPixels);
            const swing = doorSwingGeometry({ x1, y1, x2, y2 }, door, widthPixels);
            const selected = selectedOpening?.kind === "door" && selectedOpening.index === i;
            return (
              <Group
                key={`door-${i}`}
                onClick={(e) => handleOpeningSelect(e, { kind: "door", index: i })}
                onTap={(e) => handleOpeningSelect(e, { kind: "door", index: i })}
                onMouseEnter={() => setStageCursor(onSelectOpening ? "pointer" : "grab")}
                onMouseLeave={() => setStageCursor("grab")}
              >
                {selected && (
                  <Line points={[x1, y1, x2, y2]} stroke="#f59e0b" strokeWidth={14 / scale} lineCap="round" opacity={0.7} listening={false} />
                )}
                <Line points={[x1, y1, x2, y2]} stroke="#ffffff" strokeWidth={8 / scale} lineCap="round" hitStrokeWidth={Math.max(18 / scale, 10)} />
                <Line
                  points={swing.arcPoints}
                  stroke={WALL_COLOR}
                  strokeWidth={(selected ? 1.4 : 1) / scale}
                  listening={false}
                />
                <Line
                  points={[swing.hinge.x, swing.hinge.y, swing.leafEnd.x, swing.leafEnd.y]}
                  stroke={WALL_COLOR}
                  strokeWidth={(selected ? 1.8 : 1.2) / scale}
                  lineCap="round"
                  listening={false}
                />
              </Group>
            );
          })}

          {/* Windows */}
          {floorPlan.windows?.map((win, i) => {
            const room = floorPlan.rooms.find((r) => r.id === win.roomId);
            if (!room) return null;
            const widthPixels = getOpeningWidthPixels(win, "window");
            const { x1, y1, x2, y2 } = openingCoords(room, win.wall, win.position, widthPixels);
            const selected = selectedOpening?.kind === "window" && selectedOpening.index === i;
            return (
              <Group
                key={`win-${i}`}
                onClick={(e) => handleOpeningSelect(e, { kind: "window", index: i })}
                onTap={(e) => handleOpeningSelect(e, { kind: "window", index: i })}
                onMouseEnter={() => setStageCursor(onSelectOpening ? "pointer" : "grab")}
                onMouseLeave={() => setStageCursor("grab")}
              >
                {selected && (
                  <Line points={[x1, y1, x2, y2]} stroke="#083344" strokeWidth={12 / scale} lineCap="round" opacity={0.45} listening={false} />
                )}
                <Line points={[x1, y1, x2, y2]} stroke="#ffffff" strokeWidth={8 / scale} lineCap="round" hitStrokeWidth={Math.max(18 / scale, 10)} />
                <WindowDoubleLine x1={x1} y1={y1} x2={x2} y2={y2} wall={win.wall} scale={scale} />
              </Group>
            );
          })}

          {/* Furniture */}
          {floorPlan.furniture?.map((item) => {
            const room = floorPlan.rooms.find((r) => r.id === item.roomId);
            if (!room) return null;
            return (
              <BlueprintFurniture
                key={item.id}
                item={{ ...item, x: item.x + room.x, y: item.y + room.y }}
                scale={scale}
                color={isDark ? "#e0e0e0" : "#000000"}
              />
            );
          })}

          {/* Room labels + area + selection UI */}
          {floorPlan.rooms.map((room) => {
            const selected = room.id === selectedRoomId;
            const geometryFlashed = geometryFeedback?.roomId === room.id;
            const areaM2 = ((room.width * room.height) / 2500).toFixed(0);

            return (
              <Group
                key={`ui-${room.id}`}
                x={room.x}
                y={room.y}
                draggable={!!onUpdateRoomGeometry}
                onClick={(e) => handleRoomSelect(e, room.id)}
                onTap={(e) => handleRoomSelect(e, room.id)}
                onDragStart={(e) => handleRoomDragStart(e, room.id)}
                onDragEnd={(e) => handleRoomDragEnd(e, room)}
                onMouseEnter={() => setStageCursor(onUpdateRoomGeometry ? "move" : onSelectRoom ? "pointer" : "grab")}
                onMouseLeave={() => setStageCursor("grab")}
              >
                {geometryFlashed && (
                  <>
                    <Rect
                      x={-8} y={-8}
                      width={room.width + 16} height={room.height + 16}
                      stroke="#f59e0b" strokeWidth={5 / scale}
                      dash={[12 / scale, 7 / scale]}
                      shadowColor="#f59e0b" shadowBlur={22 / scale} shadowOpacity={0.35}
                      listening={false}
                    />
                    <Text
                      x={0} y={-30 / scale} width={room.width}
                      text="Edit blocked" align="center"
                      fontSize={12 / scale} fontStyle="bold" fill="#92400e"
                      listening={false}
                    />
                  </>
                )}
                {selected && (
                  <>
                    <Rect
                      x={6} y={6}
                      width={Math.max(room.width - 12, 0)} height={Math.max(room.height - 12, 0)}
                      stroke="#111827" strokeWidth={1.5 / scale}
                      dash={[8 / scale, 6 / scale]} opacity={0.45}
                      listening={false}
                    />
                    <Line points={[0, -14 / scale, room.width, -14 / scale]} stroke="#111827" strokeWidth={1.4 / scale} opacity={0.72} listening={false} />
                    <Line points={[0, -20 / scale, 0, -8 / scale]} stroke="#111827" strokeWidth={1.4 / scale} opacity={0.72} listening={false} />
                    <Line points={[room.width, -20 / scale, room.width, -8 / scale]} stroke="#111827" strokeWidth={1.4 / scale} opacity={0.72} listening={false} />
                    <Text x={0} y={-34 / scale} width={room.width} text={formatLengthMeters(room.width)} align="center" fontSize={11 / scale} fontStyle="bold" fill="#111827" listening={false} />
                    <Line points={[room.width + 14 / scale, 0, room.width + 14 / scale, room.height]} stroke="#111827" strokeWidth={1.4 / scale} opacity={0.72} listening={false} />
                    <Line points={[room.width + 8 / scale, 0, room.width + 20 / scale, 0]} stroke="#111827" strokeWidth={1.4 / scale} opacity={0.72} listening={false} />
                    <Line points={[room.width + 8 / scale, room.height, room.width + 20 / scale, room.height]} stroke="#111827" strokeWidth={1.4 / scale} opacity={0.72} listening={false} />
                    <Text x={room.width + 20 / scale} y={room.height / 2 - 7 / scale} text={formatLengthMeters(room.height)} fontSize={11 / scale} fontStyle="bold" fill="#111827" listening={false} />
                  </>
                )}
                <Text
                  x={0} y={room.height / 2 - 10} width={room.width}
                  text={room.label} align="center"
                  fontSize={Math.min(14, room.width / 8)} fontStyle="bold" fill="#1a1a2e"
                  opacity={0.25}
                />
                <Text
                  x={0} y={room.height / 2 + 8} width={room.width}
                  text={`${areaM2} m\u00B2`} align="center"
                  fontSize={Math.min(10, room.width / 12)} fill="#6b7280"
                  opacity={0.2}
                />
                {selected && onUpdateRoomGeometry && (
                  <>
                    {RESIZE_HANDLES.map((handle) => {
                      const center = resizeHandleCenter(handle, room);
                      const handleSize = 10 / scale;
                      return (
                        <Rect
                          key={handle}
                          x={center.x} y={center.y}
                          width={handleSize} height={handleSize}
                          offsetX={handleSize / 2} offsetY={handleSize / 2}
                          fill="#ffffff" stroke="#111827" strokeWidth={1.5 / scale}
                          cornerRadius={2 / scale} draggable dragDistance={2}
                          onDragStart={(e) => handleResizeStart(e, room.id)}
                          onDragEnd={(e) => handleResizeEnd(e, room, handle)}
                          onMouseEnter={() => setStageCursor(RESIZE_CURSORS[handle])}
                          onMouseLeave={() => setStageCursor("move")}
                        />
                      );
                    })}
                    <Text
                      x={8} y={Math.max(room.height - 22, 6)}
                      text={`Snap 1m \u00B7 min ${MIN_ROOM_SIZE / 50}m`}
                      fontSize={10 / scale} fill="#111827" opacity={0.55} listening={false}
                    />
                  </>
                )}
              </Group>
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

// ── Window double-line ──────────────────────────────────────────────────────

function roomPolygonPoints(floorPlan: FloorPlan, room: Room): number[] {
  const polygon = floorPlan.architectural?.roomPolygons.find((candidate) => candidate.roomId === room.id);
  const points = polygon?.points.length ? polygon.points : [
    { x: room.x, y: room.y },
    { x: room.x + room.width, y: room.y },
    { x: room.x + room.width, y: room.y + room.height },
    { x: room.x, y: room.y + room.height },
  ];
  return points.flatMap((point) => [point.x, point.y]);
}

function BuiltInSymbol({ builtIn, scale }: { builtIn: ArchitecturalBuiltIn; scale: number }) {
  const stroke = builtIn.kind === "wet_zone" ? "#0f766e" : "#374151";
  const fill = builtIn.kind === "wet_zone" ? "rgba(20,184,166,0.14)" : "rgba(17,24,39,0.06)";
  const hatchCount = Math.max(1, Math.floor((builtIn.width + builtIn.height) / 70));
  return (
    <Group listening={false}>
      <Rect
        x={builtIn.x}
        y={builtIn.y}
        width={builtIn.width}
        height={builtIn.height}
        fill={fill}
        stroke={stroke}
        strokeWidth={1 / scale}
        cornerRadius={2 / scale}
      />
      {Array.from({ length: hatchCount }).map((_, index) => {
        const offset = ((index + 1) / (hatchCount + 1)) * builtIn.width;
        return (
          <Line
            key={index}
            points={[builtIn.x + offset, builtIn.y + 2 / scale, builtIn.x + offset, builtIn.y + builtIn.height - 2 / scale]}
            stroke={stroke}
            strokeWidth={0.45 / scale}
            opacity={0.55}
          />
        );
      })}
      <Text
        x={builtIn.x}
        y={builtIn.y + builtIn.height / 2 - 5 / scale}
        width={builtIn.width}
        text={builtIn.label}
        align="center"
        fontSize={9 / scale}
        fontStyle="bold"
        fill={stroke}
        opacity={0.72}
      />
    </Group>
  );
}

function CoreSymbol({ core, scale }: { core: ArchitecturalCore; scale: number }) {
  const stair = core.kind === "stair";
  const stroke = stair ? "#7c2d12" : "#1e3a8a";
  const fill = stair ? "rgba(251,146,60,0.12)" : "rgba(59,130,246,0.12)";
  const steps = Math.max(3, Math.floor(core.height / 18));
  return (
    <Group listening={false}>
      <Rect
        x={core.x}
        y={core.y}
        width={core.width}
        height={core.height}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.2 / scale}
        cornerRadius={2 / scale}
      />
      {stair && Array.from({ length: steps }).map((_, index) => {
        const y = core.y + ((index + 1) / (steps + 1)) * core.height;
        return <Line key={index} points={[core.x + 4 / scale, y, core.x + core.width - 4 / scale, y]} stroke={stroke} strokeWidth={0.7 / scale} opacity={0.8} />;
      })}
      {!stair && (
        <>
          <Line points={[core.x, core.y, core.x + core.width, core.y + core.height]} stroke={stroke} strokeWidth={0.7 / scale} opacity={0.7} />
          <Line points={[core.x + core.width, core.y, core.x, core.y + core.height]} stroke={stroke} strokeWidth={0.7 / scale} opacity={0.7} />
        </>
      )}
      <Text
        x={core.x}
        y={core.y + core.height / 2 - 5 / scale}
        width={core.width}
        text={core.label}
        align="center"
        fontSize={9 / scale}
        fontStyle="bold"
        fill={stroke}
        opacity={0.82}
      />
    </Group>
  );
}

function WindowDoubleLine({ x1, y1, x2, y2, wall, scale }: {
  x1: number; y1: number; x2: number; y2: number;
  wall: "top" | "bottom" | "left" | "right"; scale: number;
}) {
  const gap = 3 / scale;
  const isHoriz = wall === "top" || wall === "bottom";
  const offset1 = isHoriz ? { dx: 0, dy: -gap } : { dx: -gap, dy: 0 };
  const offset2 = isHoriz ? { dx: 0, dy: gap } : { dx: gap, dy: 0 };
  return (
    <>
      <Line
        points={[x1 + offset1.dx, y1 + offset1.dy, x2 + offset1.dx, y2 + offset1.dy]}
        stroke={WALL_COLOR} strokeWidth={1 / scale} listening={false}
      />
      <Line
        points={[x1 + offset2.dx, y1 + offset2.dy, x2 + offset2.dx, y2 + offset2.dy]}
        stroke={WALL_COLOR} strokeWidth={1 / scale} listening={false}
      />
    </>
  );
}

// ── Blueprint furniture symbols ─────────────────────────────────────────────

// ── Blueprint furniture symbols (realistic architectural style) ───────────────

function BlueprintFurniture({ item, scale, color = "#000000" }: { item: FurnitureItem; scale: number; color?: string }) {
  const { x, y, width: w, height: h, type } = item;
  const s = 0.8 / scale;

  switch (type) {
    // ── BED ────────────────────────────────────────────────────────────────────
    case "bed":
      return (
        <Group x={x} y={y} listening={false}>
          {/* Bed frame */}
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={2 / scale} listening={false} />
          {/* Headboard line (thicker) */}
          <Line points={[1 / scale, 0, w - 1 / scale, 0]} stroke={color} strokeWidth={s * 1.5} listening={false} />
          {/* Pillows */}
          <Rect x={w * 0.12} y={h * 0.04} width={w * 0.32} height={h * 0.16} stroke={color} strokeWidth={s * 0.6} cornerRadius={w * 0.04} listening={false} />
          <Rect x={w * 0.56} y={h * 0.04} width={w * 0.32} height={h * 0.16} stroke={color} strokeWidth={s * 0.6} cornerRadius={w * 0.04} listening={false} />
          {/* Blanket fold line */}
          <Line points={[w * 0.05, h * 0.38, w * 0.95, h * 0.38]} stroke={color} strokeWidth={s * 0.4} listening={false} />
          <Line points={[w * 0.05, h * 0.41, w * 0.95, h * 0.41]} stroke={color} strokeWidth={s * 0.25} dash={[2 / scale, 3 / scale]} listening={false} />
          {/* Center sleep-divider crease */}
          <Line points={[w * 0.5, h * 0.2, w * 0.5, h * 0.92]} stroke={color} strokeWidth={s * 0.2} dash={[1 / scale, 4 / scale]} listening={false} />
          {/* Bedside tables */}
          {w > 100 && (
            <>
              <Rect x={2 / scale} y={h * 0.04} width={w * 0.09} height={h * 0.14} stroke={color} strokeWidth={s * 0.5} cornerRadius={1 / scale} listening={false} />
              <Rect x={w * 0.89} y={h * 0.04} width={w * 0.09} height={h * 0.14} stroke={color} strokeWidth={s * 0.5} cornerRadius={1 / scale} listening={false} />
            </>
          )}
        </Group>
      );

    // ── WARDROBE ───────────────────────────────────────────────────────────────
    case "wardrobe":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={1 / scale} listening={false} />
          {/* Sliding door track top/bottom */}
          <Line points={[0, h * 0.04, w, h * 0.04]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Line points={[0, h * 0.96, w, h * 0.96]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Door split */}
          <Line points={[w * 0.5, h * 0.04, w * 0.5, h * 0.96]} stroke={color} strokeWidth={s * 0.6} listening={false} />
          {/* Hanging rod */}
          <Line points={[w * 0.06, h * 0.25, w * 0.94, h * 0.25]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          {/* Hanger hooks */}
          {Array.from({ length: Math.min(Math.floor(w / 18), 4) }).map((_, i) => (
            <Line key={i} points={[w * (0.12 + i * 0.2), h * 0.25, w * (0.12 + i * 0.2), h * 0.32]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          ))}
          {/* Shelf below */}
          <Line points={[w * 0.06, h * 0.6, w * 0.94, h * 0.6]} stroke={color} strokeWidth={s * 0.4} listening={false} />
          <Line points={[w * 0.06, h * 0.78, w * 0.94, h * 0.78]} stroke={color} strokeWidth={s * 0.4} listening={false} />
        </Group>
      );

    // ── SOFA ───────────────────────────────────────────────────────────────────
    case "sofa":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={5 / scale} listening={false} />
          {/* Armrest profiles */}
          <Rect x={2 / scale} y={h * 0.08} width={w * 0.1} height={h * 0.84} stroke={color} strokeWidth={s * 0.6} cornerRadius={2 / scale} listening={false} />
          <Rect x={w * 0.88} y={h * 0.08} width={w * 0.1} height={h * 0.84} stroke={color} strokeWidth={s * 0.6} cornerRadius={2 / scale} listening={false} />
          {/* Back cushion divisions */}
          <Line points={[w * 0.28, h * 0.08, w * 0.28, h * 0.5]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Line points={[w * 0.5, h * 0.08, w * 0.5, h * 0.5]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Line points={[w * 0.72, h * 0.08, w * 0.72, h * 0.5]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Seat cushion divisions */}
          <Line points={[w * 0.18, h * 0.52, w * 0.18, h * 0.92]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Line points={[w * 0.38, h * 0.52, w * 0.38, h * 0.92]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Line points={[w * 0.62, h * 0.52, w * 0.62, h * 0.92]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Line points={[w * 0.82, h * 0.52, w * 0.82, h * 0.92]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Seat-front welt line */}
          <Line points={[w * 0.1, h * 0.92, w * 0.9, h * 0.92]} stroke={color} strokeWidth={s * 0.3} listening={false} />
        </Group>
      );

    // ── COFFEE TABLE ───────────────────────────────────────────────────────────
    case "coffee_table":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={3 / scale} listening={false} />
          {/* Tabletop thickness */}
          <Rect x={3 / scale} y={3 / scale} width={w - 6 / scale} height={h - 6 / scale} stroke={color} strokeWidth={s * 0.4} cornerRadius={2 / scale} listening={false} />
          {/* Magazine/book hint */}
          <Line points={[w * 0.2, h * 0.3, w * 0.8, h * 0.3]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Line points={[w * 0.2, h * 0.5, w * 0.7, h * 0.5]} stroke={color} strokeWidth={s * 0.3} listening={false} />
        </Group>
      );

    // ── MEDIA CONSOLE ──────────────────────────────────────────────────────────
    case "media_console":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={1 / scale} listening={false} />
          {/* Compartment doors */}
          <Rect x={w * 0.06} y={h * 0.12} width={w * 0.4} height={h * 0.76} stroke={color} strokeWidth={s * 0.5} cornerRadius={1 / scale} listening={false} />
          <Rect x={w * 0.54} y={h * 0.12} width={w * 0.4} height={h * 0.76} stroke={color} strokeWidth={s * 0.5} cornerRadius={1 / scale} listening={false} />
          {/* Shelf lines inside */}
          <Line points={[w * 0.06, h * 0.5, w * 0.46, h * 0.5]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Line points={[w * 0.54, h * 0.5, w * 0.94, h * 0.5]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* TV screen above */}
          <Rect x={w * 0.15} y={-h * 2.2} width={w * 0.7} height={h * 1.8} stroke={color} strokeWidth={s * 0.5} cornerRadius={1 / scale} listening={false} />
          {/* TV stand */}
          <Rect x={w * 0.42} y={-h * 0.4} width={w * 0.16} height={h * 0.4} stroke={color} strokeWidth={s * 0.4} listening={false} />
        </Group>
      );

    // ── DINING TABLE ───────────────────────────────────────────────────────────
    case "dining_table":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={3 / scale} listening={false} />
          {/* Tabletop edge thickness */}
          <Rect x={3 / scale} y={3 / scale} width={w - 6 / scale} height={h - 6 / scale} stroke={color} strokeWidth={s * 0.4} cornerRadius={2 / scale} listening={false} />
          {/* Place setting hints if table is large enough */}
          {w > 60 && h > 35 && (
            <>
              {/* Top chairs */}
              <Rect x={w * 0.1} y={-8 / scale} width={w * 0.18} height={6 / scale} stroke={color} strokeWidth={s * 0.6} cornerRadius={1 / scale} listening={false} />
              <Rect x={w * 0.4} y={-8 / scale} width={w * 0.18} height={6 / scale} stroke={color} strokeWidth={s * 0.6} cornerRadius={1 / scale} listening={false} />
              <Rect x={w * 0.7} y={-8 / scale} width={w * 0.18} height={6 / scale} stroke={color} strokeWidth={s * 0.6} cornerRadius={1 / scale} listening={false} />
              {/* Bottom chairs */}
              <Rect x={w * 0.1} y={h + 2 / scale} width={w * 0.18} height={6 / scale} stroke={color} strokeWidth={s * 0.6} cornerRadius={1 / scale} listening={false} />
              <Rect x={w * 0.4} y={h + 2 / scale} width={w * 0.18} height={6 / scale} stroke={color} strokeWidth={s * 0.6} cornerRadius={1 / scale} listening={false} />
              <Rect x={w * 0.7} y={h + 2 / scale} width={w * 0.18} height={6 / scale} stroke={color} strokeWidth={s * 0.6} cornerRadius={1 / scale} listening={false} />
            </>
          )}
        </Group>
      );

    // ── CHAIR ──────────────────────────────────────────────────────────────────
    case "chair":
      return (
        <Group x={x} y={y} listening={false}>
          {/* Backrest */}
          <Rect x={w * 0.12} y={0} width={w * 0.76} height={h * 0.28} stroke={color} strokeWidth={s * 0.7} cornerRadius={2 / scale} listening={false} />
          <Line points={[w * 0.12, h * 0.14, w * 0.88, h * 0.14]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Seat */}
          <Rect x={w * 0.05} y={h * 0.24} width={w * 0.9} height={h * 0.52} stroke={color} strokeWidth={s * 0.6} cornerRadius={2 / scale} listening={false} />
          {/* Legs */}
          <Line points={[w * 0.12, h * 0.76, w * 0.12, h * 0.96]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          <Line points={[w * 0.88, h * 0.76, w * 0.88, h * 0.96]} stroke={color} strokeWidth={s * 0.5} listening={false} />
        </Group>
      );

    // ── KITCHEN COUNTER ────────────────────────────────────────────────────────
    case "kitchen_counter":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={1 / scale} listening={false} />
          {/* Countertop thickness */}
          <Line points={[3 / scale, 0, w - 3 / scale, 0]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Sink basin */}
          <Rect x={w * 0.08} y={h * 0.1} width={w * 0.3} height={h * 0.65} stroke={color} strokeWidth={s * 0.6} rx={w * 0.04} ry={h * 0.08} listening={false} />
          {/* Sink drain */}
          <Circle x={w * 0.23} y={h * 0.42} radius={2 / scale} fill={color} listening={false} />
          {/* Faucet */}
          <Line points={[w * 0.23, h * 0.1, w * 0.23, 0, w * 0.28, 0]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          {/* Stove burners */}
          <Circle x={w * 0.6} y={h * 0.25} radius={5 / scale} stroke={color} strokeWidth={s * 0.4} listening={false} />
          <Circle x={w * 0.78} y={h * 0.25} radius={5 / scale} stroke={color} strokeWidth={s * 0.4} listening={false} />
          <Circle x={w * 0.6} y={h * 0.55} radius={5 / scale} stroke={color} strokeWidth={s * 0.4} listening={false} />
          <Circle x={w * 0.78} y={h * 0.55} radius={5 / scale} stroke={color} strokeWidth={s * 0.4} listening={false} />
          {/* Burner cross lines */}
          {[
            [w * 0.6, h * 0.25],
            [w * 0.78, h * 0.25],
            [w * 0.6, h * 0.55],
            [w * 0.78, h * 0.55],
          ].map(([cx, cy], i) => (
            <Line key={`b${i}`} points={[cx - 4 / scale, cy, cx + 4 / scale, cy]} stroke={color} strokeWidth={s * 0.2} listening={false} />
          ))}
        </Group>
      );

    // ── KITCHEN ISLAND ─────────────────────────────────────────────────────────
    case "kitchen_island":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={3 / scale} listening={false} />
          {/* Counter overhang (seat-facing side) */}
          <Line points={[4 / scale, h * 0.06, w - 4 / scale, h * 0.06]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Prep sink */}
          <Ellipse x={w * 0.25} y={h * 0.5} radiusX={w * 0.1} radiusY={h * 0.22} stroke={color} strokeWidth={s * 0.6} listening={false} />
          <Circle x={w * 0.25} y={h * 0.5} radius={1.5 / scale} fill={color} listening={false} />
          {/* Bar stool hints on opposite side */}
          <Circle x={w * 0.55} y={h * 0.15} radius={2.5 / scale} stroke={color} strokeWidth={s * 0.5} listening={false} />
          <Circle x={w * 0.7} y={h * 0.15} radius={2.5 / scale} stroke={color} strokeWidth={s * 0.5} listening={false} />
          <Circle x={w * 0.85} y={h * 0.15} radius={2.5 / scale} stroke={color} strokeWidth={s * 0.5} listening={false} />
        </Group>
      );

    // ── TOILET ─────────────────────────────────────────────────────────────────
    case "toilet":
      return (
        <Group x={x} y={y} listening={false}>
          {/* Tank */}
          <Rect x={w * 0.12} y={0} width={w * 0.76} height={h * 0.32} stroke={color} strokeWidth={s} cornerRadius={2 / scale} listening={false} />
          {/* Tank lid line */}
          <Line points={[w * 0.12, h * 0.04, w * 0.88, h * 0.04]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Flush actuator */}
          <Rect x={w * 0.42} y={h * 0.03} width={w * 0.16} height={h * 0.06} stroke={color} strokeWidth={s * 0.4} cornerRadius={1 / scale} listening={false} />
          {/* Bowl */}
          <Ellipse x={w / 2} y={h * 0.66} radiusX={w * 0.4} radiusY={h * 0.32} stroke={color} strokeWidth={s} listening={false} />
          {/* Seat separation */}
          <Line points={[w * 0.12, h * 0.66, w * 0.88, h * 0.66]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Bowl to tank connector */}
          <Line points={[w * 0.5, h * 0.32, w * 0.5, h * 0.38]} stroke={color} strokeWidth={s * 0.5} listening={false} />
        </Group>
      );

    // ── SHOWER ─────────────────────────────────────────────────────────────────
    case "shower":
      return (
        <Group x={x} y={y} listening={false}>
          {/* Enclosure outline */}
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={2 / scale} listening={false} />
          {/* Glass enclosure (corner angle) */}
          <Line points={[0, h * 0.25, 0, 0, w * 0.25, 0]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          {/* Glass door arc */}
          <Path data={`M ${w * 0.25} 0 A ${w * 0.25} ${h * 0.25} 0 0 1 0 ${h * 0.25}`} stroke={color} strokeWidth={s * 0.4} listening={false} />
          {/* Drain circle */}
          <Circle x={w * 0.5} y={h * 0.5} radius={Math.min(w, h) * 0.08} stroke={color} strokeWidth={s * 0.5} listening={false} />
          <Circle x={w * 0.5} y={h * 0.5} radius={1.5 / scale} fill={color} listening={false} />
          {/* Shower head */}
          <Circle x={w * 0.12} y={h * 0.12} radius={3 / scale} stroke={color} strokeWidth={s * 0.5} listening={false} />
          <Line points={[w * 0.12, h * 0.12, w * 0.12, h * 0.03]} stroke={color} strokeWidth={s * 0.4} listening={false} />
          {/* Spray arcs */}
          <Path data={`M ${w * 0.08} ${h * 0.08} A ${w * 0.3} ${h * 0.3} 0 0 1 ${w * 0.38} ${h * 0.08}`} stroke={color} strokeWidth={s * 0.2} listening={false} />
          <Path data={`M ${w * 0.05} ${h * 0.12} A ${w * 0.35} ${h * 0.35} 0 0 1 ${w * 0.42} ${h * 0.05}`} stroke={color} strokeWidth={s * 0.2} listening={false} />
        </Group>
      );

    // ── VANITY ─────────────────────────────────────────────────────────────────
    case "vanity":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={1 / scale} listening={false} />
          {/* Countertop edge */}
          <Line points={[1 / scale, 1 / scale, w - 1 / scale, 1 / scale]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Sink basin */}
          <Ellipse x={w / 2} y={h * 0.55} radiusX={w * 0.28} radiusY={h * 0.32} stroke={color} strokeWidth={s * 0.6} listening={false} />
          {/* Drain */}
          <Circle x={w / 2} y={h * 0.55} radius={1.5 / scale} fill={color} listening={false} />
          {/* Faucet */}
          <Line points={[w * 0.5, h * 0.23, w * 0.5, h * 0.1]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          <Line points={[w * 0.42, h * 0.1, w * 0.58, h * 0.1]} stroke={color} strokeWidth={s * 0.4} listening={false} />
          {/* Mirror above */}
          <Rect x={w * 0.15} y={-h * 1.2} width={w * 0.7} height={h * 0.8} stroke={color} strokeWidth={s * 0.4} cornerRadius={2 / scale} listening={false} />
          {/* Cabinet drawer hints */}
          <Line points={[w * 0.06, h * 0.85, w * 0.94, h * 0.85]} stroke={color} strokeWidth={s * 0.3} listening={false} />
        </Group>
      );

    // ── WASHER ─────────────────────────────────────────────────────────────────
    case "washer":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={2 / scale} listening={false} />
          {/* Door glass */}
          <Circle x={w / 2} y={h * 0.52} radius={Math.min(w, h) * 0.3} stroke={color} strokeWidth={s * 0.6} listening={false} />
          {/* Inner drum */}
          <Circle x={w / 2} y={h * 0.52} radius={Math.min(w, h) * 0.15} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Circle x={w / 2} y={h * 0.52} radius={1.5 / scale} fill={color} listening={false} />
          {/* Control panel */}
          <Rect x={w * 0.05} y={h * 0.04} width={w * 0.9} height={h * 0.15} stroke={color} strokeWidth={s * 0.4} cornerRadius={1 / scale} listening={false} />
          {/* Knobs */}
          <Circle x={w * 0.2} y={h * 0.11} radius={2.5 / scale} stroke={color} strokeWidth={s * 0.4} listening={false} />
          <Circle x={w * 0.35} y={h * 0.11} radius={2.5 / scale} stroke={color} strokeWidth={s * 0.4} listening={false} />
          <Circle x={w * 0.5} y={h * 0.11} radius={2.5 / scale} stroke={color} strokeWidth={s * 0.4} listening={false} />
        </Group>
      );

    // ── DESK ───────────────────────────────────────────────────────────────────
    case "desk":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={1 / scale} listening={false} />
          {/* Drawer/CPU unit on one side */}
          <Rect x={w * 0.02} y={h * 0.1} width={w * 0.22} height={h * 0.85} stroke={color} strokeWidth={s * 0.5} cornerRadius={1 / scale} listening={false} />
          <Line points={[w * 0.02, h * 0.35, w * 0.24, h * 0.35]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          <Line points={[w * 0.02, h * 0.6, w * 0.24, h * 0.6]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Monitor */}
          <Rect x={w * 0.4} y={-h * 1.5} width={w * 0.3} height={h * 1.15} stroke={color} strokeWidth={s * 0.5} cornerRadius={1 / scale} listening={false} />
          {/* Monitor stand */}
          <Rect x={w * 0.47} y={-h * 0.35} width={w * 0.06} height={h * 0.35} stroke={color} strokeWidth={s * 0.4} listening={false} />
          {/* Monitor screen inner */}
          <Rect x={w * 0.43} y={-h * 1.35} width={w * 0.24} height={h * 0.95} stroke={color} strokeWidth={s * 0.3} cornerRadius={0.5 / scale} listening={false} />
          {/* Keyboard hint */}
          <Rect x={w * 0.4} y={h * 0.08} width={w * 0.3} height={h * 0.08} stroke={color} strokeWidth={s * 0.3} cornerRadius={0.5 / scale} listening={false} />
          {/* Mouse mat */}
          <Rect x={w * 0.75} y={h * 0.08} width={w * 0.14} height={h * 0.1} stroke={color} strokeWidth={s * 0.3} cornerRadius={1 / scale} listening={false} />
        </Group>
      );

    // ── CAR ────────────────────────────────────────────────────────────────────
    case "car":
      return (
        <Group x={x} y={y} listening={false}>
          {/* Body */}
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={8 / scale} listening={false} />
          {/* Cabin (glass area) */}
          <Rect x={w * 0.25} y={h * 0.08} width={w * 0.5} height={h * 0.58} stroke={color} strokeWidth={s * 0.5} cornerRadius={3 / scale} listening={false} />
          {/* Windshield line */}
          <Line points={[w * 0.25, h * 0.08, w * 0.15, h * 0.35]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          {/* Rear window line */}
          <Line points={[w * 0.75, h * 0.08, w * 0.85, h * 0.35]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          {/* Hood line */}
          <Line points={[w * 0.05, h * 0.4, w * 0.2, h * 0.4]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* Trunk line */}
          <Line points={[w * 0.8, h * 0.4, w * 0.95, h * 0.4]} stroke={color} strokeWidth={s * 0.3} listening={false} />
          {/* A-pillar */}
          <Line points={[w * 0.25, h * 0.08, w * 0.25, h * 0.4]} stroke={color} strokeWidth={s * 0.4} listening={false} />
          {/* B-pillar */}
          <Line points={[w * 0.42, h * 0.08, w * 0.42, h * 0.4]} stroke={color} strokeWidth={s * 0.4} listening={false} />
          {/* C-pillar */}
          <Line points={[w * 0.58, h * 0.08, w * 0.58, h * 0.4]} stroke={color} strokeWidth={s * 0.4} listening={false} />
          {/* D-pillar */}
          <Line points={[w * 0.75, h * 0.08, w * 0.75, h * 0.4]} stroke={color} strokeWidth={s * 0.4} listening={false} />
          {/* Headlight */}
          <Rect x={1 / scale} y={h * 0.35} width={w * 0.04} height={h * 0.08} stroke={color} strokeWidth={s * 0.4} cornerRadius={0.5 / scale} listening={false} />
          {/* Taillight */}
          <Rect x={w * 0.95} y={h * 0.35} width={w * 0.04} height={h * 0.08} stroke={color} strokeWidth={s * 0.4} cornerRadius={0.5 / scale} listening={false} />
          {/* Wheels */}
          <Circle x={w * 0.2} y={h * 0.85} radius={h * 0.11} stroke={color} strokeWidth={s * 0.7} listening={false} />
          <Circle x={w * 0.2} y={h * 0.85} radius={h * 0.04} fill={color} listening={false} />
          <Circle x={w * 0.8} y={h * 0.85} radius={h * 0.11} stroke={color} strokeWidth={s * 0.7} listening={false} />
          <Circle x={w * 0.8} y={h * 0.85} radius={h * 0.04} fill={color} listening={false} />
        </Group>
      );

    // ── STORAGE ────────────────────────────────────────────────────────────────
    case "storage":
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={1 / scale} listening={false} />
          {/* Cabinet doors */}
          <Line points={[w * 0.13, 0, w * 0.13, h]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          <Line points={[w * 0.35, 0, w * 0.35, h]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          <Line points={[w * 0.63, 0, w * 0.63, h]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          <Line points={[w * 0.85, 0, w * 0.85, h]} stroke={color} strokeWidth={s * 0.5} listening={false} />
          {/* Adjustable shelf lines with clip dots */}
          {[h * 0.28, h * 0.48, h * 0.68].map((yPos, i) => (
            <React.Fragment key={`shelf_${i}`}>
              <Line points={[2 / scale, yPos, w - 2 / scale, yPos]} stroke={color} strokeWidth={s * 0.3} listening={false} />
              <Circle x={4 / scale} y={yPos} radius={1 / scale} fill={color} listening={false} />
              <Circle x={w - 4 / scale} y={yPos} radius={1 / scale} fill={color} listening={false} />
            </React.Fragment>
          ))}
        </Group>
      );

    // ── DEFAULT (unknown type — show label) ────────────────────────────────────
    default:
      return (
        <Group x={x} y={y} listening={false}>
          <Rect x={0} y={0} width={w} height={h} stroke={color} strokeWidth={s} cornerRadius={2 / scale} listening={false} />
          <Text x={0} y={h / 2 - 6 / scale} width={w} text={item.label} align="center" fontSize={Math.min(8, w / 6) / scale} fill={color} listening={false} />
        </Group>
      );
  }
}

// ── Opening geometry helpers ─────────────────────────────────────────────────

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
    return { x1: cx - gap / 2, y1: room.y + room.height, x2: cx + gap / 2, y2: room.y + room.height };
  }
  if (wall === "left") {
    const cy = room.y + room.height * p;
    return { x1: room.x, y1: cy - gap / 2, x2: room.x, y2: cy + gap / 2 };
  }
  const cy = room.y + room.height * p;
  return { x1: room.x + room.width, y1: cy - gap / 2, x2: room.x + room.width, y2: cy + gap / 2 };
}

function doorSwingGeometry(
  segment: { x1: number; y1: number; x2: number; y2: number },
  door: Door,
  width: number,
) {
  const hingeIsLeft = getDoorHinge(door) === "left";
  const hinge = hingeIsLeft ? { x: segment.x1, y: segment.y1 } : { x: segment.x2, y: segment.y2 };
  const closedEnd = hingeIsLeft ? { x: segment.x2, y: segment.y2 } : { x: segment.x1, y: segment.y1 };
  const closedVector = { x: closedEnd.x - hinge.x, y: closedEnd.y - hinge.y };
  const openVector = doorOpenVector(door.wall, getDoorSwing(door), width);
  const leafEnd = { x: hinge.x + openVector.x, y: hinge.y + openVector.y };
  return { hinge, leafEnd, arcPoints: arcPoints(hinge, closedVector, openVector, width) };
}

function doorOpenVector(wall: Door["wall"], swing: ReturnType<typeof getDoorSwing>, width: number) {
  if (wall === "top") return { x: 0, y: swing === "inward" ? width : -width };
  if (wall === "bottom") return { x: 0, y: swing === "inward" ? -width : width };
  if (wall === "left") return { x: swing === "inward" ? width : -width, y: 0 };
  return { x: swing === "inward" ? -width : width, y: 0 };
}

function arcPoints(
  center: { x: number; y: number },
  startVector: { x: number; y: number },
  endVector: { x: number; y: number },
  radius: number,
): number[] {
  const points: number[] = [];
  const steps = 16;
  const startAngle = Math.atan2(startVector.y, startVector.x);
  const endAngle = Math.atan2(endVector.y, endVector.x);
  let delta = endAngle - startAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (delta * i) / steps;
    points.push(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
  }
  return points;
}

function resizeHandleCenter(handle: ResizeHandle, room: Room): { x: number; y: number } {
  const x = handle.includes("w") ? 0 : handle.includes("e") ? room.width : room.width / 2;
  const y = handle.includes("n") ? 0 : handle.includes("s") ? room.height : room.height / 2;
  return { x, y };
}

function resizeAttemptWasTooSmall(room: Room, handle: ResizeHandle, relativeX: number, relativeY: number): boolean {
  return (handle.includes("e") && relativeX < MIN_ROOM_SIZE)
    || (handle.includes("s") && relativeY < MIN_ROOM_SIZE)
    || (handle.includes("w") && room.width - relativeX < MIN_ROOM_SIZE)
    || (handle.includes("n") && room.height - relativeY < MIN_ROOM_SIZE);
}

function formatLengthMeters(canvasUnits: number) {
  const meters = canvasUnits / CANVAS_UNITS_PER_METER;
  return `${Number.isInteger(meters) ? meters.toFixed(0) : meters.toFixed(1)}m`;
}

function GridLayer({ bbox, size, stagePos, scale, isDark }: { bbox: { x: number; y: number; w: number; h: number }; size: { w: number; h: number }; stagePos: { x: number; y: number }; scale: number; isDark: boolean }) {
  const step = 25;
  const pad = step * 8;
  const viewLeft = -stagePos.x / scale - pad;
  const viewTop = -stagePos.y / scale - pad;
  const viewRight = (size.w - stagePos.x) / scale + pad;
  const viewBottom = (size.h - stagePos.y) / scale + pad;
  const minX = Math.min(viewLeft, bbox.x - pad);
  const minY = Math.min(viewTop, bbox.y - pad);
  const maxX = Math.max(viewRight, bbox.x + bbox.w + pad);
  const maxY = Math.max(viewBottom, bbox.y + bbox.h + pad);
  const startX = Math.floor(minX / step) * step;
  const startY = Math.floor(minY / step) * step;
  const endX = Math.ceil(maxX / step) * step;
  const endY = Math.ceil(maxY / step) * step;
  const dotColor = isDark ? "#555555" : "#999999";
  const dots: React.ReactNode[] = [];
  for (let x = startX; x <= endX; x += step) {
    for (let y = startY; y <= endY; y += step) {
      dots.push(<Circle key={`d${x}_${y}`} x={x} y={y} radius={1} fill={dotColor} />);
    }
  }
  return <>{dots}</>;
}
