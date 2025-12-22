-- Create ledger_adjustments table
CREATE TABLE ledger_adjustments (
  id SERIAL PRIMARY KEY,
  person_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  adjustment_amount NUMERIC NOT NULL,
  adjustment_date TIMESTAMP DEFAULT NOW(),
  reason TEXT
);

-- Optional: Add index for faster queries
CREATE INDEX idx_ledger_adjustments_person_contact ON ledger_adjustments(person_name, contact);
