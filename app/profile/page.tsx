import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getProfile } from "@/app/actions";
import ProfileForm from "./ProfileForm";

export const metadata = {
  title: "Profile Settings | Archy AI",
  description: "Manage your Archy AI account profile, name, and avatar.",
};

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getProfile();

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1">
            Profile Settings
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage your display name and avatar.
          </p>
        </div>

        <ProfileForm
          initialFullName={profile?.full_name ?? ""}
          initialAvatarUrl={profile?.avatar_url ?? null}
          email={profile?.email ?? ""}
          userId={user.id}
        />
      </div>
    </main>
  );
}
