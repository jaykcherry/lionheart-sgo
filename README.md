# Lionheart SGO platform

Software for **Lionheart**, a Tennessee scholarship granting organization (SGO) under the federal education scholarship tax credit (26 U.S.C. §25F, credit for gifts on or after January 1, 2027). One system serves four groups:

| Who | What they do here |
|---|---|
| **Families** | Sign in by email link, set up a household, apply for each child, upload tax documents (read automatically), accept awards, confirm residency each term |
| **Schools** | Find their pre-loaded school, verify with a code sent to their school-domain email, sign the partnership agreement, connect a bank account, confirm enrollment each term, report withdrawals |
| **Donors** | Give as one person or as a couple (two gifts, two donor numbers), designate the gift for the credit, schedule pledges for Jan 1, track credit room, download acknowledgments |
| **Board & staff** | Compliance monitor, review queue with AI recommendations, award rounds (formula + published-seed lottery), two-approver school payment batches, role grants |

## How it stays correct with very little staff

1. **One rules engine** (`src/domain`) holds every rule: income limits, eligibility, award formula, donor credit, disqualified persons, the 90% test, payment gates, reconciliation, year-end documents. It's pure TypeScript with tests (`npm test`) and is the same code the clickable prototype runs.
2. **The database refuses illegal moves** (`supabase/migrations`): legal state transitions only, human-only decisions blocked for agents and jobs, append-only audit and ledger, balanced journals, nothing non-qualifying in the §25F fund, row-level security per household/school/donor. Tested in `supabase/tests/integrity.sql`.
3. **Scheduled jobs** (`src/jobs`) do the recurring work: hourly compliance check, pledge charging, enrollment windows, payment batch preparation, offer expiry, Jan 5 acknowledgments + IRS file, retention.
4. **AI agents** (`src/agents`) read documents, draft review recommendations, and answer help questions. They can't decide eligibility, deny, approve exceptions or move money; every output is logged.
5. **People decide** the things the law and good practice require: award policy, exceptions and denials, payment approvals (two people, one a board officer), bank-change callbacks, audit, Form 990 signature.

## Layout

```
src/domain/        rules engine (no I/O) + tests in tests/
src/server/        services: eligibility, awards, gifts/Stripe, disbursement/ACH, year-end, compliance, school claims
src/agents/        Claude agents + guardrails
src/jobs/          Trigger.dev scheduled tasks
src/app/           Next.js portals (family, school, donor, board), public pages, Stripe webhook, help API
supabase/          schema, RLS, integrity triggers, service RPCs, seed, DB tests
prototype/         clickable single-file prototype (site + portals) built on the same engine
docs/              setup, policies for board adoption, runbook, launch timeline, architecture
```

## Run it

```bash
npm install
npm test                       # rules engine (39 tests)
scripts/test-db.sh             # migrations + database integrity tests (needs local Postgres)
cp .env.example .env.local     # fill in keys; see docs/SETUP.md
npx supabase db reset          # applies migrations + seed to your Supabase project/local stack
npm run dev                    # http://localhost:3000
npx trigger.dev@latest dev     # scheduled jobs locally
scripts/build-prototype.sh     # rebuilds prototype/dist/lionheart.html from the engine
```

Start with `docs/SETUP.md`, then `docs/LAUNCH.md`. Policies in `docs/POLICIES.md` are drafts for the board and counsel; Tennessee relies on written policies to list a new SGO.

**Not legal or tax advice.** Treasury's 2026 rules are partly proposed; see the open questions in `docs/LAUNCH.md`.
