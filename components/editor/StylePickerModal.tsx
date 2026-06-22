"use client";

import { useState } from "react";
import type { InteriorConceptStyle, ExteriorConceptStyle } from "@/lib/floorplan-schema";

type StyleScope = "interior" | "exterior";

export interface StylePickerResult {
  scope: StyleScope;
  style: InteriorConceptStyle | ExteriorConceptStyle;
}

interface StylePickerModalProps {
  defaultScope?: StyleScope;
  onConfirm: (result: StylePickerResult) => void;
  onCancel: () => void;
}

const STYLE_CARDS: { style: InteriorConceptStyle; label: string; description: string; swatches: string[] }[] = [
  { style: "warm_minimal", label: "Warm Minimal", description: "Soft neutrals, clean lines, understated warmth", swatches: ["#F5F0EB", "#D4C5B5", "#8B7D6B", "#2C2826"] },
  { style: "modern_neutral", label: "Modern Neutral", description: "Balanced greys, warm beiges, timeless palette", swatches: ["#E8E6E1", "#B8B0A8", "#7A7270", "#3D3835"] },
  { style: "scandinavian", label: "Scandinavian", description: "Light woods, crisp whites, cozy minimalism", swatches: ["#F8F6F0", "#D1CAB8", "#A3B5A1", "#4A4A48"] },
  { style: "luxury_contemporary", label: "Luxury Contemporary", description: "Rich textures, deep tones, curated elegance", swatches: ["#E8DED8", "#A09187", "#5C524C", "#1E1B19"] },
  { style: "builder_display", label: "Builder Display", description: "Broad appeal, fresh finishes, model-ready look", swatches: ["#F0EDE8", "#C4BCB0", "#8E857C", "#3E3A36"] },
];

const FACADE_CARDS: { style: ExteriorConceptStyle; label: string; description: string; swatches: string[] }[] = [
  { style: "modern_minimal", label: "Modern Minimal", description: "Clean volumes, flat roofs, restrained palette", swatches: ["#F0F0F0", "#C0C0C0", "#808080", "#303030"] },
  { style: "warm_contemporary", label: "Warm Contemporary", description: "Natural stone, warm wood, inviting modern", swatches: ["#E8DED0", "#C4A88E", "#8B7356", "#4A3D32"] },
  { style: "scandinavian", label: "Scandinavian", description: "White render, dark trim, simple roof forms", swatches: ["#F5F5F0", "#D0D0C8", "#A0A098", "#404038"] },
  { style: "luxury_villa", label: "Luxury Villa", description: "Dramatic forms, rich materials, premium presence", swatches: ["#E0D8D0", "#B8A898", "#786858", "#282018"] },
  { style: "builder_spec", label: "Builder Spec", description: "Market-tested, cost-conscious, broad curb appeal", swatches: ["#F0ECE4", "#C8C0B4", "#90887C", "#484440"] },
];

export default function StylePickerModal({ defaultScope = "interior", onConfirm, onCancel }: StylePickerModalProps) {
  const [scope, setScope] = useState<StyleScope>(defaultScope);
  const [search, setSearch] = useState("");
  const [selectedInterior, setSelectedInterior] = useState<InteriorConceptStyle>("warm_minimal");
  const [selectedExterior, setSelectedExterior] = useState<ExteriorConceptStyle>("warm_contemporary");

  const cards = scope === "interior" ? STYLE_CARDS : FACADE_CARDS;
  const selected = scope === "interior" ? selectedInterior : selectedExterior;
  const setSelected = (value: string) => {
    if (scope === "interior") setSelectedInterior(value as InteriorConceptStyle);
    else setSelectedExterior(value as ExteriorConceptStyle);
  };

  const filtered = cards.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()),
  );

  function handleConfirm() {
    onConfirm({
      scope,
      style: scope === "interior" ? selectedInterior : selectedExterior,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-[520px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-foreground">Choose style</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scope toggle */}
        <div className="flex gap-2 px-5 pt-4 pb-2 shrink-0">
          <button
            onClick={() => setScope("interior")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              scope === "interior"
                ? "border-[#5D5DFF] bg-[#5D5DFF]/5 text-[#5D5DFF]"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            Interior
          </button>
          <button
            onClick={() => setScope("exterior")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              scope === "exterior"
                ? "border-[#5D5DFF] bg-[#5D5DFF]/5 text-[#5D5DFF]"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            Exterior
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pb-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search styles..."
            className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-border"
          />
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2.5">
          {filtered.map((card) => {
            const isSelected = card.style === selected;
            return (
              <button
                key={card.style}
                onClick={() => setSelected(card.style)}
                className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                  isSelected
                    ? "border-[#5D5DFF] bg-[#5D5DFF]/5 ring-1 ring-[#5D5DFF]/30"
                    : "border-border bg-card hover:border-[#5D5DFF]/50 hover:bg-[#5D5DFF]/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${isSelected ? "text-[#5D5DFF]" : "text-foreground"}`}>
                      {card.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{card.description}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {card.swatches.map((color, i) => (
                      <span
                        key={i}
                        className="w-5 h-5 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">No styles match your search.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">
            Apply style
          </button>
        </div>
      </div>
    </div>
  );
}
