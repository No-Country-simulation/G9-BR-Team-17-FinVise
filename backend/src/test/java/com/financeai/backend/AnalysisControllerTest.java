package com.financeai.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.financeai.backend.analysis.AnalysisResponse;
import com.financeai.backend.analysis.AnalysisService;
import com.financeai.backend.analysis.CreateAnalysisRequest;
import com.financeai.backend.auth.JwtUtil;
import com.financeai.backend.transaction.TransactionDto;
import com.financeai.backend.transaction.TransactionType;
import com.financeai.backend.user.User;
import com.financeai.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AnalysisControllerTest extends PostgresTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private AnalysisService analysisService;

    private String authHeader;
    private UUID authenticatedUserId;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("test-" + UUID.randomUUID() + "@example.com");
        user.setName("Test User");
        user.setPasswordHash("hash");
        user = userRepository.save(user);

        authenticatedUserId = user.getId();
        String token = jwtUtil.generateToken(authenticatedUserId, user.getEmail());
        authHeader = "Bearer " + token;
    }

    @Test
    void shouldCreateAnalysis() throws Exception {
        UUID analysisId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        AnalysisResponse response = new AnalysisResponse(
            analysisId,
            userId,
            null,
            null,
            Collections.emptyMap(),
            Collections.emptyList(),
            Collections.emptyList(),
            Collections.emptyMap(),
            null
        );
        when(analysisService.createAnalysis(any(), any())).thenReturn(response);

        List<TransactionDto> transactions = List.of(
            new TransactionDto(null, "Salário", BigDecimal.valueOf(5000.00), LocalDate.of(2024, 1, 1),
                TransactionType.INCOME, null, null, false, null)
        );
        CreateAnalysisRequest request = new CreateAnalysisRequest(
            BigDecimal.valueOf(5000.00),
            BigDecimal.valueOf(20.00),
            "MEDIUM",
            BigDecimal.valueOf(1000.00),
            transactions
        );

        mockMvc.perform(post("/api/v1/financial-analyses")
                .header("Authorization", authHeader)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.analysisId").value(analysisId.toString()));

        verify(analysisService).createAnalysis(eq(authenticatedUserId), any());
    }

    @Test
    void shouldGetAnalysis() throws Exception {
        UUID analysisId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        AnalysisResponse response = new AnalysisResponse(
            analysisId,
            userId,
            null,
            null,
            Collections.emptyMap(),
            Collections.emptyList(),
            Collections.emptyList(),
            Collections.emptyMap(),
            null
        );
        when(analysisService.getAnalysis(any(), org.mockito.ArgumentMatchers.eq(analysisId)))
            .thenReturn(response);

        mockMvc.perform(get("/api/v1/financial-analyses/{analysisId}", analysisId)
                .header("Authorization", authHeader))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.analysisId").value(analysisId.toString()));

        verify(analysisService).getAnalysis(authenticatedUserId, analysisId);
    }

    @Test
    void shouldDeleteAnalysisOwnedByAuthenticatedUser() throws Exception {
        UUID analysisId = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/financial-analyses/{analysisId}", analysisId)
                .header("Authorization", authHeader))
            .andExpect(status().isNoContent());

        verify(analysisService).deleteAnalysis(authenticatedUserId, analysisId);
    }

    @Test
    void shouldReturnSuccessfulEmptyResponseWhenThereIsNoLatestAnalysis() throws Exception {
        mockMvc.perform(get("/api/v1/financial-analyses/latest")
                .header("Authorization", authHeader))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void shouldListBothProfileAnalysisModels() throws Exception {
        mockMvc.perform(get("/api/v1/financial-analyses/models")
                .header("Authorization", authHeader))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(2))
            .andExpect(jsonPath("$.data[0].code").value("MACHINE_LEARNING"))
            .andExpect(jsonPath("$.data[1].code").value("FINANCIAL_RULES"));
    }

    @Test
    void shouldAnalyzeStoredTransactionsWithSelectedModel() throws Exception {
        UUID analysisId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID firstSourceId = UUID.randomUUID();
        UUID secondSourceId = UUID.randomUUID();
        AnalysisResponse response = new AnalysisResponse(
            analysisId,
            userId,
            null,
            null,
            Collections.emptyMap(),
            Collections.emptyList(),
            Collections.emptyList(),
            java.util.Map.of("analysisModel", "MACHINE_LEARNING"),
            null
        );
        when(analysisService.analyzeStoredTransactions(
            any(), any(), any(), any(), any(), any(), any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/financial-analyses/from-transactions")
                .header("Authorization", authHeader)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "userId": "%s",
                      "model": "MACHINE_LEARNING",
                      "source": "CSV_IMPORT",
                      "importSourceIds": ["%s", "%s"]
                    }
                    """.formatted(userId, firstSourceId, secondSourceId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.analysisId").value(analysisId.toString()))
            .andExpect(jsonPath("$.data.modelVersions.analysisModel").value("MACHINE_LEARNING"));

        verify(analysisService).analyzeStoredTransactions(
            eq(authenticatedUserId), any(), any(), any(),
            eq(List.of(firstSourceId, secondSourceId)), any(), any());
    }

    @Test
    void shouldRejectUserPathThatDoesNotMatchAuthenticatedUser() throws Exception {
        mockMvc.perform(get("/api/v1/users/{userId}/dashboard", UUID.randomUUID())
                .header("Authorization", authHeader))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }
}
