# Lionheart policies (drafts for board adoption)

These are the written policies Tennessee may rely on when listing a new SGO, and the rules the software enforces. Have Tennessee nonprofit counsel and a CPA review before adoption. Section numbers refer to 26 U.S.C. §25F and Treasury's October 2026 temporary (T.D. 10057) and proposed (REG-117199-25) regulations.

## 1. Mission and scope
Lionheart funds scholarships for qualified elementary and secondary education expenses of eligible students who reside in Tennessee. Lionheart's activities are at least 85% scholarship-granting.

## 2. Student eligibility
A student is eligible if, at application:
1. the student resides in Tennessee (residency under Tennessee law; military-dependent and Indian-lands exceptions apply);
2. the student is eligible to enroll in a public elementary or secondary school (grades K–12);
3. household income for the prior calendar year is at or below 300% of area median gross income for the household's size and area. Household = the student and everyone residing with the student. Income = cash income under HUD Section 8 rules (24 CFR 5.609). Shared custody: use the household where the student lived longest; if equal, the higher-income household.

Verification methods: (a) direct verification for every adult, preferably from an IRS tax return transcript obtained with the family's e-signed Form 4506-C through an IVES participant (the transcript figures replace the family's own; Lionheart keeps only the last four digits of any SSN), otherwise from tax returns, W-2s, pay stubs or other cash-income evidence; (b) categorical eligibility from an award letter dated within 12 months showing current receipt of SNAP, TANF, WIC, Section 8 housing or SSI; (c) foster placement letter. Limits come from HUD's median family income for the student's area until the IRS publishes §25F tables; the version used is recorded with every decision.

## 3. Award policy (version 2027-28-v2): lowest income first
Goal: help every eligible student we can, and reach the lowest-income families first. The full internal rubric (worked examples, verification, exceptions) is the board's *Scholarship Award Rubric*; this section is the binding summary, and `src/domain/awards.ts` implements it exactly.
- **Need Index (NI)** = verified household income ÷ area median income adjusted for household size (the same figure used for the 300% test). NI 1.00 = 100% of area median. Households verified through SNAP, TANF, WIC, Section 8, SSI or a foster placement are assigned NI 0.00.
- **Unmet need** = tuition + required fees − Tennessee EFS − school aid − other SGO awards − other aid.
- **Award** = the smaller of (unmet need × share) and the cap, in whole dollars. Share and cap slide in a straight line between these points: NI 0.00 → 95%, $9,000; 1.00 → 85%, $8,000; 2.00 → 55%, $5,000; 3.00 → 25%, $2,500. A lower NI never receives a smaller share or cap. Minimum award $500.
- **Order**: (1) students who received a Lionheart scholarship the previous school year; (2) siblings of recipients; (3) everyone else. Within each group, lowest NI first, in bands 0.05 wide (5% of area median) so that small differences in documented income don't decide the order; ties inside a band are broken by a lottery seeded from a public randomness beacon (drand quicknet). The beacon round number is announced to the board and posted publicly 14 days before the round; applicants and available cash are frozen and fingerprinted one hour before that beacon value exists, so no one can know or influence the tie-breaks.
- **Breadth before depth**: in each round every ranked student first receives up to $1,000 (the floor), in rank order; remaining cash then tops up awards to the full amount, in rank order. A student who receives less than the full amount keeps a place in line and is topped up, in order, as gifts arrive. A partial award under the $500 minimum is not issued.
- **Cash-backed**: awards are made only from cash on hand in the §25F account, never against pledges. Strict order: a lower-ranked student is never funded ahead of a higher-ranked student who is short for lack of cash.
- **Household cap**: none for 2027–28 (the board may set one).
- **Rounds**: April 15, July 15 and December 1 (spring-only), at 10:00 a.m. Central. Rounds run automatically on schedule; nothing reaches families until a board member approves the round's results (approval requested by email, with reminders on day 3 and day 7). Offers expire after 10 days and return to the waitlist.
- **Payment**: half each term (fall Aug 20, spring Jan 20), paid directly to the school after the school confirms enrollment and the family re-attests Tennessee residency.
- **Floor**: each year Lionheart funds at least 10 students who do not all attend the same school.

