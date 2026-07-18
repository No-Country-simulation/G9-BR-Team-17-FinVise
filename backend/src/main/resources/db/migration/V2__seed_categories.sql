INSERT INTO transaction_categories (code, name, type) VALUES
    ('ALIMENTACAO', 'Alimentação', 'EXPENSE'),
    ('TRANSPORTE', 'Transporte', 'EXPENSE'),
    ('SAUDE', 'Saúde', 'EXPENSE'),
    ('MORADIA', 'Moradia', 'EXPENSE'),
    ('EDUCACAO', 'Educação', 'EXPENSE'),
    ('LAZER', 'Lazer', 'EXPENSE'),
    ('SERVICOS', 'Serviços', 'EXPENSE'),
    ('COMPRAS', 'Compras', 'EXPENSE'),
    ('DIVIDAS', 'Dívidas', 'EXPENSE'),
    ('INVESTIMENTOS', 'Investimentos', 'EXPENSE'),
    ('TRANSFERENCIAS', 'Transferências', 'TRANSFER'),
    ('OUTROS', 'Outros', 'EXPENSE'),
    ('RENDA', 'Renda', 'INCOME')
ON CONFLICT (code) DO NOTHING;
