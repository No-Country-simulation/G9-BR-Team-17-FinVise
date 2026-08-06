package com.financeai.backend.user;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import com.financeai.backend.auth.GenericMessageResponse;
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
    public ResponseEntity<ApiResponse<FinancialAnalysisHistoryPageResponse>> getHistory(
        @PathVariable UUID userId,
        @RequestParam(name = "page", defaultValue = "0") int page,
        @RequestParam(name = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
            userService.getHistory(
                authenticatedUserProvider.requireCurrentUser(userId), page, size)));
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

    @PutMapping("/me/password")
    public ResponseEntity<GenericMessageResponse> changePassword(
        @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(authenticatedUserProvider.getUserId(), request);
        return ResponseEntity.ok(new GenericMessageResponse("Senha atualizada com sucesso."));
    }
}
