"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Editor", href: "/editor" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Pricing", href: "/pricing" },
      { label: "Reviews", href: "/reviews" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Refer Friends", href: "/refer" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export default function Footer() {
  const pathname = usePathname();

  // Hide footer completely in editor (full-screen tool)
  if (pathname?.startsWith("/editor")) return null;

  return (
    <footer className="w-full border-t border-border bg-background mt-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
        {/* Brand */}
        <div className="col-span-2 flex flex-col gap-3">
          <Logo />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            Design smarter, build faster. Turn plain text into professional 2D blueprints and
            interactive 3D layouts in seconds.
          </p>
        </div>

        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {col.title}
            </p>
            <ul className="flex flex-col gap-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs font-medium text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Archy AI. All rights reserved.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Built with Next.js · Supabase · Gemini
          </p>
        </div>
      </div>
    </footer>
  );
}
