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

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Signs tokens, hashes OTPs and 12-word phrases, derives pass codes |
| `RESEND_API_KEY` | Send mail through Resend |
| `SMTP_URL` | Send mail through any SMTP server instead |
| `MAIL_FROM` / `MAIL_REPLY_TO` | Sender identity |
| `NEXT_PUBLIC_SITE_URL` | Absolute URL for Open Graph and pass QR links |
| `UPI_VPA` / `UPI_PAYEE_NAME` | Collect-request UPI ID shown in checkout |
| `CMS_PHRASE` / `DOOR_PHRASE` | 12 BIP39 English words (hashed in memory, never logged) |
| `CMS_PHRASE_HASH` / `DOOR_PHRASE_HASH` | Optional precomputed hashes instead of plaintext |

If `CMS_PHRASE` / `DOOR_PHRASE` are unset, `/admin` and `/door` use the
first-deploy hashes baked into `src/server/phrase.ts` (plaintext is not in git).
Set the env vars when you rotate.

## The purchase flow

Six steps, `PASS → DETAILS → VERIFY → CONFIRM → PAY → DONE`:

1. **PASS** — pick a tier, set quantity (max 8), live subtotal.
2. **DETAILS** — name, email, phone. Validated by the same Zod schema the API
   uses, so client and server can never disagree about what's acceptable.
3. **VERIFY** — `POST /api/passes/verify` emails a 6-digit code.
4. **CONFIRM** — order review, 5% booking fee, dry-event acknowledgement.
5. **PAY** — UPI QR + VPA + amount from **server** pricing. Optional UTR.
   Hitting "I've paid" does **not** issue a pass.
6. **DONE** — reservation held. An admin confirms the UPI credit in `/admin`.
   Approval emails the pass: name, 6-digit door code (HMAC of email+phone, not
   a substring), and a signed QR.

### Why this is not "all frontend"

The landing page is a Next.js client, but money, approval, and entry are not:

- Prices are recomputed in `lib/pricing.ts` on the server.
- Email OTPs are stored as hashes, compared in constant time.
- Checkout gets a purpose-tagged HMAC token; it cannot be replayed as CMS/door.
- UPI amount and VPA come from the reserve API. Approving a pass is
  `approveOrder()` on the server — the CMS button is a human stand-in for a
  payment-gateway webhook. When a real PG lands, point its webhook at that
  same function.
- Pass QR payloads are HMAC-signed. A screenshot of someone else's name +
  digits is not enough; the door panel verifies the signature.
- CMS (`/admin`) and door (`/door`) each unlock with a **different** 12-word
  phrase so scanner staff cannot approve payments. Header LOGIN is guest-only
  (email + 6-digit code) and never opens the CMS.

### API

| Route | Does |
| --- | --- |
| `POST /api/passes/verify` | Issues + emails a 6-digit code |
| `POST /api/passes/verify/confirm` | Exchanges a correct code for a signed token |
| `POST /api/passes/reserve` | Creates the reservation, returns UPI QR |
| `POST /api/passes/pay` | Records optional UTR; order stays `reserved` |
| `POST /api/account/login` | Guest: email a 6-digit login code |
| `POST /api/account/login/confirm` | Guest session cookie (buyer-session HMAC) |
| `GET /api/account/orders` | That guest's reservations only |
| `POST /api/admin/login` | 12-word CMS unlock → httpOnly cookie |
| `GET /api/admin/orders` | List + stats (CMS session) |
| `POST /api/admin/orders/:id/approve` | Marks paid, mints QR, emails pass |
| `POST /api/admin/orders/:id/reject` | Marks rejected, emails the buyer |
| `GET /api/admin/scans` | Door scan log |
| `POST /api/door/login` | 12-word door unlock |
| `POST /api/door/scan` | Verify QR/code, log it, email "you're in" on first entry |

### Storage

`src/server/store.ts` is the only persistence module: orders, OTPs, and scan
logs live in memory and are mirrored to `.data/utopia.json`. Fine for a single
Node process. **Vercel serverless has a read-only filesystem**, so this falls
back to in-process memory (lost on cold start). Point `store.ts` at Postgres
or Vercel KV before real ticket volume. The rest of the app already talks to
the store through functions, not files.

## Guest vs staff

- `/login` — guest email + 6-digit code (header LOGIN)
- `/account` — that guest's passes
- `/admin` — unlisted CMS. 12-word phrase if you're not staff
- `/admin/scans` — door scan log (CMS session)
- `/door` — 12-word door unlock, camera + 6-digit entry

## Structure

```
src/
├── app/
│   ├── account/               # guest pass list
│   ├── login/                 # guest email login
│   ├── admin/                 # CMS (phrase gate if locked)
│   ├── door/                  # QR verify panel
│   ├── api/account/…          # guest session + orders
│   ├── api/passes/…           # verify, reserve, pay
│   ├── api/admin/…            # phrase login, orders, scans
│   ├── api/door/…             # phrase login, scan
│   └── page.tsx
├── components/                # landing + checkout + PhraseUnlock
├── lib/                       # event, passes, pricing, validation
└── server/
    ├── store.ts               # orders + OTPs + scans + tokens
    ├── phrase.ts              # 12-word generate / hash / check
    ├── pass-code.ts           # 6-digit HMAC + QR
    ├── upi.ts                 # collect-request URI
    ├── mailer.ts
    └── rate-limit.ts
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
