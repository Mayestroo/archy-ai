"use client";

import { FLOOR_PLAN_EXPORT_QUALITIES, FLOOR_PLAN_EXPORT_TEMPLATES, exportFloorPlanPDF, exportFloorPlanPNG, type FloorPlanExportQuality, type FloorPlanExportTemplate } from "@/lib/floorplan-export";
import type { FloorPlan } from "@/lib/floorplan-schema";
import { ensureFurniture } from "@/lib/furniture";
import { ensureMaterials } from "@/lib/materials";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

const FloorPlanCanvas = dynamic(() => import("@/components/FloorPlanCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Loading shared preview...
    </div>
  ),
});

interface SharedPlanClientProps {
  title: string;
  floorPlan: FloorPlan;
  createdAt: string;
  sharedAt: string | null;
}

export default function SharedPlanClient({ title, floorPlan, createdAt, sharedAt }: SharedPlanClientProps) {
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);
  const [exportTemplate, setExportTemplate] = useState<FloorPlanExportTemplate>("presentation");
  const [exportQuality, setExportQuality] = useState<FloorPlanExportQuality>("standard");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const displayFloorPlan = useMemo(() => ensureFurniture(ensureMaterials(floorPlan)), [floorPlan]);
  const stats = getPlanStats(displayFloorPlan);
  const createdDate = formatDate(createdAt);
  const sharedDate = sharedAt ? formatDate(sharedAt) : null;

  async function handleExport(format: "pdf" | "png") {
    if (exporting) return;
    setExporting(format);
    setError(null);
    try {
      if (format === "pdf") {
        await exportFloorPlanPDF(displayFloorPlan, { title, template: exportTemplate, quality: exportQuality });
      } else {
        exportFloorPlanPNG(displayFloorPlan, { title, template: exportTemplate, quality: exportQuality });
      }
    } catch (err: unknown) {
      setError(`Export failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setExporting(null);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#07080d] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(93,93,255,0.35),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.18),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="relative mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-6 py-10 md:flex-row md:items-end md:justify-between md:py-14">
          <div className="max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                Shared client preview
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                Read-only
              </span>
            </div>
            <h1 className="text-balance text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
              {title || "Archy AI Floor Plan"}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/62 md:text-base">
              Review the plan, check dimensions, and export a client-ready PDF or PNG. This public link does not allow editing.
            </p>
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-2 rounded-3xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/40 backdrop-blur">
            <Metric label="Rooms" value={`${displayFloorPlan.rooms.length}`} />
            <Metric label="Area" value={`${displayFloorPlan.totalArea || stats.area} m²`} />
            <Metric label="Beds" value={`${stats.beds}`} />
            <Metric label="Baths" value={`${stats.baths}`} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1400px] gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/35">
          <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Blueprint preview</p>
              <p className="mt-1 text-sm font-semibold text-white/80">1 grid square equals 1 metre</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">
                <span className="text-white/55">Template</span>
                <select
                  value={exportTemplate}
                  onChange={(event) => setExportTemplate(event.target.value as FloorPlanExportTemplate)}
                  disabled={!!exporting}
                  className="bg-transparent text-xs font-black text-white outline-none disabled:opacity-50 [&_option]:bg-[#07080d] [&_option]:text-white"
                >
                  {FLOOR_PLAN_EXPORT_TEMPLATES.map((template) => (
                    <option key={template.value} value={template.value}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">
                <span className="text-white/55">Quality</span>
                <select
                  value={exportQuality}
                  onChange={(event) => setExportQuality(event.target.value as FloorPlanExportQuality)}
                  disabled={!!exporting}
                  className="bg-transparent text-xs font-black text-white outline-none disabled:opacity-50 [&_option]:bg-[#07080d] [&_option]:text-white"
                >
                  {FLOOR_PLAN_EXPORT_QUALITIES.map((quality) => (
                    <option key={quality.value} value={quality.value}>
                      {quality.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleExport("pdf")}
                disabled={!!exporting}
                className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#07080d] hover:bg-white/90 disabled:opacity-50"
              >
                {exporting === "pdf" ? "Exporting..." : "Export PDF"}
              </button>
              <button
                type="button"
                onClick={() => void handleExport("png")}
                disabled={!!exporting}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15 disabled:opacity-50"
              >
                {exporting === "png" ? "Exporting..." : "Export PNG"}
              </button>
            </div>
          </div>
          <div className="h-[520px] bg-neutral-100 md:h-[680px]">
            <FloorPlanCanvas floorPlan={displayFloorPlan} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/25">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Project info</p>
            <div className="mt-4 space-y-3 text-sm">
              <InfoRow label="Created" value={createdDate} />
              <InfoRow label="Shared" value={sharedDate ?? "Active"} />
              <InfoRow label="Doors" value={`${displayFloorPlan.doors?.length ?? 0}`} />
              <InfoRow label="Windows" value={`${displayFloorPlan.windows?.length ?? 0}`} />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/25">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Room schedule</p>
            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {displayFloorPlan.rooms.map((room) => (
                <div key={room.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{room.label}</p>
                    <p className="mt-0.5 text-[10px] capitalize text-white/45">{room.type.replace(/_/g, " ")}</p>
                  </div>
                  <span className="shrink-0 text-xs font-black text-white/70">
                    {Math.round((room.width * room.height) / 2500)} m²
                  </span>
                </div>
              ))}
            </div>
          </div>

          {displayFloorPlan.exteriorConcept && (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/25">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Facade concept</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black text-white">{displayFloorPlan.exteriorConcept.title}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{displayFloorPlan.exteriorConcept.styleLabel}</p>
                <p className="mt-2 text-xs leading-5 text-white/58">{displayFloorPlan.exteriorConcept.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {displayFloorPlan.exteriorConcept.palette.slice(0, 4).map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[9px] font-bold text-white/55">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!!displayFloorPlan.interiorConcepts?.length && (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/25">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">Interior concepts</p>
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {displayFloorPlan.interiorConcepts.map((concept) => (
                  <div key={concept.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-black text-white">{concept.title}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{concept.styleLabel}</p>
                    <p className="mt-2 text-xs leading-5 text-white/58">{concept.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {concept.palette.slice(0, 4).map((item) => (
                        <span key={item} className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[9px] font-bold text-white/55">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/25">
            <p className="text-sm font-bold text-white">Share this preview</p>
            <p className="mt-1 text-xs leading-5 text-white/50">Anyone with this link can view and export this read-only concept plan.</p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-black text-white hover:bg-white/15"
            >
              {copyStatus === "copied" ? "Link copied" : "Copy current link"}
            </button>
            {copyStatus === "error" && <p className="mt-2 text-[10px] font-semibold text-red-300">Copy failed. Use the browser address bar.</p>}
          </div>

          <Link
            href="/"
            className="block rounded-[1.5rem] border border-white/10 bg-[#5D5DFF] p-5 text-white shadow-xl shadow-[#5D5DFF]/20 transition-transform hover:-translate-y-0.5"
          >
            <p className="text-sm font-black">Create your own floor plan</p>
            <p className="mt-1 text-xs leading-5 text-white/70">Generate and edit professional layouts with Archy AI.</p>
          </Link>
        </aside>
      </section>

      {error && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[min(520px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-red-400/25 bg-red-950 px-4 py-3 text-sm font-semibold text-red-100 shadow-2xl">
          {error}
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 last:border-0 last:pb-0">
      <span className="text-white/45">{label}</span>
      <span className="text-right font-bold text-white/80">{value}</span>
    </div>
  );
}

function getPlanStats(floorPlan: FloorPlan) {
  return {
    area: Math.round(floorPlan.rooms.reduce((sum, room) => sum + (room.width * room.height) / 2500, 0)),
    beds: floorPlan.rooms.filter((room) => room.type === "bedroom" || room.type === "master_bedroom").length,
    baths: floorPlan.rooms.filter((room) => room.type === "bathroom" || room.type === "ensuite").length,
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
