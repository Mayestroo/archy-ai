import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import WriteReviewForm from "@/components/WriteReviewForm";
import Link from "next/link";

interface ReviewProfile {
  full_name: string | null;
  avatar_url: string | null;
}

interface ReviewRecord {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: ReviewProfile | null;
}

interface UserReview {
  id?: string;
  rating: number;
  comment: string;
}

export default async function ReviewsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Get current user for header and review submission
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch current user's review if logged in
  let userReview: UserReview | null = null;
  if (user) {
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(); // Use maybeSingle to avoid errors if no review exists
    userReview = data as UserReview | null;
  }

  // Fetch all reviews with profiles
  const { data: reviewsData, error } = await supabase
    .from("reviews")
    .select("*, profiles(full_name, avatar_url)")
    .order("created_at", { ascending: false });
  const reviews = (reviewsData ?? []) as ReviewRecord[];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-[1000px] w-full mx-auto px-6 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-4 text-foreground">Community Reviews</h1>
          <p className="text-muted-foreground text-lg mb-8">See what other builders are creating with Archy AI.</p>
          
          <div className="flex justify-center">
            {user ? (
              <WriteReviewForm existingReview={userReview} userAvatar={user.user_metadata.avatar_url} />
            ) : (
              <div className="p-4 bg-secondary/30 rounded-2xl border border-border inline-block">
                <p className="text-sm text-muted-foreground">
                  <Link href="/login" className="text-foreground font-bold hover:underline">Sign in</Link> to share your own feedback!
                </p>
              </div>
            )}
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center bg-secondary/30 rounded-2xl border border-border">
            <p className="text-destructive font-medium">Failed to load reviews. Please try again later.</p>
          </div>
        ) : reviews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((review) => (
              <div key={review.id} className="p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#0070F3] flex items-center justify-center text-white overflow-hidden">
                    {review.profiles?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={review.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold">{(review.profiles?.full_name || "U").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{review.profiles?.full_name || "Anonymous Builder"}</p>
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < review.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[14px] leading-relaxed text-muted-foreground italic">&quot;{review.comment}&quot;</p>
                <p className="text-[10px] text-muted-foreground/50 mt-4 uppercase tracking-wider">{new Date(review.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-secondary/10 rounded-2xl border border-border border-dashed">
            <p className="text-muted-foreground">No reviews yet. Be the first to share your experience!</p>
          </div>
        )}
      </main>
    </div>
  );
}
