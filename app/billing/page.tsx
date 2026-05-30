import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Billing | Archy AI",
  description: "Manage your Archy AI subscription and billing.",
};

export default async function BillingPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="flex-1 max-w-4xl mx-auto px-6 py-20 w-full">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight">Billing &amp; Subscription</h1>
        <div className="px-4 py-1.5 bg-secondary text-muted-foreground text-xs font-bold rounded-full border border-border">
          Free Plan
        </div>
      </div>

      <div className="grid gap-8">
        {/* Current Plan */}
        <section className="p-10 rounded-[40px] bg-secondary/10 border border-border overflow-hidden relative">
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-[#5D5DFF]/5 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <h3 className="text-xl font-bold mb-2 text-foreground">Current Plan: Free</h3>
              <p className="text-muted-foreground text-sm">
                Unlimited floor plan generations · 2D &amp; 3D preview · PDF export
              </p>
            </div>
            <div className="shrink-0 px-8 py-3 bg-[#5D5DFF]/10 text-[#5D5DFF] font-bold rounded-full border border-[#5D5DFF]/20 text-sm">
              Free forever
            </div>
          </div>
        </section>

        {/* Pro — Coming Soon */}
        <section className="p-10 rounded-[40px] border border-dashed border-border bg-card relative overflow-hidden">
          <div className="absolute -left-20 -top-20 w-64 h-64 bg-[#5D5DFF]/5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-xl font-bold text-foreground">Pro Plan</h3>
              <span className="px-3 py-1 bg-[#5D5DFF]/10 text-[#5D5DFF] text-[11px] font-bold rounded-full border border-[#5D5DFF]/20 uppercase tracking-widest">
                Coming Soon
              </span>
            </div>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground mb-8">
              {[
                "Priority AI generation queue",
                "Design credits for advanced templates",
                "Team collaboration & sharing",
                "Custom branding on exports",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#5D5DFF] shrink-0">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mb-5">
              Join the waitlist — we&apos;ll notify you when Pro launches.
            </p>
            <WaitlistForm email={user.email ?? ""} />
          </div>
        </section>

        {/* Account Info */}
        <section className="p-8 rounded-[32px] bg-card border border-border">
          <h3 className="text-base font-bold mb-4 text-foreground">Account</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Member since {new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long" })}
              </p>
            </div>
            <Link
              href="/profile"
              className="text-xs font-semibold px-4 py-2 bg-secondary hover:bg-muted border border-border rounded-lg transition-colors"
            >
              Edit Profile
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

// Inline client component for waitlist form
import WaitlistFormClient from "./WaitlistForm";
const WaitlistForm = WaitlistFormClient;
