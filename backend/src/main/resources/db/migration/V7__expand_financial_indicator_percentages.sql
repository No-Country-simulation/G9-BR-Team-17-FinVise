ALTER TABLE financial_indicators
    ALTER COLUMN income_commitment_pct TYPE NUMERIC(19, 2),
    ALTER COLUMN debt_level_pct TYPE NUMERIC(19, 2),
    ALTER COLUMN savings_rate_pct TYPE NUMERIC(19, 2),
    ALTER COLUMN fixed_expenses_pct TYPE NUMERIC(19, 2),
    ALTER COLUMN non_essential_expenses_pct TYPE NUMERIC(19, 2),
    ALTER COLUMN variation_pct TYPE NUMERIC(19, 2);
