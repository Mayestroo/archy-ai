"use client";

import type { FloorPlanVersionRecord } from "@/app/actions";
import ChatSidebar from "@/components/editor/ChatSidebar";
import PropertiesSidebar from "@/components/editor/PropertiesSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { exportFloorPlanPDF, exportFloorPlanPNG, type FloorPlanExportQuality, type FloorPlanExportTemplate } from "@/lib/floorplan-export";
import type { EditableRoomType, ExteriorConceptStyle, FloorPlan, InteriorConceptStyle, Room } from "@/lib/floorplan-schema";
import { ensureFurniture, regenerateFurniture } from "@/lib/furniture";
import { applyExteriorConcept } from "@/lib/exterior-concepts";
import { applyInteriorConcept } from "@/lib/interior-concepts";
import { applyRoomMaterial, ensureMaterials, refreshMaterials, regenerateMaterials } from "@/lib/materials";
import { regenerateOpenings } from "@/lib/opening-regeneration";
import {
  DEFAULT_DOOR_WIDTH_METERS,
  DEFAULT_WINDOW_WIDTH_METERS,
  clampOpeningPositionForWidth,
  clampOpeningWidthForWall,
  getDoorHinge,
  getDoorSwing,
  getDoorWallOptions,
  getOpenings,
  getWindowWallOptions,
  isValidDoorWall,
  isValidWindowWall,
  openingFitsWall,
  type OpeningKind,
  type OpeningPatch,
  type OpeningSelection,
} from "@/lib/openings";
import {
  addRoomToFloorPlan,
  applyRoomGeometry,
  deleteRoomFromFloorPlan,
  type RoomGeometry,
} from "@/lib/room-geometry";
import { isUserType, type UserType } from "@/lib/user-types";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import OnboardingProgressOverlay from "@/components/editor/OnboardingProgressOverlay";
import ShapePickerModal from "@/components/editor/ShapePickerModal";
import RoomProgramModal from "@/components/editor/RoomProgramModal";
import StylePickerModal, { type StylePickerResult } from "@/components/editor/StylePickerModal";
import FinishPickerModal from "@/components/editor/FinishPickerModal";
import FurnitureBrowser from "@/components/editor/FurnitureBrowser";
import {
  type GenerationStage,
  type WizardAnswers,
  type WizardModal,
  type WizardPhase,
  type WizardStep,
  compileWizardPrompt,
  getNextWizardStep,
} from "@/lib/editor-onboarding";

const FloorPlanCanvas = dynamic(() => import("@/components/FloorPlanCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-transparent flex items-center justify-center text-muted-foreground">
      Loading canvas engine...
    </div>
  ),
});

const FloorPlan3D = dynamic(() => import("@/components/FloorPlan3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-transparent flex items-center justify-center text-muted-foreground">
      Initializing 3D engine...
    </div>
  ),
});

const supabase = createClient();
const HISTORY_LIMIT = 50;

type ExportFormat = "pdf" | "png";

interface EditorSnapshot {
  floorPlan: FloorPlan;
  selectedRoomId: string | null;
  selectedOpening: OpeningSelection | null;
}

interface EditFeedback {
  id: number;
  message: string;
  roomId?: string;
}

interface SavedPlanRow {
  prompt: string;
  floor_plan_json: FloorPlan;
  share_token?: string | null;
  share_enabled?: boolean | null;
}