## 4. Disqualified persons and conflicts of interest
No scholarship may go to a disqualified person: officers, directors, trustees, anyone who participates in selecting recipients (including committee members), substantial contributors (over $5,000 to the §25F account in a year and over 2% of that year's §25F contributions, spouses combined; status lasts that year and the next), and family members of each (spouse, ancestors, children, grandchildren, great-grandchildren and their spouses; Lionheart also includes siblings). Every applicant is screened before each award and each payment; matches are held for the board chair. Board members disclose relatives who may apply and recuse from any related decision.

## 4a. School verification
A school administrator verifies by email, never by phone: either a six-digit code sent to their own address on the school's email domain (valid 15 minutes), or a code sent to the school's official contact address in the Tennessee Department of Education's Non-Public Schools Directory (valid 48 hours). The second email names the person who asked, so whoever reads the school's official inbox decides whether to pass the code on. At most three directory codes per school per day. Every request and verification is logged.

## 5. No earmarking; school preferences
Lionheart does not earmark or set aside contributions for any particular student, and donors have no role in selecting recipients. A donor may name one preferred school. A named gift joins that school's designated pool. In each award round a school's pool funds eligible applicants who attend that school first, ranked by this policy's need formula; a pool is used only when the school has at least 10 eligible applicants in the round, and anything a pool can't use funds the general list in the same round. Parents, grandparents and other relatives may give, may name the school their child attends, and their children may apply; a family's giving never affects an applicant's ranking. Selection runs on the need formula with donor status hidden from reviewers. A donor acknowledges that the gift is not conditioned on any scholarship for any particular student. The only family bar is the statutory one in §4: children, grandchildren and other family members of a substantial contributor (more than $5,000 and more than 2% of contributions in a year, spouses combined) cannot receive an award that year or the next. Checkout warns any donor whose gifts would pass $5,000 in a year.
Lionheart publishes donor-anonymous totals of named gifts per school (the Schools page tracker). Donor counts below three are not shown. Treasury's 2026 regulations do not address school designations; the board revisits this section when further guidance is issued.

## 6. Gift acceptance and designation
Qualified contributions: cash from individuals (card, Apple Pay, Google Pay, ACH, PayPal, check), made on or after January 1, 2027, designated by the donor at the time of the gift as a §25F qualified contribution. Designation is irrevocable. Gifts from businesses, pass-through entities, donor-advised funds, stock or digital assets are accepted to the general scholarship fund and do not earn the credit. Amounts above a donor's $1,700 credit go to the general fund unless the donor directs otherwise. Card fees are paid from operating funds so the full designated amount reaches the §25F account.

## 7. Segregated account
All qualified contributions and their earnings are held in a separate bank account and ledger fund. Only qualified contributions, earnings, school refunds of scholarship money, and operating-fund fee top-ups may be deposited. Scholarship payments are the only outflows. Lionheart spends at least 90% of each year's §25F income on scholarships by December 31 of the following year.

## 8. Donor acknowledgments and IRS reporting
By January 31 each donor receives a written acknowledgment: Lionheart's EIN, total designated qualified contributions for the year, the donor's unique donor number, and a statement that no goods or services were provided. By February 28 Lionheart reports each donor number, name, address and total to the IRS. Both are released automatically, with no separate sign-off, once they tie to designated deposits to the cent; if they don't, nothing is sent, the treasurer is alerted and the check repeats daily. Acknowledgments are delivered by email only; donors agree to electronic delivery when they give, and no paper copies are mailed. The IRS report is uploaded through the IRS SGO portal by an officer, who records the confirmation number. Lionheart does not collect donor Social Security numbers.

## 9. Fraud prevention
Duplicate-award checks against EFS, school aid and other SGOs; document reuse detection across households; address and bank-account matching; a new or changed school bank account is paid only after it is confirmed from the school's email on file with the Tennessee Department of Education (never an address the requester supplies) and a three-day cancel window has passed, with cancel links sent to the requester and every school administrator; every payment batch passes automated safety checks (no school paid more than its unpaid awards for the term, total within segregated cash, no bank-account change since approval) and needs two approvers, one a board officer; it then sends through the bank's API on the pay date.

## 10. Refunds and withdrawals
Schools report withdrawals within 30 days and refund the unused share of a paid term, prorated by days enrolled out of 90, within 30 days. The school is invoiced automatically when it reports; any refund not paid is deducted from the school's next Lionheart payment (oldest first, whole refunds only). Refunds are §25F income in the year received and are re-awarded.

## 11. Appeals
A family may appeal a denial within 30 days. Appeals are decided by the board (not by staff who made the original decision); the decision is final.

## 12. Records and privacy
Financial, award and acknowledgment records: at least 7 years. Raw tax documents: deleted 3 years after the final determination; extracted values and file hashes kept. Access is limited by role and logged. Breaches are handled under Tennessee's notification law.

## 13. Audit
Annual financial and programmatic audit: by a committee of independent persons unrelated to management while total receipts are $500,000 or less (report signed under penalties of perjury), otherwise by an independent external professional. Copies go to the IRS (with Form 990) and to Tennessee.
