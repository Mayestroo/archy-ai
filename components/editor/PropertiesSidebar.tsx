"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFloorPlan, type FloorPlanVersionRecord } from "@/app/actions";
import PlanVersionHistory from "@/components/editor/PlanVersionHistory";
import SharePlanControls from "@/components/SharePlanControls";
import { EXTERIOR_CONCEPT_STYLE_OPTIONS } from "@/lib/exterior-concepts";
import { FLOOR_PLAN_EXPORT_QUALITIES, FLOOR_PLAN_EXPORT_TEMPLATES, type FloorPlanExportQuality, type FloorPlanExportTemplate } from "@/lib/floorplan-export";
import { ROOM_TYPE_OPTIONS, type Door, type EditableRoomType, type ExteriorConceptBrief, type ExteriorConceptStyle, type FloorPlan, type InteriorConceptBrief, type InteriorConceptStyle, type Room, type RoomMaterial, type WallSide } from "@/lib/floorplan-schema";
import { MATERIAL_PALETTE_OPTIONS, getRoomMaterial } from "@/lib/materials";
import { INTERIOR_CONCEPT_STYLE_OPTIONS, getRoomInteriorConcept } from "@/lib/interior-concepts";
import {
  DOOR_HINGES,
  DOOR_SWINGS,
  MAX_OPENING_WIDTH_METERS,
  MIN_OPENING_WIDTH_METERS,
  OPENING_POSITION_STEP,
  OPENING_WIDTH_STEP_METERS,
  clampOpeningPositionForWidth,
  clampOpeningWidthForWall,
  getDoorHinge,
  getDoorSwing,
  getDoorWallOptions,
  getOpenings,
  getOpeningWidthMeters,
  getWallLengthMeters,
  getWindowWallOptions,
  isDoorHinge,
  isDoorSwing,
  isWallSide,
  type Opening,
  type OpeningKind,
  type OpeningPatch,
  type OpeningSelection,
} from "@/lib/openings";
import { MIN_ROOM_SIZE, ROOM_GRID_SIZE } from "@/lib/room-geometry";
import RenderScenePanel from "@/components/editor/RenderScenePanel";
import type { User } from "@supabase/supabase-js";

interface FloorPlanWithPrompt extends FloorPlan {
  __prompt?: string;
}

interface PropertiesSidebarProps {
  floorPlan: FloorPlan | null;
  user: User | null;
  currentPrompt?: string;
  selectedRoomId?: string | null;
  selectedOpening?: OpeningSelection | null;
  onSelectRoom?: (roomId: string) => void;
  onSelectOpening?: (selection: OpeningSelection) => void;
  onUpdateRoom?: (roomId: string, patch: Partial<Pick<Room, "label" | "type">>) => void;
  onUpdateRoomMaterial?: (roomId: string, palette: string) => void;
  onCreateInteriorConcept?: (roomId: string, style: InteriorConceptStyle) => boolean;
  onCreateExteriorConcept?: (style: ExteriorConceptStyle) => boolean;
  onAddRoom?: (roomType: EditableRoomType) => boolean;
  onDeleteRoom?: (roomId: string) => boolean;
  onAddOpening?: (kind: OpeningKind, roomId: string) => void;
  onUpdateOpening?: (selection: OpeningSelection, patch: OpeningPatch) => void;
  onRemoveOpening?: (selection: OpeningSelection) => void;
  onRegenerateOpenings?: () => boolean;
  onRegenerateFurniture?: () => boolean;
  onRegenerateMaterials?: () => boolean;
  onExportPDF?: () => void;
  onExportPNG?: () => void;
  exporting?: "pdf" | "png" | null;
  exportTemplate?: FloorPlanExportTemplate;
  onExportTemplateChange?: (template: FloorPlanExportTemplate) => void;
  exportQuality?: FloorPlanExportQuality;
  onExportQualityChange?: (quality: FloorPlanExportQuality) => void;
  savedPlanId?: string | null;
  shareToken?: string | null;
  versionRefreshKey?: number;
  onPlanSaved?: (planId: string) => void;
  onShareTokenChange?: (token: string | null) => void;
  onRestoreVersion?: (version: FloorPlanVersionRecord) => void;
  onOpenModal?: (modal: import("@/lib/editor-onboarding").WizardModal) => void;
}

interface SelectedOpeningDetails {
  kind: OpeningKind;
  index: number;
  opening: Opening;
  room: Room;
}

