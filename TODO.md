# TODO: Fix 'BUY' transaction subtraction in Ledger Page

- [x] Modify the diff calculation in fetchLedger function in LedgerPage.jsx to account for transaction type ('buy' vs 'sell')
  - For 'sell': diff = amountPaid - totalPrice
  - For 'buy': diff = totalPrice - amountPaid
- [x] Verify the change by checking the logic ensures 'buy' transactions are correctly subtracted from the amount to take/give
- [x] Filter ledger entries to only show records where Total to Take >= 10, excluding Total to Give entries

# TODO: Implement separate table to track changes in products table from ProductsPage

- [x] Create `create_product_changes_table.sql` file to define the `product_changes` table with fields: id (serial primary key), product_id, change_type, old_values (JSON), new_values (JSON), timestamp (default now)
- [x] Add `logProductChange` function in `src/api/supabaseApi.js` to insert into product_changes
- [x] Modify `addProduct` in `src/api/supabaseApi.js` to log changes: 'add' for new products, 'edit' or 'add_stock' for edits (detect if only stock changed), capture old and new values
- [x] Modify `deleteProduct` in `src/api/supabaseApi.js` to log 'delete' with old values
- [ ] Run the SQL script in Supabase to create the table
- [ ] Test the logging by performing add, edit, delete, and add stock operations in ProductsPage
