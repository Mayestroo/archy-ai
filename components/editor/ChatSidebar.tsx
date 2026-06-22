"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import {
  AREA_PRESETS,
  EXTRA_SUGGESTIONS,
  FLOOR_OPTIONS,
  WIZARD_STEPS,
  compileWizardPrompt,
  formatArea,
  formatRoomSummary,
  formatShapeAnswer,
  getWizardIntro,
  getWizardStepPrompt,
  type WizardAnswers,
  type WizardModal,
  type WizardPhase,
  type WizardStep,
} from "@/lib/editor-onboarding";
import { getStarterTemplateSet, type StarterTemplateSet } from "@/lib/starter-templates";
import type { UserType } from "@/lib/user-types";

interface ChatSidebarProps {
  onGenerate: (prompt: string) => void;
  loading: boolean;
  error: string | null;
  currentPrompt: string;
  hasFloorPlan: boolean;
  generationNotes?: string[];
  userType?: UserType | null;
  wizardPhase: WizardPhase;
  wizardStep: WizardStep;
  wizardAnswers: WizardAnswers;
  onWizardAnswer: (step: WizardStep, value: Partial<WizardAnswers>) => void;
  onWizardNext: () => void;
  onOpenModal: (modal: WizardModal) => void;
  onWizardGenerate: () => void;
  onStartNewPlan: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "Add another bedroom",
  "Make the kitchen larger",
  "Add a balcony off the living room",
  "Convert one bedroom into an office",
];

