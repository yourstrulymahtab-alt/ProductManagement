-- Create product_changes table to track changes in stock, costPrice, and sellPrice from ProductsPage
CREATE TABLE product_changes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  change_type TEXT NOT NULL, -- 'add', 'edit', 'delete', 'add_stock'
  old_stock NUMERIC,
  new_stock NUMERIC,
  old_cost_price NUMERIC,
  new_cost_price NUMERIC,
  old_sell_price NUMERIC,
  new_sell_price NUMERIC,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Optional: Add index for faster queries on product_id and timestamp
CREATE INDEX idx_product_changes_product_id ON product_changes(product_id);
CREATE INDEX idx_product_changes_timestamp ON product_changes(timestamp);
