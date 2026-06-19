"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { isUserType } from "@/lib/user-types";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirect("/login?error=Could not authenticate user");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  // By default Supabase with require email confirmations is on, 
  // but for local testing without SMTP it usually auto-confirms or needs 'confirm' param
  redirect("/?message=Account created successfully");
}

export async function signInWithGoogle(formData?: FormData) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  // Carry signup context through OAuth round-trip via the redirectTo query params.
  const refId = formData?.get("ref") as string | null;
  const userTypeValue = formData?.get("user_type") as string | null;
  const callbackUrl = new URL("/auth/callback", siteUrl);
  if (refId) callbackUrl.searchParams.set("ref", refId);
  if (isUserType(userTypeValue)) callbackUrl.searchParams.set("user_type", userTypeValue);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    console.error("Google Auth Error:", error);
    return redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function logout() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
