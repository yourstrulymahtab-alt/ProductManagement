-- Create product_changes table to track changes in products table from ProductsPage
CREATE TABLE product_changes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  change_type TEXT NOT NULL, -- 'add', 'edit', 'delete', 'add_stock'
  old_values JSONB, -- Store old product data as JSON
  new_values JSONB, -- Store new product data as JSON
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Optional: Add index for faster queries on product_id and timestamp
CREATE INDEX idx_product_changes_product_id ON product_changes(product_id);
CREATE INDEX idx_product_changes_timestamp ON product_changes(timestamp);
