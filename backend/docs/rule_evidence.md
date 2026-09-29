# Evidence behind seeded rules

Seeded rules come from two sources: the user's explicitly defined recurring commitments and merchant/counterparty patterns verified against the supplied `finance.db` plus archived PhonePe imports. Ambiguous person-to-person transfers are intentionally not guessed.

## Recurring commitment evidence

The exact-amount commitment rules use repeated patterns observed in the PhonePe history:

| Commitment | Counterparty pattern | Exact amount | Occurrences | Date range observed |
|---|---|---:|---:|---|
| My Sukanya contribution | contains `3810` | ₹11,500.00 | 22 | 2023-05-12 → 2025-07-01 |
| Home Loan EMI | contains `6735` | ₹18,000.00 | 7 | 2026-02-04 → 2026-09-04 |
| Home Loan Top-Up EMI | contains `4488` | ₹21,000.00 | 3 | 2026-02-04 → 2026-04-02 |
| Union/Asha Home Loan Arrangement | contains `0987` | ₹40,000.00 | 9 | 2026-01-17 → 2026-09-05 |

The larger/irregular later payments to some masked accounts are not silently treated as the old recurring amount. `ASHA` also appears in both directions over a very wide amount range, so its broad rule gives a Home Loan hint and deliberately requires review rather than auto-attaching every payment to a commitment.

The rent-funded portion of the Union/Asha arrangement is not visible in PhonePe and therefore remains a manual/off-account commitment contribution. No loan due day is invented when the supplied data does not establish one.

## Merchant/counterparty audit

The 2026-09-28 rule expansion inspected **3,774 database transactions**, **1,627 counterparties**, and **six overlapping PhonePe exports containing 3,761 unique PhonePe transaction IDs**. At the time of the audit, 3,165 database transactions were still Unknown.

Rules were added for merchant-like text actually present in the data, including food words such as soup/tiffin/noodles/canteen, education-supply names such as book/book shop/stall and stationery/stationers, grocery patterns, pharmacies/medical providers, utilities/recharges, fuel/vehicle services, travel, shopping/electronics/clothing, entertainment and other clear merchant classes.

The dry-run result for the expanded debit merchant set was **1,220 matched debit rows**, including **920 previously Unknown debits**, with **zero conflicting categories at the winning priority**. The deliberately small merchant-refund set matched five previously Unknown credits.

### False-positive controls

Real data exposed a dangerous substring edge case: `BARBEQUE NATION HOSPITALITY LIMITED` contains the letters `hospital`, and `PORT HOSPITAL CANTEEN` contains a true hospital word but is a canteen purchase. The fix has three parts:

1. `word_contains` performs token-boundary matching for words such as `hospital`, `book`, and `stationer`.
2. Specific exceptions use a lower numeric priority than broad merchant rules.
3. The engine applies only the lowest matching priority; same-priority rules may coexist only when their actions agree. Conflicting actions go to Review.

This also allows whole-word `book` to classify `Book Center` without accidentally classifying `Bookmyshow` as education.

See `DATA_RULE_AUDIT_2026-09-28.md` for the full audit summary and category-level dry-run counts.
