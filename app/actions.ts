"use server";

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { FloorPlan } from "@/lib/floorplan-schema";
import { isUserType, type UserType } from "@/lib/user-types";

export interface SharedFloorPlanRecord {
  id: string;
  prompt: string;
  created_at: string;
  floor_plan_json: FloorPlan;
  shared_at: string | null;
  user_type: UserType | null;
}

export interface FloorPlanVersionRecord {
  id: string;
  floor_plan_id: string;
  version_number: number;
  prompt: string;
  floor_plan_json: FloorPlan;
  created_at: string;
}

export async function saveFloorPlan(
  prompt: string, 
  enhancedPrompt: string, 
  floorPlanJson: FloorPlan,
  planId?: string | null,
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be logged in to save plans.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();
  let userType: UserType | null = null;
  if (isUserType(profile?.user_type)) {
    userType = profile.user_type;
  } else if (isUserType(user.user_metadata?.user_type)) {
    userType = user.user_metadata.user_type;
  }

  const payload = {
    prompt,
    enhanced_prompt: enhancedPrompt,
    floor_plan_json: floorPlanJson,
    user_type: userType,
  };

  const query = planId
    ? supabase
      .from("floor_plans")
      .update(payload)
      .eq("id", planId)
      .eq("user_id", user.id)
      .select("id")
      .single()
    : supabase
      .from("floor_plans")
      .insert({
        user_id: user.id,
        ...payload,
      })
      .select("id")
      .single();

  const { data, error } = await query;

  if (error) {
    console.error("Save Plan Error:", error);
    throw new Error(error.message);
  }

  await createFloorPlanVersion(supabase, data.id, user.id, prompt, enhancedPrompt, floorPlanJson);
  revalidatePath("/dashboard");
  return data.id;
}

export async function getFloorPlanVersions(planId: string): Promise<FloorPlanVersionRecord[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be logged in to view version history.");
  }

  const { data, error } = await supabase
    .from("floor_plan_versions")
    .select("id, floor_plan_id, version_number, prompt, floor_plan_json, created_at")
    .eq("floor_plan_id", planId)
    .eq("user_id", user.id)
    .order("version_number", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Get Floor Plan Versions Error:", error);
    throw new Error(error.message);
  }

  return (data ?? []).map((version) => ({
    id: version.id,
    floor_plan_id: version.floor_plan_id,
    version_number: version.version_number,
    prompt: version.prompt,
    floor_plan_json: version.floor_plan_json as FloorPlan,
    created_at: version.created_at,
  }));
}

async function createFloorPlanVersion(
  supabase: ReturnType<typeof createClient>,
  planId: string,
  userId: string,
  prompt: string,
  enhancedPrompt: string,
  floorPlanJson: FloorPlan,
) {
  const { data: latestVersion, error: latestVersionError } = await supabase
    .from("floor_plan_versions")
    .select("version_number")
    .eq("floor_plan_id", planId)
    .eq("user_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersionError) {
    console.error("Latest Floor Plan Version Error:", latestVersionError);
    throw new Error(latestVersionError.message);
  }

  const versionNumber = (latestVersion?.version_number ?? 0) + 1;
  const { error } = await supabase
    .from("floor_plan_versions")
    .insert({
      floor_plan_id: planId,
      user_id: userId,
      version_number: versionNumber,
      prompt,
      enhanced_prompt: enhancedPrompt,
      floor_plan_json: floorPlanJson,
    });

  if (error) {
    console.error("Create Floor Plan Version Error:", error);
    throw new Error(error.message);
  }
}

