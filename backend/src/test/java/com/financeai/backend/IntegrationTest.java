package com.financeai.backend;

import com.financeai.backend.analysis.FinancialAnalysisRepository;
import com.financeai.backend.indicator.FinancialIndicatorRepository;
import com.financeai.backend.indicator.SpendingSummaryRepository;
import com.financeai.backend.recommendation.RecommendationRepository;
import com.financeai.backend.transaction.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class IntegrationTest extends PostgresTestSupport {

    @LocalServerPort
    private int port;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private FinancialAnalysisRepository analysisRepository;

    @Autowired
    private FinancialIndicatorRepository indicatorRepository;

    @Autowired
    private SpendingSummaryRepository spendingSummaryRepository;

    @Autowired
    private RecommendationRepository recommendationRepository;

    @Test
    void contextLoads() {
        assertThat(port).isPositive();
    }

    @Test
    void actuatorHealthShouldBeUp() {
        RestClient restClient = RestClient.create();
        String response = restClient.get()
            .uri("http://localhost:{port}/actuator/health", port)
            .retrieve()
            .body(String.class);

        assertThat(response).contains("\"status\":\"UP\"");
    }

    @Test
    void cleanDatabaseShouldApplyAllMigrations() {
        Integer appliedMigrations = jdbcTemplate.queryForObject(
            "select count(*) from flyway_schema_history where success",
            Integer.class);
        String usersTable = jdbcTemplate.queryForObject(
            "select to_regclass('public.users')", String.class);
        String ragQueueTable = jdbcTemplate.queryForObject(
            "select to_regclass('public.rag_index_jobs')", String.class);
        Integer ragConsistencyColumns = jdbcTemplate.queryForObject("""
            select count(*)
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'rag_documents'
              and column_name in ('chunk_key', 'schema_version')
            """, Integer.class);

        assertThat(appliedMigrations).isEqualTo(25);
        assertThat(usersTable).isEqualTo("users");
        assertThat(ragQueueTable).isEqualTo("rag_index_jobs");
        assertThat(ragConsistencyColumns).isEqualTo(2);
    }

    @Test
    void queryOptimizationIndexesShouldBeAvailable() {
        Integer indexes = jdbcTemplate.queryForObject("""
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname IN (
                'idx_agent_messages_conversation_created_id',
                'idx_financial_analyses_user_created',
                'idx_financial_analyses_user_source_created',
                'idx_financial_analyses_user_import_source_created',
                'idx_agent_conversations_user_created',
                'idx_transactions_user_source_import_date'
              )
            """, Integer.class);

        assertThat(indexes).isEqualTo(6);
    }

    @Test
    @Transactional
    void optimizedQueriesShouldAggregateAndProjectWithoutLoadingCompleteCollections() {
        UUID userId = UUID.randomUUID();
        UUID incomeId = UUID.randomUUID();
        UUID expenseId = UUID.randomUUID();
        UUID analysisId = UUID.randomUUID();
        UUID indicatorId = UUID.randomUUID();
        UUID summaryId = UUID.randomUUID();
        UUID recommendationId = UUID.randomUUID();

        jdbcTemplate.update("""
            INSERT INTO users (id, email, password_hash, name)
            VALUES (CAST(? AS uuid), ?, 'hash', 'Query Test')
            """, userId.toString(), "query-" + userId + "@example.com");
        jdbcTemplate.update("""
            INSERT INTO transactions
                (id, user_id, description, amount, transaction_date, type, recurrent, source)
            VALUES
                (CAST(? AS uuid), CAST(? AS uuid), 'Salário', 5000, DATE '2026-07-01',
                 'INCOME', false, 'CSV_IMPORT'),
                (CAST(? AS uuid), CAST(? AS uuid), 'Mercado', 1250, DATE '2026-07-05',
                 'EXPENSE', false, 'CSV_IMPORT')
            """,
            incomeId.toString(), userId.toString(), expenseId.toString(), userId.toString());
        jdbcTemplate.update("""
            INSERT INTO financial_analyses
                (id, user_id, analysis_period, profile_classification, score, confidence,
                 model_versions)
            VALUES
                (CAST(? AS uuid), CAST(? AS uuid), '2026-07', 'SAUDAVEL', 80, 0.9,
                 CAST(? AS jsonb))
            """, analysisId.toString(), userId.toString(),
            "{\"transactionSource\":\"CSV_IMPORT\"}");
        jdbcTemplate.update("""
            INSERT INTO financial_indicators
                (id, analysis_id, monthly_income, total_expenses, income_commitment_pct,
                 debt_level_pct, savings_rate_pct, recurring_expenses_count,
                 fixed_expenses_pct, non_essential_expenses_pct, reserve_in_months)
            VALUES
                (CAST(? AS uuid), CAST(? AS uuid), 5000, 1250, 25, 0, 75, 0, 25, 0, 4)
            """, indicatorId.toString(), analysisId.toString());
        jdbcTemplate.update("""
            INSERT INTO spending_summaries
                (id, analysis_id, category_code, amount, percentage)
            VALUES (CAST(? AS uuid), CAST(? AS uuid), 'OUTROS', 1250, 100)
            """, summaryId.toString(), analysisId.toString());
        jdbcTemplate.update("""
            INSERT INTO recommendations
                (id, analysis_id, title, description, priority)
            VALUES (CAST(? AS uuid), CAST(? AS uuid), 'Poupar', 'Mantenha a reserva', 'HIGH')
            """, recommendationId.toString(), analysisId.toString());

        TransactionRepository.TotalsProjection totals = transactionRepository.summarize(
            userId, "CSV_IMPORT", null);
        assertThat(totals.getTotalIncome()).isEqualByComparingTo("5000");
        assertThat(totals.getTotalExpense()).isEqualByComparingTo("1250");
        assertThat(transactionRepository.summarizeByMonth(userId, "CSV_IMPORT", null))
            .singleElement()
            .satisfies(month -> assertThat(month.getMonthValue()).isEqualTo("2026-07"));
        assertThat(transactionRepository.summarizeExpensesByCategory(
            userId, "CSV_IMPORT", null))
            .singleElement()
            .satisfies(category -> {
                assertThat(category.getCategoryCode()).isEqualTo("OUTROS");
                assertThat(category.getAmount()).isEqualByComparingTo("1250");
            });

        assertThat(analysisRepository.findLatestByUserAndSource(
            userId, "CSV_IMPORT", null)).hasValueSatisfying(
                analysis -> assertThat(analysis.getId()).isEqualTo(analysisId));
        assertThat(analysisRepository.findPageByUserAndSource(
            userId, "CSV_IMPORT", PageRequest.of(0, 20)).getTotalElements()).isEqualTo(1);
        assertThat(indicatorRepository.findViewsByAnalysisIds(List.of(analysisId)))
            .singleElement()
            .satisfies(indicator -> assertThat(indicator.getMonthlyIncome())
                .isEqualByComparingTo("5000"));
        assertThat(spendingSummaryRepository.findViewsByAnalysisIds(List.of(analysisId)))
            .singleElement()
            .satisfies(summary -> assertThat(summary.getAmount()).isEqualByComparingTo("1250"));
        assertThat(recommendationRepository.findViewsByAnalysisIds(List.of(analysisId)))
            .singleElement()
            .satisfies(recommendation -> assertThat(recommendation.getId())
                .isEqualTo(recommendationId));
    }
}
