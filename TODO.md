# TODO: Fix Billing Page Download Issue

- [x] Add `lastBill` state to store the last generated bill's data (customer, transactions, total).
- [x] In `handleSaveAndGenerateBill`, set `lastBill` before clearing inputs.
- [x] Update `generateBillHtml` to use `lastBill` instead of current state.
- [x] Update `handleDownloadHTML` to use `lastBill` for generating the HTML.
- [x] Ensure bill preview uses the updated `billHtml`.