export default function ChatSidebar({
  onGenerate,
  loading,
  error,
  currentPrompt,
  hasFloorPlan,
  generationNotes,
  userType,
  wizardPhase,
  wizardStep,
  wizardAnswers,
  onWizardAnswer,
  onWizardNext,
  onOpenModal,
  onWizardGenerate,
  onStartNewPlan,
}: ChatSidebarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [extrasInput, setExtrasInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const generationNotesText = generationNotes?.filter(Boolean).join(" ") ?? "";
  const starterSet = getStarterTemplateSet(userType);

  useEffect(() => {
    if (!currentPrompt) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMessages((prev) => {
        if (prev.length && prev[prev.length - 1].role === "user" && prev[prev.length - 1].content === currentPrompt) {
          return prev;
        }
        const last = prev[prev.length - 1];
        if (last?.role === "user" && last.content === currentPrompt) return prev;
        return [...prev, { role: "user", content: currentPrompt }];
      });
    });
    return () => { cancelled = true; };
  }, [currentPrompt]);

  useEffect(() => {
    if (loading || !hasFloorPlan || !currentPrompt) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev;
        const content = generationNotesText
          ? `Done. ${generationNotesText} Tell me what to change next.`
          : "Done. Your plan is on the canvas. Tell me what to change next.";
        return [...prev, { role: "assistant", content }];
      });
    });
    return () => { cancelled = true; };
  }, [loading, hasFloorPlan, currentPrompt, generationNotesText]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, wizardPhase, wizardStep, wizardAnswers]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onGenerate(trimmed);
    setInput("");
  }

  function handleChooseFloor(value: string) {
    onWizardAnswer("floors", { floors: Number(value) });
  }

  function handleChooseArea(value: number, unit: "sqm" | "sqft") {
    onWizardAnswer("area", { area: { value, unit } });
  }

  function handlePickSuggestion(suggestion: string) {
    const current = wizardAnswers.extras ?? [];
    onWizardAnswer("extras", { extras: [...current, suggestion] });
  }

  function handleExtrasNext() {
    const text = extrasInput.trim();
    if (text) {
      const current = wizardAnswers.extras ?? [];
      onWizardAnswer("extras", { extras: [...current, text] });
    } else {
      onWizardNext();
    }
    setExtrasInput("");
  }

  function renderWizardBubble(key: string, role: "user" | "assistant", text: string) {
    return (
      <div key={key} className={`flex ${role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-1 duration-300`}>
        <div
          className={`max-w-[85%] text-sm px-3.5 py-2.5 rounded-2xl leading-relaxed ${
            role === "user"
              ? "bg-foreground text-background rounded-br-sm"
              : "bg-secondary text-foreground rounded-bl-sm border border-border"
          }`}
        >
          {text}
        </div>
      </div>
    );
  }

  function renderWizardControls() {
    switch (wizardStep) {
      case "floors":
        return (
          <div className="flex flex-wrap gap-1.5">
            {FLOOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => !opt.locked && handleChooseFloor(opt.value)}
                disabled={!!opt.locked}
                title={opt.locked ? opt.lockLabel : ""}
                className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-secondary hover:bg-muted border border-border text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
        );

      case "area":
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {AREA_PRESETS.map((preset) => (
                <button
                  key={`${preset.value}-${preset.unit}`}
                  onClick={() => handleChooseArea(preset.value, preset.unit)}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-secondary hover:bg-muted border border-border text-foreground transition-colors"
                >
                  {preset.value} {preset.unit}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="number"
                placeholder="Custom sqm..."
                className="flex-1 min-w-0 bg-background border border-border rounded-full px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-border"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = Number((e.target as HTMLInputElement).value);
                    if (val > 0) handleChooseArea(val, "sqm");
                  }
                }}
              />
            </div>
          </div>
        );

      case "shape":
        return (
          <button
            onClick={() => onOpenModal("shape")}
            className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-[#5D5DFF]/10 text-[#5D5DFF] border border-[#5D5DFF]/30 hover:bg-[#5D5DFF]/20 transition-colors"
          >
            Choose floor plan shape
          </button>
        );

      case "rooms":
        return (
          <button
            onClick={() => onOpenModal("rooms")}
            className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-[#5D5DFF]/10 text-[#5D5DFF] border border-[#5D5DFF]/30 hover:bg-[#5D5DFF]/20 transition-colors"
          >
            Choose preferred rooms
          </button>
        );

      case "extras":
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {EXTRA_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handlePickSuggestion(suggestion)}
                  className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-secondary hover:bg-muted border border-border text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={extrasInput}
                onChange={(e) => setExtrasInput(e.target.value)}
                placeholder="Or type your own..."
                className="flex-1 min-w-0 bg-background border border-border rounded-full px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-border"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleExtrasNext();
                  }
                }}
              />
              <button
                onClick={handleExtrasNext}
                className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
              >
                {extrasInput.trim() || wizardAnswers.extras?.length ? "Next" : "Skip"}
              </button>
            </div>
          </div>
        );

      case "review": {
        const compiled = compileWizardPrompt(wizardAnswers, userType);
        return (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Your brief</p>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{compiled}</p>
            </div>
            <button
              onClick={onWizardGenerate}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {loading ? "Generating..." : "Generate my floor plan"}
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  }

  function renderWizardStepSummary(step: WizardStep): string {
    switch (step) {
      case "floors":
        return wizardAnswers.floors ? `${wizardAnswers.floors} floor${wizardAnswers.floors === 1 ? "" : "s"}` : "";
      case "area":
        return wizardAnswers.area ? formatArea(wizardAnswers.area) : "";
      case "shape":
        return wizardAnswers.shape ? formatShapeAnswer(wizardAnswers.shape) : "";
      case "rooms":
        return wizardAnswers.rooms ? formatRoomSummary(wizardAnswers.rooms) : "";
      case "extras": {
        const extras = [wizardAnswers.extraNote, ...(wizardAnswers.extras ?? [])].filter(Boolean);
        return extras.length ? extras.join("; ") : "None";
      }
      case "review":
        return "";
      default:
        return "";
    }
  }

  function renderWizardFlow() {
    const currentIdx = WIZARD_STEPS.indexOf(wizardStep);
    const completedSteps = WIZARD_STEPS.slice(0, currentIdx);

    const elements: React.ReactNode[] = [];
    elements.push(renderWizardBubble("intro", "assistant", getWizardIntro(userType)));

    completedSteps.forEach((step) => {
      elements.push(renderWizardBubble(`${step}-prompt`, "assistant", getWizardStepPrompt(step, userType)));
      const summary = renderWizardStepSummary(step);
      if (summary) {
        elements.push(renderWizardBubble(`${step}-summary`, "user", summary));
      }
    });

    elements.push(renderWizardBubble(`${wizardStep}-current-prompt`, "assistant", getWizardStepPrompt(wizardStep, userType)));

    if (wizardStep === "review" || wizardStep === "extras") {
      elements.push(
        <div key="controls" className="flex justify-start">
          <div className="max-w-[85%]">{renderWizardControls()}</div>
        </div>,
      );
    } else {
      elements.push(
        <div key="controls" className="flex justify-start">
          <div className="max-w-[85%]">{renderWizardControls()}</div>
        </div>,
      );
    }

    return elements;
  }

  if (wizardPhase !== "refining" && !hasFloorPlan) {
    return (
      <aside className="w-full md:w-[340px] shrink-0 border-r border-border bg-background flex flex-col h-full">
        <div className="h-[60px] px-4 border-b border-border flex items-center justify-between shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" href="" />
          </Link>
          <Link
            href="/dashboard"
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md hover:bg-secondary transition-colors"
          >
            My plans
          </Link>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {renderWizardFlow()}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary border border-border rounded-2xl rounded-bl-sm px-3.5 py-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2.5 bg-red-950/30 border border-red-900/30 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full md:w-[340px] shrink-0 border-r border-border bg-background flex flex-col h-full">
      <div className="h-[60px] px-4 border-b border-border flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="sm" href="" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={onStartNewPlan}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md hover:bg-secondary transition-colors"
          >
            New plan
          </button>
          <Link
            href="/dashboard"
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md hover:bg-secondary transition-colors"
          >
            My plans
          </Link>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center pt-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-secondary flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">Describe your space</p>
            <p className="text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
              Tell Archy AI what you want to build — number of bedrooms, style, special rooms, etc.
            </p>
          </div>
        )}

        {!hasFloorPlan && !loading && (
          <StarterBriefs starterSet={starterSet} onGenerate={onGenerate} />
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-1 duration-300`}
          >
            <div
              className={`max-w-[85%] text-sm px-3.5 py-2.5 rounded-2xl leading-relaxed ${
                msg.role === "user"
                  ? "bg-foreground text-background rounded-br-sm"
                  : "bg-secondary text-foreground rounded-bl-sm border border-border"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {hasFloorPlan && !loading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
          <div className="flex flex-wrap gap-1.5 justify-start">
            <button
              onClick={() => onOpenModal("style")}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-[#5D5DFF]/10 text-[#5D5DFF] border border-[#5D5DFF]/30 hover:bg-[#5D5DFF]/20 transition-colors"
            >
              Choose style
            </button>
            <button
              onClick={() => onOpenModal("finish")}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
            >
              Choose finishes
            </button>
            <button
              onClick={() => onOpenModal("furniture")}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              Browse furniture
            </button>
            <button
              onClick={() => onOpenModal("render")}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
            >
              Render scene
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-secondary border border-border rounded-2xl rounded-bl-sm px-3.5 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}

        {error && (
          <div className="px-3 py-2.5 bg-red-950/30 border border-red-900/30 text-red-400 text-xs rounded-xl">
            {error}
          </div>
        )}
      </div>

      {hasFloorPlan && !loading && (
        <div className="px-4 pb-3 shrink-0">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Quick edits</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => onGenerate(p)}
                className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-secondary hover:bg-muted border border-border text-foreground transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 border-t border-border shrink-0 bg-card">
        <div className="bg-background border border-border rounded-2xl focus-within:ring-1 focus-within:ring-border transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={hasFloorPlan ? "Refine your plan..." : "Describe your floor plan..."}
            rows={2}
            className="w-full bg-transparent px-3.5 pt-3 pb-1 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none resize-none"
            disabled={loading}
          />
          <div className="flex items-center justify-between px-2.5 pb-2">
            <p className="text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-[10px]">↵</kbd> to send
            </p>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-3.5 h-8 rounded-full bg-foreground text-background text-xs font-semibold flex items-center gap-1 hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground transition-all"
            >
              {loading ? "..." : "Send"}
              {!loading && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}

function StarterBriefs({
  starterSet,
  onGenerate,
}: {
  starterSet: StarterTemplateSet;
  onGenerate: (prompt: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
        {starterSet.eyebrow}
      </p>
      <p className="text-sm font-bold text-foreground">{starterSet.title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed mt-1 mb-3">
        {starterSet.description}
      </p>
      <div className="grid gap-2">
        {starterSet.templates.map((template) => (
          <button
            key={template.title}
            type="button"
            onClick={() => onGenerate(template.prompt)}
            className="text-left rounded-xl border border-border bg-background px-3 py-2.5 hover:border-[#5D5DFF]/70 hover:bg-[#5D5DFF]/5 transition-colors group"
          >
            <span className="block text-xs font-bold text-foreground group-hover:text-[#5D5DFF] transition-colors">
              {template.title}
            </span>
            <span className="block text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              {template.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
