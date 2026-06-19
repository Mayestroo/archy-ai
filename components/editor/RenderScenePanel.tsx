"use client";

import { useState } from "react";

export default function RenderScenePanel() {
  const [tab, setTab] = useState<"scene" | "renders">("scene");
  const [fov, setFov] = useState(75);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [prompt, setPrompt] = useState("");

  const aspectOptions = ["16:9", "4:3", "3:2", "1:1", "9:16"];

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
      {/* Tabs */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setTab("scene")}
          className={`flex-1 py-1.5 text-[10px] font-bold transition-colors ${
            tab === "scene"
              ? "bg-foreground text-background"
              : "bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          Scene
        </button>
        <button
          onClick={() => setTab("renders")}
          className={`flex-1 py-1.5 text-[10px] font-bold transition-colors ${
            tab === "renders"
              ? "bg-foreground text-background"
              : "bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          Renders
        </button>
      </div>

      {tab === "scene" && (
        <div className="space-y-3">
          {/* Preview area (stub) */}
          <div className="rounded-lg border border-dashed border-border bg-background/60 h-[120px] flex items-center justify-center">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-1 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-[10px] text-muted-foreground">Camera preview</p>
            </div>
          </div>

          {/* FOV slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Field of view
              </label>
              <span className="text-[10px] font-bold text-foreground">{fov}°</span>
            </div>
            <input
              type="range"
              min="30"
              max="120"
              value={fov}
              onChange={(e) => setFov(Number(e.target.value))}
              className="w-full accent-[#5D5DFF]"
            />
          </div>

          {/* Aspect ratio */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Aspect ratio
            </label>
            <div className="flex gap-1.5">
              {aspectOptions.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold border transition-colors ${
                    aspectRatio === ratio
                      ? "border-[#5D5DFF] bg-[#5D5DFF]/5 text-[#5D5DFF]"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Render prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the render style, lighting, mood..."
              rows={2}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[11px] text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-border resize-none"
            />
          </div>

          {/* Render button (stub) */}
          <button
            disabled
            className="w-full py-2 rounded-xl bg-foreground/30 text-background text-xs font-bold cursor-not-allowed"
            title="Image rendering will be available in a future update"
          >
            Render (coming soon)
          </button>
        </div>
      )}

      {tab === "renders" && (
        <div className="rounded-lg border border-dashed border-border bg-background/60 px-4 py-8 text-center">
          <p className="text-xs font-semibold text-foreground">No renders yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Generate a render from the Scene tab to see it here.
          </p>
        </div>
      )}
    </div>
  );
}
