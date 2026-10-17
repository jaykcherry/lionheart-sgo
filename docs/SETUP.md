# Setup: accounts to connect

The code is complete; it goes live when these accounts exist. Roughly in order:

| # | Account | What to do | Env vars |
|---|---|---|---|
| 1 | **GitHub** | Repo for this code | — |
| 2 | **Supabase** (Pro, ~$25/mo) | New project in US region. `npx supabase link`, then `npx supabase db push` (migrations) and run `supabase/seed.sql`, then `supabase/seed-schools.sql` (all 358 Christian schools on the TDOE 2026-27 list). Auth → Email: enable magic links, set Site URL; enable MFA (TOTP) and require it for staff/board/school admins. | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| 3 | **Vercel** | Import the repo; add env vars; custom domain `lionheartscholars.org` | `NEXT_PUBLIC_SITE_URL` |
| 4 | **Stripe** | Apply for nonprofit pricing (needs the IRS determination letter). Enable Apple Pay (verify domain) and Google Pay. Webhook → `https://<domain>/api/stripe/webhook` for `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.dispute.created`. Payouts to the **segregated** bank account. | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| 5 | **PayPal** | PayPal Giving Fund or PayPal Checkout business account; deposits to the segregated account. Integration point: add a PayPal button to `/donor/give` that creates gifts via `startGift` (method `paypal`). | — |
| 6 | **Banks** | Two accounts: operating and **segregated §25F**. Ask for daily transaction export (or API). For automated ACH to schools, open an Increase account (or use the bank's ACH origination with the CSV from `PAYOUT_PROVIDER=manual`). Hook up school bank linking (Plaid or Stripe Financial Connections) in `src/app/school/page.tsx` where marked. | `PAYOUT_PROVIDER`, `INCREASE_*` |
| 7 | **Anthropic** | API key with a monthly spend limit | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |
| 8 | **Resend** | Verify the sending domain (SPF/DKIM) | `RESEND_API_KEY`, `EMAIL_FROM` |
| 9 | **Trigger.dev** | Create project; `npx trigger.dev@latest deploy`; add env vars there too | `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF` |
| 10 | **Bookkeeping** | QuickBooks/Xero with classes for 25F-TN, general, operating; monthly import of ledger journals | — |

## First users
1. Sign in at `/signin` with the board chair's email.
2. In the Supabase SQL editor, grant the first board role once: `insert into user_roles (user_id, role) select id, 'board' from profiles where email = 'chair@…';`
3. From then on, grant staff/board access in `/board` → Grant access (adds them to the disqualified-person registry).

## Data to load
- **Schools**: `supabase/seed-schools.sql` loads the TDOE 2026-27 Christian schools (Categories I-IV). To refresh: update `data/tn-christian-schools-2026-27.psv`, run `python3 scripts/build-schools.py`, regenerate the seed, and run `scripts/sync-web.sh`. Add each school's main phone before claims open, since 29 schools have no email domain and are verified by phone.
- **Design sync**: the app's theme, fonts, motion layer and school directory come from `prototype/`. After changing the prototype, run `scripts/sync-web.sh`.
- **Tuition**: schools enter it, or bulk-load `tuition_schedules`.
- **Income limits**: `npm run limits:load -- <HUD FY2026 CSV> FY2026` to cover all 95 counties.
- **DQ registry**: board, officers, selection committee and their relatives in `dq_persons` / `dq_relatives`.

## Estimated monthly cost at launch
Supabase ~$25, Vercel ~$20, Trigger.dev $0–50, Resend ~$20, Anthropic ~$50–300 (about $0.02–0.05 per document), Stripe ~2.2% + 30¢ per card gift under nonprofit pricing, Increase/bank ACH ~$0–100. Roughly $150–500/month plus card fees.
