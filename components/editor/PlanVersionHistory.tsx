"use client";

import { getFloorPlanVersions, type FloorPlanVersionRecord } from "@/app/actions";
import { useEffect, useState, useTransition } from "react";

interface PlanVersionHistoryProps {
  planId?: string | null;
  refreshKey?: number;
  onRestoreVersion?: (version: FloorPlanVersionRecord) => void;
}

export default function PlanVersionHistory({
  planId,
  refreshKey = 0,
  onRestoreVersion,
}: PlanVersionHistoryProps) {
  const [versions, setVersions] = useState<FloorPlanVersionRecord[]>([]);
  const [loading, setLoading] = useState(!!planId);
  const [error, setError] = useState<string | null>(null);
  const [restoredVersion, setRestoredVersion] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!planId) return;

    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        try {
          const nextVersions = await getFloorPlanVersions(planId);
          if (!cancelled) setVersions(nextVersions);
        } catch (err: unknown) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load version history");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [planId, refreshKey]);

  function handleRestore(version: FloorPlanVersionRecord) {
    startTransition(() => {
      onRestoreVersion?.(version);
      setRestoredVersion(version.version_number);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Version history
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {planId
              ? "Each save snapshots this plan. Restore loads a version for review, then save to make it current."
              : "Save this plan to start version history."}
          </p>
        </div>
        {versions.length > 0 && (
          <span className="rounded-full bg-background px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            {versions.length}
          </span>
        )}
      </div>

      {!planId ? null : loading ? (
        <div className="mt-3 rounded-lg border border-border bg-background/60 px-3 py-3 text-[11px] font-semibold text-muted-foreground">
          Loading versions...
        </div>
      ) : error ? (
        <div className="mt-3 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-[10px] font-semibold text-red-500">
          {error}
        </div>
      ) : versions.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border bg-background/60 px-3 py-3 text-center">
          <p className="text-[11px] font-semibold text-foreground">No saved versions yet</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Save once to create version 1.</p>
        </div>
      ) : (
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
          {versions.map((version, index) => {
            const latest = index === 0;
            const restored = restoredVersion === version.version_number;
            return (
              <div
                key={version.id}
                className={`rounded-lg border px-3 py-2 ${latest ? "border-[#5D5DFF]/40 bg-[#5D5DFF]/5" : "border-border bg-background/60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground">Version {version.version_number}</p>
                      {latest && (
                        <span className="rounded-full bg-[#5D5DFF]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-[#5D5DFF]">
                          Latest
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {formatVersionDate(version.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(version)}
                    disabled={isPending}
                    className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-bold text-foreground hover:bg-secondary disabled:opacity-40"
                  >
                    Restore
                  </button>
                </div>
                {restored && (
                  <p className="mt-2 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500">
                    Loaded. Save to make this the current plan.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatVersionDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
