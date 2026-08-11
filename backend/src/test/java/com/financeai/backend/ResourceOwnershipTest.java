package com.financeai.backend;

import com.financeai.backend.agent.AgentConversationRepository;
import com.financeai.backend.agent.AgentMessageRepository;
import com.financeai.backend.agent.AgentService;
import com.financeai.backend.agent.SendMessageRequest;
import com.financeai.backend.analysis.AnalysisService;
import com.financeai.backend.analysis.FinancialAnalysis;
import com.financeai.backend.analysis.FinancialAnalysisRepository;
import com.financeai.backend.common.exception.ResourceNotFoundException;
import com.financeai.backend.indicator.FinancialIndicatorRepository;
import com.financeai.backend.indicator.SpendingSummaryRepository;
import com.financeai.backend.integration.ai.AiServiceClient;
import com.financeai.backend.recommendation.RecommendationEngine;
import com.financeai.backend.recommendation.RecommendationRepository;
import com.financeai.backend.transaction.TransactionCategoryRepository;
import com.financeai.backend.transaction.TransactionRepository;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ResourceOwnershipTest {

    @Test
    void shouldLoadAnalysisOnlyInsideAuthenticatedUserScope() {
        UUID userId = UUID.randomUUID();
        UUID analysisId = UUID.randomUUID();
        FinancialAnalysisRepository analysisRepository = mock(FinancialAnalysisRepository.class);
        when(analysisRepository.findByIdAndUserId(analysisId, userId)).thenReturn(Optional.empty());

        AnalysisService service = new AnalysisService(
            analysisRepository,
            mock(FinancialIndicatorRepository.class),
            mock(SpendingSummaryRepository.class),
            mock(RecommendationRepository.class),
            mock(TransactionRepository.class),
            mock(TransactionCategoryRepository.class),
            mock(UserRepository.class),
            mock(AiServiceClient.class),
            mock(RecommendationEngine.class),
            mock(org.springframework.transaction.support.TransactionOperations.class)
        );

        assertThatThrownBy(() -> service.getAnalysis(userId, analysisId))
            .isInstanceOf(ResourceNotFoundException.class);
        verify(analysisRepository).findByIdAndUserId(analysisId, userId);
    }

    @Test
    void shouldDeleteOnlyAnalysisOwnedByAuthenticatedUser() {
        UUID userId = UUID.randomUUID();
        UUID analysisId = UUID.randomUUID();
        FinancialAnalysis analysis = new FinancialAnalysis();
        analysis.setId(analysisId);
        FinancialAnalysisRepository analysisRepository = mock(FinancialAnalysisRepository.class);
        FinancialIndicatorRepository indicatorRepository = mock(FinancialIndicatorRepository.class);
        SpendingSummaryRepository spendingSummaryRepository = mock(SpendingSummaryRepository.class);
        RecommendationRepository recommendationRepository = mock(RecommendationRepository.class);
        when(analysisRepository.findByIdAndUserId(analysisId, userId)).thenReturn(Optional.of(analysis));

        AnalysisService service = new AnalysisService(
            analysisRepository,
            indicatorRepository,
            spendingSummaryRepository,
            recommendationRepository,
            mock(TransactionRepository.class),
            mock(TransactionCategoryRepository.class),
            mock(UserRepository.class),
            mock(AiServiceClient.class),
            mock(RecommendationEngine.class),
            mock(org.springframework.transaction.support.TransactionOperations.class)
        );

        service.deleteAnalysis(userId, analysisId);

        verify(analysisRepository).findByIdAndUserId(analysisId, userId);
        verify(recommendationRepository).deleteByAnalysisId(analysisId);
        verify(spendingSummaryRepository).deleteByAnalysisId(analysisId);
        verify(indicatorRepository).deleteByAnalysisId(analysisId);
        verify(analysisRepository).delete(analysis);
    }

    @Test
    void shouldLoadConversationOnlyInsideAuthenticatedUserScope() {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        AgentConversationRepository conversationRepository = mock(AgentConversationRepository.class);
        when(conversationRepository.findByIdAndUserId(conversationId, userId))
            .thenReturn(Optional.empty());

        AgentService service = new AgentService(
            conversationRepository,
            mock(AgentMessageRepository.class),
            mock(UserRepository.class),
            mock(com.financeai.backend.agent.AgentFinancialContextRepository.class),
            mock(com.financeai.backend.agent.AgentRequestCoordinator.class),
            new com.financeai.backend.agent.AgentContextProperties(),
            mock(com.financeai.backend.integration.ai.AiServiceClient.class),
            new com.fasterxml.jackson.databind.ObjectMapper()
        );

        assertThatThrownBy(() -> service.sendMessage(
            userId, conversationId, new SendMessageRequest("teste", UUID.randomUUID())))
            .isInstanceOf(ResourceNotFoundException.class);
        verify(conversationRepository).findByIdAndUserId(conversationId, userId);
    }
}
