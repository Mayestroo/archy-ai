"use client";

import { useState } from "react";
import type { EditableRoomType } from "@/lib/floorplan-schema";

interface FurnitureBrowserProps {
  onConfirm: (roomType: EditableRoomType) => void;
  onCancel: () => void;
}

interface FurnitureCategory {
  id: string;
  label: string;
  icon: string;
  items: {
    roomType: EditableRoomType;
    label: string;
    icon: string;
    description: string;
  }[];
}

const FURNITURE_CATEGORIES: FurnitureCategory[] = [
  {
    id: "bedroom",
    label: "Bedroom",
    icon: "🛏️",
    items: [
      { roomType: "master_bedroom", label: "Master Bedroom", icon: "🛌", description: "King bed, dresser, wardrobe, nightstands" },
      { roomType: "bedroom", label: "Bedroom", icon: "🛏️", description: "Queen bed, closet, desk, nightstand" },
      { roomType: "study", label: "Walk-in Closet", icon: "🚪", description: "Shelving, hanging rods, island" },
    ],
  },
  {
    id: "bathroom",
    label: "Bathroom",
    icon: "🚿",
    items: [
      { roomType: "bathroom", label: "Bathroom", icon: "🛁", description: "Toilet, vanity, shower, bathtub" },
      { roomType: "ensuite", label: "Ensuite", icon: "🚿", description: "Toilet, vanity, walk-in shower" },
    ],
  },
  {
    id: "living",
    label: "Living Room",
    icon: "🛋️",
    items: [
      { roomType: "living", label: "Living Room", icon: "🛋️", description: "Sofa, coffee table, media console, armchair" },
      { roomType: "dining", label: "Dining Room", icon: "🍽️", description: "Dining table, chairs, sideboard" },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen & Dining",
    icon: "🍳",
    items: [
      { roomType: "kitchen", label: "Kitchen", icon: "🍳", description: "Counter, island, sink, stove" },
    ],
  },
  {
    id: "office",
    label: "Office",
    icon: "💼",
    items: [
      { roomType: "study", label: "Office / Study", icon: "💼", description: "Desk, chair, bookshelf, filing" },
    ],
  },
  {
    id: "service",
    label: "Entry & Laundry",
    icon: "🧹",
    items: [
      { roomType: "laundry", label: "Laundry", icon: "🧺", description: "Washer, dryer, counter, storage" },
      { roomType: "entry", label: "Mudroom", icon: "👢", description: "Bench, hooks, shoe storage" },
    ],
  },
  {
    id: "garage",
    label: "Garage & Storage",
    icon: "🚗",
    items: [
      { roomType: "garage", label: "Garage", icon: "🚗", description: "Car space, workbench, shelving" },
      { roomType: "studio", label: "Storage", icon: "📦", description: "Shelving, bins, utility" },
    ],
  },
];

export default function FurnitureBrowser({ onConfirm, onCancel }: FurnitureBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState(FURNITURE_CATEGORIES[0].id);

  const category = FURNITURE_CATEGORIES.find((c) => c.id === selectedCategory) ?? FURNITURE_CATEGORIES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-[520px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-foreground">Browse furniture</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar */}
          <div className="w-[140px] shrink-0 border-r border-border overflow-y-auto p-2 space-y-1">
            {FURNITURE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-[#5D5DFF]/10 text-[#5D5DFF]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <span className="mr-1.5">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Item grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              {category.icon} {category.label}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {category.items.map((item) => (
                <button
                  key={item.roomType}
                  onClick={() => onConfirm(item.roomType)}
                  className="text-left rounded-xl border border-border bg-card p-3 hover:border-[#5D5DFF]/70 hover:bg-[#5D5DFF]/5 transition-colors group"
                >
                  <p className="text-lg mb-1">{item.icon}</p>
                  <p className="text-xs font-bold text-foreground group-hover:text-[#5D5DFF] transition-colors">
                    {item.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                  <p className="text-[9px] font-semibold text-[#5D5DFF] mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    Add to plan
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-5 py-4 border-t border-border shrink-0">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
