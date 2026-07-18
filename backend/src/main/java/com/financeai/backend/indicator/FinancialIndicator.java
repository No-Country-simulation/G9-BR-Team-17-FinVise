package com.financeai.backend.indicator;

import com.financeai.backend.analysis.FinancialAnalysis;
import jakarta.persistence.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "financial_indicators")
@EntityListeners(AuditingEntityListener.class)
public class FinancialIndicator {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false, unique = true)
    private FinancialAnalysis analysis;

    @Column(name = "monthly_income", precision = 19, scale = 2)
    private BigDecimal monthlyIncome;

    @Column(name = "total_income", precision = 19, scale = 2)
    private BigDecimal totalIncome;

    @Column(name = "total_expenses", precision = 19, scale = 2)
    private BigDecimal totalExpenses;

    @Column(name = "monthly_balance", precision = 19, scale = 2)
    private BigDecimal monthlyBalance;

    @Column(name = "income_commitment_pct", precision = 19, scale = 2)
    private BigDecimal incomeCommitmentPercentage;

    @Column(name = "debt_level_pct", precision = 19, scale = 2)
    private BigDecimal debtLevelPercentage;

    @Column(name = "savings_rate_pct", precision = 19, scale = 2)
    private BigDecimal savingsRatePercentage;

    @Column(name = "fixed_expenses_pct", precision = 19, scale = 2)
    private BigDecimal fixedExpensesPercentage;

    @Column(name = "non_essential_expenses_pct", precision = 19, scale = 2)
    private BigDecimal nonEssentialExpensesPercentage;

    @Column(name = "recurring_expenses_count")
    private Integer recurringExpensesCount;

    @Column(name = "top_category")
    private String topCategory;

    @Column(name = "variation_pct", precision = 19, scale = 2)
    private BigDecimal variationPercentage;

    @Column(name = "reserve_in_months", precision = 19, scale = 2)
    private BigDecimal reserveInMonths;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public FinancialAnalysis getAnalysis() {
        return analysis;
    }

    public void setAnalysis(FinancialAnalysis analysis) {
        this.analysis = analysis;
    }

    public BigDecimal getMonthlyIncome() {
        return monthlyIncome;
    }

    public void setMonthlyIncome(BigDecimal monthlyIncome) {
        this.monthlyIncome = monthlyIncome;
    }

    public BigDecimal getTotalIncome() {
        return totalIncome;
    }

    public void setTotalIncome(BigDecimal totalIncome) {
        this.totalIncome = totalIncome;
    }

    public BigDecimal getTotalExpenses() {
        return totalExpenses;
    }

    public void setTotalExpenses(BigDecimal totalExpenses) {
        this.totalExpenses = totalExpenses;
    }

    public BigDecimal getMonthlyBalance() {
        return monthlyBalance;
    }

    public void setMonthlyBalance(BigDecimal monthlyBalance) {
        this.monthlyBalance = monthlyBalance;
    }

    public BigDecimal getIncomeCommitmentPercentage() {
        return incomeCommitmentPercentage;
    }

    public void setIncomeCommitmentPercentage(BigDecimal incomeCommitmentPercentage) {
        this.incomeCommitmentPercentage = incomeCommitmentPercentage;
    }

    public BigDecimal getDebtLevelPercentage() {
        return debtLevelPercentage;
    }

    public void setDebtLevelPercentage(BigDecimal debtLevelPercentage) {
        this.debtLevelPercentage = debtLevelPercentage;
    }

    public BigDecimal getSavingsRatePercentage() {
        return savingsRatePercentage;
    }

    public void setSavingsRatePercentage(BigDecimal savingsRatePercentage) {
        this.savingsRatePercentage = savingsRatePercentage;
    }

    public BigDecimal getFixedExpensesPercentage() {
        return fixedExpensesPercentage;
    }

    public void setFixedExpensesPercentage(BigDecimal fixedExpensesPercentage) {
        this.fixedExpensesPercentage = fixedExpensesPercentage;
    }

    public BigDecimal getNonEssentialExpensesPercentage() {
        return nonEssentialExpensesPercentage;
    }

    public void setNonEssentialExpensesPercentage(BigDecimal nonEssentialExpensesPercentage) {
        this.nonEssentialExpensesPercentage = nonEssentialExpensesPercentage;
    }

    public Integer getRecurringExpensesCount() {
        return recurringExpensesCount;
    }

    public void setRecurringExpensesCount(Integer recurringExpensesCount) {
        this.recurringExpensesCount = recurringExpensesCount;
    }

    public String getTopCategory() {
        return topCategory;
    }

    public void setTopCategory(String topCategory) {
        this.topCategory = topCategory;
    }

    public BigDecimal getVariationPercentage() {
        return variationPercentage;
    }

    public void setVariationPercentage(BigDecimal variationPercentage) {
        this.variationPercentage = variationPercentage;
    }

    public BigDecimal getReserveInMonths() {
        return reserveInMonths;
    }

    public void setReserveInMonths(BigDecimal reserveInMonths) {
        this.reserveInMonths = reserveInMonths;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
