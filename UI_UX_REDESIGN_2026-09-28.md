# Money Ledger UI/UX redesign — 2026-09-28

This pass rebuilds the frontend around one small, consistent UI system instead of page-by-page styling.

## Product-wide changes

- Simplified desktop sidebar into **Money / Organize / Manage** groups.
- Simplified mobile navigation to **Home / Transactions / Commitments / More** plus one add button.
- Standardized page headers, sections, cards, metrics, buttons, fields, notices, empty states, loading states, modals, and responsive tables.
- Reduced decorative gradients and nested card noise; accent color is now used primarily for actions and selection state.
- Increased tap targets, spacing, readability, consistent border radii, and mobile safe-area handling.
- Added a coherent `UI.tsx` primitive set rather than duplicating header/empty/metric markup across pages.
- Updated browser/PWA branding from **Finance Tracker** to **Money Ledger**.

## Page improvements

### Overview
- Clear 4-card money summary: balance, money in, money out, net cash flow.
- Review warning is prominent only when work is waiting.
- Cash-flow and top-spending charts use a cleaner two-column desktop layout.
- Commitments are shown as progress cards rather than a dense table.
- Spending-by-type and shortcuts moved to lower-priority sections.

### Transactions
- Search/filter controls live in one panel.
- Result count plus visible money-in/money-out totals.
- Responsive table becomes stacked readable cards on mobile.
- Newly added transaction highlighting now scrolls into view.
- Clear loading, error, and no-results states.

### Transaction editor
- Larger, structured modal with sticky actions.
- Main classification is always visible.
- Rare features (category splits, commitment allocation, multi-month allocation) are collapsed into optional sections.
- Safer validation messages and clearer amount-allocation summaries.

### Quick Add
- Simple Expense / Income / Transfer segmented control.
- Large amount entry first.
- Transfer uses explicit From / To account fields.
- Cleaner two-column desktop form and full-width mobile bottom sheet.

### Review Inbox
- Review reasons now have explanations.
- Each item prioritizes payee, amount, date, and the reason it needs attention.
- Quick Transfer / Ignore / Review actions remain available without clutter.

### Commitments
- Month summary metrics.
- Reworked payment calendar with compact mobile cells and detailed selected-day panel.
- Commitment cards show status, paid/expected amount, and progress.
- Recorded payment dates are visible.
- Manual payment form is hidden until requested.

### Goals
- Summary metrics for lifetime, YTD, combined target, and remaining amount.
- Goal cards have clear progress and commitment contribution breakdowns.

### Accounts
- Combined/positive/negative balance summary.
- Cleaner account cards.
- New-account form only appears when requested.
- Archive action added with confirmation.

### People & payees
- Search panel and responsive table.
- Merge mode clearly explains that the first selection is retained.
- Relationship editing remains inline.

### Rules
- Rule builder no longer requires remembering raw database IDs.
- Category, label, person, account, commitment, and goal targets use real dropdowns.
- Condition operators change to match the selected field.
- Added client-side validation and clearer test feedback.
- Rules can be paused/enabled directly.
- Re-apply and delete actions require confirmation.

### Imports
- Drag/drop or choose-file workflow.
- Selected-file preview before import.
- Responsive import history and visible errors.
- Duplicate-import safety is explained without taking over the page.

### Categories
- Cleaner hierarchy cards.
- Rename categories inline.
- Delete non-system categories with confirmation.
- New category form is hidden until needed.

### More
- Less-used features grouped under Organize and Manage instead of presenting a random tile wall.

## Verification

- Backend Python compilation passes.
- `git diff --check` passes.
- Frontend TypeScript/JSX syntax and local type relationships were checked with temporary module shims because this environment has no installed `node_modules`.
- A real `npm build` cannot be completed in this sandbox because dependency installation is unavailable; the temporary audit shims are removed from the source tree.
