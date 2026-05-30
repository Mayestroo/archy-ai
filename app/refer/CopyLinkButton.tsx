"use client";

import { useState } from "react";

export default function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers that block clipboard
      const el = document.createElement("textarea");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="flex items-center gap-2 p-4 bg-background border border-border rounded-2xl shadow-sm">
      <input
        readOnly
        value={link}
        className="bg-transparent flex-1 text-[13px] font-mono outline-none text-muted-foreground truncate"
      />
      <button
        onClick={handleCopy}
        className={`shrink-0 text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 transition-all active:scale-95 ${
          copied
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            : "bg-foreground text-background"
        }`}
      >
        {copied ? "✓ Copied!" : "Copy"}
      </button>
    </div>
  );
}
