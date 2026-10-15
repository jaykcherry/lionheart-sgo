# Runbook: what people still do

Target staffing in year one: one part-time operations/compliance lead (about 0.5 FTE, heavier in Feb–Apr and Aug), a treasurer and board chair on the board, a 3-person independent audit committee, and a contract bookkeeper a few hours a month. Everything below is a person's job; everything not listed is automated.

## Daily (ops lead, ~20–40 min)
- Clear the review queue on `/board`: eligibility reviews, document reviews, support handoffs. The AI recommendation is a starting point; you decide.
- Read any critical compliance finding. Critical findings already paused the affected flow.

## Weekly
- Confirm bank-change requests by phone (number on file, never from the request), then click "I called the main office".
- Spot-check 5 automatically approved applications against their documents (sampling keeps the automation honest).

## Each award round (Apr, Jul, Dec)
1. Board meeting: read the lottery seed into the minutes.
2. Ops lead runs the round on `/board` with that seed.
3. Board reviews totals (students, schools, waitlist, holds, 10-student rule) and approves.

## Each term (Aug, Jan)
- Aug 1 / Jan 2: enrollment windows open automatically; nudge schools that haven't confirmed by day 5.
- Aug 15 / Jan 15: payment batch prepared automatically. Ops lead approves; treasurer approves second; treasurer sends.
- Follow up refunds owed by schools after withdrawals.

## Annually
| When | Who | What |
|---|---|---|
| Before Jan 1 | Ops lead | Confirm IRS SGO portal registration and Tennessee listing; set `SGO_LISTED=true` when listed |
| Jan 5–10 | Treasurer | Review year-end tie-out; approve acknowledgment delivery |
| By Feb 28 | Treasurer | Submit the IRS contribution report file from storage `irs/<year>-contribution-report.csv` through the IRS SGO portal |
| Spring | Audit committee | Financial and programmatic audit; furnish to Tennessee |
| By May 15 | CPA + board | Form 990 with §25F certification and statistics; copy to Tennessee |
| By Jun 30 | Ops lead | Tennessee charitable solicitation renewal |
| Fall | Board | Re-adopt award policy for next year; refresh HUD limits (`npm run limits:load`) |

## If something breaks
- **Bank ≠ ledger**: disbursements pause automatically. Bookkeeper finds the missing deposit/fee top-up; post the correcting journal; rerun compliance.
- **Webhook failures**: Stripe retries for 3 days; check `/api/stripe/webhook` logs; journals are idempotent so replays are safe.
- **Chargeback**: ticket opens; post a chargeback journal; if the year is closed, issue a corrected acknowledgment.
- **Agent misbehaves**: agents can't change state; disable the job in Trigger.dev and work tickets by hand.
