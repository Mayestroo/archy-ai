"use client";

import { useState, useTransition } from "react";
import { submitReview } from "@/app/actions";

interface ExistingReview {
  id?: string;
  rating: number;
  comment: string;
}

interface WriteReviewFormProps {
  existingReview?: ExistingReview | null;
  userAvatar?: string | null;
}

export default function WriteReviewForm({ existingReview, userAvatar }: WriteReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Please write a short comment.");
      return;
    }
    if (rating < 1 || rating > 5) {
      setError("Please pick a rating.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await submitReview(rating, comment.trim());
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setOpen(false);
          // refresh so the new review shows
          if (typeof window !== "undefined") window.location.reload();
        }, 1200);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to submit review.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-sm"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        {existingReview ? "Edit your review" : "Write a review"}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-lg text-left"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-[#5D5DFF] text-white text-sm font-bold flex items-center justify-center overflow-hidden shrink-0">
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            "U"
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {existingReview ? "Update your review" : "Share your experience"}
          </p>
          <p className="text-xs text-muted-foreground">It only takes a moment.</p>
        </div>
      </div>

      {/* Star picker */}
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = (hoverRating || rating) >= star;
          return (
            <button
              type="button"
              key={star}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110"
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill={active ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.8"
                className={active ? "text-amber-500" : "text-muted-foreground"}
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          );
        })}
        <span className="ml-2 text-xs text-muted-foreground">{rating} / 5</span>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tell other builders what you loved (or didn't)..."
        rows={4}
        maxLength={500}
        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#5D5DFF]/40 transition-all resize-none"
      />
      <p className="text-[10px] text-muted-foreground mt-1 text-right">
        {comment.length}/500
      </p>

      {error && (
        <p className="mt-2 text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 mt-5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-secondary hover:bg-muted border border-border transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || submitted}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            submitted
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
              : "bg-foreground text-background hover:opacity-90 disabled:opacity-50"
          }`}
        >
          {submitted
            ? "✓ Thanks for the feedback!"
            : isPending
            ? "Submitting..."
            : existingReview
            ? "Update review"
            : "Submit review"}
        </button>
      </div>
    </form>
  );
}
