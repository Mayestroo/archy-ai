"use client";

import { useState } from "react";
import { ROOM_OPTIONS } from "@/lib/editor-onboarding";

interface RoomProgramModalProps {
  initialRooms?: Record<string, number>;
  onConfirm: (rooms: Record<string, number>) => void;
  onCancel: () => void;
}

export default function RoomProgramModal({ initialRooms, onConfirm, onCancel }: RoomProgramModalProps) {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const room of ROOM_OPTIONS) {
      initial[room.id] = initialRooms?.[room.id] ?? room.defaultCount;
    }
    return initial;
  });

  function adjust(id: string, delta: number) {
    setCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  }

  function reset() {
    const initial: Record<string, number> = {};
    for (const room of ROOM_OPTIONS) initial[room.id] = room.defaultCount;
    setCounts(initial);
  }

  function removeZeroes(rooms: Record<string, number>): Record<string, number> {
    return Object.fromEntries(Object.entries(rooms).filter(([, v]) => v > 0));
  }

  const categories = [...new Set(ROOM_OPTIONS.map((r) => r.category))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-[400px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Preferred rooms</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{cat}</p>
              <div className="space-y-1.5">
                {ROOM_OPTIONS.filter((r) => r.category === cat).map((room) => (
                  <div key={room.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border">
                    <span className="text-sm font-medium text-foreground">{room.label}</span>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => adjust(room.id, -1)}
                        disabled={!counts[room.id]}
                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14" strokeLinecap="round" />
                        </svg>
                      </button>
                      <span className="w-5 text-center text-sm font-bold text-foreground">{counts[room.id] ?? 0}</span>
                      <button
                        onClick={() => adjust(room.id, 1)}
                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <button onClick={reset} className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors">
            Reset
          </button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-secondary transition-colors">
              Cancel
            </button>
            <button onClick={() => onConfirm(removeZeroes(counts))} className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity">
              Use these rooms
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
