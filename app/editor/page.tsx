"use client";

import ChatSidebar from "@/components/editor/ChatSidebar";
import PropertiesSidebar from "@/components/editor/PropertiesSidebar";
import type { FloorPlan } from "@/lib/floorplan-schema";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

export default function EditorPage() {
  const searchParams = useSearchParams();
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [prompt, setPrompt] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const generateRef = useRef(handleGenerate);

  useEffect(() => {
    generateRef.current = handleGenerate;
  });

  const planId = searchParams.get("planId");
  const initialPrompt = searchParams.get("prompt");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
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
            setFloorPlan(data.floor_plan_json as FloorPlan);
            setPrompt(data.prompt as string);
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

  async function handleGenerate(newPrompt: string) {
    if (!newPrompt.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: newPrompt.trim(),
          currentFloorPlan: floorPlan
        }),
      });

      const data = (await res.json()) as { floorPlan?: FloorPlan; error?: string };
      if (!res.ok) throw new Error(data.error || "Generation failed");
      if (!data.floorPlan) throw new Error("Generation failed");

      setFloorPlan(data.floorPlan);
      setPrompt(newPrompt);
      // Auto-switch to 2D view on new generation to show changes clearly
      setViewMode("2d");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col md:flex-row w-full h-100dvh overflow-hidden bg-background">

      {/* Left Sidebar: Chat/Wizard */}
      <ChatSidebar
        onGenerate={handleGenerate}
        loading={loading}
        error={error}
        currentPrompt={prompt}
        hasFloorPlan={!!floorPlan}
      />

      {/* Center Canvas Area */}
      <div className="flex-1 relative bg-neutral-50 dark:bg-[#0A0A0A] flex flex-col">
        {/* Canvas Header */}
        <div className="h-[60px] flex items-center justify-end px-4 border-b border-border shrink-0 bg-background z-10 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button className="px-3.5 py-1.5 rounded-full border border-border bg-card text-[13px] font-medium text-foreground flex items-center gap-1.5 hover:bg-secondary transition-colors shadow-sm">
              Export
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div className="flex items-center gap-1.5 text-muted-foreground text-[13px] font-medium mr-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01" /></svg>
              20 credits
            </div>
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

        <div className="flex-1 w-full h-full">
          {floorPlan ? (
            viewMode === "2d" ? (
              <FloorPlanCanvas floorPlan={floorPlan} />
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
      <PropertiesSidebar floorPlan={floorPlan} user={user} />

    </main>
  );
}
