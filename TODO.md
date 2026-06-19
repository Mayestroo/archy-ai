# Project Tracking: Archy AI Platform

This file tracks the current state of development, implemented features, and pending tasks.

## 🏗️ Core Architecture
- [x] **Framework**: Next.js (App Router)
- [x] **Database**: Supabase (PostgreSQL)
- [x] **AI Engine**: Google Gemini API (with fallback models)
- [x] **Styling**: Tailwind CSS + shadcn/ui
- [x] **Auth**: Supabase Auth (Google OAuth)

## ✅ Implemented Features

### AI & Core
- [x] **AI Floor Plan Generation**: Two-stage pipeline (Gemini → Layout Engine)
- [x] **AI Room Specifications**: Per-room area, aspect ratio, zone, and adjacency hints for proportional scaling
- [x] **2D Blueprint Canvas** (`FloorPlanCanvas` — react-konva)
- [x] **3D Preview Engine** (`FloorPlan3D` — Three.js / R3F)
- [x] **PDF Export**: canvas → jsPDF download
- [x] **Plan Save / Delete**: Supabase CRUD with RLS

### Landing Page
- [x] **Hero section** with typing animation and quick-start templates
- [x] **Dynamic stats**: projects created, user count, avg rating (via `get_global_stats` RPC)
- [x] **Real user avatars** from `profiles` table (with fallback)
- [ ] **Reviews section**: removed from landing page per user request

### Auth & User
- [x] **Google OAuth** via Supabase
- [x] **Auth callback**: captures `?ref=` for referral credit tracking
- [x] **Signup page**: shows referral banner + hidden `ref` input when referred

### User Profile
- [x] **`/profile` page**: edit name, upload avatar (Supabase Storage)
- [x] **Avatar upload**: signed upload to `avatars` bucket, public URL saved to `profiles`
- [x] **`getProfile` / `updateProfile`** server actions (includes credits balance)

### Billing
- [x] **`/billing` page**: auth-gated, honest Free plan, Pro waitlist form
- [x] **Waitlist form** (`WaitlistForm.tsx`): ready to wire to Loops/Mailchimp

### Referral & Credits
- [x] **`/refer` page**: real link + code, live credits balance display
- [x] **Copy-to-clipboard** button (functional, with browser fallback)
- [x] **Credit system DB schema**: `credits` + `referred_by` columns on `profiles`
- [x] **DB trigger**: `handle_referral_signup()` awards 10 credits to both parties

### Content
- [x] **`/blog`**: 6 articles with featured layout, category badges, gradient cards
- [x] **`/blog/[slug]`**: individual article pages with full written content
- [x] **`/reviews`**: community reviews page with `WriteReviewForm`
- [x] **`/privacy`**: Privacy Policy (complete placeholder content)
- [x] **`/terms`**: Terms of Service (complete placeholder content)

### Bug Fixes
- [x] `lib/openai.ts`: removed top-level throw (lazy init)
- [x] Signup `Terms` / `Privacy` links: now point to real routes
- [x] `ProfileDropdown`: added "Profile Settings" link

## 🗄️ Database Migrations (run in Supabase SQL Editor)
```
supabase/migrations/20260430_avatars_storage.sql   ← avatars bucket + RLS
supabase/migrations/20260430_credits_system.sql    ← credits column + trigger
```

## 🚧 Remaining / Future Work
- [ ] **Stripe billing**: wire credits to real payment (Stripe)
- [ ] **Waitlist form**: connect to email provider (Loops / Mailchimp)
- [x] **Refinement loop**: dedicated `buildRefinementPrompt` — preserves unchanged rooms, explicit delta rules
- [x] **Material customisation**: room colours / finishes in 3D preview
- [x] **Render export**: high-res PNG / print-quality PDF
- [ ] **Blog CMS**: replace static posts with a headless CMS (Contentlayer / Sanity)

---
*Last updated: 2026-06-12*