export default function EditorPage() {
  const searchParams = useSearchParams();
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [prompt, setPrompt] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedOpening, setSelectedOpening] = useState<OpeningSelection | null>(null);
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const [editFeedback, setEditFeedback] = useState<EditFeedback | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportTemplate, setExportTemplate] = useState<FloorPlanExportTemplate>("presentation");
  const [exportQuality, setExportQuality] = useState<FloorPlanExportQuality>("standard");
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [versionRefreshKey, setVersionRefreshKey] = useState(0);
  const [wizardPhase, setWizardPhase] = useState<WizardPhase>("onboarding");
  const [wizardStep, setWizardStep] = useState<WizardStep>("floors");
  const [wizardAnswers, setWizardAnswers] = useState<WizardAnswers>({});
  const [activeEditorModal, setActiveEditorModal] = useState<WizardModal>(null);
  const [generationStage, setGenerationStage] = useState<GenerationStage | null>(null);
  const generateRef = useRef(handleGenerate);
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});
  const canUndoRef = useRef(false);
  const canRedoRef = useRef(false);
  const editFeedbackIdRef = useRef(0);

  useEffect(() => {
    generateRef.current = handleGenerate;
  });

  const planId = searchParams.get("planId");
  const initialPrompt = searchParams.get("prompt");
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      setUser(data.user);

      const metadataUserType = data.user.user_metadata?.user_type;
      if (isUserType(metadataUserType)) setUserType(metadataUserType);

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", data.user.id)
        .single();

      if (!cancelled && isUserType(profile?.user_type)) setUserType(profile.user_type);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load saved plan if planId is in URL
  useEffect(() => {
    if (!planId) return;

    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        setLoading(true);
        try {
          const { data } = await supabase
            .from("floor_plans")
            .select("*")
            .eq("id", planId)
            .single();

          if (cancelled) return;
          if (data) {
            const savedPlan = data as SavedPlanRow;
            const nextFloorPlan = ensureFurniture(ensureMaterials(savedPlan.floor_plan_json));
            setFloorPlan(nextFloorPlan);
            setSelectedRoomId(nextFloorPlan.rooms[0]?.id ?? null);
            setSelectedOpening(null);
            setUndoStack([]);
            setRedoStack([]);
            setEditFeedback(null);
            setSavedPlanId(planId);
            setShareToken(savedPlan.share_enabled ? savedPlan.share_token ?? null : null);
            setPrompt(savedPlan.prompt);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [planId]);

  useEffect(() => {
    if (!initialPrompt || floorPlan || loading || prompt) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setPrompt(initialPrompt);
      void generateRef.current(initialPrompt);
    });

    return () => {
      cancelled = true;
    };
  }, [initialPrompt, floorPlan, loading, prompt]);

  async function handleGenerate(newPrompt: string, wizardBrief?: WizardAnswers) {
    if (!newPrompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: newPrompt.trim(),
          currentFloorPlan: floorPlan,
          userType,
          wizardBrief,
        }),
      });

      const data = (await res.json()) as { floorPlan?: FloorPlan; error?: string };
      if (!res.ok) throw new Error(data.error || "Generation failed");
      if (!data.floorPlan) throw new Error("Generation failed");

      setFloorPlan(data.floorPlan);
      setSelectedRoomId(data.floorPlan.rooms[0]?.id ?? null);
      setSelectedOpening(null);
      setUndoStack([]);
      setRedoStack([]);
      setEditFeedback(null);
      setSavedPlanId(null);
      setShareToken(null);
      setVersionRefreshKey(0);
      setPrompt(newPrompt);
      setWizardPhase("refining");
      // Auto-switch to 2D view on new generation to show changes clearly
      setViewMode("2d");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setWizardPhase("onboarding");
    } finally {
      setGenerationStage(null);
      setLoading(false);
    }
  }

  async function handleExport(format: ExportFormat) {
    if (!floorPlan || exporting) return;

    setExporting(format);
    setError(null);

    try {
      const metadata = { title: prompt.trim() || "Archy AI Floor Plan", template: exportTemplate, quality: exportQuality };
      if (format === "pdf") {
        await exportFloorPlanPDF(floorPlan, metadata);
      } else {
        exportFloorPlanPNG(floorPlan, metadata);
      }
    } catch (err: unknown) {
      setError(`Export failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    undoRef.current = handleUndo;
    redoRef.current = handleRedo;
    canUndoRef.current = canUndo;
    canRedoRef.current = canRedo;
  });

  useEffect(() => {
    if (!editFeedback) return;
    const timer = window.setTimeout(() => setEditFeedback(null), 3200);
    return () => window.clearTimeout(timer);
  }, [editFeedback]);

  useEffect(() => {
    if (!loading) return;
    const t0 = setTimeout(() => setGenerationStage("drawing_plan_outline"), 0);
    const t1 = setTimeout(() => setGenerationStage("optimizing_flow"), 2000);
    const t2 = setTimeout(() => setGenerationStage("placing_furniture"), 5000);
    const t3 = setTimeout(() => setGenerationStage("finalizing_layout"), 8000);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [loading]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (eventStartedInEditableElement(event.target)) return;

      const key = event.key.toLowerCase();
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const isUndo = isModifierPressed && !event.shiftKey && key === "z";
      const isRedo = isModifierPressed && (key === "y" || (event.shiftKey && key === "z"));

      if (isUndo && canUndoRef.current) {
        event.preventDefault();
        undoRef.current();
      }

      if (isRedo && canRedoRef.current) {
        event.preventDefault();
        redoRef.current();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function createSnapshot(): EditorSnapshot | null {
    if (!floorPlan) return null;
    return { floorPlan, selectedRoomId, selectedOpening };
  }

  function pushHistory(stack: EditorSnapshot[], snapshot: EditorSnapshot): EditorSnapshot[] {
    return [...stack.slice(-(HISTORY_LIMIT - 1)), snapshot];
  }

  function applySnapshot(snapshot: EditorSnapshot) {
    setFloorPlan(snapshot.floorPlan);
    setSelectedRoomId(snapshot.selectedRoomId);
    setSelectedOpening(snapshot.selectedOpening);
    setEditFeedback(null);
    setViewMode("2d");
  }

  function showEditFeedback(message: string, roomId?: string) {
    editFeedbackIdRef.current += 1;
    setEditFeedback({ id: editFeedbackIdRef.current, message, roomId });
  }

  function commitFloorPlan(
    nextFloorPlan: FloorPlan,
    nextSelection: Pick<EditorSnapshot, "selectedRoomId" | "selectedOpening"> = { selectedRoomId, selectedOpening },
  ): boolean {
    const snapshot = createSnapshot();
    if (!snapshot) return false;

    setUndoStack((stack) => pushHistory(stack, snapshot));
    setRedoStack([]);
    setFloorPlan(nextFloorPlan);
    setSelectedRoomId(nextSelection.selectedRoomId);
    setSelectedOpening(nextSelection.selectedOpening);
    setEditFeedback(null);
    return true;
  }

  function handleUndo() {
    const current = createSnapshot();
    if (!current || !canUndo) return;

    const previous = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => pushHistory(stack, current));
    applySnapshot(previous);
  }

  function handleRedo() {
    const current = createSnapshot();
    if (!current || !canRedo) return;

    const next = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => pushHistory(stack, current));
    applySnapshot(next);
  }

  function handleUpdateRoom(roomId: string, patch: Partial<Pick<Room, "label" | "type">>) {
    if (!floorPlan) return;

    const nextFloorPlan = {
      ...floorPlan,
      rooms: floorPlan.rooms.map((room) => (
        room.id === roomId ? { ...room, ...patch } : room
      )),
    };

    commitFloorPlan(patch.type ? regenerateFurniture(refreshMaterials(nextFloorPlan)) : nextFloorPlan);
  }

  function handleUpdateRoomMaterial(roomId: string, palette: string) {
    if (!floorPlan) return;
    commitFloorPlan(applyRoomMaterial(floorPlan, roomId, palette), { selectedRoomId: roomId, selectedOpening: null });
    setViewMode("2d");
  }

  function handleCreateInteriorConcept(roomId: string, style: InteriorConceptStyle) {
    if (!floorPlan) return false;
    const nextFloorPlan = applyInteriorConcept(floorPlan, roomId, style);
    const committed = commitFloorPlan(nextFloorPlan, { selectedRoomId: roomId, selectedOpening: null });
    if (committed) setViewMode("2d");
    return committed;
  }

  function handleCreateExteriorConcept(style: ExteriorConceptStyle) {
    if (!floorPlan) return false;
    const committed = commitFloorPlan(applyExteriorConcept(floorPlan, style), { selectedRoomId, selectedOpening: null });
    if (committed) setViewMode("2d");
    return committed;
  }

  function handleUpdateRoomGeometry(roomId: string, geometry: RoomGeometry): boolean {
    if (!floorPlan) return false;

    const nextFloorPlan = applyRoomGeometry(floorPlan, roomId, geometry);
    if (!nextFloorPlan) {
      showEditFeedback("Room edit blocked: rooms cannot overlap. Try a nearby open grid space.", roomId);
      return false;
    }

    return commitFloorPlan(regenerateFurniture(refreshMaterials(nextFloorPlan)), { selectedRoomId: roomId, selectedOpening: null });
  }

  function handleRoomGeometryFeedback(roomId: string, message: string) {
    showEditFeedback(message, roomId);
  }

  function handleAddRoom(roomType: EditableRoomType): boolean {
    if (!floorPlan) return false;

    const result = addRoomToFloorPlan(floorPlan, roomType, selectedRoomId);
    if (!result) {
      showEditFeedback("Room not added: no open snapped space was found. Move nearby rooms first.", selectedRoomId ?? undefined);
      return false;
    }

    commitFloorPlan(regenerateFurniture(refreshMaterials(result.floorPlan)), { selectedRoomId: result.roomId, selectedOpening: null });
    setViewMode("2d");
    return true;
  }

  function handleDeleteRoom(roomId: string): boolean {
    if (!floorPlan) return false;

    const result = deleteRoomFromFloorPlan(floorPlan, roomId);
    if (!result) {
      showEditFeedback("Room not deleted: a floor plan must keep at least one room.", roomId);
      return false;
    }

    commitFloorPlan(regenerateFurniture(refreshMaterials(result.floorPlan)), { selectedRoomId: result.selectedRoomId, selectedOpening: null });
    setViewMode("2d");
    return true;
  }

  function handleSelectRoom(roomId: string) {
    setSelectedRoomId(roomId);
    setSelectedOpening(null);
  }

  function handleSelectOpening(selection: OpeningSelection) {
    if (!floorPlan) return;
    const opening = getOpenings(floorPlan, selection.kind)[selection.index];
    if (!opening) return;

    setSelectedRoomId(opening.roomId);
    setSelectedOpening(selection);
  }

  function handleAddOpening(kind: OpeningKind, roomId: string) {
    if (!floorPlan) return;

    const room = floorPlan.rooms.find((candidate) => candidate.id === roomId);
    if (!room) return;

    const wall = kind === "door"
      ? getDoorWallOptions(room, floorPlan.rooms)[0]
      : getWindowWallOptions(room, floorPlan.rooms)[0];

    if (!wall) {
      showEditFeedback(kind === "window"
        ? "Window not added: this room has no exterior wall available."
        : "Door not added: this room has no valid shared or exterior wall.", roomId);
      return;
    }

    const widthMeters = clampOpeningWidthForWall(
      kind === "door" ? DEFAULT_DOOR_WIDTH_METERS : DEFAULT_WINDOW_WIDTH_METERS,
      kind,
      room,
      wall,
    );

    if (!openingFitsWall(room, wall, widthMeters)) {
      showEditFeedback(`${kind === "door" ? "Door" : "Window"} not added: the opening is too wide for that wall.`, roomId);
      return;
    }

    const index = kind === "door" ? (floorPlan.doors ?? []).length : (floorPlan.windows ?? []).length;

    commitFloorPlan(
      kind === "door"
        ? {
          ...floorPlan,
          doors: [
            ...(floorPlan.doors ?? []),
            {
              roomId,
              wall,
              position: clampOpeningPositionForWidth(0.5, room, wall, widthMeters),
              widthMeters,
              hinge: "left",
              swing: "inward",
            },
          ],
        }
        : {
          ...floorPlan,
          windows: [
            ...(floorPlan.windows ?? []),
            { roomId, wall, position: clampOpeningPositionForWidth(0.5, room, wall, widthMeters), widthMeters },
          ],
        },
      { selectedRoomId: roomId, selectedOpening: { kind, index } },
    );
    setViewMode("2d");
  }

  function handleUpdateOpening(selection: OpeningSelection, patch: OpeningPatch) {
    if (!floorPlan) return;

    if (selection.kind === "door") {
      const doors = floorPlan.doors ?? [];
      const door = doors[selection.index];
      const room = door && floorPlan.rooms.find((candidate) => candidate.id === door.roomId);
      if (!door || !room) return;

      const wall = patch.wall ?? door.wall;
      const widthMeters = clampOpeningWidthForWall(patch.widthMeters ?? door.widthMeters, "door", room, wall);
      const nextDoor = {
        ...door,
        wall,
        widthMeters,
        position: clampOpeningPositionForWidth(patch.position ?? door.position, room, wall, widthMeters),
        hinge: patch.hinge ?? getDoorHinge(door),
        swing: patch.swing ?? getDoorSwing(door),
      };

      if (!isValidDoorWall(room, floorPlan.rooms, nextDoor.wall)) {
        showEditFeedback("Door edit blocked: doors must use a shared wall or an exterior wall.", room.id);
        return;
      }

      if (!openingFitsWall(room, nextDoor.wall, nextDoor.widthMeters)) {
        showEditFeedback("Door edit blocked: the opening is too wide for that wall.", room.id);
        return;
      }

      commitFloorPlan({
        ...floorPlan,
        doors: doors.map((item, index) => (index === selection.index ? nextDoor : item)),
      }, { selectedRoomId, selectedOpening: selection });
      return;
    }

    const windows = floorPlan.windows ?? [];
    const window = windows[selection.index];
    const room = window && floorPlan.rooms.find((candidate) => candidate.id === window.roomId);
    if (!window || !room) return;

    const wall = patch.wall ?? window.wall;
    const widthMeters = clampOpeningWidthForWall(patch.widthMeters ?? window.widthMeters, "window", room, wall);
    const nextWindow = {
      ...window,
      wall,
      widthMeters,
      position: clampOpeningPositionForWidth(patch.position ?? window.position, room, wall, widthMeters),
    };

    if (!isValidWindowWall(room, floorPlan.rooms, nextWindow.wall)) {
      showEditFeedback("Window edit blocked: windows must stay on exterior walls.", room.id);
      return;
    }

    if (!openingFitsWall(room, nextWindow.wall, nextWindow.widthMeters)) {
      showEditFeedback("Window edit blocked: the opening is too wide for that wall.", room.id);
      return;
    }

    commitFloorPlan({
      ...floorPlan,
      windows: windows.map((item, index) => (index === selection.index ? nextWindow : item)),
    }, { selectedRoomId, selectedOpening: selection });
  }

  function handleRemoveOpening(selection: OpeningSelection) {
    if (!floorPlan) return;

    commitFloorPlan(
      selection.kind === "door"
        ? { ...floorPlan, doors: (floorPlan.doors ?? []).filter((_, index) => index !== selection.index) }
        : { ...floorPlan, windows: (floorPlan.windows ?? []).filter((_, index) => index !== selection.index) },
      { selectedRoomId, selectedOpening: null },
    );
  }

  function handleRegenerateOpenings(): boolean {
    if (!floorPlan) return false;

    const nextFloorPlan = regenerateOpenings(floorPlan);
    commitFloorPlan(nextFloorPlan, { selectedRoomId, selectedOpening: null });
    setViewMode("2d");
    return true;
  }

  function handleRegenerateFurniture(): boolean {
    if (!floorPlan) return false;

    commitFloorPlan(regenerateFurniture(floorPlan), { selectedRoomId, selectedOpening: null });
    setViewMode("2d");
    return true;
  }

  function handleRegenerateMaterials(): boolean {
    if (!floorPlan) return false;

    commitFloorPlan(regenerateMaterials(floorPlan), { selectedRoomId, selectedOpening: null });
    setViewMode("2d");
    return true;
  }

  function handlePlanSaved(planId: string) {
    setSavedPlanId(planId);
    setVersionRefreshKey((key) => key + 1);
  }

  function handleRestoreVersion(version: FloorPlanVersionRecord) {
    const nextFloorPlan = ensureFurniture(ensureMaterials(version.floor_plan_json));
    setFloorPlan(nextFloorPlan);
    setPrompt(version.prompt);
    setSelectedRoomId(nextFloorPlan.rooms[0]?.id ?? null);
    setSelectedOpening(null);
    setUndoStack([]);
    setRedoStack([]);
    setEditFeedback(null);
    setViewMode("2d");
  }

  function handleWizardAnswer(step: WizardStep, value: Partial<WizardAnswers>) {
    const next = getNextWizardStep(step);
    setWizardAnswers((prev) => ({ ...prev, ...value }));
    if (next) setWizardStep(next);
  }

  function handleWizardNext() {
    const next = getNextWizardStep(wizardStep);
    if (next) setWizardStep(next);
  }

  function handleShapeSelected(answer: import("@/lib/editor-onboarding").ShapeAnswer) {
    setWizardAnswers((prev) => ({ ...prev, shape: answer }));
    setWizardStep("rooms");
    setActiveEditorModal(null);
  }

  function handleRoomsSelected(rooms: Record<string, number>) {
    setWizardAnswers((prev) => ({ ...prev, rooms }));
    setWizardStep("extras");
    setActiveEditorModal(null);
  }

  function handleWizardGenerate() {
    const compiled = compileWizardPrompt(wizardAnswers, userType);
    setWizardPhase("generating");
    void handleGenerate(compiled, wizardAnswers);
  }

  function handleStartNewPlan() {
    setWizardPhase("onboarding");
    setWizardStep("floors");
    setWizardAnswers({});
    setActiveEditorModal(null);
    setFloorPlan(null);
    setSelectedRoomId(null);
    setSelectedOpening(null);
    setUndoStack([]);
    setRedoStack([]);
    setPrompt("");
    setSavedPlanId(null);
    setShareToken(null);
    setVersionRefreshKey(0);
    setEditFeedback(null);
  }

  function handleStyleSelected(result: StylePickerResult) {
    if (result.scope === "interior" && selectedRoomId) {
      handleCreateInteriorConcept(selectedRoomId, result.style as InteriorConceptStyle);
    } else if (result.scope === "exterior") {
      handleCreateExteriorConcept(result.style as ExteriorConceptStyle);
    }
    setActiveEditorModal(null);
  }

  function handleFinishSelected(palette: string) {
    if (selectedRoomId) {
      handleUpdateRoomMaterial(selectedRoomId, palette);
    }
    setActiveEditorModal(null);
  }

  function handleFurnitureRoomSelected(roomType: EditableRoomType) {
    handleAddRoom(roomType);
    setActiveEditorModal(null);
  }

  return (
    <main className="flex flex-col md:flex-row w-full h-dvh overflow-hidden bg-background">

      {/* Left Sidebar: Chat/Wizard */}
      <ChatSidebar
        onGenerate={handleGenerate}
        loading={loading}
        error={error}
        currentPrompt={prompt}
        hasFloorPlan={!!floorPlan}
        generationNotes={floorPlan?.generationNotes}
        userType={userType}
        wizardPhase={wizardPhase}
        wizardStep={wizardStep}
        wizardAnswers={wizardAnswers}
        onWizardAnswer={handleWizardAnswer}
        onWizardNext={handleWizardNext}
        onOpenModal={setActiveEditorModal}
        onWizardGenerate={handleWizardGenerate}
        onStartNewPlan={handleStartNewPlan}
      />

      {/* Center Canvas Area */}
      <div className="flex-1 relative flex flex-col" style={{ backgroundColor: "var(--background)" }}>
        {/* Canvas Header */}
        <div className="h-[60px] flex items-center justify-end px-4 border-b border-border shrink-0 bg-background z-10 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <div className="flex items-center rounded-full border border-border bg-card shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl/Cmd+Z)"
                className="h-8 px-3 text-[12px] font-semibold text-foreground hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)"
                className="h-8 px-3 text-[12px] font-semibold text-foreground hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent transition-colors border-l border-border"
              >
                Redo
              </button>
            </div>
            <div className="flex items-center rounded-full border border-border bg-card shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => void handleExport("pdf")}
                disabled={!floorPlan || !!exporting}
                className="h-8 px-3.5 text-[12px] font-semibold text-foreground hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                {exporting === "pdf" ? "Exporting..." : "Export PDF"}
              </button>
              <button
                type="button"
                onClick={() => void handleExport("png")}
                disabled={!floorPlan || !!exporting}
                className="h-8 px-3 text-[12px] font-semibold text-foreground hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent transition-colors border-l border-border"
              >
                {exporting === "png" ? "Exporting..." : "PNG"}
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground text-[13px] font-medium mr-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01" /></svg>
              20 credits
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* View Toggle Bar */}
        <div className="absolute top-[76px] left-1/2 -translate-x-1/2 z-10 flex bg-card border border-border rounded-full p-1 shadow-sm">
          <button
            onClick={() => setViewMode("2d")}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${viewMode === "2d" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            Layout
          </button>
          <button
            onClick={() => setViewMode("3d")}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${viewMode === "3d" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            Visualize
          </button>
        </div>

        {editFeedback && (
          <div
            key={editFeedback.id}
            role="status"
            className="absolute top-[124px] left-1/2 -translate-x-1/2 z-20 w-[min(520px,calc(100%-2rem))] rounded-2xl border border-amber-500/35 bg-background/95 px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.16)] backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="M12 9v4" strokeLinecap="round" />
                  <path d="M12 17h.01" strokeLinecap="round" />
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">
                  Constraint check
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {editFeedback.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {(!floorPlan || loading) && (
          <OnboardingProgressOverlay
            wizardPhase={wizardPhase}
            wizardStep={wizardStep}
            userType={userType}
            generationStage={generationStage}
          />
        )}

        <div className="flex-1 w-full h-full">
          {floorPlan ? (
            viewMode === "2d" ? (
              <FloorPlanCanvas
                floorPlan={floorPlan}
                selectedRoomId={selectedRoomId}
                selectedOpening={selectedOpening}
                onSelectRoom={handleSelectRoom}
                onSelectOpening={handleSelectOpening}
                onUpdateRoomGeometry={handleUpdateRoomGeometry}
                geometryFeedback={editFeedback?.roomId ? { id: editFeedback.id, roomId: editFeedback.roomId } : null}
                onRoomGeometryFeedback={handleRoomGeometryFeedback}
              />
            ) : (
              <FloorPlan3D floorPlan={floorPlan} />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center max-w-sm">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <p className="text-sm">Describe your floor plan in the chat on the left to get started.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Properties & Renders */}
      <PropertiesSidebar
        floorPlan={floorPlan}
        user={user}
        currentPrompt={prompt}
        selectedRoomId={selectedRoomId}
        selectedOpening={selectedOpening}
        onSelectRoom={handleSelectRoom}
        onSelectOpening={handleSelectOpening}
        onUpdateRoom={handleUpdateRoom}
        onUpdateRoomMaterial={handleUpdateRoomMaterial}
        onCreateInteriorConcept={handleCreateInteriorConcept}
        onCreateExteriorConcept={handleCreateExteriorConcept}
        onAddRoom={handleAddRoom}
        onDeleteRoom={handleDeleteRoom}
        onAddOpening={handleAddOpening}
        onUpdateOpening={handleUpdateOpening}
        onRemoveOpening={handleRemoveOpening}
        onRegenerateOpenings={handleRegenerateOpenings}
        onRegenerateFurniture={handleRegenerateFurniture}
        onRegenerateMaterials={handleRegenerateMaterials}
        onExportPDF={() => void handleExport("pdf")}
        onExportPNG={() => void handleExport("png")}
        exporting={exporting}
        exportTemplate={exportTemplate}
        onExportTemplateChange={setExportTemplate}
        exportQuality={exportQuality}
        onExportQualityChange={setExportQuality}
        savedPlanId={savedPlanId}
        shareToken={shareToken}
        versionRefreshKey={versionRefreshKey}
        onPlanSaved={handlePlanSaved}
        onShareTokenChange={setShareToken}
        onRestoreVersion={handleRestoreVersion}
      />

      {activeEditorModal === "shape" && (
        <ShapePickerModal
          onConfirm={handleShapeSelected}
          onCancel={() => setActiveEditorModal(null)}
        />
      )}
      {activeEditorModal === "rooms" && (
        <RoomProgramModal
          onConfirm={handleRoomsSelected}
          onCancel={() => setActiveEditorModal(null)}
        />
      )}
      {activeEditorModal === "style" && (
        <StylePickerModal
          defaultScope={selectedRoomId ? "interior" : "exterior"}
          onConfirm={handleStyleSelected}
          onCancel={() => setActiveEditorModal(null)}
        />
      )}
      {activeEditorModal === "finish" && (
        <FinishPickerModal
          selectedPalette={undefined}
          onConfirm={handleFinishSelected}
          onCancel={() => setActiveEditorModal(null)}
        />
      )}
      {activeEditorModal === "furniture" && (
        <FurnitureBrowser
          onConfirm={handleFurnitureRoomSelected}
          onCancel={() => setActiveEditorModal(null)}
        />
      )}

    </main>
  );
}

function eventStartedInEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
