package com.financeai.backend;

import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.integration.ai.TransactionClassificationResult;
import com.financeai.backend.transaction.Transaction;
import com.financeai.backend.transaction.TransactionCategorizationService;
import com.financeai.backend.transaction.TransactionCategory;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.financeai.backend.transaction.TransactionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionCategorizationServiceTest {

    @Mock
    private AiServiceClient aiServiceClient;
    @Mock
    private TransactionCategoryRepository categoryRepository;

    private TransactionCategorizationService service;
    private TransactionCategory incomeCategory;
    private TransactionCategory healthCategory;

    @BeforeEach
    void setUp() {
        service = new TransactionCategorizationService(aiServiceClient, categoryRepository);
        incomeCategory = category("RENDA");
        healthCategory = category("SAUDE");
        when(categoryRepository.findAll()).thenReturn(List.of(
            incomeCategory,
            healthCategory,
            category("OUTROS"),
            category("ALIMENTACAO")
        ));
    }

    @Test
    void shouldForceIncomeToIncomeCategoryAndUseRulesWhenAiReturnsOthers() {
        when(aiServiceClient.classifyTransactions(any())).thenReturn(new TransactionClassificationResult(
            List.of(
                prediction("MORADIA"),
                prediction("OUTROS")
            ),
            "FALLBACK",
            "FALLBACK"
        ));
        Transaction income = transaction("Aluguel recebido", TransactionType.INCOME);
        Transaction expense = transaction("Plano de saude", TransactionType.EXPENSE);

        TransactionCategorizationService.CategorizationResult result =
            service.categorize(List.of(income, expense));

        assertThat(income.getCategoryId()).isEqualTo(incomeCategory.getId());
        assertThat(expense.getCategoryId()).isEqualTo(healthCategory.getId());
        assertThat(result.categorizedCount()).isEqualTo(2);
        assertThat(result.modelVersion()).isEqualTo("FALLBACK");
    }

    private Transaction transaction(String description, TransactionType type) {
        Transaction transaction = new Transaction();
        transaction.setDescription(description);
        transaction.setType(type);
        transaction.setAmount(BigDecimal.TEN);
        transaction.setRecurrent(false);
        transaction.setSource("CSV_IMPORT");
        return transaction;
    }

    private TransactionCategory category(String code) {
        TransactionCategory category = new TransactionCategory();
        category.setId(UUID.randomUUID());
        category.setCode(code);
        return category;
    }

    private TransactionClassificationResult.Prediction prediction(String code) {
        return new TransactionClassificationResult.Prediction(code, code, 0.75, List.of(code.toLowerCase()));
    }
}
