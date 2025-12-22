# TODO: Add Amount Adjustment History Feature to Ledger Page

## Issue Description
The ledger page needs a feature to maintain a history of amount adjustments against each record, using a new table for this purpose. Removed the edit feature and replaced it with a simple adjustment field and button.

## Root Cause
Previously, there was no tracking of changes made to the amount paid in transactions, making it difficult to audit adjustments. The edit feature was changing the original amount paid, which was not desired.

## Changes Made

### 1. New Table: `amount_adjustments`
- Created a new table to store adjustment history with fields: id, transaction_id, old_amount, new_amount, adjustment_date, reason.

### 2. API Updates (src/api/supabaseApi.js)
- [x] Added `getAmountAdjustments(transactionId)` to fetch history for a transaction.
- [x] Added `addAmountAdjustment(adjustment)` to insert new adjustment records.
- [x] Removed modification to `addTransaction` for recording adjustments on edit.

### 3. Frontend Updates (src/pages/LedgerPage.jsx)
- [x] Removed edit functionality (editRow, editAmount states and handleEdit, handleSave functions).
- [x] Added adjustRow, adjustAmount states and handleAdjust function.
- [x] Added state for expanded rows and adjustment history.
- [x] Added `toggleExpansion` function to show/hide history.
- [x] Changed table header from "Edit" to "Adjust Amount".
- [x] Replaced edit cell with adjustment input field and button.
- [x] Added History column to the table with Show/Hide button.
- [x] Added expandable row displaying adjustment history in a sub-table.

## Testing
- [ ] Test adjusting amount and verify history is recorded without changing original amount paid.
- [ ] Test expanding/collapsing history for transactions.
- [ ] Test multiple adjustments and ensure all are displayed chronologically.
- [ ] Verify history persists across page refreshes.

## Follow-up
- [ ] Ensure the new table is created in the database.
- [ ] Monitor for any performance issues with history loading.
