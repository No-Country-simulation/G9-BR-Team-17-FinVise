package com.financeai.backend.agent;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class AgentFinancialContextRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public AgentFinancialContextRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Overview overview(UUID userId, String source, List<UUID> sourceIds) {
        return jdbc.queryForObject("""
            SELECT COUNT(*) AS transaction_count,
                   MIN(transaction_date) AS period_start,
                   MAX(transaction_date) AS period_end,
                   COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0) AS total_income,
                   COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0) AS total_expenses
            FROM transactions
            """ + where(sourceIds), parameters(userId, source, sourceIds), (rs, row) ->
            new Overview(rs.getInt("transaction_count"),
                rs.getObject("period_start", LocalDate.class),
                rs.getObject("period_end", LocalDate.class),
                rs.getBigDecimal("total_income"), rs.getBigDecimal("total_expenses")));
    }

    public List<MonthlyFact> monthlyFacts(UUID userId, String source, List<UUID> sourceIds,
                                          int maximumMonths) {
        MapSqlParameterSource params = parameters(userId, source, sourceIds)
            .addValue("maximumMonths", maximumMonths);
        return jdbc.query("""
            SELECT * FROM (
            SELECT TO_CHAR(DATE_TRUNC('month', transaction_date), 'YYYY-MM') AS period,
                   COUNT(*) AS transaction_count,
                   COUNT(*) FILTER (WHERE type = 'INCOME') AS income_count,
                   COUNT(*) FILTER (WHERE type = 'EXPENSE') AS expense_count,
                   COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0) AS total_income,
                   COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0) AS total_expenses
            FROM transactions
            """ + where(sourceIds) + """
            GROUP BY DATE_TRUNC('month', transaction_date)
            ORDER BY DATE_TRUNC('month', transaction_date) DESC
            LIMIT :maximumMonths
            ) bounded_months
            ORDER BY period
            """, params, (rs, row) -> new MonthlyFact(
            rs.getString("period"), rs.getInt("transaction_count"),
            rs.getInt("income_count"), rs.getInt("expense_count"),
            rs.getBigDecimal("total_income"), rs.getBigDecimal("total_expenses")));
    }

    public List<CategoryFact> expenseCategories(UUID userId, String source,
                                                 List<UUID> sourceIds) {
        return jdbc.query("""
            SELECT COALESCE(category.code, 'OUTROS') AS category,
                   COALESCE(SUM(t.amount), 0) AS total
            FROM transactions t
            LEFT JOIN transaction_categories category ON category.id = t.category_id
            """ + where(sourceIds, "t") + """
              AND t.type = 'EXPENSE'
            GROUP BY COALESCE(category.code, 'OUTROS')
            ORDER BY total DESC
            LIMIT 30
            """, parameters(userId, source, sourceIds), (rs, row) ->
            new CategoryFact(rs.getString("category"), rs.getBigDecimal("total")));
    }

    public List<TransactionFact> recentTransactions(UUID userId, String source,
                                                     List<UUID> sourceIds, int limit) {
        MapSqlParameterSource params = parameters(userId, source, sourceIds).addValue("limit", limit);
        return jdbc.query("""
            SELECT id, description, amount, type, transaction_date, payment_method, recurrent
            FROM transactions
            """ + where(sourceIds) + """
            ORDER BY transaction_date DESC, id DESC LIMIT :limit
            """, params, transactionMapper());
    }

    public List<TransactionFact> recurringExpenses(UUID userId, String source,
                                                    List<UUID> sourceIds, int limit) {
        MapSqlParameterSource params = parameters(userId, source, sourceIds).addValue("limit", limit);
        return jdbc.query("""
            SELECT id, description, amount, type, transaction_date, payment_method, recurrent
            FROM transactions
            """ + where(sourceIds) + """
              AND type = 'EXPENSE' AND recurrent = TRUE
            ORDER BY transaction_date DESC, amount DESC, id DESC LIMIT :limit
            """, params, transactionMapper());
    }

    public List<TransactionFact> rankedTransactions(UUID userId, String source,
                                                     List<UUID> sourceIds,
                                                     String type, boolean ascending, int limit) {
        MapSqlParameterSource params = parameters(userId, source, sourceIds)
            .addValue("type", type).addValue("limit", limit);
        String direction = ascending ? "ASC" : "DESC";
        return jdbc.query("""
            SELECT id, description, amount, type, transaction_date, payment_method, recurrent
            FROM transactions
            """ + where(sourceIds) + " AND type = :type ORDER BY amount " + direction
            + ", transaction_date " + direction + ", id " + direction + " LIMIT :limit",
            params, transactionMapper());
    }

    public List<TransactionFact> rankedTransactionsForPeriod(
        UUID userId, String source, List<UUID> sourceIds, String type,
        boolean ascending, int month, Integer year, int limit
    ) {
        MapSqlParameterSource params = parameters(userId, source, sourceIds)
            .addValue("type", type).addValue("month", month)
            .addValue("year", year).addValue("limit", limit);
        String direction = ascending ? "ASC" : "DESC";
        return jdbc.query("""
            SELECT id, description, amount, type, transaction_date, payment_method, recurrent
            FROM transactions
            """ + where(sourceIds) + """
              AND type = :type
              AND EXTRACT(MONTH FROM transaction_date) = :month
              AND (CAST(:year AS integer) IS NULL
                   OR EXTRACT(YEAR FROM transaction_date) = CAST(:year AS integer))
            ORDER BY amount """ + direction + ", transaction_date " + direction
            + ", id " + direction + " LIMIT :limit", params, transactionMapper());
    }

    private org.springframework.jdbc.core.RowMapper<TransactionFact> transactionMapper() {
        return (rs, row) -> new TransactionFact(rs.getObject("id", UUID.class),
            rs.getString("description"), rs.getBigDecimal("amount"), rs.getString("type"),
            rs.getObject("transaction_date", LocalDate.class), rs.getString("payment_method"),
            rs.getBoolean("recurrent"));
    }

    private String where(List<UUID> sourceIds) { return where(sourceIds, null); }

    private String where(List<UUID> sourceIds, String alias) {
        String prefix = alias == null ? "" : alias + ".";
        return " WHERE " + prefix + "user_id = :userId"
            + " AND (CAST(:source AS text) IS NULL OR " + prefix + "source = CAST(:source AS text))"
            + (sourceIds.isEmpty() ? "" : " AND " + prefix + "import_source_id IN (:sourceIds)");
    }

    private MapSqlParameterSource parameters(UUID userId, String source, List<UUID> sourceIds) {
        return new MapSqlParameterSource().addValue("userId", userId)
            .addValue("source", source).addValue("sourceIds", sourceIds);
    }

    public record Overview(int transactionCount, LocalDate periodStart, LocalDate periodEnd,
                           BigDecimal totalIncome, BigDecimal totalExpenses) {}
    public record MonthlyFact(String period, int transactionCount, int incomeCount,
                              int expenseCount, BigDecimal totalIncome,
                              BigDecimal totalExpenses) {
        public BigDecimal balance() { return totalIncome.subtract(totalExpenses); }
    }
    public record CategoryFact(String category, BigDecimal total) {}
    public record TransactionFact(UUID id, String description, BigDecimal amount, String type,
                                  LocalDate date, String paymentMethod, boolean recurrent) {}
}
