import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isUserType } from "@/lib/user-types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const refId = searchParams.get("ref"); // referral user ID passed from signup
  const userType = searchParams.get("user_type");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const metadata: Record<string, string> = {};
      if (refId) metadata.referred_by = refId;
      if (isUserType(userType)) metadata.user_type = userType;

      // Store signup context in auth metadata for future segmentation.
      if (Object.keys(metadata).length > 0) {
        await supabase.auth.updateUser({ data: metadata });
      }

      if (isUserType(userType)) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert(
              { id: user.id, user_type: userType, updated_at: new Date().toISOString() },
              { onConflict: "id" }
            );

          if (profileError) {
            console.error("Failed to save signup user type:", profileError.message);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication failed`);
}