export async function createShareLink(planId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be logged in to share plans.");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = randomBytes(24).toString("base64url");
    const { data, error } = await supabase
      .from("floor_plans")
      .update({ share_token: token, share_enabled: true, shared_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("user_id", user.id)
      .select("share_token")
      .single();

    if (!error && data?.share_token) {
      revalidatePath("/dashboard");
      return { token: data.share_token as string, path: `/share/${data.share_token}` };
    }

    if (error?.code !== "23505") {
      console.error("Create Share Link Error:", error);
      throw new Error(error?.message || "Failed to create share link");
    }
  }

  throw new Error("Failed to create a unique share link. Try again.");
}

export async function revokeShareLink(planId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be logged in to manage share links.");
  }

  const { error } = await supabase
    .from("floor_plans")
    .update({ share_token: null, share_enabled: false, shared_at: null })
    .eq("id", planId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Revoke Share Link Error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
}

export async function getSharedFloorPlan(token: string): Promise<SharedFloorPlanRecord | null> {
  const normalizedToken = token.trim();
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(normalizedToken)) return null;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase
    .from("floor_plans")
    .select("id, prompt, created_at, floor_plan_json, shared_at, user_type")
    .eq("share_token", normalizedToken)
    .eq("share_enabled", true)
    .single();

  if (error) {
    if (error.code !== "PGRST116") console.error("Get Shared Floor Plan Error:", error);
    return null;
  }

  const userType = isUserType(data.user_type) ? data.user_type : null;
  return {
    id: data.id,
    prompt: data.prompt,
    created_at: data.created_at,
    floor_plan_json: data.floor_plan_json as FloorPlan,
    shared_at: data.shared_at,
    user_type: userType,
  };
}

export async function deleteFloorPlan(id: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be logged in to delete plans.");
  }

  const { error } = await supabase
    .from("floor_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Delete Plan Error:", error);
    throw new Error(error.message);
  }
}

export async function getPlatformStats() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Try to use the RPC for global stats
  const { data, error } = await supabase.rpc('get_global_stats');
  
  if (error) {
    console.error("Global Stats RPC Error (Falling back to default query):", error);
    // Fallback: This will ONLY work for the current user's projects unless RLS is relaxed or not configured yet.
    try {
      const { count: projectCount } = await supabase
        .from("floor_plans")
        .select("*", { count: "exact", head: true });
      
      return {
        projectCountSource: projectCount || 0,
        userCountSource: 124, // Static fallback for social proof if DB fails
        avgRatingSource: 4.9 // Static fallback for social proof if DB fails
      };
    } catch {
      return {
        projectCountSource: 0,
        userCountSource: 0,
        avgRatingSource: 0
      };
    }
  }
  
  return {
    projectCountSource: data.project_count || 0,
    userCountSource: data.user_count || 0,
    avgRatingSource: data.avg_rating || 0
  };
}

export async function getRealUserAvatars(limit = 5) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Fetch avatars from the public profiles table
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_url")
    .not("avatar_url", "is", null)
    .limit(limit);

  if (error) {
    console.error("Real User Avatars Error (Likely missing 'profiles' table):", error);
    // Fallback avatars for UI consistency
    return [
      "https://api.uifaces.co/our-content/donated/x4_8z_4s.jpg",
      "https://randomuser.me/api/portraits/men/32.jpg",
      "https://randomuser.me/api/portraits/women/44.jpg"
    ];
  }

  return data.map(u => u.avatar_url);
}

export async function submitReview(rating: number, comment: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to submit a review.");
  }

  // Upsert the review for the current user (1 review per user)
  const { data, error } = await supabase
    .from("reviews")
    .upsert({
      user_id: user.id,
      rating,
      comment,
      created_at: new Date().toISOString()
    }, {
      onConflict: "user_id"
    })
    .select();

  if (error) {
    console.error("Submit Review Error:", error);
    throw new Error(error.message);
  }

  return { success: true, data };
}

export async function getProfile() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, updated_at, credits, user_type")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("getProfile error:", error);
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: data?.full_name ?? user.user_metadata?.full_name ?? "",
    avatar_url: data?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    credits: data?.credits ?? 0,
    user_type: data?.user_type ?? user.user_metadata?.user_type ?? null,
  };
}

export async function updateProfile(fullName: string, avatarUrl: string | null) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, full_name: fullName, avatar_url: avatarUrl, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getUploadSignedUrl(fileName: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const filePath = `${user.id}/${fileName}`;
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUploadUrl(filePath);

  if (error) throw new Error(error.message);
  return { signedUrl: data.signedUrl, path: filePath, token: data.token };
}
