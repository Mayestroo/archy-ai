import { signInWithGoogle } from "@/app/login/actions";
import Link from "next/link";

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
            
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-secondary hover:bg-muted text-foreground font-semibold py-3 rounded-xl transition-all border border-border shadow-sm group text-[14px]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" className="group-hover:scale-110 transition-transform">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

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
