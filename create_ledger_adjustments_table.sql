-- Create ledger_adjustments table
CREATE TABLE ledger_adjustments (
  id SERIAL PRIMARY KEY,
  person_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  adjustment_amount NUMERIC NOT NULL,
  adjustment_date TIMESTAMP DEFAULT NOW(),
  -- Date on which this adjustment should be applied in the ledger (day-wise due)
  effective_date DATE NOT NULL DEFAULT (adjustment_date::date),
  reason TEXT
);

-- Optional: Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ledger_adjustments_person_contact ON ledger_adjustments(person_name, contact);
CREATE INDEX IF NOT EXISTS idx_ledger_adjustments_person_contact_effective_date
  ON ledger_adjustments(person_name, contact, effective_date);

