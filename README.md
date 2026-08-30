# UTOPIA — by AVION Productions

Landing page and pass-reservation flow for **UTOPIA**, a dry day party by AVION
Productions.

> **Sunday 27 September · 12:00 PM – 5:00 PM**
> Ouzo Club and Kitchen, Hyderabad · [Directions](https://maps.app.goo.gl/2RwwfkFsRRg3G3rJ6)
> Unlimited food, unlimited mocktails, zero alcohol.

Two passes: **Early Bird ₹1,249** and **VIP ₹1,549**.

## Stack

| Concern     | Choice                                                        |
| ----------- | ------------------------------------------------------------- |
| Framework   | Next.js (App Router) + React + TypeScript                     |
| Styling     | Tailwind CSS v4 (CSS-first `@theme` tokens)                    |
| Animation   | Framer Motion                                                 |
| Icons       | Lucide React (brand marks hand-drawn in `ui/SocialIcons.tsx`)  |
| Validation  | Zod, shared between the browser and the API routes            |
| Email       | Resend HTTP API or any SMTP server via Nodemailer             |
| Type        | Bodoni Moda (display), Space Grotesk (UI), JetBrains Mono      |

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build
npm start              # serve the production build
npm run lint           # eslint
npx tsc --noEmit       # type-check
```

No environment variables are needed to develop. Without mail credentials the
verification code is printed to the server console **and** shown in the
checkout modal, so the whole purchase flow is clickable out of the box.

## Setup from scratch

```bash
npx create-next-app@latest utopia --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --use-npm
cd utopia
npm install framer-motion lucide-react zod nodemailer
npm install -D @types/nodemailer
npm run dev
```

## Configuration

Copy `.env.example` to `.env.local`. Everything is optional in development;
`AUTH_SECRET` is **required** in production.

| Variable                            | Purpose                                              |
| ----------------------------------- | ---------------------------------------------------- |
| `AUTH_SECRET`                       | Signs verification tokens, hashes the 6-digit codes  |
| `RESEND_API_KEY`                    | Send mail through Resend                             |
| `SMTP_URL`                          | Send mail through any SMTP server instead            |
| `MAIL_FROM` / `MAIL_REPLY_TO`       | Sender identity                                      |
| `NEXT_PUBLIC_SITE_URL`              | Absolute URL for Open Graph images                   |

## The purchase flow

Five steps, `PASS → DETAILS → VERIFY → CONFIRM → DONE`:

1. **PASS** — pick a tier, set quantity (max 8), live subtotal.
2. **DETAILS** — name, email, phone. Validated by the same Zod schema the API
   uses, so client and server can never disagree about what's acceptable.
3. **VERIFY** — `POST /api/passes/verify` emails a 6-digit code. The six-box
   input supports paste, arrow keys, and backspace-across-boxes; a rejected
   code clears itself so retrying is just typing again.
4. **CONFIRM** — order review, 5% booking fee, dry-event acknowledgement.
5. **DONE** — reservation reference, hold countdown, confirmation email sent.

### API

| Route                            | Does                                                        |
| -------------------------------- | ----------------------------------------------------------- |
| `POST /api/passes/verify`        | Issues + emails a 6-digit code (45s resend cooldown)        |
| `POST /api/passes/verify/confirm`| Exchanges a correct code for a signed, 30-minute HMAC token |
| `POST /api/passes/reserve`       | Creates the reservation and emails the receipt              |

Hardening already in place:

- Codes are stored only as SHA-256 hashes salted with `AUTH_SECRET`, compared
  in constant time, expire after 10 minutes, and lock after 5 wrong attempts.
- Verification tokens are HMAC-signed and bound to the email address, so a
  reservation can't be created for an address that wasn't verified.
- **Prices are recomputed server-side** in `lib/pricing.ts` — a tampered client
  payload cannot change what gets charged.
- Fixed-window rate limits per IP on all three routes, plus a per-address send
  cap.

### Storage

`src/server/store.ts` is the only module that touches persistence: orders and
verifications live in memory and are mirrored to `.data/utopia.json`. Good for
local development and a single Node process; **replace it with a real database
before taking money.** It already exposes `listOrders()`, `getOrderByReference()`
and `countPassesSold()` for the admin panel.

### Not done yet

Payment gateway and admin panel. `CheckoutFlow` deliberately stops at
`status: "reserved"` — wire the gateway into `POST /api/passes/reserve`'s
response and flip the order to `paid` on webhook.

## Structure

```
src/
├── app/
│   ├── api/passes/…           # verify, verify/confirm, reserve
│   ├── globals.css            # design tokens, keyframes, glass/glow/film utils
│   ├── layout.tsx             # fonts + metadata
│   └── page.tsx               # composition root
├── components/
│   ├── BackgroundFX.tsx       # room tone: glows, grid, scanlines, grain
│   ├── Preloader.tsx          # loading sequence + shutter reveal
│   ├── Hero.tsx               # headline + the real poster
│   ├── StoryBand.tsx          # manifesto, teaser title card, AVION band
│   ├── EventInfo.tsx          # date/time/venue + maps link + countdown
│   ├── Countdown.tsx          # live countdown, rolling digits
│   ├── PassTiers.tsx          # tier grid
│   ├── PassCard.tsx           # 3D tilt + flip revealing everything included
│   ├── HouseRules.tsx         # the no-alcohol rules, expandable
│   ├── CheckoutModal.tsx      # the five-step flow
│   ├── Footer.tsx, Marquee.tsx, Navbar.tsx
│   └── ui/                    # Reveal/SplitText, NeonButton, brand glyphs
├── lib/
│   ├── event.ts               # every piece of event copy and the date logic
│   ├── passes.ts              # the two tiers, perks, pricing
│   ├── pricing.ts             # shared money maths
│   ├── validation.ts          # Zod schemas + error flattening
│   └── useNow.ts              # shared 1s clock (external store, SSR-safe)
└── server/
    ├── store.ts               # orders + verification codes + tokens
    ├── mailer.ts              # Resend / SMTP / dev console, with templates
    └── rate-limit.ts          # per-IP fixed window
```

## Editing content

Almost all copy lives in `src/lib/event.ts` and `src/lib/passes.ts` — names,
prices, perks, venue, maps link, policy lines. Section prose sits inline in its
own component so it reads in context rather than through a key.

The countdown targets the **next** 27 September at noon, so it stays live year
over year instead of freezing at zero.

## Media

`public/media/` is cut from the real AVION teaser and the released poster with
ffmpeg — letterboxing removed, and crops chosen so the video's own titles never
sit under our text. `poster.jpg` also has the Instagram share glyph patched out.

## Accessibility & motion

- Every animation respects `prefers-reduced-motion`.
- The modal is a labelled dialog with Escape-to-close, a Tab focus trap, and
  body scroll lock; it cannot be dismissed mid-request.
- Card flips, quantity steppers, tier selection and the rules accordion are all
  real buttons with `aria-pressed` / `aria-expanded` / `aria-label`.
