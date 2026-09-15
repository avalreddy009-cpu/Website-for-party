# BRAIN.md — context for the next AI

Read this before changing anything. This is the live UTOPIA site, not a demo.

**Human:** Meghanath, software engineer. Prefers working in code, not long plans.  
**Repo:** `avalreddy009-cpu/Website-for-party`  
**Live:** https://avionproductions.vercel.app  
**Default branch:** `main`. Ship there.

`README.md` is stale (still says Early Bird, a 5% fee, Resend-first mail, file-backed store). Trust this file and the code.

`AGENTS.md` is auto-injected Next.js 16 guidance. This app is Next.js **16.3.3** (App Router). Read `node_modules/next/dist/docs/` before using APIs your training data remembers.

---

## What this is

Landing + checkout + guest account + CMS + door scanner for **UTOPIA**, a dry day party by **AVION Productions**.

| | |
| --- | --- |
| When | Sunday 27 September, 12:00 PM – 5:00 PM |
| Where | Ouzo Club and Kitchen, Hyderabad |
| Policy | Zero substance: no alcohol, no vaping, no drugs. Pocket/bag checks. |
| Passes | **STANDARD** (id `"early"`) and **VIP** (id `"vip"`) |
| Default prices | ₹1,249 / ₹1,549 — CMS can change live prices in Redis |
| Contact | `avionproductions27@gmail.com` (`EVENT.email`) |
| Instagram | `https://www.instagram.com/avion.prod._/` |

Pass **IDs stay** `"early" | "vip"`. The cheap pass **display name is STANDARD**, not Early Bird.

---

## Do not regress

These were explicit product decisions. Do not “helpfully” put them back.

1. **No 5% booking fee.** `priceOrder` / `priceCart` keep `fee: 0`. Listed price is what they pay.
2. **No demo `test@` guest user** on the public site.
3. **No Redis warning on the public landing.** `StoreHealthBanner` is CMS (`/admin`) and door (`/door`) only.
4. **Instagram** is `https://www.instagram.com/avion.prod._/` — not the old `@avion.productions` URL.
5. **Public contact email** is `avionproductions27@gmail.com`. Footer, terms, login, MY PASSES, checkout, mail HTML/text, and default reply-to all follow `EVENT.email`.
6. **No Open Graph / Twitter card image.** Sharing the URL must stay a plain link (`src/app/layout.tsx`).
7. **Holds do not expire.** Unpaid `reserved` rows stay until staff **DROP HOLD**. `reopenTimedOutHolds()` turns old `expired` rows back to `reserved` on hydrate. Do not bring back a 30-minute expiry.
8. **Approve needs both** a 12-digit UTR **and** a screenshot (`missing-proof` otherwise). Proofs stay after approve/reject. **REMOVE** still deletes that order’s proof.
9. **UPI `tn` is only the booking reference** (`UTP-XXXX-XXXX`). Do not stuff names or pass types into the pay note.
10. **VIP copy must not say “everything in Standard.”** VIP lists the same floor perks (entry, food, mocktails, DJ) in its own perk list, plus lounge / queue-skip / table. Keep the pass cards a fixed height (`PassCard` shows 6 tight lines on the front; the rest is WHAT’S IN IT).
11. **Homepage intro:** a full-screen Three.js shader + a 10-layer 3D wordmark is what is live. A lighter iOS path shipped, then Meghanath said **roll it back**. Do not re-lite the intro unless he asks again. Safari on iPhone can still show WebKit’s “A problem repeatedly occurred” crash page because of that intro — he chose the old look anyway.
12. **Do not commit secrets.** No Gmail app passwords, no Redis tokens, no `AUTH_SECRET`. Live SMTP is Vercel env: `GMAIL_USER` / `GMAIL_APP_PASSWORD`. Sending *from* `avionproductions27@gmail.com` is a Vercel env change, not a git change.

---

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Framer Motion, Zod, Three.js (intro shader), Nodemailer.

Durable store is **Upstash Redis REST** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) in `src/server/store.ts`. Without Redis, each Vercel lambda has its own memory: CMS approve never reaches the door, and a paid pass scans as not a pass.

