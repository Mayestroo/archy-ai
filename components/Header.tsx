"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

interface HeaderUser {
  id?: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  } | null;
}

interface HeaderProps {
  user: HeaderUser | null;
  loading?: boolean;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/reviews", label: "Reviews" },
];

export default function Header({ user, loading = false }: HeaderProps) {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const [dropdownOpenPath, setDropdownOpenPath] = useState<string | null>(null);
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownOpen = dropdownOpenPath === currentPath;
  const mobileOpen = mobileOpenPath === currentPath;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpenPath(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Hide header completely in editor (full-screen tool)
  if (pathname?.startsWith("/editor")) return null;

  const initial =
    (user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || "U").toUpperCase();
  const avatar = user?.user_metadata?.avatar_url;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-[color:var(--nav-bg)] backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-6 h-[60px] flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-8">
          <Logo />

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Auth */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-secondary/50 animate-pulse" />
          ) : user ? (
            <>
              <Link
                href="/editor"
                className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-1.5 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity shadow-sm"
              >
                New Plan
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpenPath((openPath) => openPath === currentPath ? null : currentPath)}
                  className="w-8 h-8 rounded-full bg-[#5D5DFF] text-white text-xs font-bold flex items-center justify-center overflow-hidden shadow-md hover:opacity-90 transition-opacity"
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initial
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {user.user_metadata?.full_name || user.email}
                      </p>
                      {user.user_metadata?.full_name && user.email && (
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      )}
                    </div>
                    <div className="p-1.5">
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        Profile Settings
                      </Link>
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        My Plans
                      </Link>
                      <Link
                        href="/billing"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="6" width="20" height="12" rx="2" />
                          <path d="M2 10h20" />
                        </svg>
                        Billing
                      </Link>
                      <Link
                        href="/refer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Refer Friends
                      </Link>
                    </div>
                    <div className="p-1.5 border-t border-border">
                      <form action={logout}>
                        <button
                          type="submit"
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-950/30 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          Sign out
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-block text-[13px] font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-[13px] font-semibold px-4 py-1.5 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity shadow-sm"
              >
                Get started
              </Link>
            </>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpenPath((openPath) => openPath === currentPath ? null : currentPath)}
            className="md:hidden w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center"
            aria-label="Menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              ) : (
                <>
                  <path d="M3 6h18" strokeLinecap="round" />
                  <path d="M3 12h18" strokeLinecap="round" />
                  <path d="M3 18h18" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border bg-background px-6 py-3 flex flex-col gap-1">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  active ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
