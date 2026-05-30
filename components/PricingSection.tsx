"use client";

import Link from "next/link";

const TIERS = [
  {
    name: "Free",
    badge: "Forever free",
    price: "$0",
    cadence: "/ month",
    description: "Everything you need to design your first project.",
    cta: { label: "Start designing", href: "/editor" },
    highlight: false,
    features: [
      "Unlimited floor plan generations",
      "2D blueprint canvas",
      "Interactive 3D preview",
      "PDF export",
      "Save up to 50 plans",
      "Community support",
    ],
  },
  {
    name: "Pro",
    badge: "Coming soon",
    price: "$19",
    cadence: "/ month",
    description: "Power-user tools for architects and small studios.",
    cta: { label: "Join waitlist", href: "/billing" },
    highlight: true,
    features: [
      "Priority AI generation queue",
      "Design credits for premium templates",
      "Team collaboration & sharing",
      "Custom branding on exports",
      "High-res render export",
      "Priority email support",
    ],
  },
  {
    name: "Studio",
    badge: "Custom",
    price: "Talk to us",
    cadence: "",
    description: "Volume pricing, SSO and dedicated support for teams.",
    cta: { label: "Contact sales", href: "mailto:hello@archyai.example" },
    highlight: false,
    features: [
      "Everything in Pro",
      "SSO / SAML",
      "Custom integrations",
      "Dedicated success manager",
      "SLA & security review",
      "Volume credits",
    ],
  },
];

export default function PricingSection() {
  return (
    <section className="w-full max-w-[1300px] px-6 py-20">
      {/* Header */}
      <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <p className="text-xs font-bold text-[#5D5DFF] uppercase tracking-[0.2em] mb-3">
          Pricing
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
          Simple, transparent pricing.
        </h1>
        <p className="text-muted-foreground text-base max-w-xl mx-auto">
          Start free. Upgrade when you need more power. No surprises.
        </p>
      </div>

      {/* Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-3xl border p-8 transition-all ${
              tier.highlight
                ? "bg-card border-[#5D5DFF]/40 shadow-2xl shadow-[#5D5DFF]/10"
                : "bg-card border-border hover:border-muted"
            }`}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#5D5DFF] text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-md">
                Most popular
              </div>
            )}

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">
                {tier.badge}
              </span>
            </div>

            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-4xl font-extrabold text-foreground tracking-tight">
                {tier.price}
              </span>
              {tier.cadence && (
                <span className="text-sm text-muted-foreground">{tier.cadence}</span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {tier.description}
            </p>

            <Link
              href={tier.cta.href}
              className={`w-full py-3 rounded-xl text-center text-sm font-semibold transition-all mb-8 ${
                tier.highlight
                  ? "bg-[#5D5DFF] text-white hover:bg-[#4B4BE5] shadow-lg shadow-[#5D5DFF]/30"
                  : "bg-foreground text-background hover:opacity-90"
              }`}
            >
              {tier.cta.label}
            </Link>

            <ul className="flex flex-col gap-3 mt-auto">
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={`mt-0.5 shrink-0 ${
                      tier.highlight ? "text-[#5D5DFF]" : "text-foreground"
                    }`}
                  >
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="leading-snug">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* FAQ-ish footer */}
      <div className="mt-16 text-center">
        <p className="text-sm text-muted-foreground">
          Have a question?{" "}
          <Link href="/about" className="text-foreground font-semibold hover:underline">
            Read more about Archy AI
          </Link>
        </p>
      </div>
    </section>
  );
}
