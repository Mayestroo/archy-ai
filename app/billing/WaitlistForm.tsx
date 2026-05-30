"use client";

import { useState } from "react";

export default function WaitlistForm({ email }: { email: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [value, setValue] = useState(email);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: wire to a real waitlist endpoint (e.g. Loops, Mailchimp, or a Supabase table)
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-5 py-3 rounded-xl text-sm font-semibold w-fit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        You&apos;re on the list! We&apos;ll be in touch.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 max-w-sm">
      <input
        type="email"
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#5D5DFF]/40 transition-all"
      />
      <button
        type="submit"
        className="shrink-0 px-5 py-2.5 bg-[#5D5DFF] hover:bg-[#4B4BE5] text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-[#5D5DFF]/20"
      >
        Join Waitlist
      </button>
    </form>
  );
}
