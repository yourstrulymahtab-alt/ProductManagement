# TODO: Implement Regular Customer Checkbox Feature

- [ ] Add `isRegular` state (default false) to BillingPage.jsx
- [ ] Add checkbox labeled "R" in the UI near customer fields
- [ ] Calculate total sell profit as sum of (transactionPrice - costPrice) * quantity for 'sell' transactions
- [ ] Implement regular discount: subtract 10% of total sell profit from total when checked
- [ ] Implement regular penalty: add 10% of total sell profit to total if any 'return' transactions exist when checked
- [ ] Update adjustedTotal calculation to include regular adjustments
- [ ] On save, add ledger adjustment with reason 'Regular' if isRegular is true
- [ ] Update bill generation to reflect regular adjustments
