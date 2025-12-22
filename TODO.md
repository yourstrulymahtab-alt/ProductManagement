# TODO: Fix Stock Validation Issue in Billing

## Issue Description
When attempting to sell a quantity more than the available stock of a product, a warning is shown, but the transaction is still added to the transactions table.

## Root Cause
- The `addTransaction` function in `supabaseApi.js` was inserting the transaction first and then checking stock, allowing invalid sell transactions to be added if the stock check failed.
- Frontend validation used potentially outdated stock data fetched at page load.

## Changes Made

### 1. API Level Fix (src/api/supabaseApi.js)
- [x] Moved stock validation before inserting sell transactions in `addTransaction`.
- For sell transactions, fetch current stock and check if sufficient before inserting.
- If insufficient, throw error before any insertion occurs.

### 2. Frontend Enhancement (src/pages/BillingPage.jsx)
- [x] Added product refresh in `handleSaveAndGenerateBill` before validation to ensure latest stock data.
- This prevents validation from passing on outdated stock information.

## Testing
- [ ] Test selling more than available stock - should show warning and NOT add transaction.
- [ ] Test selling within stock limits - should proceed normally.
- [ ] Test concurrent transactions to ensure stock is properly managed.
- [ ] Verify buy transactions still work correctly.

## Follow-up
- [ ] Monitor for any edge cases or additional issues.
- [ ] Consider implementing database-level constraints for additional safety.
