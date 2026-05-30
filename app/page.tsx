"use client";

import { getPlatformStats, getRealUserAvatars } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PROMPT_EXAMPLES = [
  "A modern 3-bedroom villa with a rooftop pool...",
  "Open-plan office for 20 people with meeting rooms...",
  "Industrial style loft with high ceilings and brick walls...",
  "Cozy 1-bedroom apartment with a balcony and garden view...",
  "Luxury retail store layout with a minimalist aesthetic...",
];

export default function Home() {
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [stats, setStats] = useState<{ projects: number; users: number; avgRating: number } | null>(null);
  const [avatars, setAvatars] = useState<string[]>([]);

  useEffect(() => {
    getPlatformStats().then(data => {
      setStats({
        projects: data.projectCountSource,
        users: data.userCountSource,
        avgRating: data.avgRatingSource
      });
    });
    getRealUserAvatars().then(data => {
      setAvatars(data);
    });
  }, []);

  // Typing animation for placeholder
  const [placeholder, setPlaceholder] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentFullText = PROMPT_EXAMPLES[exampleIndex];
    const typingSpeed = isDeleting ? 40 : 80;
    const pauseTime = 2000;

    const timeout = setTimeout(() => {
      if (!isDeleting && charIndex < currentFullText.length) {
        setPlaceholder(currentFullText.substring(0, charIndex + 1));
        setCharIndex(prev => prev + 1);
      } else if (isDeleting && charIndex > 0) {
        setPlaceholder(currentFullText.substring(0, charIndex - 1));
        setCharIndex(prev => prev - 1);
      } else if (!isDeleting && charIndex === currentFullText.length) {
        setTimeout(() => setIsDeleting(true), pauseTime);
      } else if (isDeleting && charIndex === 0) {
        setIsDeleting(false);
        setExampleIndex(prev => (prev + 1) % PROMPT_EXAMPLES.length);
      }
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, exampleIndex]);

  const handleStartDesign = () => {
    if (!prompt.trim()) return;
    router.push(`/editor?prompt=${encodeURIComponent(prompt.trim())}`);
  };

  return (
    <main className="min-h-screen bg-background text-foreground font-sans flex flex-col relative w-full items-center">
      <div className="w-full max-w-[1400px] flex flex-col px-6 min-h-[70vh] flex-1 pt-4 pb-12 z-10">

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Platform Stats */}
          {stats && (stats.users > 0 || stats.projects > 0) && (
            <div className="flex flex-col items-center gap-3 mb-8 animate-in fade-in zoom-in-95 duration-1000 delay-300">
              <div className="flex items-center gap-4">
                {avatars.length > 0 && (
                  <>
                    <div className="flex -space-x-3">
                      {avatars.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={src} alt="User" className="w-8 h-8 rounded-full border-2 border-background object-crop shadow-sm" />
                      ))}
                    </div>
                    <div className="h-4 w-px bg-[#4a4a4a] mx-1" />
                  </>
                )}
                <div className="flex items-center gap-1.5">
                  <div className="flex text-amber-500 dark:text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={i < Math.floor(stats.avgRating) ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-[13px] font-bold text-foreground/80">{stats.avgRating.toFixed(1)}</span>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground font-medium grayscale">
                Joined <span className="text-foreground font-bold">{stats.users.toLocaleString()}</span> builders · <span className="text-foreground font-bold">{stats.projects.toLocaleString()}</span> projects created
              </p>
            </div>
          )}

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            <span className="text-foreground">Design smarter,</span><br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-muted-foreground to-neutral-500">build faster.</span>
          </h1>

          <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6 leading-relaxed font-medium">
            Turn plain text into professional 2D blueprints and interactive 3D layouts in seconds.
            Archy AI bridges the gap between imagination and architecture.
          </p>
        </div>

        {/* Input Card Container */}
        <div className="w-full max-w-3xl mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] scale-100">
          <div className="bg-card border border-border rounded-2xl shadow-2xl focus-within:ring-1 focus-within:ring-border focus-within:border-border transition-all duration-300 flex flex-col relative overflow-hidden">
            {/* Subtle top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-[#5D5DFF] to-transparent opacity-50"></div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent px-5 pt-5 pb-3 min-h-[100px] text-foreground placeholder-muted-foreground/60 focus:outline-none resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleStartDesign();
                }
              }}
            />

            <div className="flex items-center justify-between px-6 pb-5 pt-3 mt-auto bg-background/50 border-t border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium select-none">
                Press <kbd className="bg-secondary border border-border text-foreground px-2 py-0.5 rounded font-sans text-xs shadow-sm">Enter ↵</kbd> to start
              </div>

              <button
                onClick={handleStartDesign}
                disabled={!prompt.trim()}
                className="w-auto px-5 h-10 rounded-full flex items-center justify-center gap-2 bg-foreground text-background hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground transition-all duration-200 shadow-lg font-semibold text-sm"
              >
                Start Designing
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Prompt Templates */}
          <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-300 fill-mode-both">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Try starting with</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-muted-foreground text-xs font-medium">
              <button onClick={() => setPrompt("Modern House with 4 bedrooms, pool, and open plan design")} className="flex items-center gap-1.5 bg-card hover:bg-secondary border border-border hover:text-foreground px-3 py-1.5 rounded-full transition-colors font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                Modern House
              </button>
              <button onClick={() => setPrompt("Spacious Office Space with open layout and 3 meeting rooms")} className="flex items-center gap-1.5 bg-card hover:bg-secondary border border-border hover:text-foreground px-3 py-1.5 rounded-full transition-colors font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
                Office Space
              </button>
              <button onClick={() => setPrompt("Cozy Apartment with 1 bedroom and balcony")} className="flex items-center gap-1.5 bg-card hover:bg-secondary border border-border hover:text-foreground px-3 py-1.5 rounded-full transition-colors font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"></path><path d="M2 14v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M6 18v2"></path><path d="M18 18v2"></path><path d="M12 12v6"></path></svg>
                Cozy Apartment
              </button>
              <button onClick={() => setPrompt("Retail Store with displays and checkout area")} className="flex items-center gap-1.5 bg-card hover:bg-secondary border border-border hover:text-foreground px-3 py-1.5 rounded-full transition-colors font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                Retail Store
              </button>
              <button onClick={() => setPrompt("Small Cafe Layout with indoor seating")} className="flex items-center gap-1.5 bg-card hover:bg-secondary border border-border hover:text-foreground px-3 py-1.5 rounded-full transition-colors font-medium">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" y1="2" x2="6" y2="4"></line><line x1="10" y1="2" x2="10" y2="4"></line><line x1="14" y1="2" x2="14" y2="4"></line></svg>
                Boutique Cafe
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
