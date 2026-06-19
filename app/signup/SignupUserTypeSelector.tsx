"use client";

import { useState } from "react";
import { USER_TYPE_OPTIONS, type UserType } from "@/lib/user-types";

export default function SignupUserTypeSelector() {
  const [selectedUserType, setSelectedUserType] = useState<UserType | "">("");

  return (
    <>
      <div>
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
          What describes you best?
        </p>
        <div className="grid gap-2">
          {USER_TYPE_OPTIONS.map((option) => {
            const selected = selectedUserType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedUserType(option.value)}
                className={`w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
                  selected
                    ? "border-[#5D5DFF] bg-[#5D5DFF]/10 shadow-sm shadow-[#5D5DFF]/10"
                    : "border-border bg-background hover:border-muted-foreground/40 hover:bg-secondary/40"
                }`}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selected ? "border-[#5D5DFF] bg-[#5D5DFF]" : "border-border bg-card"
                    }`}
                    aria-hidden="true"
                  >
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-foreground">{option.label}</span>
                    <span className="block text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                      {option.description}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <input type="hidden" name="user_type" value={selectedUserType} />

      <button
        type="submit"
        disabled={!selectedUserType}
        className="w-full flex items-center justify-center gap-3 bg-secondary hover:bg-muted text-foreground font-semibold py-3 rounded-xl transition-all border border-border shadow-sm group text-[14px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-secondary"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" className="group-hover:scale-110 transition-transform">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </button>
    </>
  );
}
