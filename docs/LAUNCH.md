# Launch timeline (from mid-October 2026)

Bold items are hard regulatory deadlines.

| By | Milestone | Owner |
|---|---|---|
| Oct 31, 2026 | Incorporate / confirm EIN; file Form 1023 if not filed (exempt status must be effective by Jan 1, 2027 to use Tennessee's pending-exemption listing rule) | Founder + counsel |
| Oct 31 | Submit Tennessee DOE SGO interest form; email SGO.Questions@tn.gov asking (1) whether Tennessee will list SGOs with pending exemption, (2) EFS stacking | Founder |
| Oct 31 | Open operating and segregated bank accounts; Tennessee charitable solicitation registration | Treasurer |
| Nov 15 | Board adopts `docs/POLICIES.md` (as revised by counsel), conflict-of-interest policy, award policy 2027-28-v2 | Board |
| Nov 2026 | **Register in the IRS SGO portal** as soon as it opens (before Jan 1) | Ops lead |
| Nov 2026 | Connect accounts in `docs/SETUP.md`; load school list and HUD limits; recruit audit committee | Ops lead |
| **Dec 1, 2026** | **Public comments due** on proposed regs. Suggested asks: add TennCare/Medicaid and individually determined free/reduced lunch to categorical eligibility; confirm DAF treatment; confirm status of gifts made Jan 1–Feb 15, 2027; confirm whether segregated funds may pay admin costs; confirm non-binding school preferences are permitted | Founder + counsel |
| Dec 15, 2026 | Donor portal live, pledges only (`SGO_LISTED=false`); school claim campaign begins; IRS hearing | Ops lead |
| **Jan 1, 2027** | Credit-eligible gifts begin. Pledges charge only when Lionheart is on the IRS SGO list | — |
| **Feb 15, 2027** | **Tennessee submits its SGO list to the IRS.** When Lionheart appears, set `SGO_LISTED=true`; pledges charge the next morning | TDOE / ops lead |
| Feb 16, 2027 | Family applications open | — |
| Mid-Apr 2027 | Round 1 (at least 10 students, more than one school) | Board |
| Jul 2027 | Round 2; schools publish tuition | Board |
| Aug 20, 2027 | Fall payments | Treasurer |
| Jan 20, 2028 | Spring payments | Treasurer |
| **Jan 31, 2028** | **Donor acknowledgments for 2027** | Automated + treasurer |
| **Feb 28, 2028** | **IRS contribution report for 2027** | Treasurer |
| **May 15, 2028** | **Form 990 + §25F certification** (calendar fiscal year) | CPA + board |
| **Dec 31, 2028** | **2027 receipts at least 90% spent** | Award engine + board |

## Open questions to resolve before launch
1. Do gifts made between Jan 1 and Lionheart's appearance on the IRS list qualify? (The code waits for the listing by default.)
2. Donor-advised fund grants: treated as not credit-eligible.
3. Donor-number format: comes from the IRS portal; `provisionalDonorNumber` in `src/domain/acknowledgments.ts` is a placeholder.
4. Form 8525 has not been released; donor-facing copy refers to it by number only.
5. Qualified-expense guidance under §530 is pending; awards currently pay tuition and required fees only.
6. EFS stacking: the engine treats EFS as other aid and funds only the remainder. Confirm with TDOE in writing.
7. School list: `supabase/seed.sql` holds 12 sample schools; replace with the accredited list.
