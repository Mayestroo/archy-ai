import { signInWithGoogle } from "@/app/login/actions";
import Link from "next/link";
import SignupUserTypeSelector from "./SignupUserTypeSelector";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; ref?: string }>;
}) {
  const params = await searchParams;
  const refId = params.ref ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-[340px] flex flex-col items-center">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-5 h-5 rounded-full bg-[#5D5DFF] flex items-center justify-center text-white font-bold text-[11px] leading-none pt-0.5 shadow-md shadow-[#5D5DFF]/20">
            A
          </div>
          <span className="text-base font-bold text-foreground tracking-tight">Archy AI</span>
        </div>
        
        {/* Auth Card */}
        <div className="w-full bg-card border border-border p-7 rounded-2xl shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">Create Account</h1>
            <p className="text-muted-foreground text-[13px] font-medium">Start designing with Archy AI today</p>
          </div>

          <form action={signInWithGoogle} className="flex flex-col gap-6">
            {refId && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-semibold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                You were referred — you&apos;ll both get 10 free credits!
              </div>
            )}
            {refId && <input type="hidden" name="ref" value={refId} />}
            {params.error && (
              <div className="bg-red-950/20 border border-red-900/50 text-red-400 text-xs p-3 rounded-lg text-center font-medium">
                {params.error}
              </div>
            )}

            <SignupUserTypeSelector />

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-4 font-medium">
              By continuing, you agree to our <Link href="/terms" className="text-foreground hover:underline underline-offset-4">Terms of Service</Link> and <Link href="/privacy" className="text-foreground hover:underline underline-offset-4">Privacy Policy</Link>
            </p>

            <div className="pt-4 border-t border-border mt-2">
              <Link
                href="/login"
                className="block w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Already have an account? <span className="text-[#5D5DFF] hover:underline underline-offset-4">Log In</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
