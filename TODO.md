# TODO: Fix 'BUY' transaction subtraction in Ledger Page

- [x] Modify the diff calculation in fetchLedger function in LedgerPage.jsx to account for transaction type ('buy' vs 'sell')
  - For 'sell': diff = amountPaid - totalPrice
  - For 'buy': diff = totalPrice - amountPaid
- [x] Verify the change by checking the logic ensures 'buy' transactions are correctly subtracted from the amount to take/give
- [x] Filter ledger entries to only show records where Total to Take >= 10, excluding Total to Give entries
