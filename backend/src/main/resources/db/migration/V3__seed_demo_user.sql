INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'demo@financeai.com',
    '$2a$10$iz9hDIBjCmAel/a9f0SnSer91DQAq6xUTQTsaFT9/HzkpDMq0OvIS',
    'Usuário Demo',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;