const WALL_LABELS: Record<WallSide, string> = {
  top: "Top",
  bottom: "Bottom",
  left: "Left",
  right: "Right",
};

export default function PropertiesSidebar({
  floorPlan,
  user,
  currentPrompt,
  selectedRoomId,
  selectedOpening,
  onSelectRoom,
  onSelectOpening,
  onUpdateRoom,
  onUpdateRoomMaterial,
  onCreateInteriorConcept,
  onCreateExteriorConcept,
  onAddRoom,
  onDeleteRoom,
  onAddOpening,
  onUpdateOpening,
  onRemoveOpening,
  onRegenerateOpenings,
  onRegenerateFurniture,
  onRegenerateMaterials,
  onExportPDF,
  onExportPNG,
  exporting = null,
  exportTemplate = "presentation",
  onExportTemplateChange,
  exportQuality = "standard",
  onExportQualityChange,
  savedPlanId,
  shareToken,
  versionRefreshKey,
  onPlanSaved,
  onShareTokenChange,
  onRestoreVersion,
  onOpenModal,
}: PropertiesSidebarProps) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [newRoomType, setNewRoomType] = useState<EditableRoomType>("bedroom");
  const [conceptStyle, setConceptStyle] = useState<InteriorConceptStyle>("warm_minimal");
  const [exteriorConceptStyle, setExteriorConceptStyle] = useState<ExteriorConceptStyle>("warm_contemporary");
  const [conceptStatus, setConceptStatus] = useState<"idle" | "done">("idle");
  const [exteriorConceptStatus, setExteriorConceptStatus] = useState<"idle" | "done">("idle");
  const [openingRegenStatus, setOpeningRegenStatus] = useState<"idle" | "done">("idle");
  const [furnitureRegenStatus, setFurnitureRegenStatus] = useState<"idle" | "done">("idle");
  const [materialRegenStatus, setMaterialRegenStatus] = useState<"idle" | "done">("idle");
  const [isPending, startTransition] = useTransition();

  const rooms = floorPlan?.rooms ?? [];
  const totalArea = floorPlan?.totalArea ?? 0;
  const bedrooms = rooms.filter((r) => r.type === "bedroom" || r.type === "master_bedroom").length;
  const bathrooms = rooms.filter((r) => r.type === "bathroom" || r.type === "ensuite").length;
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedOpeningDetails = floorPlan && selectedOpening
    ? getSelectedOpeningDetails(floorPlan, selectedOpening)
    : null;

  function handleAddRoom() {
    onAddRoom?.(newRoomType);
  }

  function handleDeleteRoom(roomId: string) {
    onDeleteRoom?.(roomId);
  }

  function handleRegenerateOpenings() {
    const regenerated = onRegenerateOpenings?.() ?? false;
    if (!regenerated) return;
    setOpeningRegenStatus("done");
    setTimeout(() => setOpeningRegenStatus("idle"), 2500);
  }

  function handleCreateInteriorConcept(roomId: string) {
    const created = onCreateInteriorConcept?.(roomId, conceptStyle) ?? false;
    if (!created) return;
    setConceptStatus("done");
    setTimeout(() => setConceptStatus("idle"), 2500);
  }

  function handleCreateExteriorConcept() {
    const created = onCreateExteriorConcept?.(exteriorConceptStyle) ?? false;
    if (!created) return;
    setExteriorConceptStatus("done");
    setTimeout(() => setExteriorConceptStatus("idle"), 2500);
  }

  function handleRegenerateFurniture() {
    const regenerated = onRegenerateFurniture?.() ?? false;
    if (!regenerated) return;
    setFurnitureRegenStatus("done");
    setTimeout(() => setFurnitureRegenStatus("idle"), 2500);
  }

  function handleRegenerateMaterials() {
    const regenerated = onRegenerateMaterials?.() ?? false;
    if (!regenerated) return;
    setMaterialRegenStatus("done");
    setTimeout(() => setMaterialRegenStatus("idle"), 2500);
  }

  function handleSave() {
    if (!floorPlan) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setSaveStatus("saving");
    setError(null);
    startTransition(async () => {
      try {
        const promptText = currentPrompt?.trim() || (floorPlan as FloorPlanWithPrompt).__prompt || "Untitled plan";
        const planId = await saveFloorPlan(promptText, promptText, floorPlan, savedPlanId);
        onPlanSaved?.(planId);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch (err: unknown) {
        setSaveStatus("error");
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <aside className="hidden md:flex w-[320px] shrink-0 border-l border-border bg-background flex-col h-full">
      {/* Header */}
      <div className="h-[60px] px-4 border-b border-border flex items-center justify-between shrink-0">
        <p className="text-sm font-bold text-foreground">Properties</p>
        {user && (
          <Link
            href="/profile"
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {user.email?.split("@")[0] ?? "Account"}
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {!floorPlan ? (
          <div className="text-center pt-12">
            <p className="text-sm text-muted-foreground">
              Generate a floor plan to see its properties here.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Overview
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Total" value={`${totalArea}`} unit="m²" />
                <Stat label="Beds" value={`${bedrooms}`} />
                <Stat label="Baths" value={`${bathrooms}`} />
              </div>
            </div>

            {/* Selected room editor */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Edit room
              </p>
              {selectedRoom ? (
                <div className="space-y-3">
                  <RoomEditor
                    room={selectedRoom}
                    canDeleteRoom={rooms.length > 1}
                    onUpdateRoom={onUpdateRoom}
                    onDeleteRoom={onDeleteRoom ? handleDeleteRoom : undefined}
                  />
                  <OpeningManager
                    floorPlan={floorPlan}
                    room={selectedRoom}
                    selectedOpening={selectedOpening}
                    selectedOpeningDetails={selectedOpeningDetails}
                    onAddOpening={onAddOpening}
                    onSelectOpening={onSelectOpening}
                    onUpdateOpening={onUpdateOpening}
                    onRemoveOpening={onRemoveOpening}
                  />
                  <InteriorConceptPanel
                    room={selectedRoom}
                    concept={getRoomInteriorConcept(floorPlan, selectedRoom.id)}
                    conceptStyle={conceptStyle}
                    conceptStatus={conceptStatus}
                    onConceptStyleChange={setConceptStyle}
                    onCreateInteriorConcept={onCreateInteriorConcept ? handleCreateInteriorConcept : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => onOpenModal?.("style")}
                    disabled={!onOpenModal}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
                  >
                    Open style picker
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-3 py-4 text-center">
                  <p className="text-xs font-semibold text-foreground">Select a room</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Click a room on the canvas or choose one below.
                  </p>
                </div>
              )}
            </div>

            {/* Rooms */}
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Rooms ({rooms.length})
              </p>
              <div className="rounded-xl border border-border bg-secondary/20 p-3 mb-2 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={newRoomType}
                    onChange={(event) => setNewRoomType(event.target.value as EditableRoomType)}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold text-foreground outline-none focus:border-[#5D5DFF]"
                    aria-label="New room type"
                  >
                    {ROOM_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddRoom}
                    disabled={!onAddRoom}
                    className="px-3 py-2 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Adds the room near {selectedRoom ? selectedRoom.label : "the plan"} in the nearest non-overlapping grid slot.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                {rooms.map((room) => {
                  const m2 = Math.round((room.width * room.height) / 2500);
                  const selected = room.id === selectedRoomId;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => onSelectRoom?.(room.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                        selected
                          ? "bg-[#5D5DFF]/10 border-[#5D5DFF]/60"
                          : "bg-secondary/40 border-border hover:bg-secondary"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${selected ? "text-[#5D5DFF]" : "text-foreground"}`}>
                          {room.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {room.type.replace(/_/g, " ")}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-muted-foreground shrink-0 ml-2">
                        {m2} m²
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Doors / Windows count */}
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Doors" value={`${floorPlan.doors?.length ?? 0}`} />
              <Stat label="Windows" value={`${floorPlan.windows?.length ?? 0}`} />
            </div>

            <ExteriorConceptPanel
              concept={floorPlan.exteriorConcept ?? null}
              conceptStyle={exteriorConceptStyle}
              conceptStatus={exteriorConceptStatus}
              onConceptStyleChange={setExteriorConceptStyle}
              onCreateExteriorConcept={onCreateExteriorConcept ? handleCreateExteriorConcept : undefined}
            />
            <button
              type="button"
              onClick={() => onOpenModal?.("style")}
              disabled={!onOpenModal}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
            >
              Open facade style picker
            </button>

            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Furniture suggestions
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Rebuild room furniture from current room geometry and room types.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-background px-2 py-1 text-[10px] font-bold text-muted-foreground">
                  {floorPlan.furniture?.length ?? 0}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenModal?.("furniture")}
                disabled={!onOpenModal}
                className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
              >
                Browse furniture
              </button>
              <button
                type="button"
                onClick={handleRegenerateFurniture}
                disabled={!onRegenerateFurniture}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
              >
                Regenerate furniture
              </button>
              {furnitureRegenStatus === "done" && (
                <p className="mt-2 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
                  Furniture regenerated. Undo is available from the header.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Material presets
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Rebuild room finish palettes from current room types.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-background px-2 py-1 text-[10px] font-bold text-muted-foreground">
                  {floorPlan.materials?.length ?? 0}
                </span>
              </div>
              {selectedRoom && (
                <MaterialEditor
                  room={selectedRoom}
                  material={getRoomMaterial(floorPlan, selectedRoom.id)}
                  onUpdateRoomMaterial={onUpdateRoomMaterial}
                />
              )}
              <button
                type="button"
                onClick={() => onOpenModal?.("finish")}
                disabled={!onOpenModal}
                className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
              >
                Open finish picker
              </button>
              <button
                type="button"
                onClick={handleRegenerateMaterials}
                disabled={!onRegenerateMaterials}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
              >
                Regenerate materials
              </button>
              {materialRegenStatus === "done" && (
                <p className="mt-2 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
                  Materials regenerated. Undo is available from the header.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Opening suggestions
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Rebuild doors/windows from current room geometry while keeping valid manual openings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRegenerateOpenings}
                disabled={!onRegenerateOpenings}
                className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
              >
                Regenerate openings
              </button>
              {openingRegenStatus === "done" && (
                <p className="mt-2 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
                  Openings regenerated. Undo is available from the header.
                </p>
              )}
            </div>

            <PlanVersionHistory
              key={`${savedPlanId ?? "unsaved"}:${versionRefreshKey ?? 0}`}
              planId={savedPlanId}
              refreshKey={versionRefreshKey}
              onRestoreVersion={onRestoreVersion}
            />

            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Render
              </p>
              <RenderScenePanel />
            </div>
          </>
        )}

        {error && (
          <div className="px-3 py-2.5 bg-red-950/30 border border-red-900/30 text-red-400 text-xs rounded-xl">
            {error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border shrink-0 bg-card flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={!floorPlan || saveStatus === "saving" || isPending}
          className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
            saveStatus === "saved"
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
              : "bg-foreground text-background hover:opacity-90 disabled:opacity-40"
          }`}
        >
          {saveStatus === "saving" || isPending
            ? "Saving..."
            : saveStatus === "saved"
            ? "✓ Saved"
            : !user
            ? "Sign in to save"
            : "Save plan"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 rounded-xl border border-border bg-background p-3">
            <label htmlFor="export-template" className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Export template
            </label>
            <select
              id="export-template"
              value={exportTemplate}
              onChange={(event) => onExportTemplateChange?.(event.target.value as FloorPlanExportTemplate)}
              disabled={!floorPlan || !!exporting || !onExportTemplateChange}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-[#5D5DFF] disabled:opacity-40"
            >
              {FLOOR_PLAN_EXPORT_TEMPLATES.map((template) => (
                <option key={template.value} value={template.value}>
                  {template.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              {FLOOR_PLAN_EXPORT_TEMPLATES.find((template) => template.value === exportTemplate)?.description}
            </p>
          </div>
          <div className="col-span-2 rounded-xl border border-border bg-background p-3">
            <label htmlFor="export-quality" className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Export quality
            </label>
            <select
              id="export-quality"
              value={exportQuality}
              onChange={(event) => onExportQualityChange?.(event.target.value as FloorPlanExportQuality)}
              disabled={!floorPlan || !!exporting || !onExportQualityChange}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-[#5D5DFF] disabled:opacity-40"
            >
              {FLOOR_PLAN_EXPORT_QUALITIES.map((quality) => (
                <option key={quality.value} value={quality.value}>
                  {quality.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              {FLOOR_PLAN_EXPORT_QUALITIES.find((quality) => quality.value === exportQuality)?.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onExportPDF}
            disabled={!floorPlan || !!exporting || !onExportPDF}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted border border-border text-foreground transition-colors disabled:opacity-40"
          >
            {exporting === "pdf" ? "Exporting..." : "PDF"}
          </button>
          <button
            type="button"
            onClick={onExportPNG}
            disabled={!floorPlan || !!exporting || !onExportPNG}
            className="w-full py-2.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-muted border border-border text-foreground transition-colors disabled:opacity-40"
          >
            {exporting === "png" ? "Exporting..." : "PNG"}
          </button>
        </div>

        <SharePlanControls
          key={savedPlanId ?? "unsaved-plan-share"}
          planId={savedPlanId}
          initialShareToken={shareToken}
          initialShareEnabled={!!shareToken}
          onShareTokenChange={onShareTokenChange}
        />
      </div>
    </aside>
  );
}

function RoomEditor({
  room,
  canDeleteRoom,
  onUpdateRoom,
  onDeleteRoom,
}: {
  room: Room;
  canDeleteRoom: boolean;
  onUpdateRoom?: (roomId: string, patch: Partial<Pick<Room, "label" | "type">>) => void;
  onDeleteRoom?: (roomId: string) => void;
}) {
  const area = Math.round((room.width * room.height) / 2500);
  const typeIsKnown = ROOM_TYPE_OPTIONS.some((option) => option.value === room.type);

  return (
    <div className="rounded-xl border border-[#5D5DFF]/30 bg-[#5D5DFF]/5 p-3 space-y-3">
      <div>
        <label htmlFor="room-label" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
          Label
        </label>
        <input
          id="room-label"
          value={room.label}
          onChange={(event) => onUpdateRoom?.(room.id, { label: event.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-[#5D5DFF]"
          placeholder="Room label"
        />
      </div>

      <div>
        <label htmlFor="room-type" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
          Type
        </label>
        <select
          id="room-type"
          value={room.type}
          onChange={(event) => onUpdateRoom?.(room.id, { type: event.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-[#5D5DFF]"
        >
          {!typeIsKnown && <option value={room.type}>{room.type.replace(/_/g, " ")}</option>}
          {ROOM_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <MiniStat label="Area" value={`${area} m²`} />
        <MiniStat label="Width" value={`${Math.round(room.width / 50)} m`} />
        <MiniStat label="Depth" value={`${Math.round(room.height / 50)} m`} />
      </div>

      <p className="text-[10px] text-muted-foreground">
        Drag this room on the canvas or use the resize handles. Geometry snaps to {ROOM_GRID_SIZE / 50}m and rooms stay at least {MIN_ROOM_SIZE / 50}m wide/deep.
      </p>

      <div className="pt-1 border-t border-border/70">
        <button
          type="button"
          onClick={() => onDeleteRoom?.(room.id)}
          disabled={!onDeleteRoom || !canDeleteRoom}
          className="w-full rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-red-500/5"
        >
          Delete room
        </button>
        <p className="text-[10px] text-muted-foreground mt-1">
          Deleting a room also removes its doors and windows.
        </p>
      </div>
    </div>
  );
}

function OpeningManager({
  floorPlan,
  room,
  selectedOpening,
  selectedOpeningDetails,
  onAddOpening,
  onSelectOpening,
  onUpdateOpening,
  onRemoveOpening,
}: {
  floorPlan: FloorPlan;
  room: Room;
  selectedOpening?: OpeningSelection | null;
  selectedOpeningDetails: SelectedOpeningDetails | null;
  onAddOpening?: (kind: OpeningKind, roomId: string) => void;
  onSelectOpening?: (selection: OpeningSelection) => void;
  onUpdateOpening?: (selection: OpeningSelection, patch: OpeningPatch) => void;
  onRemoveOpening?: (selection: OpeningSelection) => void;
}) {
  const doorWallOptions = getDoorWallOptions(room, floorPlan.rooms);
  const windowWallOptions = getWindowWallOptions(room, floorPlan.rooms);
  const roomOpenings = getRoomOpenings(floorPlan, room.id);
  const selectedOpeningIsInRoom = selectedOpeningDetails?.room.id === room.id;

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Openings
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Doors and windows for this room
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onAddOpening?.("door", room.id)}
            disabled={!onAddOpening || doorWallOptions.length === 0}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-[10px] font-bold text-foreground hover:bg-secondary disabled:opacity-40"
          >
            + Door
          </button>
          <button
            type="button"
            onClick={() => onAddOpening?.("window", room.id)}
            disabled={!onAddOpening || windowWallOptions.length === 0}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-[10px] font-bold text-foreground hover:bg-secondary disabled:opacity-40"
          >
            + Window
          </button>
        </div>
      </div>

      {roomOpenings.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {roomOpenings.map((item) => {
            const selected = selectedOpening?.kind === item.kind && selectedOpening.index === item.index;
            const accent = item.kind === "door" ? "text-amber-600" : "text-cyan-600";
            const widthMeters = getOpeningWidthMeters(item.opening, item.kind);

            return (
              <button
                key={`${item.kind}-${item.index}`}
                type="button"
                onClick={() => onSelectOpening?.({ kind: item.kind, index: item.index })}
                className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                  selected
                    ? "bg-background border-[#5D5DFF]/60"
                    : "bg-background/60 border-border hover:bg-background"
                }`}
              >
                <p className={`text-[10px] font-bold capitalize ${selected ? "text-[#5D5DFF]" : accent}`}>
                  {item.kind} {item.index + 1}
                </p>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {item.opening.wall} · {widthMeters.toFixed(1)}m · {Math.round(item.opening.position * 100)}%
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-background/60 px-3 py-3 text-center">
          <p className="text-[11px] font-semibold text-foreground">No openings yet</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Add a door or window to this room.
          </p>
        </div>
      )}

      {selectedOpeningIsInRoom && selectedOpeningDetails ? (
        <OpeningEditor
          details={selectedOpeningDetails}
          rooms={floorPlan.rooms}
          onUpdateOpening={onUpdateOpening}
          onRemoveOpening={onRemoveOpening}
        />
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Select a door or window on the canvas or from the list to edit its wall and position.
        </p>
      )}
    </div>
  );
}

function OpeningEditor({
  details,
  rooms,
  onUpdateOpening,
  onRemoveOpening,
}: {
  details: SelectedOpeningDetails;
  rooms: Room[];
  onUpdateOpening?: (selection: OpeningSelection, patch: OpeningPatch) => void;
  onRemoveOpening?: (selection: OpeningSelection) => void;
}) {
  const selection = { kind: details.kind, index: details.index } satisfies OpeningSelection;
  const validWalls = details.kind === "door"
    ? getDoorWallOptions(details.room, rooms)
    : getWindowWallOptions(details.room, rooms);
  const wallOptions = validWalls.includes(details.opening.wall)
    ? validWalls
    : [details.opening.wall, ...validWalls];
  const currentWallIsValid = validWalls.includes(details.opening.wall);
  const widthMeters = clampOpeningWidthForWall(details.opening.widthMeters, details.kind, details.room, details.opening.wall);
  const wallLengthMeters = getWallLengthMeters(details.room, details.opening.wall);
  const maxWidthMeters = Math.max(MIN_OPENING_WIDTH_METERS, Math.min(MAX_OPENING_WIDTH_METERS, wallLengthMeters));
  const position = clampOpeningPositionForWidth(details.opening.position, details.room, details.opening.wall, widthMeters);
  const door = details.kind === "door" ? details.opening as Door : null;

  function handleWallChange(value: string) {
    if (!isWallSide(value)) return;
    onUpdateOpening?.(selection, { wall: value });
  }

  function handlePositionChange(value: string) {
    onUpdateOpening?.(selection, { position: Number(value) });
  }

  function handleWidthChange(value: string) {
    onUpdateOpening?.(selection, { widthMeters: Number(value) });
  }

  function handleHingeChange(value: string) {
    if (!isDoorHinge(value)) return;
    onUpdateOpening?.(selection, { hinge: value });
  }

  function handleSwingChange(value: string) {
    if (!isDoorSwing(value)) return;
    onUpdateOpening?.(selection, { swing: value });
  }

  return (
    <div className="rounded-lg border border-[#5D5DFF]/30 bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-foreground capitalize">
            {details.kind} {details.index + 1}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {details.room.label}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemoveOpening?.(selection)}
          disabled={!onRemoveOpening}
          className="text-[10px] font-bold text-red-500 hover:text-red-400 disabled:opacity-40"
        >
          Delete
        </button>
      </div>

      <div>
        <label htmlFor="opening-wall" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
          Wall
        </label>
        <select
          id="opening-wall"
          value={details.opening.wall}
          onChange={(event) => handleWallChange(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-[#5D5DFF]"
        >
          {wallOptions.map((wall) => (
            <option key={wall} value={wall}>
              {WALL_LABELS[wall]}{validWalls.includes(wall) ? "" : " (invalid)"}
            </option>
          ))}
        </select>
        {!currentWallIsValid && (
          <p className="text-[10px] text-red-500 mt-1">
            {details.kind === "window" ? "Windows must stay on exterior walls." : "Doors must use a shared or exterior wall."}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="opening-position" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Position
          </label>
          <span className="text-[10px] font-bold text-foreground">{Math.round(position * 100)}%</span>
        </div>
        <input
          id="opening-position"
          type="range"
          min="0"
          max="1"
          step={OPENING_POSITION_STEP}
          value={position}
          onChange={(event) => handlePositionChange(event.target.value)}
          className="w-full accent-[#5D5DFF]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="opening-width" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Width
          </label>
          <span className="text-[10px] font-bold text-foreground">{widthMeters.toFixed(1)}m</span>
        </div>
        <input
          id="opening-width"
          type="range"
          min={MIN_OPENING_WIDTH_METERS}
          max={maxWidthMeters}
          step={OPENING_WIDTH_STEP_METERS}
          value={widthMeters}
          onChange={(event) => handleWidthChange(event.target.value)}
          className="w-full accent-[#5D5DFF]"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Fits this {wallLengthMeters.toFixed(1)}m wall.
        </p>
      </div>

      {door && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="door-hinge" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Hinge
            </label>
            <select
              id="door-hinge"
              value={getDoorHinge(door)}
              onChange={(event) => handleHingeChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold text-foreground outline-none focus:border-[#5D5DFF] capitalize"
            >
              {DOOR_HINGES.map((hinge) => (
                <option key={hinge} value={hinge}>{hinge}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="door-swing" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Swing
            </label>
            <select
              id="door-swing"
              value={getDoorSwing(door)}
              onChange={(event) => handleSwingChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold text-foreground outline-none focus:border-[#5D5DFF] capitalize"
            >
              {DOOR_SWINGS.map((swing) => (
                <option key={swing} value={swing}>{swing}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function ExteriorConceptPanel({
  concept,
  conceptStyle,
  conceptStatus,
  onConceptStyleChange,
  onCreateExteriorConcept,
}: {
  concept: ExteriorConceptBrief | null;
  conceptStyle: ExteriorConceptStyle;
  conceptStatus: "idle" | "done";
  onConceptStyleChange: (style: ExteriorConceptStyle) => void;
  onCreateExteriorConcept?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Exterior facade concept
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Create a render-ready whole-plan facade brief.
        </p>
      </div>

      <div>
        <label htmlFor="exterior-concept-style" className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
          Facade style
        </label>
        <select
          id="exterior-concept-style"
          value={conceptStyle}
          onChange={(event) => onConceptStyleChange(event.target.value as ExteriorConceptStyle)}
          disabled={!onCreateExteriorConcept}
          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold text-foreground outline-none focus:border-[#5D5DFF] disabled:opacity-40"
        >
          {EXTERIOR_CONCEPT_STYLE_OPTIONS.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={onCreateExteriorConcept}
        disabled={!onCreateExteriorConcept}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
      >
        Create facade brief
      </button>

      {conceptStatus === "done" && (
        <p className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
          Facade brief created. Undo is available from the header.
        </p>
      )}

      {concept ? (
        <div className="rounded-lg border border-[#5D5DFF]/25 bg-background p-3 space-y-2">
          <div>
            <p className="text-xs font-bold text-foreground">{concept.title}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{concept.summary}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {concept.palette.slice(0, 4).map((item) => (
              <span key={item} className="rounded-full border border-border bg-secondary/40 px-2 py-1 text-[9px] font-bold text-muted-foreground">
                {item}
              </span>
            ))}
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Render prompt</p>
            <p className="mt-1 max-h-24 overflow-y-auto rounded-md bg-secondary/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
              {concept.renderPrompt}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-background/60 px-3 py-3 text-center text-[10px] text-muted-foreground">
          No facade brief yet for this plan.
        </p>
      )}
    </div>
  );
}

function InteriorConceptPanel({
  room,
  concept,
  conceptStyle,
  conceptStatus,
  onConceptStyleChange,
  onCreateInteriorConcept,
}: {
  room: Room;
  concept: InteriorConceptBrief | null;
  conceptStyle: InteriorConceptStyle;
  conceptStatus: "idle" | "done";
  onConceptStyleChange: (style: InteriorConceptStyle) => void;
  onCreateInteriorConcept?: (roomId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Interior concept
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Create a render-ready brief for {room.label}.
        </p>
      </div>

      <div>
        <label htmlFor="interior-concept-style" className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
          Concept style
        </label>
        <select
          id="interior-concept-style"
          value={conceptStyle}
          onChange={(event) => onConceptStyleChange(event.target.value as InteriorConceptStyle)}
          disabled={!onCreateInteriorConcept}
          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold text-foreground outline-none focus:border-[#5D5DFF] disabled:opacity-40"
        >
          {INTERIOR_CONCEPT_STYLE_OPTIONS.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => onCreateInteriorConcept?.(room.id)}
        disabled={!onCreateInteriorConcept}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
      >
        Create concept brief
      </button>

      {conceptStatus === "done" && (
        <p className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
          Concept brief created. Undo is available from the header.
        </p>
      )}

      {concept ? (
        <div className="rounded-lg border border-[#5D5DFF]/25 bg-background p-3 space-y-2">
          <div>
            <p className="text-xs font-bold text-foreground">{concept.title}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{concept.summary}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {concept.palette.slice(0, 4).map((item) => (
              <span key={item} className="rounded-full border border-border bg-secondary/40 px-2 py-1 text-[9px] font-bold text-muted-foreground">
                {item}
              </span>
            ))}
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Render prompt</p>
            <p className="mt-1 max-h-24 overflow-y-auto rounded-md bg-secondary/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
              {concept.renderPrompt}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-background/60 px-3 py-3 text-center text-[10px] text-muted-foreground">
          No concept brief yet for this room.
        </p>
      )}
    </div>
  );
}

function getRoomOpenings(floorPlan: FloorPlan, roomId: string) {
  return [
    ...(floorPlan.doors ?? []).map((opening, index) => ({ kind: "door" as const, index, opening })),
    ...(floorPlan.windows ?? []).map((opening, index) => ({ kind: "window" as const, index, opening })),
  ].filter((item) => item.opening.roomId === roomId);
}

function getSelectedOpeningDetails(
  floorPlan: FloorPlan,
  selection: OpeningSelection,
): SelectedOpeningDetails | null {
  const opening = getOpenings(floorPlan, selection.kind)[selection.index];
  if (!opening) return null;

  const room = floorPlan.rooms.find((candidate) => candidate.id === opening.roomId);
  if (!room) return null;

  return { ...selection, opening, room };
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-2">
      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className="text-[11px] font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function MaterialEditor({
  room,
  material,
  onUpdateRoomMaterial,
}: {
  room: Room;
  material: RoomMaterial | null;
  onUpdateRoomMaterial?: (roomId: string, palette: string) => void;
}) {
  if (!material) return null;

  return (
    <div className="mt-3 rounded-lg border border-border bg-background p-2.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <span
          className="h-7 w-7 rounded-md border border-border"
          style={{ backgroundColor: material.floorColor }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold text-foreground">
            {material.palette}{material.manual ? " · manual" : ""}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{material.floorFinish}</p>
        </div>
      </div>
      <div>
        <label htmlFor="room-material-palette" className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
          Selected room palette
        </label>
        <select
          id="room-material-palette"
          value={material.palette}
          onChange={(event) => onUpdateRoomMaterial?.(room.id, event.target.value)}
          disabled={!onUpdateRoomMaterial}
          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-semibold text-foreground outline-none focus:border-[#5D5DFF] disabled:opacity-40"
        >
          {MATERIAL_PALETTE_OPTIONS.map((preset) => (
            <option key={preset.palette} value={preset.palette}>
              {preset.palette}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <MiniMaterialSwatch label="Floor" color={material.floorColor} value={material.floorFinish} />
        <MiniMaterialSwatch label="Walls" color={material.wallColor} value={material.wallFinish} />
      </div>
    </div>
  );
}

function MiniMaterialSwatch({ label, color, value }: { label: string; color: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-1.5">
      <div className="flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-sm border border-border" style={{ backgroundColor: color }} aria-hidden="true" />
        <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 truncate text-[9px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="px-3 py-2.5 rounded-xl bg-secondary/40 border border-border">
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
      <p className="text-base font-bold text-foreground mt-0.5">
        {value}
        {unit && <span className="text-[10px] font-medium text-muted-foreground ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
