"use client";

import { useState } from "react";
import { SHAPE_OPTIONS, SHAPE_ATTACHMENTS, type ShapeAnswer, type ShapeKey } from "@/lib/editor-onboarding";

interface ShapePickerModalProps {
  onConfirm: (answer: ShapeAnswer) => void;
  onCancel: () => void;
}

const SHAPE_PREVIEWS: Record<ShapeKey, string> = {
  rectangle: "M15,15 L105,15 L105,65 L15,65 Z",
  l_shape: "M15,15 L85,15 L85,45 L55,45 L55,65 L15,65 Z",
  u_shape: "M15,15 L85,15 L85,65 L70,65 L70,30 L30,30 L30,65 L15,65 Z",
  t_shape: "M25,15 L75,15 L75,30 L95,30 L95,60 L5,60 L5,30 L25,30 Z",
  stepped: "M15,15 L65,15 L65,30 L85,30 L85,50 L55,50 L55,65 L15,65 Z",
  courtyard: "M15,15 L85,15 L85,65 L15,65 Z M35,30 L65,30 L65,50 L35,50 Z",
};

export default function ShapePickerModal({ onConfirm, onCancel }: ShapePickerModalProps) {
  const [selectedShape, setSelectedShape] = useState<ShapeKey>("rectangle");
  const [frontDoorSide, setFrontDoorSide] = useState<"top" | "right" | "bottom" | "left">("bottom");
  const [attachments, setAttachments] = useState<typeof SHAPE_ATTACHMENTS>([]);

  function toggleAttachment(type: (typeof SHAPE_ATTACHMENTS)[number]) {
    setAttachments((prev) => {
      const exists = prev.find((a) => a.type === type.type);
      if (exists) return prev.filter((a) => a.type !== type.type);
      return [...prev, type];
    });
  }

  function handleConfirm() {
    onConfirm({
      shapeKey: selectedShape,
      frontDoorSide,
      attachments,
    });
  }

  const sides: ("top" | "right" | "bottom" | "left")[] = ["top", "right", "bottom", "left"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-[520px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Choose floor plan shape</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Shape presets grid */}
          <div className="grid grid-cols-3 gap-3">
            {SHAPE_OPTIONS.map((shape) => {
              const isSelected = selectedShape === shape.key;
              return (
                <button
                  key={shape.key}
                  onClick={() => setSelectedShape(shape.key)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-[#5D5DFF] bg-[#5D5DFF]/5 ring-1 ring-[#5D5DFF]/30"
                      : "border-border bg-card hover:border-[#5D5DFF]/50 hover:bg-[#5D5DFF]/5"
                  }`}
                >
                  <svg
                    width="100%"
                    height="48"
                    viewBox="0 0 100 80"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-1.5"
                  >
                    <path
                      d={SHAPE_PREVIEWS[shape.key]}
                      fill={isSelected ? "#5D5DFF" : "#888"}
                      fillOpacity={isSelected ? 0.15 : 0.08}
                      stroke={isSelected ? "#5D5DFF" : "#888"}
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className={`text-xs font-semibold ${isSelected ? "text-[#5D5DFF]" : "text-foreground"}`}>
                    {shape.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{shape.description}</p>
                </button>
              );
            })}
          </div>

          {/* Front door */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Front door side</p>
            <div className="flex gap-2">
              {sides.map((side) => (
                <button
                  key={side}
                  onClick={() => setFrontDoorSide(side)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    frontDoorSide === side
                      ? "border-[#5D5DFF] bg-[#5D5DFF]/5 text-[#5D5DFF]"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {side.charAt(0).toUpperCase() + side.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Attachments</p>
            <div className="flex gap-2">
              {SHAPE_ATTACHMENTS.map((att) => {
                const isActive = !!attachments.find((a) => a.type === att.type);
                return (
                  <button
                    key={att.type}
                    onClick={() => toggleAttachment(att)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      isActive
                        ? "border-[#5D5DFF] bg-[#5D5DFF]/5 text-[#5D5DFF]"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {att.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">
            Use this shape
          </button>
        </div>
      </div>
    </div>
  );
}
