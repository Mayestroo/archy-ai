import type { UserType } from "./user-types";

export type WizardPhase = "onboarding" | "generating" | "refining";
export type WizardStep = "floors" | "area" | "shape" | "rooms" | "extras" | "review";
export type WizardModal = "shape" | "rooms" | "style" | "finish" | "furniture" | "render" | null;
export type EditorModal = WizardModal;
export type GenerationStage = "drawing_plan_outline" | "optimizing_flow" | "placing_furniture" | "finalizing_layout";

export const GENERATION_STAGES: { key: GenerationStage; label: string }[] = [
  { key: "drawing_plan_outline", label: "Drawing plan outline" },
  { key: "optimizing_flow", label: "Optimizing room flow" },
  { key: "placing_furniture", label: "Placing furniture" },
  { key: "finalizing_layout", label: "Finalizing layout" },
];

export type ShapeKey = "rectangle" | "l_shape" | "u_shape" | "t_shape" | "stepped" | "courtyard";
export type ShapeAttachmentType = "garage" | "deck" | "porch";

export interface ShapeAttachment {
  type: ShapeAttachmentType;
  label: string;
  side: "top" | "right" | "bottom" | "left";
}

export interface ShapeAnswer {
  shapeKey: ShapeKey;
  frontDoorSide: "top" | "right" | "bottom" | "left";
  attachments: ShapeAttachment[];
}

export interface AreaAnswer {
  value: number;
  unit: "sqm" | "sqft";
}

export interface WizardAnswers {
  floors?: number;
  area?: AreaAnswer;
  shape?: ShapeAnswer;
  rooms?: Record<string, number>;
  extras?: string[];
  extraNote?: string;
}

export interface WizardChoice {
  value: string;
  label: string;
  description?: string;
  locked?: boolean;
  lockLabel?: string;
}

export interface WizardStepDefinition {
  step: WizardStep;
  title: string;
  question: string;
  helperText?: string;
  kind: "choice" | "input" | "modal" | "review";
}

export interface RoomOption {
  id: string;
  label: string;
  defaultCount: number;
  category: string;
}

export const WIZARD_STEPS: WizardStep[] = ["floors", "area", "shape", "rooms", "extras", "review"];

export const FLOOR_OPTIONS: WizardChoice[] = [
  { value: "1", label: "1 floor" },
  { value: "2", label: "2 floors", locked: true, lockLabel: "Unlock multi-floor generation when you upgrade your plan." },
  { value: "3", label: "3 floors", locked: true, lockLabel: "Unlock multi-floor generation when you upgrade your plan." },
  { value: "4", label: "4 floors", locked: true, lockLabel: "Unlock multi-floor generation when you upgrade your plan." },
];

export const AREA_PRESETS: AreaAnswer[] = [
  { value: 80, unit: "sqm" },
  { value: 100, unit: "sqm" },
  { value: 120, unit: "sqm" },
  { value: 140, unit: "sqm" },
  { value: 180, unit: "sqm" },
];

export const SHAPE_OPTIONS: { key: ShapeKey; label: string; description: string }[] = [
  { key: "rectangle", label: "Rectangle", description: "Clean, efficient envelope" },
  { key: "l_shape", label: "L-shape", description: "Separated wing with a corner" },
  { key: "u_shape", label: "U-shape", description: "Courtyard-style enclosure" },
  { key: "t_shape", label: "T-shape", description: "Central spine with a cross wing" },
  { key: "stepped", label: "Stepped", description: "Offset massing with a dynamic edge" },
  { key: "courtyard", label: "Courtyard", description: "Wrapped void with outdoor focus" },
];

export const SHAPE_ATTACHMENTS: ShapeAttachment[] = [
  { type: "garage", label: "Garage", side: "right" },
  { type: "deck", label: "Deck", side: "bottom" },
  { type: "porch", label: "Porch", side: "top" },
];

