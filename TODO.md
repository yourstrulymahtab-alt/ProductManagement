- [ ] Decide adjustment storage: use existing `ledger_adjustments` table + add `effective_date DATE` column
- [ ] SQL migration: ALTER `ledger_adjustments` to add `effective_date DATE NOT NULL`
- [ ] Backfill history adjustment rows: set `effective_date = adjustment_date::date` for existing records

- [ ] Update Supabase API (`src/api/supabaseApi.js`):
  - [ ] Update `getLedgerAdjustments(person, contact)` to order by `effective_date`
  - [ ] Add/extend `addLedgerAdjustment` to accept and write `effective_date`
  - [ ] (Optional) Add helper `getLedgerDailyAdjustments(person, contact)` if using a separate table
- [ ] Refactor Ledger computation (`src/pages/LedgerPage.jsx`):
  - [ ] Group non-reversed transactions by person+contact+transaction day
  - [ ] Compute signed daily net per person (sell vs return logic kept consistent with current Due meaning)
  - [ ] Fetch adjustments for that person+contact and group them by effective date
  - [ ] For each date in ascending order, apply that day’s adjustments to compute running due
  - [ ] Update UI to show date-wise transaction rows + due after adjustments (and final due)
- [ ] Add UI for date-wise adjustments in Ledger page:
  - [x] Provide date picker (effective date)
  - [x] Save via `addLedgerAdjustment` with `effective_date`
  - [x] Add amount + reason
  - [x] Refresh ledger computation


- [ ] Ensure future transactions work automatically:
  - [ ] Verify ledger recomputes due using transaction_date buckets + any adjustments for those future dates
- [ ] Ensure history transactions work:
  - [ ] Verify past dates compute due using stored transactions + historical adjustments effective on those dates
- [ ] Update transaction edit behavior (`src/api/supabaseApi.js` / `src/pages/TransactionsPage.jsx`):
  - [ ] When `amountPaid` is edited (and an adjustment row is created), set `effective_date` = that transaction’s original `transaction_date` (not `now`)
- [ ] Verify reversing behavior:
  - [ ] Confirm reversed transactions are excluded from ledger day calculations
- [ ] Testing checklist:
  - [ ] Add a few transactions for same person across multiple days and verify per-day due changes
  - [ ] Add adjustment for a specific earlier date and verify due changes for that date onward (running balance)
  - [ ] Add adjustment for a future date and verify only that future due changes
  - [ ] Edit amountPaid on an existing transaction and verify the correction is applied to the correct transaction day

