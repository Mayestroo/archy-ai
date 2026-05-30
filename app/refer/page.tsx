import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile } from "@/app/actions";
import CopyLinkButton from "./CopyLinkButton";

export const metadata = {
  title: "Refer Friends | Archy AI",
  description: "Invite friends to Archy AI and earn design credits together.",
};

export default async function ReferPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getProfile();
  const credits = profile?.credits ?? 0;

  const referralCode = `ARCHY-${user.id.slice(0, 8).toUpperCase()}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://archy.ai";
  const referralLink = `${siteUrl}/signup?ref=${user.id}`;

  return (
    <main className="flex-1 max-w-3xl mx-auto px-6 py-20 w-full">
      {/* Credits Balance Banner */}
      <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-6 py-4 mb-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5D5DFF]/10 border border-[#5D5DFF]/20 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5D5DFF" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Your design credits</p>
            <p className="text-2xl font-extrabold text-foreground tracking-tight">{credits} <span className="text-sm font-medium text-muted-foreground">credits</span></p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-right hidden sm:block">
          <p>Earn <span className="text-foreground font-bold">+10 credits</span> per referral</p>
          <p className="mt-0.5">Each new friend gets 10 too</p>
        </div>
      </div>

      <div className="bg-linear-to-br from-secondary/50 to-background rounded-[40px] p-12 border border-border text-center shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#5D5DFF]/10 blur-3xl rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full" />

        <div className="w-20 h-20 bg-background rounded-3xl flex items-center justify-center mx-auto mb-8 border border-border shadow-inner relative z-10">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        <h1 className="text-4xl font-extrabold mb-4 relative z-10">Refer your friends</h1>
        <p className="text-muted-foreground text-lg mb-10 max-w-md mx-auto relative z-10">
          Share Archy AI with your network and earn <span className="text-foreground font-bold">$10 in design credits</span> for every professional you invite.
        </p>

        <div className="flex flex-col gap-4 max-w-sm mx-auto relative z-10">
          <CopyLinkButton link={referralLink} />
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
            Your Code: <span className="text-foreground">{referralCode}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 relative z-10">
        {[
          { title: "Invite", desc: "Send your unique link to fellow builders.", icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6" },
          { title: "Join", desc: "They sign up and create their first plan.", icon: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M20 8v6 M23 11h-6" },
          { title: "Earn", desc: "You both get 10 design credits instantly.", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" }
        ].map((step, i) => (
          <div key={i} className="p-8 rounded-[32px] bg-card border border-border/60 text-center shadow-lg hover:border-border transition-colors group">
            <div className="w-12 h-12 rounded-2xl bg-[#5D5DFF]/10 border border-[#5D5DFF]/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-[#5D5DFF] transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5D5DFF" strokeWidth="1.5" className="group-hover:stroke-white transition-all">
                <path d={step.icon} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
