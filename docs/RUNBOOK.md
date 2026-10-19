# Runbook: what people still do

Target staffing in year one: one part-time operations/compliance lead (about 0.5 FTE, heavier in Feb–Apr and Aug), a treasurer and board chair on the board, a 3-person independent audit committee, and a contract bookkeeper a few hours a month. Everything below is a person's job; everything not listed is automated.

## Daily (ops lead, ~10–20 min in peak season)
- Clear the review queue on `/board`: the exceptions left after IRS transcript verification (non-filers, identity mismatches, odd households), document reviews, support handoffs. The AI recommendation is a starting point; you decide.
- Read any critical compliance finding. Critical findings already paused the affected flow.

## Weekly
- Bank changes confirm themselves by email (school's TDOE directory address + 3-day cancel window). Glance at any "payee_change_cancelled" tickets; no calls.
- Spot-check 5 automatically approved applications against their documents (sampling keeps the automation honest).

## Each award round (Apr 15, Jul 15, Dec 1): automatic
- 14 days before: the board gets an email with the run time and the public drand beacon round that will break ties (also posted publicly). Nothing to do.
- 1 hour before: applicants and cash freeze and are fingerprinted. At the run time the round runs itself with the beacon value.
- After the run: one board member opens the emailed link (`/board/rounds/<id>`), reviews totals (students, schools, waitlist, holds, 10-student rule) and clicks Approve. Reminders on day 3 and day 7.

## Each term (Aug, Jan)
- Aug 1–13 / Jan 2–13: enrollment windows open and reminders go out automatically on days 1, 5, 9 and 12 (schools without a portal user get them at their TDOE directory address; families get residency reminders).
- Aug 15 / Jan 15: the batch builds itself, passes safety checks and emails approvers. Two approvals still required (ops lead, then a board officer), about two minutes each. Reminders daily from 3 days before the pay date.
- Aug 20 / Jan 20: approved batches send themselves through the bank's API (requires `PAYOUT_PROVIDER=increase`; with `manual` a critical ticket opens instead and nothing is marked sent). Late confirmations go out in weekly catch-up batches.
- Refunds owed after withdrawals are invoiced automatically, reminded on days 14 and 28, and netted from the school's next payment.

## Annually
| When | Who | What |
|---|---|---|
| Before Jan 1 | Ops lead | Confirm IRS SGO portal registration and Tennessee listing; set `SGO_LISTED=true` when listed |
| Jan 5–31 | (automatic) | Acknowledgments release and deliver the first morning everything ties out; if not, the treasurer is emailed once and it retries daily |
| Feb 1–28 | Treasurer | Upload the IRS contribution report (download link arrives by email Feb 1; reminders Feb 15, 22, 26) through the IRS SGO portal, then record the confirmation number on `/board` |
| Spring | Audit committee | Financial and programmatic audit; furnish to Tennessee |
| By May 15 | CPA + board | Form 990 with §25F certification and statistics; copy to Tennessee |
| By Jun 30 | Ops lead | Tennessee charitable solicitation renewal |
| Fall | Board | Re-adopt award policy for next year; refresh HUD limits (`npm run limits:load`) |

## If something breaks
- **Bank ≠ ledger**: disbursements pause automatically. Bookkeeper finds the missing deposit/fee top-up; post the correcting journal; rerun compliance.
- **Webhook failures**: Stripe retries for 3 days; check `/api/stripe/webhook` logs; journals are idempotent so replays are safe.
- **Chargeback**: ticket opens; post a chargeback journal; if the year is closed, issue a corrected acknowledgment.
- **Agent misbehaves**: agents can't change state; disable the job in Trigger.dev and work tickets by hand.
