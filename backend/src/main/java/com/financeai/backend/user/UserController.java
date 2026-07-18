package com.financeai.backend.user;

import com.financeai.backend.analysis.FinancialAnalysis;
import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import com.financeai.backend.recommendation.RecommendationDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public UserController(UserService userService,
                          AuthenticatedUserProvider authenticatedUserProvider) {
        this.userService = userService;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @GetMapping("/{userId}/dashboard")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
            userService.getDashboard(authenticatedUserProvider.requireCurrentUser(userId))));
    }

    @GetMapping("/{userId}/history")
    public ResponseEntity<ApiResponse<List<FinancialAnalysis>>> getHistory(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
            userService.getHistory(authenticatedUserProvider.requireCurrentUser(userId))));
    }

    @GetMapping("/{userId}/recommendations")
    public ResponseEntity<ApiResponse<List<RecommendationDto>>> getRecommendations(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
            userService.getRecommendations(authenticatedUserProvider.requireCurrentUser(userId))));
    }

    @PostMapping("/{userId}/simulations/savings")
    public ResponseEntity<ApiResponse<SavingsSimulationResponse>> simulateSavings(
        @PathVariable UUID userId,
        @Valid @RequestBody SavingsSimulationRequest request) {
        authenticatedUserProvider.requireCurrentUser(userId);
        return ResponseEntity.ok(ApiResponse.success(userService.simulateSavings(request)));
    }
}
