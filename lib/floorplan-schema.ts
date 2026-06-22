// lib/floorplan-schema.ts

export type WallSide = "top" | "bottom" | "left" | "right";
export type DoorHinge = "left" | "right";
export type DoorSwing = "inward" | "outward";

export const ROOM_TYPE_OPTIONS = [
  { value: "living", label: "Living" },
  { value: "dining", label: "Dining" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bedroom", label: "Bedroom" },
  { value: "master_bedroom", label: "Master Bedroom" },
  { value: "bathroom", label: "Bathroom" },
  { value: "ensuite", label: "Ensuite" },
  { value: "hallway", label: "Hallway" },
  { value: "laundry", label: "Laundry" },
  { value: "entry", label: "Entry" },
  { value: "garage", label: "Garage" },
  { value: "studio", label: "Studio" },
  { value: "study", label: "Study / Office" },
] as const;

export type EditableRoomType = (typeof ROOM_TYPE_OPTIONS)[number]["value"];

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
  /** Opening width in metres. Defaults to 0.9m when omitted. */
  widthMeters?: number;
  /** Which side of the opening contains the hinge, viewed along the wall. */
  hinge?: DoorHinge;
  /** Whether the door swings into or out of the room. */
  swing?: DoorSwing;
}

export interface Window {
  /** ID of the room this window belongs to */
  roomId: string;
  /** Which wall the window is placed on */
  wall: WallSide;
  /** Fractional position along the wall (0.0 – 1.0) */
  position: number;
  /** Opening width in metres. Defaults to 1.2m when omitted. */
  widthMeters?: number;
}

export type FurnitureType =
  | "bed"
  | "wardrobe"
  | "sofa"
  | "coffee_table"
  | "media_console"
  | "dining_table"
  | "chair"
  | "kitchen_counter"
  | "kitchen_island"
  | "toilet"
  | "vanity"
  | "shower"
  | "washer"
  | "desk"
  | "car"
  | "storage";

export interface FurnitureItem {
  /** Unique identifier for this furniture item */
  id: string;
  /** ID of the room this furniture belongs to */
  roomId: string;
  /** Furniture category used for drawing simple symbols */
  type: FurnitureType;
  /** Human-readable label, e.g. "Queen Bed" */
  label: string;
  /** X position relative to the room origin */
  x: number;
  /** Y position relative to the room origin */
  y: number;
  /** Width in the same canvas units as rooms */
  width: number;
  /** Height in the same canvas units as rooms */
  height: number;
  /** Optional clockwise rotation in degrees */
  rotation?: 0 | 90 | 180 | 270;
}

export interface RoomMaterial {
  /** ID of the room this material preset belongs to */
  roomId: string;
  /** Human-readable material palette name */
  palette: string;
  /** 2D/3D floor color */
  floorColor: string;
  /** 3D wall color */
  wallColor: string;
  /** Accent color used for room outlines and export highlights */
  accentColor: string;
  /** Text label for the main floor finish */
  floorFinish: string;
  /** Text label for the main wall finish */
  wallFinish: string;
  /** Whether this palette was explicitly chosen by the user */
  manual?: boolean;
}

export interface PlanPoint {
  x: number;
  y: number;
}

export interface ArchitecturalWallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  exterior: boolean;
  thickness: number;
  roomIds: string[];
}

export interface RoomPolygon {
  roomId: string;
  points: PlanPoint[];
}

export type BuiltInKind = "closet" | "cabinet" | "counter" | "wet_zone" | "storage";

export interface ArchitecturalBuiltIn {
  id: string;
  roomId: string;
  kind: BuiltInKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ArchitecturalCoreKind = "stair" | "service_shaft";

export interface ArchitecturalCore {
  id: string;
  kind: ArchitecturalCoreKind;
  label: string;
  roomId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArchitecturalDetail {
  version: "wall_graph_v1";
  wallThickness: {
    exterior: number;
    interior: number;
  };
  footprint: PlanPoint[];
  roomPolygons: RoomPolygon[];
  wallSegments: ArchitecturalWallSegment[];
  builtIns: ArchitecturalBuiltIn[];
  cores: ArchitecturalCore[];
}

export type InteriorConceptStyle = "warm_minimal" | "modern_neutral" | "scandinavian" | "luxury_contemporary" | "builder_display";
export type ExteriorConceptStyle = "modern_minimal" | "warm_contemporary" | "scandinavian" | "luxury_villa" | "builder_spec";

export interface InteriorConceptBrief {
  /** Unique identifier for this concept brief */
  id: string;
  /** ID of the room this concept belongs to */
  roomId: string;
  /** Style preset used to generate the concept */
  style: InteriorConceptStyle;
  /** Human-readable style label */
  styleLabel: string;
  /** Short client-facing title */
  title: string;
  /** Concise concept summary */
  summary: string;
  /** Palette labels and finish cues */
  palette: string[];
  /** Furniture and layout direction */
  furniturePlan: string[];
  /** Detailed prompt ready for a future image/rendering model */
  renderPrompt: string;
  /** ISO timestamp when this brief was created */
  createdAt: string;
}

export interface ExteriorConceptBrief {
  /** Unique identifier for this facade concept brief */
  id: string;
  /** Style preset used to generate the facade concept */
  style: ExteriorConceptStyle;
  /** Human-readable style label */
  styleLabel: string;
  /** Short client-facing title */
  title: string;
  /** Concise facade concept summary */
  summary: string;
  /** Exterior material and color cues */
  palette: string[];
  /** Massing, entry, roof, and opening direction */
  facadeMoves: string[];
  /** Detailed prompt ready for a future image/rendering model */
  renderPrompt: string;
  /** ISO timestamp when this brief was created */
  createdAt: string;
}

export interface FloorPlan {
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  /** Optional professional drawing layer derived from room geometry. */
  architectural?: ArchitecturalDetail;
  /** Deterministic furniture suggestions, positioned relative to each room */
  furniture?: FurnitureItem[];
  /** Deterministic room material and finish presets */
  materials?: RoomMaterial[];
  /** Saved room-level interior concept briefs */
  interiorConcepts?: InteriorConceptBrief[];
  /** Saved whole-plan exterior facade concept brief */
  exteriorConcept?: ExteriorConceptBrief;
  /** Total floor area in square units */
  totalArea: number;
  /** Deterministic layout template used to create this plan, when known */
  template?: string;
  /** User-visible notes about limitations or deterministic refinements applied */
  generationNotes?: string[];
}
