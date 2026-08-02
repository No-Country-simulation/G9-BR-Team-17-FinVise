-- Remove the public demo account and every dependent record created from it.
-- Demo data must be provisioned explicitly in isolated development environments.
DO $$
DECLARE
    demo_user_id UUID;
BEGIN
    FOR demo_user_id IN
        SELECT id
        FROM users
        WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
           OR email = 'demo@financeai.com'
    LOOP
        DELETE FROM agent_messages
        WHERE conversation_id IN (
            SELECT id FROM agent_conversations WHERE user_id = demo_user_id
        );

        DELETE FROM recommendations
        WHERE analysis_id IN (
            SELECT id FROM financial_analyses WHERE user_id = demo_user_id
        );

        DELETE FROM spending_summaries
        WHERE analysis_id IN (
            SELECT id FROM financial_analyses WHERE user_id = demo_user_id
        );

        DELETE FROM financial_indicators
        WHERE analysis_id IN (
            SELECT id FROM financial_analyses WHERE user_id = demo_user_id
        );

        DELETE FROM agent_conversations WHERE user_id = demo_user_id;
        DELETE FROM financial_analyses WHERE user_id = demo_user_id;
        DELETE FROM transactions WHERE user_id = demo_user_id;
        DELETE FROM imported_files WHERE user_id = demo_user_id;
        DELETE FROM password_reset_codes WHERE user_id = demo_user_id;
        DELETE FROM open_finance_connections WHERE user_id = demo_user_id;
        DELETE FROM rag_documents WHERE user_id = demo_user_id;
        DELETE FROM users WHERE id = demo_user_id;
    END LOOP;
END $$;