export const ROOM_OPTIONS: RoomOption[] = [
  { id: "office", label: "Office", defaultCount: 1, category: "Work" },
  { id: "pantry", label: "Pantry", defaultCount: 1, category: "Storage" },
  { id: "bedroom", label: "Bedroom", defaultCount: 3, category: "Private" },
  { id: "kitchen", label: "Kitchen", defaultCount: 1, category: "Shared" },
  { id: "laundry", label: "Laundry", defaultCount: 1, category: "Service" },
  { id: "walk_in", label: "Walk-in", defaultCount: 1, category: "Private" },
  { id: "dining_room", label: "Dining Room", defaultCount: 1, category: "Shared" },
  { id: "living_room", label: "Living Room", defaultCount: 1, category: "Shared" },
  { id: "full_bathroom", label: "Full Bathroom", defaultCount: 2, category: "Service" },
  { id: "guest_bathroom", label: "Guest Bathroom", defaultCount: 1, category: "Service" },
  { id: "walk_in_closet", label: "Walk-in Closet", defaultCount: 1, category: "Private" },
];

export const EXTRA_SUGGESTIONS = [
  "Connect the mudroom to the entrance",
  "Make the office south-east facing",
  "Open-concept kitchen and living room",
  "Keep bedrooms away from street noise",
  "Prioritize morning light in the dining area",
];

export function getWizardSteps(userType: UserType | null | undefined): WizardStepDefinition[] {
  const tone = getWizardTone(userType);
  return [
    {
      step: "floors",
      title: "Number of floors",
      question: tone.floors,
      helperText: "Higher floor counts are locked in v1.",
      kind: "choice",
    },
    {
      step: "area",
      title: "Floor plan area",
      question: tone.area,
      helperText: "Use sqm or sqft. The preview updates after you confirm.",
      kind: "input",
    },
    {
      step: "shape",
      title: "Floor plan shape",
      question: tone.shape,
      helperText: "Choose a footprint and add garage / outdoor attachments.",
      kind: "modal",
    },
    {
      step: "rooms",
      title: "Preferred rooms",
      question: tone.rooms,
      helperText: "Set the room mix for the first pass.",
      kind: "modal",
    },
    {
      step: "extras",
      title: "Additional requirements",
      question: tone.extras,
      helperText: "Add flow, privacy, orientation, or lifestyle preferences.",
      kind: "input",
    },
    {
      step: "review",
      title: "Review",
      question: tone.review,
      helperText: "Generate the plan when the brief looks right.",
      kind: "review",
    },
  ];
}

export function getWizardIntro(userType: UserType | null | undefined): string {
  switch (userType) {
    case "architect_designer":
      return "Let's build a client-ready brief. First, how many floors should the project have?";
    case "real_estate_builder":
      return "Let's build a marketable concept. First, how many floors should this home have?";
    default:
      return "I'd be happy to help you generate a floor plan! Let's start with some basic information. How many floors should this home have?";
  }
}

export function getWizardStepPrompt(step: WizardStep, userType: UserType | null | undefined): string {
  const steps = getWizardSteps(userType);
  return steps.find((item) => item.step === step)?.question ?? "";
}

export function getNextWizardStep(step: WizardStep): WizardStep | null {
  const index = WIZARD_STEPS.indexOf(step);
  return index >= 0 && index < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[index + 1] : null;
}

export function formatArea(area?: AreaAnswer | null): string {
  if (!area) return "";
  return `${area.value} ${area.unit}`;
}

export function formatShapeAnswer(shape?: ShapeAnswer | null): string {
  if (!shape) return "";
  const shapeLabel = SHAPE_OPTIONS.find((item) => item.key === shape.shapeKey)?.label ?? shape.shapeKey;
  const attachments = shape.attachments.map((attachment) => attachment.label).join(", ");
  return attachments ? `${shapeLabel} + ${attachments}` : shapeLabel;
}

export function formatRoomSummary(rooms?: Record<string, number> | null): string {
  if (!rooms) return "";

  const bedCount = rooms.bedroom ?? 0;
  const bathCount = (rooms.full_bathroom ?? 0) + (rooms.guest_bathroom ?? 0);
  const officeCount = rooms.office ?? 0;
  const pantryCount = rooms.pantry ?? 0;
  const livingCount = rooms.living_room ?? 0;
  const diningCount = rooms.dining_room ?? 0;
  const parts: string[] = [];

  if (bedCount) parts.push(`${bedCount} bed${bedCount === 1 ? "" : "s"}`);
  if (bathCount) parts.push(`${bathCount} bath${bathCount === 1 ? "" : "s"}`);
  if (officeCount) parts.push(`${officeCount} office${officeCount === 1 ? "" : "s"}`);
  if (pantryCount) parts.push(`${pantryCount} pantry${pantryCount === 1 ? "" : "s"}`);
  if (livingCount) parts.push(`${livingCount} living room${livingCount === 1 ? "" : "s"}`);
  if (diningCount) parts.push(`${diningCount} dining room${diningCount === 1 ? "" : "s"}`);

  if (!parts.length) {
    return Object.entries(rooms)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => `${count} ${labelRoomKey(id)}`)
      .join(", ");
  }

  return parts.join(", ");
}

