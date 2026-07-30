package com.financeai.backend.fact;

import com.financeai.backend.transaction.TransactionType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

public record FinancialFactsPayload(
    Overview overview,
    List<MonthlyFact> months,
    List<CategoryFact> categories,
    Rankings rankings,
    DataQuality dataQuality
) {
    public record Overview(
        int transactionCount,
        int incomeCount,
        int expenseCount,
        BigDecimal totalIncome,
        BigDecimal totalExpenses,
        BigDecimal balance,
        BigDecimal averageIncome,
        BigDecimal averageExpense,
        BigDecimal medianIncome,
        BigDecimal medianExpense,
        int recurringExpenseCount,
        BigDecimal recurringExpenseTotal
    ) {
    }

    public record MonthlyFact(
        YearMonth period,
        int transactionCount,
        int incomeCount,
        int expenseCount,
        BigDecimal totalIncome,
        BigDecimal totalExpenses,
        BigDecimal balance,
        BigDecimal expenseVariationPercentage
    ) {
    }

    public record CategoryFact(
        String code,
        String name,
        int transactionCount,
        BigDecimal totalExpenses,
        BigDecimal percentage,
        BigDecimal averageExpense,
        BigDecimal minimumExpense,
        BigDecimal maximumExpense
    ) {
    }

    public record Rankings(
        MonthlyFact highestExpenseMonth,
        MonthlyFact lowestExpenseMonth,
        MonthlyFact highestBalanceMonth,
        MonthlyFact lowestBalanceMonth,
        List<TransactionFact> smallestExpenses,
        List<TransactionFact> largestExpenses,
        List<TransactionFact> smallestIncomes,
        List<TransactionFact> largestIncomes,
        List<TransactionFact> recurringExpenses
    ) {
    }

    public record TransactionFact(
        UUID id,
        String description,
        BigDecimal amount,
        LocalDate date,
        TransactionType type,
        String categoryCode
    ) {
    }

    public record DataQuality(
        int uncategorizedExpenseCount,
        BigDecimal uncategorizedExpensePercentage,
        int monthsCovered
    ) {
    }
}
