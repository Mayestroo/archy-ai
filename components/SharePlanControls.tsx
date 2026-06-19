"use client";

import { createShareLink, revokeShareLink } from "@/app/actions";
import { useState, useTransition } from "react";

interface SharePlanControlsProps {
  planId?: string | null;
  initialShareToken?: string | null;
  initialShareEnabled?: boolean | null;
  variant?: "sidebar" | "card";
  onShareTokenChange?: (token: string | null) => void;
}

export default function SharePlanControls({
  planId,
  initialShareToken,
  initialShareEnabled,
  variant = "sidebar",
  onShareTokenChange,
}: SharePlanControlsProps) {
  const [shareToken, setShareToken] = useState(initialShareEnabled ? initialShareToken ?? null : null);
  const [status, setStatus] = useState<"idle" | "copied" | "created" | "revoked" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sharePath = shareToken ? `/share/${shareToken}` : null;
  const compact = variant === "card";

  function handleCreateLink() {
    if (!planId || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createShareLink(planId);
        setShareToken(result.token);
        onShareTokenChange?.(result.token);
        setStatus("created");
      } catch (err: unknown) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to create share link");
      }
    });
  }

  function handleRevokeLink() {
    if (!planId || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        await revokeShareLink(planId);
        setShareToken(null);
        onShareTokenChange?.(null);
        setStatus("revoked");
      } catch (err: unknown) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to revoke share link");
      }
    });
  }

  async function handleCopyLink() {
    if (!sharePath) return;
    try {
      await navigator.clipboard.writeText(new URL(sharePath, window.location.origin).toString());
      setStatus("copied");
      setError(null);
    } catch {
      setStatus("error");
      setError("Copy failed. Select and copy the link manually.");
    }
  }

  if (compact) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-background/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Client link</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {sharePath ?? "Not shared yet"}
            </p>
          </div>
          {shareToken ? (
            <button
              type="button"
              onClick={handleCopyLink}
              className="shrink-0 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[10px] font-bold text-foreground hover:bg-muted"
            >
              Copy
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreateLink}
              disabled={!planId || isPending}
              className="shrink-0 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[10px] font-bold text-foreground hover:bg-muted disabled:opacity-40"
            >
              {isPending ? "..." : "Share"}
            </button>
          )}
        </div>
        {shareToken && (
          <div className="mt-2 flex gap-1.5">
            <a
              href={sharePath ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-lg border border-border bg-secondary px-2 py-1.5 text-center text-[10px] font-bold text-foreground hover:bg-muted"
            >
              Open
            </a>
            <button
              type="button"
              onClick={handleCreateLink}
              disabled={isPending}
              className="rounded-lg border border-border bg-secondary px-2 py-1.5 text-[10px] font-bold text-foreground hover:bg-muted disabled:opacity-40"
            >
              Regen
            </button>
            <button
              type="button"
              onClick={handleRevokeLink}
              disabled={isPending}
              className="rounded-lg border border-red-500/25 bg-red-500/5 px-2 py-1.5 text-[10px] font-bold text-red-500 hover:bg-red-500/10 disabled:opacity-40"
            >
              Revoke
            </button>
          </div>
        )}
        <ShareStatus status={status} error={error} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Client preview</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {planId
              ? "Create a read-only link clients can open without signing in."
              : "Save this plan before creating a client preview link."}
          </p>
        </div>
        <span className={`mt-0.5 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${shareToken ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
          {shareToken ? "Live" : "Off"}
        </span>
      </div>

      {shareToken && (
        <div className="mt-3 rounded-lg border border-border bg-background px-2.5 py-2">
          <p className="truncate text-[11px] font-semibold text-foreground">
            {sharePath}
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {shareToken ? (
          <>
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background hover:opacity-90"
            >
              Copy link
            </button>
            <a
              href={sharePath ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border bg-background px-3 py-2 text-center text-xs font-bold text-foreground hover:bg-secondary"
            >
              Open
            </a>
            <button
              type="button"
              onClick={handleCreateLink}
              disabled={isPending}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40"
            >
              {isPending ? "Working..." : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={handleRevokeLink}
              disabled={isPending}
              className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 disabled:opacity-40"
            >
              Revoke
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleCreateLink}
            disabled={!planId || isPending}
            className="col-span-2 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background hover:opacity-90 disabled:opacity-40"
          >
            {isPending ? "Creating link..." : "Create share link"}
          </button>
        )}
      </div>
      <ShareStatus status={status} error={error} />
    </div>
  );
}

function ShareStatus({ status, error }: { status: string; error: string | null }) {
  if (error) {
    return <p className="mt-2 text-[10px] font-semibold text-red-500">{error}</p>;
  }
  if (status === "copied") return <p className="mt-2 text-[10px] font-semibold text-emerald-500">Link copied.</p>;
  if (status === "created") return <p className="mt-2 text-[10px] font-semibold text-emerald-500">Share link is live.</p>;
  if (status === "revoked") return <p className="mt-2 text-[10px] font-semibold text-muted-foreground">Share link revoked.</p>;
  return null;
}
