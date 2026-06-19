"use client";

import { useState } from "react";
import { MATERIAL_PALETTE_OPTIONS } from "@/lib/materials";

interface FinishPickerModalProps {
  selectedPalette?: string;
  onConfirm: (palette: string) => void;
  onCancel: () => void;
}

const MATERIAL_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "tile", label: "Tile" },
  { id: "wood", label: "Wood" },
  { id: "wall_panel", label: "Wall Panel" },
  { id: "brick", label: "Brick" },
  { id: "concrete", label: "Concrete" },
  { id: "paint", label: "Paint" },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  tile: ["tile", "ceramic", "porcelain", "mosaic", "stone", "marble", "slate"],
  wood: ["wood", "oak", "walnut", "maple", "bamboo", "laminate", "timber"],
  wall_panel: ["wall panel", "wainscot", "shiplap", "board", "batten", "acoustic"],
  brick: ["brick", "masonry", "clinker"],
  concrete: ["concrete", "cement", "terrazzo", "polymer", "micro"],
  paint: ["paint", "matte", "gloss", "emulsion", "limewash", "plaster"],
};

const COLOR_PRESETS = [
  { label: "Warm White", color: "#F5F0EB" },
  { label: "Soft Beige", color: "#D4C5B5" },
  { label: "Light Grey", color: "#D0D0D0" },
  { label: "Stone", color: "#B8B0A8" },
  { label: "Sage", color: "#A3B5A1" },
  { label: "Dusty Blue", color: "#8FA8C0" },
  { label: "Warm Taupe", color: "#8B7D6B" },
  { label: "Charcoal", color: "#4A4A48" },
  { label: "Deep Navy", color: "#2C3E50" },
  { label: "Ochre", color: "#C4A050" },
  { label: "Terracotta", color: "#C86A50" },
  { label: "Forest", color: "#3A5A40" },
];

export default function FinishPickerModal({ selectedPalette, onConfirm, onCancel }: FinishPickerModalProps) {
  const [tab, setTab] = useState<"material" | "colour">("material");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(selectedPalette ?? "");

  function matchesCategory(palette: string, catId: string): boolean {
    if (catId === "all") return true;
    const keywords = CATEGORY_KEYWORDS[catId] ?? [];
    return keywords.some((kw) => palette.toLowerCase().includes(kw));
  }

  const filteredPalettes = MATERIAL_PALETTE_OPTIONS.filter((p) => {
    if (search && !p.palette.toLowerCase().includes(search.toLowerCase())) return false;
    if (!matchesCategory(p.palette, category)) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-[480px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-foreground">Choose finishes</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-4 pb-2 shrink-0">
          <button
            onClick={() => setTab("material")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              tab === "material"
                ? "border-[#5D5DFF] bg-[#5D5DFF]/5 text-[#5D5DFF]"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            Material
          </button>
          <button
            onClick={() => setTab("colour")}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              tab === "colour"
                ? "border-[#5D5DFF] bg-[#5D5DFF]/5 text-[#5D5DFF]"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            Colour
          </button>
        </div>

        {tab === "material" && (
          <>
            {/* Category + search */}
            <div className="px-5 pb-3 space-y-2 shrink-0">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {MATERIAL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`shrink-0 text-[10px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${
                      category === cat.id
                        ? "border-[#5D5DFF] bg-[#5D5DFF]/5 text-[#5D5DFF]"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search materials..."
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-border"
              />
            </div>

            {/* Material palette grid */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="grid grid-cols-2 gap-2">
                {filteredPalettes.map((p) => {
                  const isSelected = selected === p.palette;
                  return (
                    <button
                      key={p.palette}
                      onClick={() => setSelected(p.palette)}
                      className={`text-left rounded-xl border p-3 transition-all ${
                        isSelected
                          ? "border-[#5D5DFF] bg-[#5D5DFF]/5 ring-1 ring-[#5D5DFF]/30"
                          : "border-border bg-card hover:border-[#5D5DFF]/50 hover:bg-[#5D5DFF]/5"
                      }`}
                    >
                      <div className="flex gap-1 mb-2">
                        <span className="h-6 w-6 rounded-md border border-border" style={{ backgroundColor: p.floorColor }} />
                        <span className="h-6 w-6 rounded-md border border-border" style={{ backgroundColor: p.wallColor }} />
                        <span className="h-6 w-6 rounded-md border border-border" style={{ backgroundColor: p.accentColor }} />
                      </div>
                      <p className={`text-[11px] font-bold ${isSelected ? "text-[#5D5DFF]" : "text-foreground"}`}>
                        {p.palette}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {p.floorFinish} · {p.wallFinish}
                      </p>
                    </button>
                  );
                })}
                {filteredPalettes.length === 0 && (
                  <p className="col-span-2 text-center text-xs text-muted-foreground py-8">No materials match.</p>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "colour" && (
          <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3">
            <div className="grid grid-cols-4 gap-3">
              {COLOR_PRESETS.map((c) => {
                const isSelected = selected === c.label;
                return (
                  <button
                    key={c.label}
                    onClick={() => setSelected(c.label)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                      isSelected
                        ? "border-[#5D5DFF] bg-[#5D5DFF]/5 ring-1 ring-[#5D5DFF]/30"
                        : "border-border bg-card hover:border-[#5D5DFF]/50"
                    }`}
                  >
                    <span
                      className="h-9 w-9 rounded-lg border border-border"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className={`text-[9px] font-semibold text-center leading-tight ${isSelected ? "text-[#5D5DFF]" : "text-foreground"}`}>
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm(selected)} className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">
            Apply finish
          </button>
        </div>
      </div>
    </div>
  );
}
