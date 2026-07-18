package com.financeai.backend.openfinance;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/open-finance")
public class OpenFinanceController {
    private final OpenFinanceService openFinanceService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public OpenFinanceController(OpenFinanceService openFinanceService,
                                 AuthenticatedUserProvider authenticatedUserProvider) {
        this.openFinanceService = openFinanceService;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<OpenFinanceStatusResponse>> status() {
        return ResponseEntity.ok(ApiResponse.success(openFinanceService.status()));
    }

    @PostMapping("/connect-token")
    public ResponseEntity<ApiResponse<OpenFinanceConnectTokenResponse>> connectToken() {
        return ResponseEntity.ok(ApiResponse.success(
            openFinanceService.createConnectToken(authenticatedUserProvider.getUserId())));
    }

    @PostMapping("/items/{itemId}/sync")
    public ResponseEntity<ApiResponse<OpenFinanceSyncResponse>> synchronize(
        @PathVariable String itemId,
        @Valid @RequestBody OpenFinanceSyncRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
            openFinanceService.synchronize(
                authenticatedUserProvider.getUserId(), itemId, request.model())));
    }
}
