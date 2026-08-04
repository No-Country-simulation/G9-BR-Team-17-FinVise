package com.financeai.backend;

import com.financeai.backend.analysis.*;
import com.financeai.backend.indicator.FinancialIndicatorRepository;
import com.financeai.backend.indicator.SpendingSummaryRepository;
import com.financeai.backend.integration.ai.*;
import com.financeai.backend.recommendation.RecommendationRepository;
import com.financeai.backend.recommendation.RecommendationEngine;
import com.financeai.backend.transaction.*;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionOperations;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinancialCalculationTest {

    @Mock
    private FinancialAnalysisRepository analysisRepository;
    @Mock
    private FinancialIndicatorRepository indicatorRepository;
    @Mock
    private SpendingSummaryRepository spendingSummaryRepository;
    @Mock
    private RecommendationRepository recommendationRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private TransactionCategoryRepository categoryRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AiServiceClient aiServiceClient;

    @InjectMocks
    private AnalysisService analysisService;

    private final RecommendationEngine recommendationEngine = new RecommendationEngine();

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user = new User();
        user.setId(userId);
        user.setEmail("test@example.com");
        user.setName("Test User");
        user.setPasswordHash("hash");

        // O recommendation engine é real; o objectMapper também.
        analysisService = new AnalysisService(
            analysisRepository,
            indicatorRepository,
            spendingSummaryRepository,
            recommendationRepository,
            transactionRepository,
            categoryRepository,
            userRepository,
            aiServiceClient,
            recommendationEngine,
            immediateTransactions()
        );
    }

    @Test
    void shouldCalculateIncomeExpensesAndIndicators() {
        // given
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(aiServiceClient.classifyTransactions(any())).thenReturn(null);
        when(aiServiceClient.analyzeProfile(any())).thenReturn(new ProfileAnalysisResult(
            "SAUDAVEL",
            BigDecimal.valueOf(80.00),
            BigDecimal.valueOf(0.95),
            List.of("Renda estável", "Poupança regular"),
            "test-model",
            null
        ));

        TransactionCategory others = new TransactionCategory();
        others.setId(UUID.randomUUID());
        others.setCode("OUTROS");
        when(categoryRepository.findAll()).thenReturn(List.of(others));
        when(categoryRepository.findAllById(any())).thenReturn(List.of(others));

        when(transactionRepository.saveAllAndFlush(any())).thenAnswer(invocation -> {
            List<Transaction> transactionsToSave = invocation.getArgument(0);
            transactionsToSave.forEach(transaction -> {
                if (transaction.getId() == null) {
                    transaction.setId(UUID.randomUUID());
                }
            });
            return transactionsToSave;
        });
        when(analysisRepository.save(any())).thenAnswer(invocation -> {
            FinancialAnalysis a = invocation.getArgument(0);
            if (a.getId() == null) {
                a.setId(UUID.randomUUID());
            }
            return a;
        });
        when(indicatorRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(spendingSummaryRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(recommendationRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<TransactionDto> transactions = List.of(
            new TransactionDto(null, "Salário", BigDecimal.valueOf(5000.00), LocalDate.of(2024, 1, 1),
                TransactionType.INCOME, null, null, false, null),
            new TransactionDto(null, "Aluguel", BigDecimal.valueOf(1200.00), LocalDate.of(2024, 1, 5),
                TransactionType.EXPENSE, null, null, true, null),
            new TransactionDto(null, "Supermercado", BigDecimal.valueOf(800.00), LocalDate.of(2024, 1, 10),
                TransactionType.EXPENSE, null, null, false, null)
        );

        CreateAnalysisRequest request = new CreateAnalysisRequest(
            BigDecimal.valueOf(5000.00),
            BigDecimal.valueOf(20.00),
            "MEDIUM",
            BigDecimal.valueOf(6000.00),
            transactions
        );

        // when
        AnalysisResponse response = analysisService.createAnalysis(user.getId(), request);

        // then
        IndicatorDto indicators = response.indicators();
        assertThat(indicators.monthlyIncome()).isEqualByComparingTo(BigDecimal.valueOf(5000.00));
        assertThat(indicators.totalExpenses()).isEqualByComparingTo(BigDecimal.valueOf(2000.00));
        assertThat(indicators.incomeCommitmentPercentage()).isEqualByComparingTo(BigDecimal.valueOf(40.00));
        assertThat(indicators.recurringExpensesCount()).isEqualTo(1);

        assertThat(response.spendingSummary()).containsKey("OUTROS");
        assertThat(response.spendingSummary().get("OUTROS").amount())
            .isEqualByComparingTo(BigDecimal.valueOf(2000.00));

        // Renda 5.000 - despesas 2.000 = sobra 3.000 => taxa de poupança base 60%
        assertThat(indicators.estimatedSavingsRate()).isEqualByComparingTo(BigDecimal.valueOf(60.00));
    }

    private TransactionOperations immediateTransactions() {
        return new TransactionOperations() {
            @Override
            public <T> T execute(TransactionCallback<T> action) {
                return action.doInTransaction(org.mockito.Mockito.mock(TransactionStatus.class));
            }
        };
    }

    @Test
    void shouldReturnZeroForEmptyIncomeCommitmentWhenNoIncome() {
        // given
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(aiServiceClient.classifyTransactions(any())).thenReturn(null);
        when(aiServiceClient.analyzeProfile(any())).thenReturn(new ProfileAnalysisResult(
            "EM_OBSERVACAO",
            BigDecimal.valueOf(50.00),
            BigDecimal.valueOf(0.80),
            List.of(),
            "test-model",
            null
        ));

        TransactionCategory others = new TransactionCategory();
        others.setId(UUID.randomUUID());
        others.setCode("OUTROS");
        when(categoryRepository.findAll()).thenReturn(List.of(others));
        when(categoryRepository.findAllById(any())).thenReturn(List.of(others));

        when(transactionRepository.saveAllAndFlush(any())).thenAnswer(invocation -> {
            List<Transaction> transactionsToSave = invocation.getArgument(0);
            transactionsToSave.forEach(transaction -> {
                if (transaction.getId() == null) {
                    transaction.setId(UUID.randomUUID());
                }
            });
            return transactionsToSave;
        });
        when(analysisRepository.save(any())).thenAnswer(invocation -> {
            FinancialAnalysis a = invocation.getArgument(0);
            if (a.getId() == null) {
                a.setId(UUID.randomUUID());
            }
            return a;
        });
        when(indicatorRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(spendingSummaryRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(recommendationRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<TransactionDto> transactions = List.of(
            new TransactionDto(null, "Aluguel", BigDecimal.valueOf(1000.00), LocalDate.of(2024, 1, 5),
                TransactionType.EXPENSE, null, null, false, null)
        );

        CreateAnalysisRequest request = new CreateAnalysisRequest(
            BigDecimal.ZERO,
            BigDecimal.ZERO,
            "LOW",
            BigDecimal.ZERO,
            transactions
        );

        // when
        AnalysisResponse response = analysisService.createAnalysis(user.getId(), request);

        // then
        IndicatorDto indicators = response.indicators();
        assertThat(indicators.incomeCommitmentPercentage()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(indicators.estimatedSavingsRate()).isEqualByComparingTo(BigDecimal.ZERO);
    }
}
