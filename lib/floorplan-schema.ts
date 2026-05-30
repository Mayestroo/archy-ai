// lib/floorplan-schema.ts

export type WallSide = "top" | "bottom" | "left" | "right";

export interface Room {
  /** Unique identifier for this room */
  id: string;
  /** Room type, e.g. "bedroom", "kitchen", "bathroom", "living" */
  type: string;
  /** X position in the canvas grid (px or arbitrary units) */
  x: number;
  /** Y position in the canvas grid */
  y: number;
  /** Width of the room */
  width: number;
  /** Height of the room */
  height: number;
  /** Human-readable label, e.g. "Master Bedroom" */
  label: string;
}

export interface Door {
  /** ID of the room this door belongs to */
  roomId: string;
  /** Which wall the door is placed on */
  wall: WallSide;
  /** Fractional position along the wall (0.0 – 1.0) */
  position: number;
}

export interface Window {
  /** ID of the room this window belongs to */
  roomId: string;
  /** Which wall the window is placed on */
  wall: WallSide;
  /** Fractional position along the wall (0.0 – 1.0) */
  position: number;
}

export interface FloorPlan {
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  /** Total floor area in square units */
  totalArea: number;
}
