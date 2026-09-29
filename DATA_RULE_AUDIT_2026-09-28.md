# Data/rule audit — 2026-09-28

This update was built from the supplied `finance.db` and the six archived PhonePe CSV exports. The database/import files were used only to discover real counterparty patterns and validate matching behavior; they are not bundled into this source package.

## Source profile

- Database transactions: **3,774**
- Counterparties: **1,627**
- Existing rules before this pass: **81**
- Commitment-payment rows: **51**
- PhonePe CSV files inspected: **6**
- Unique PhonePe transaction IDs across the overlapping exports: **3,761**
- Existing transaction classifications before the new merchant pass: **3,165 Unknown**, 377 Expense, 155 Transfer, 38 Savings, 18 Family Contribution, 10 EMI, 9 Loan Payment, and 2 Refund.
- Of the unknown rows, **3,085 were debits** and **80 were credits**.

The master exports overlap heavily, so raw CSV row counts must never be treated as separate money movements. The importer continues to de-duplicate by PhonePe transaction/reference identity.

## Merchant rules added/expanded

The counterparty list contains many merchant descriptions rather than stable brand names. The built-in rules now cover common observed words and spelling variants for:

- food/dining: soup/soups, tiffin/tiffen, noodles/noodel, curry point, canteen, restaurant, café, tea shop/stall, fast food, food court/plaza, biryani, bakery, sweets, juice, lassi, catering variants, etc.;
- groceries: supermarket, kirana, fruits, dairy/milk, chicken shops/centres, grocery delivery brands;
- education supplies: whole-word `book`/`books`, book stall/shop/center/centre, stationery/stationary, stationer/stationers;
- medical/pharmacy: hospital as a **whole word**, clinics, healthcare/diagnostics, pharmacy/medicals/chemist variants;
- utilities/recharge: broadband/mobile recharge, electricity/power distribution, LPG and common providers;
- transport/travel: petrol/fuel, cabs, vehicle service, rail/air/hotel/travel merchants;
- shopping/electronics/clothing, entertainment, insurance and home-maintenance merchants.

A small credit-side rule set recognizes clear merchant reversals/refunds (for example Flipkart, IRCTC/Indian Railways and Airtel recharge) without treating ordinary incoming person-to-person money as income or refunds automatically.

## Safety changes driven by the real data

The old substring rule for `hospital` produced false positives. Real examples include:

- `BARBEQUE NATION HOSPITALITY LIMITED`
- `PORT HOSPITAL CANTEEN`

`hospital` now uses a whole-word matcher, and explicit lower-priority-number exceptions classify those food merchants as Dining Out. The rule engine now genuinely honors priority: the **lowest numeric matching priority wins**. Multiple matches at the same winning priority are accepted only when their actions agree; competing actions are sent to Review rather than guessed.

The whole-word matcher also lets `book` safely match names such as `Book Center` while not matching the concatenated brand `Bookmyshow`. `K R Stationers`, `Vaseem Book and Stationery`, `VASEEM BOOKS AND STATIONERY`, `Prakash Book Shop`, and `Sri Raja Rajeswari Book Stall` are covered by the education-supplies rules.

## Coverage check against the supplied database

A dry-run of the new merchant-debit rules over the supplied database found:

- **1,220** debit transactions matching a merchant rule;
- **920** previously Unknown debit transactions that can now receive a safe merchant classification;
- **0** same-winning-priority cross-category conflicts in that dry-run;
- **5** previously Unknown credits matching the intentionally small merchant-refund rule set.

Newly classifiable Unknown debits were concentrated in Dining Out (412), Groceries (135), Utilities (88), Pharmacy (85), Clothing (40), Fuel (28), Electronics (27), Doctor/Hospital (21), Vehicle Maintenance (19), Outings (18), Books/Supplies (15), General Shopping (14), Maintenance (10), Fees (4), Hotels (2), and Flights/Trains (2).

These numbers describe the supplied snapshot; they are not hard-coded expectations for future imports.

## What remains deliberately unclassified

The app still does **not** guess when a counterparty is a person's name, a masked bank account, a payment gateway with no merchant meaning, an ambiguous transfer, or another description that cannot be assigned safely from its text. Those rows remain in Review. Manual classifications are authoritative and are not overwritten when built-in rules are refreshed.

The built-in merchant-rule version is stored in Settings. On the first startup after this update, non-manual rule-managed/unclassified transactions are re-evaluated once so an existing database benefits from the new rules; subsequent startups do not repeatedly rewrite classifications.
