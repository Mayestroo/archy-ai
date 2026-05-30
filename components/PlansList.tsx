"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteFloorPlan } from "@/app/actions";
import type { FloorPlan } from "@/lib/floorplan-schema";

interface PlanRecord {
  id: string;
  prompt: string;
  created_at: string;
  floor_plan_json: FloorPlan;
}

interface PlansListProps {
  initialPlans: PlanRecord[];
}

export default function PlansList({ initialPlans }: PlansListProps) {
  const [plans, setPlans] = useState(initialPlans);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    startTransition(async () => {
      try {
        await deleteFloorPlan(id);
        setPlans((prev) => prev.filter((p) => p.id !== id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to delete plan");
      } finally {
        setDeletingId(null);
        setConfirmId(null);
      }
    });
  }

  return (
    <div className="w-full max-w-[1300px] px-6 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">My Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {plans.length === 0
              ? "You haven't created any plans yet."
              : `${plans.length} saved plan${plans.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <Link
          href="/editor"
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          New Plan
        </Link>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950/30 border border-red-900/40 text-red-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {plans.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-base font-semibold text-foreground mb-1">No plans yet</p>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Describe your dream space and Archy AI will generate a floor plan for you in seconds.
          </p>
          <Link
            href="/editor"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-foreground text-background hover:opacity-90"
          >
            Create your first plan
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const rooms = plan.floor_plan_json?.rooms ?? [];
            const area = plan.floor_plan_json?.totalArea ?? 0;
            const date = new Date(plan.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={plan.id}
                className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-muted hover:shadow-lg hover:shadow-black/5 transition-all"
              >
                {/* Preview */}
                <Link href={`/editor?planId=${plan.id}`}>
                  <div className="aspect-video bg-linear-to-br from-secondary/30 to-secondary/60 relative overflow-hidden">
                    <MiniPlanPreview floorPlan={plan.floor_plan_json} />
                  </div>
                </Link>

                {/* Body */}
                <div className="p-4">
                  <Link href={`/editor?planId=${plan.id}`}>
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-[#5D5DFF] transition-colors">
                      {plan.prompt || "Untitled plan"}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span>{date}</span>
                    <span>·</span>
                    <span>{rooms.length} rooms</span>
                    {area > 0 && (
                      <>
                        <span>·</span>
                        <span>{area} sqm</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <Link
                      href={`/editor?planId=${plan.id}`}
                      className="flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg bg-secondary hover:bg-muted border border-border transition-colors"
                    >
                      Open
                    </Link>
                    {confirmId === plan.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(plan.id)}
                          disabled={isPending}
                          className="text-xs font-semibold px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          {deletingId === plan.id ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs font-semibold px-3 py-2 rounded-lg bg-secondary hover:bg-muted border border-border transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmId(plan.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary hover:bg-red-950/40 hover:text-red-400 border border-border transition-colors"
                        aria-label="Delete plan"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Tiny inline SVG preview of a floor plan – avoids loading Konva/three for thumbnails. */
function MiniPlanPreview({ floorPlan }: { floorPlan: FloorPlan | null | undefined }) {
  if (!floorPlan?.rooms?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
        No preview
      </div>
    );
  }
  const rooms = floorPlan.rooms;
  const maxX = Math.max(...rooms.map((r) => r.x + r.width));
  const maxY = Math.max(...rooms.map((r) => r.y + r.height));

  const palette = [
    "#5D5DFF",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#8b5cf6",
    "#ec4899",
    "#84cc16",
  ];

  return (
    <svg
      viewBox={`0 0 ${maxX} ${maxY}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full p-4"
    >
      {rooms.map((room, i) => (
        <g key={room.id}>
          <rect
            x={room.x}
            y={room.y}
            width={room.width}
            height={room.height}
            fill={palette[i % palette.length]}
            fillOpacity={0.2}
            stroke={palette[i % palette.length]}
            strokeWidth={2}
          />
        </g>
      ))}
    </svg>
  );
}
