import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import PlansList from "@/components/PlansList";

export default async function PlansPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch plans for this user, newest first
  const { data: plans } = await supabase
    .from("floor_plans")
    .select("id, prompt, created_at, floor_plan_json")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-background text-foreground font-sans flex flex-col items-center">
      <PlansList initialPlans={plans || []} />
    </main>
  );
}
