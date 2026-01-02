# TODO: Add Payment Input to Billing Page

## Steps to Complete:
- [ ] Import addLedgerAdjustment in BillingPage.jsx
- [ ] Add paymentAmount state variable (string, default '')
- [ ] Add TextField for "Payment Amount" below the total display
- [ ] Modify total calculation to compute adjustedTotal = total - parseFloat(paymentAmount || 0) and display adjusted total
- [ ] Update handleSaveAndGenerateBill to add ledger adjustment if paymentAmount > 0 after saving transactions
- [ ] Update generateBillHtml function to accept paidAmount parameter, remove "Paid" column from table, add "Paid Amount" below table, and adjust total display
- [ ] Update bill preview and download HTML generation to use adjusted total and include paidAmount
- [ ] Clear paymentAmount input after successful bill generation
- [ ] Store paidAmount in lastBill for download purposes
