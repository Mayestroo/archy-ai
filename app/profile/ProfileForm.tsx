"use client";

import { useState, useRef, useTransition } from "react";
import { updateProfile } from "@/app/actions";
import { createClient } from "@/utils/supabase/client";
import { logout } from "@/app/login/actions";

interface ProfileFormProps {
  initialFullName: string;
  initialAvatarUrl: string | null;
  email: string;
  userId: string;
}

export default function ProfileForm({
  initialFullName,
  initialAvatarUrl,
  email,
  userId,
}: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const supabase = createClient();

  const initial = (fullName || email).charAt(0).toUpperCase();

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setUploading(true);
    setErrorMsg(null);

    try {
      const ext = file.name.split(".").pop();
      const fileName = `avatar-${Date.now()}.${ext}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      setErrorMsg("Avatar upload failed: " + message);
      setAvatarPreview(initialAvatarUrl); // revert preview
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    setSaveStatus("saving");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await updateProfile(fullName.trim(), avatarUrl);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } catch (err: unknown) {
        setSaveStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to save profile.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar Card */}
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-6">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#5D5DFF] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-foreground">Profile photo</p>
          <p className="text-xs text-muted-foreground">JPG or PNG, max 5 MB</p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-1 text-xs font-semibold px-4 py-2 bg-secondary hover:bg-muted border border-border rounded-lg transition-colors w-fit"
          >
            {uploading ? "Uploading..." : "Change photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      {/* Fields Card */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-border transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Email
          </label>
          <input
            type="email"
            value={email}
            readOnly
            className="bg-secondary/40 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground cursor-not-allowed"
          />
          <p className="text-[11px] text-muted-foreground">Email cannot be changed here.</p>
        </div>

        {errorMsg && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/30 rounded-xl px-4 py-3">
            {errorMsg}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saveStatus === "saving" || isPending || uploading}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 shadow-sm
            ${saveStatus === "saved"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : saveStatus === "error"
              ? "bg-red-950/30 text-red-400 border border-red-900/30"
              : "bg-foreground text-background hover:opacity-90 disabled:opacity-50"
            }`}
        >
          {saveStatus === "saving" || isPending
            ? "Saving..."
            : saveStatus === "saved"
            ? "✓ Saved!"
            : saveStatus === "error"
            ? "Error — try again"
            : "Save Changes"}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-card border border-red-900/20 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">Danger Zone</h2>
        <p className="text-xs text-muted-foreground mb-4">
          This will sign you out of all sessions.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-red-950/30 hover:bg-red-950/50 text-red-400 border border-red-900/30 transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
