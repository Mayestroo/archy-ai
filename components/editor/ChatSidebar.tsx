"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";

interface ChatSidebarProps {
  onGenerate: (prompt: string) => void;
  loading: boolean;
  error: string | null;
  currentPrompt: string;
  hasFloorPlan: boolean;
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
}: ChatSidebarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track new prompts/responses as chat history
  useEffect(() => {
    if (!currentPrompt) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMessages((prev) => {
        if (prev.length && prev[prev.length - 1].role === "user" && prev[prev.length - 1].content === currentPrompt) {
          return prev;
        }
        // Only push if it's not already the last user message
        const last = prev[prev.length - 1];
        if (last?.role === "user" && last.content === currentPrompt) return prev;
        const filtered = [...prev];
        filtered.push({ role: "user", content: currentPrompt });
        return filtered;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [currentPrompt]);

  useEffect(() => {
    if (loading || !hasFloorPlan || !currentPrompt) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev;
        return [
          ...prev,
          { role: "assistant", content: "Done — your plan is on the canvas. Tell me what to change next." },
        ];
      });
    });

    return () => {
      cancelled = true;
    };
  }, [loading, hasFloorPlan, currentPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onGenerate(trimmed);
    setInput("");
  }

  return (
    <aside className="w-full md:w-[340px] shrink-0 border-r border-border bg-background flex flex-col h-full">
      {/* Header */}
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

      {/* Messages */}
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

      {/* Quick prompts */}
      {hasFloorPlan && !loading && (
        <div className="px-4 pb-3 shrink-0">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
            Quick edits
          </p>
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

      {/* Input */}
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
            placeholder={
              hasFloorPlan ? "Refine your plan..." : "Describe your floor plan..."
            }
            rows={2}
            className="w-full bg-transparent px-3.5 pt-3 pb-1 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none resize-none"
            disabled={loading}
          />
          <div className="flex items-center justify-between px-2.5 pb-2">
            <p className="text-[10px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded text-[10px]">↵</kbd>{" "}
              to send
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
