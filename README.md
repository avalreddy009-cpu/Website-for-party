# UTOPIA — by AVION Productions

A high-energy, animated landing page for **UTOPIA**, an underground day rave by
AVION Productions. September 27th, 12:00 PM – 5:00 PM.

Deep blacks, electric blue glows, stark white grunge typography, glassmorphism
overlays, and a surreal poster/mask motif drifting behind the type.

## Stack

| Concern       | Choice                                        |
| ------------- | --------------------------------------------- |
| Framework     | Next.js (App Router) + React + TypeScript     |
| Styling       | Tailwind CSS v4 (CSS-first `@theme` tokens)   |
| Animation     | Framer Motion                                 |
| Icons         | Lucide React (brand marks hand-drawn locally) |
| Type          | Anton (display), Space Grotesk, JetBrains Mono |

## Setup from scratch

If you are recreating this project in an empty directory, these are the exact
commands:

```bash
# 1. Scaffold the app (App Router + TypeScript + Tailwind + ESLint + src dir)
npx create-next-app@latest utopia-avion-landing \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm

cd utopia-avion-landing

# 2. Animation + icon packages
npm install framer-motion lucide-react

# 3. Run it
npm run dev            # http://localhost:3000
```

## Running this repo

```bash
npm install
npm run dev            # dev server on http://localhost:3000
npm run build          # production build
npm start              # serve the production build
npm run lint           # eslint
npx tsc --noEmit       # type-check
```

## Structure

```
src/
├── app/
│   ├── globals.css        # design tokens, keyframes, glass/glow/grain utilities
│   ├── layout.tsx         # fonts + metadata
│   └── page.tsx           # composition root: loader → hero → info → passes → footer
├── components/
│   ├── BackgroundFX.tsx   # ambient glows, mask parallax, grid, scanlines, grain
│   ├── MaskMotif.tsx      # the surreal poster mask (hand-authored SVG)
│   ├── Preloader.tsx      # custom loading sequence + shutter reveal
│   ├── Navbar.tsx         # scroll-triggered glass nav
│   ├── Hero.tsx           # grunge headline, chromatic ghost layers, magnetic CTA
│   ├── EventInfo.tsx      # date/time/venue dossier + countdown + venue teaser
│   ├── Countdown.tsx      # live countdown with rolling digits
│   ├── PassTiers.tsx      # tier grid
│   ├── PassCard.tsx       # 3D tilt + card flip revealing perks
│   ├── CheckoutModal.tsx  # 4-step checkout workflow
│   ├── Footer.tsx         # minimal underground footer
│   ├── Marquee.tsx        # seamless ticker strips
│   └── ui/                # Reveal/SplitText, NeonButton, brand glyphs
└── lib/
    ├── event.ts           # event copy, date resolution, price formatting
    ├── passes.ts          # pass tiers, perks, pricing, booking fee
    └── useNow.ts          # shared 1s clock (external store, hydration-safe)
```

## Editing the content

Everything user-facing lives in two files:

- `src/lib/event.ts` — name, host, tagline, date/time labels, venue teaser,
  contact and social links, plus `getEventDate()` and `formatPrice()`.
- `src/lib/passes.ts` — the three tiers, their perks, pricing, accent colours,
  and the booking fee rate.

The countdown targets the **next** 27 September at 12:00 local time, so the
timer stays live year over year instead of freezing at zero.

## Checkout workflow

`CheckoutModal` runs a four-step flow — **PASS → DETAILS → CONFIRM → DONE**:

1. **PASS** — switch tier, step the quantity (max 10), live subtotal.
2. **DETAILS** — name, email, phone with inline validation and shake-on-error.
3. **CONFIRM** — order review, subtotal + 7% booking fee, terms acknowledgement.
4. **DONE** — simulated payment round-trip, then a ticket stub with a generated
   order reference you can copy.

The flow is remounted per checkout session (keyed by `sessionId`), so each open
starts clean. Payment is stubbed in `CheckoutFlow.handleNext` — replace the
`setTimeout` with your payment provider call and post the order to your API.

## Accessibility & motion

- Every animation respects `prefers-reduced-motion`.
- The modal is a labelled dialog with Escape-to-close, a Tab focus trap, and
  body scroll lock.
- Card flips, quantity steppers, and tier selection are real buttons with
  `aria-pressed` / `aria-label` where needed.
