"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at, profiles(full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) setReviews(data as unknown as Review[]);
        setLoading(false);
      });
  }, []);

  // Don't render anything while loading or if no reviews yet
  if (loading || reviews.length === 0) return null;

  const avgRating =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section className="w-full py-24 bg-background border-t border-border">
      <div className="max-w-[1300px] mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <p className="text-xs font-bold text-[#4B4BE5] dark:text-[#5D5DFF] uppercase tracking-[0.2em] mb-3">
              Community
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Loved by builders
            </h2>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex text-amber-500 dark:text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={i < Math.round(avgRating) ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm font-bold text-foreground">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <Link
            href="/reviews"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 shrink-0"
          >
            View all reviews
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Review Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {reviews.map((review) => {
            const name = review.profiles?.full_name || "Anonymous Builder";
            const initial = name.charAt(0).toUpperCase();
            const avatarUrl = review.profiles?.avatar_url;

            return (
              <div
                key={review.id}
                className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 hover:border-muted transition-all hover:shadow-lg hover:shadow-black/5"
              >
                {/* Stars */}
                <div className="flex text-amber-500 dark:text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill={i < review.rating ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>

                {/* Comment */}
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 italic">
                  &ldquo;{review.comment}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <div className="w-8 h-8 rounded-full bg-[#5D5DFF] flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initial
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/reviews"
            className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 bg-secondary hover:bg-muted border border-border rounded-xl transition-colors"
          >
            Share your experience
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