| Redis key | What |
| --- | --- |
| `utopia:db:v1` | Orders, OTPs, scans, prices (no JPEG blobs) |
| `utopia:proof:v1:{orderId}` | Payment-proof JPEG |
| `utopia:purged:v1` | Tombstones so a purged order cannot come back on merge |

Local `.data/utopia.json` is only a cache. Production is Redis.

Checkout shrinks screenshots (720px, ~80 KB data-URL cap) in `src/lib/payment-proof.ts` / `src/lib/validation.ts`. Do not put raw camera JPEGs in the DB blob — that already blew the 1MB Upstash value limit and dropped every order.

---

## Who logs in where

| URL | Who | How |
| --- | --- | --- |
| `/` | Public | Shader intro, then landing |
| `/login` → `/account` | Guest | Email + 6-digit code. Header LOGIN is guest-only. Never opens CMS. |
| `/admin` | Staff CMS | Different 12-word BIP39 phrase (`CMS_PHRASE` or first-deploy hash in `src/server/phrase.ts`) |
| `/door` | Door staff | A **different** 12-word phrase. Scanner staff must not be able to approve payments. |

CMS actions:

- **DROP HOLD** — unpaid reservation (`discardOpenHold`)
- **REMOVE** — paid pass (`purgeOrder` + tombstone + delete that proof)
- **TRANSFER** — paid, unscanned pass to a new name/email/phone (new door code; old QR dies)
- **Approve** — Redis flush **before** mail. Mail goes through Next.js `after()` so Gmail SMTP cannot block the HTTP response. Needs UTR + screenshot.
- **Reject** — same flush-then-`after()` mail pattern. Confirm UI is a red bar at the **top** of the card.

Door: signed QR whose order is missing → `no-record` (our store problem, not a fake). One QR / door code = one person.

---

## Buy flow

Checkout is a modal, not a new route. Rough steps: pass → details → email verify → confirm → UPI pay → done.

- Prices always recomputed on the server (`src/lib/pricing.ts`). Browser totals are display.
- Guest verifies email, then `POST /api/passes/reserve` creates `reserved` + UPI QR. Amount and VPA come from the server.
- “I’ve paid” (`/api/passes/pay`) records **UTR + screenshot**. Order stays `reserved` until CMS approve. Hitting pay does **not** issue a pass.
- Approve mints HMAC door code + signed QR and emails them. Guest can also open `/account?claim=…`.
- Mixed STANDARD + VIP in one cart is allowed (`src/lib/cart.ts`).

Copy for names, venue, policy, Instagram, email: `src/lib/event.ts`.  
Pass names, perks, default prices: `src/lib/passes.ts`. Live prices overlay via `catalogWithPrices` + Redis.

UTOPIA logotype: `public/brand/utopia-wordmark.png`, `src/components/UtopiaWordmark.tsx`.

---

## Working on this repo

- Branch names: `cursor/<descriptive-name>-d958` (lowercase).
- Base PRs on `main` unless told otherwise.
- After a product change, merge to `main` so Vercel production updates. Preview is not the live site.
- `npx tsc --noEmit` needs the local binary (`./node_modules/.bin/tsc`), not the npm `tsc` package.
- Verify UI in a browser (or Chrome against the local server) when you change layout, copy on cards, or checkout. A single screenshot of the intro is not verification.
- Do not post to Slack/GitHub comments unless asked. Do not put secrets in git, PRs, or chat.

---

## Known sharp edges

- **iOS Safari crash** on first load: WebKit killing the tab, not an in-app toast. Cause is the homepage intro (WebGL + stacked 3D wordmark + blur FX + hero photos). Rolled back on purpose. If asked to fix it again, skip WebGL on phones; do not ship that unless he wants it.
- **README vs code:** ignore README prices/fee/mail/store. Code + this file win.
- **Staff Redis banner** must stay off `/`.
- **Gmail:** if login/checkout says it couldn’t send email, check Vercel `GMAIL_USER` (must be the 27 inbox) and a current app password. Never paste the app password into the repo.
- Next.js 16 may nag about `middleware` → `proxy`. Don’t drive-by migrate that unless the task is that migration.
