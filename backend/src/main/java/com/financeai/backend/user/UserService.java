package com.financeai.backend.user;

import com.financeai.backend.analysis.FinancialAnalysis;
import com.financeai.backend.analysis.FinancialAnalysisRepository;
import com.financeai.backend.auth.RegisterRequest;
import com.financeai.backend.auth.RegisterResponse;
import com.financeai.backend.common.exception.EmailAlreadyExistsException;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.indicator.FinancialIndicator;
import com.financeai.backend.indicator.FinancialIndicatorRepository;
import com.financeai.backend.indicator.SpendingSummary;
import com.financeai.backend.indicator.SpendingSummaryRepository;
import com.financeai.backend.recommendation.Recommendation;
import com.financeai.backend.recommendation.RecommendationDto;
import com.financeai.backend.recommendation.RecommendationRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserService {

    private static final int SCALE = 2;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
    private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

    private final UserRepository userRepository;
    private final FinancialAnalysisRepository analysisRepository;
    private final FinancialIndicatorRepository indicatorRepository;
    private final SpendingSummaryRepository spendingSummaryRepository;
    private final RecommendationRepository recommendationRepository;
    private final PasswordEncoder passwordEncoder;


    public UserService(UserRepository userRepository,
                       FinancialAnalysisRepository analysisRepository,
                       FinancialIndicatorRepository indicatorRepository,
                       SpendingSummaryRepository spendingSummaryRepository,
                       RecommendationRepository recommendationRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.analysisRepository = analysisRepository;
        this.indicatorRepository = indicatorRepository;
        this.spendingSummaryRepository = spendingSummaryRepository;
        this.recommendationRepository = recommendationRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(UUID userId) {
        User user = findUser(userId);
        FinancialAnalysis latestAnalysis = analysisRepository.findTopByUserIdOrderByCreatedAtDesc(userId)
            .orElse(null);

        if (latestAnalysis == null) {
            return new DashboardResponse(
                userId, user.getName(), null, null, Collections.emptyMap(),
                Collections.emptyList(), BigDecimal.ZERO, null);
        }

        FinancialIndicator indicator = indicatorRepository.findByAnalysisId(latestAnalysis.getId())
            .orElseThrow(() -> new ResourceNotFoundException("Indicadores", latestAnalysis.getId()));

        List<SpendingSummary> summaries = spendingSummaryRepository.findByAnalysisId(latestAnalysis.getId());
        Map<String, DashboardResponse.CategorySummary> spendingMap = summaries.stream()
            .collect(Collectors.toMap(
                SpendingSummary::getCategoryCode,
                s -> new DashboardResponse.CategorySummary(s.getAmount(), s.getPercentage())
            ));

        List<RecommendationDto> topRecommendations = recommendationRepository
            .findByAnalysisIdOrderByPriorityDesc(latestAnalysis.getId()).stream()
            .map(this::toRecommendationDto)
            .limit(5)
            .toList();

        return new DashboardResponse(
            userId,
            user.getName(),
            new com.financeai.backend.analysis.FinancialProfileDto(
                latestAnalysis.getProfileClassification(),
                latestAnalysis.getScore(),
                latestAnalysis.getConfidence(),
                Collections.emptyList()),
            new com.financeai.backend.analysis.IndicatorDto(
                indicator.getMonthlyIncome(),
                indicator.getTotalExpenses(),
                indicator.getIncomeCommitmentPercentage(),
                indicator.getDebtLevelPercentage(),
                indicator.getSavingsRatePercentage(),
                indicator.getRecurringExpensesCount(),
                indicator.getFixedExpensesPercentage(),
                indicator.getNonEssentialExpensesPercentage(),
                indicator.getReserveInMonths()),
            spendingMap,
            topRecommendations,
            BigDecimal.ZERO,
            latestAnalysis.getAnalysisPeriod()
        );
    }

    @Transactional(readOnly = true)
    public List<FinancialAnalysis> getHistory(UUID userId) {
        findUser(userId);
        return analysisRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<RecommendationDto> getRecommendations(UUID userId) {
        findUser(userId);
        return recommendationRepository.findByAnalysis_UserIdOrderByCreatedAtDesc(userId).stream()
            .map(this::toRecommendationDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public SavingsSimulationResponse simulateSavings(SavingsSimulationRequest request) {
        BigDecimal monthlyIncome = request.monthlyIncome();
        BigDecimal currentRate = request.currentSavingsRate();
        BigDecimal targetRate = request.targetSavingsRate();
        int months = request.months();

        BigDecimal currentMonthly = monthlyIncome.multiply(currentRate).divide(ONE_HUNDRED, SCALE, ROUNDING);
        BigDecimal targetMonthly = monthlyIncome.multiply(targetRate).divide(ONE_HUNDRED, SCALE, ROUNDING);

        BigDecimal accumulatedCurrent = currentMonthly.multiply(BigDecimal.valueOf(months));
        BigDecimal accumulatedTarget = targetMonthly.multiply(BigDecimal.valueOf(months));

        BigDecimal additionalMonthlyEffort = targetMonthly.subtract(currentMonthly);
        BigDecimal projectedAnnualDifference = additionalMonthlyEffort.multiply(BigDecimal.valueOf(12));

        return new SavingsSimulationResponse(
            monthlyIncome,
            currentRate,
            targetRate,
            months,
            currentMonthly,
            targetMonthly,
            accumulatedCurrent,
            accumulatedTarget,
            additionalMonthlyEffort,
            projectedAnnualDifference
        );
    }

    @Transactional
    public RegisterResponse register(RegisterRequest req) {
        String normalizedEmail = req.email().trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new EmailAlreadyExistsException(normalizedEmail);
        }

        User user = new User();
        user.setName(req.fullName().trim());
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(req.password()));

        User saved = userRepository.save(user);

        return RegisterResponse.from(saved);
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Usuário", userId));
    }

    private RecommendationDto toRecommendationDto(Recommendation r) {
        return new RecommendationDto(
            r.getId(),
            r.getTitle(),
            r.getDescription(),
            r.getReason(),
            r.getPriority(),
            r.getCategory(),
            r.getExpectedImpact(),
            r.getSuggestedAmount(),
            r.getRelatedIndicator(),
            r.getCreatedAt()
        );
    }
}