export function formatWizardStepSummary(step: WizardStep, answers: WizardAnswers): string {
  switch (step) {
    case "floors":
      return answers.floors ? `${answers.floors} floor${answers.floors === 1 ? "" : "s"}` : "";
    case "area":
      return formatArea(answers.area);
    case "shape":
      return formatShapeAnswer(answers.shape);
    case "rooms":
      return formatRoomSummary(answers.rooms);
    case "extras":
      return [answers.extraNote, ...(answers.extras ?? [])].filter(Boolean).join("; ");
    case "review":
      return "Ready to generate";
    default:
      return "";
  }
}

export function compileWizardPrompt(answers: WizardAnswers, userType: UserType | null | undefined): string {
  const lines: string[] = [];
  const intro = getPromptTone(userType);

  lines.push(intro);
  if (answers.floors) lines.push(`Floors: ${answers.floors}`);
  if (answers.area) lines.push(`Area: ${formatArea(answers.area)}`);
  if (answers.shape) {
    const shapeLabel = SHAPE_OPTIONS.find((item) => item.key === answers.shape?.shapeKey)?.label ?? answers.shape.shapeKey;
    const frontDoor = `front door on the ${answers.shape.frontDoorSide} side`;
    const attachments = answers.shape.attachments.length
      ? `attachments: ${answers.shape.attachments.map((attachment) => `${attachment.label} on the ${attachment.side} side`).join(", ")}`
      : "";
    lines.push(`Footprint: ${shapeLabel}${attachments ? `, ${attachments}` : ""}; ${frontDoor}.`);
  }
  if (answers.rooms && Object.keys(answers.rooms).length) {
    const roomSummary = Object.entries(answers.rooms)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => `${count} ${labelRoomKey(id)}`)
      .join(", ");
    lines.push(`Rooms: ${roomSummary}`);
  }

  const extras = [answers.extraNote, ...(answers.extras ?? [])].filter((value): value is string => !!value && value.trim().length > 0);
  if (extras.length) lines.push(`Additional requirements: ${extras.join("; ")}`);

  lines.push("Create a clean, high-quality, editable floor plan with strong zoning, efficient circulation, sensible room proportions, and clear public/private/service separation.");
  return lines.join("\n");
}

function getWizardTone(userType: UserType | null | undefined): { floors: string; area: string; shape: string; rooms: string; extras: string; review: string } {
  switch (userType) {
    case "architect_designer":
      return {
        floors: "How many floors does the project need?",
        area: "What target floor area should we design for?",
        shape: "What footprint shape should we start from?",
        rooms: "Which room program should the plan support?",
        extras: "Any circulation, privacy, or adjacency requirements?",
        review: "Does the brief look client-ready?",
      };
    case "real_estate_builder":
      return {
        floors: "How many floors should this home have?",
        area: "What floor area will make this marketable?",
        shape: "Which footprint will present best?",
        rooms: "Which rooms should be included for buyer appeal?",
        extras: "Any buildability or presentation requirements?",
        review: "Ready to generate a buyer-friendly layout?",
      };
    default:
      return {
        floors: "How many floors should this home have?",
        area: "How much floor space are we aiming for?",
        shape: "What shape do you have in mind for the plan?",
        rooms: "Which rooms should we include?",
        extras: "Any special requirements or priorities?",
        review: "Ready to generate your floor plan?",
      };
  }
}

function getPromptTone(userType: UserType | null | undefined): string {
  switch (userType) {
    case "architect_designer":
      return "Create a client-ready floor plan with clear zoning, strong circulation, and refined room proportions.";
    case "real_estate_builder":
      return "Create a marketable, buildable floor plan with clear room labels and easy presentation value.";
    default:
      return "Create a comfortable, practical floor plan with good flow, clear zoning, and clean room proportions.";
  }
}

function labelRoomKey(key: string): string {
  return key.replaceAll("_", " ");
}
