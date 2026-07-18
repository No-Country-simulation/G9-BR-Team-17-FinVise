package com.financeai.backend.agent;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/agent")
public class AgentController {

    private final AgentService agentService;
    private final AuthenticatedUserProvider authenticatedUserProvider;

    public AgentController(AgentService agentService,
                           AuthenticatedUserProvider authenticatedUserProvider) {
        this.agentService = agentService;
        this.authenticatedUserProvider = authenticatedUserProvider;
    }

    @PostMapping("/conversations")
    public ResponseEntity<ApiResponse<ConversationResponse>> createConversation(
        @Valid @RequestBody CreateConversationRequest request) {
        return ResponseEntity.ok(ApiResponse.success(agentService.createConversation(
            authenticatedUserProvider.getUserId(), request)));
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<ApiResponse<ConversationResponse>> sendMessage(
        @PathVariable UUID conversationId,
        @Valid @RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(ApiResponse.success(agentService.sendMessage(
            authenticatedUserProvider.getUserId(), conversationId, request)));
    }

    @GetMapping("/conversations/{conversationId}")
    public ResponseEntity<ApiResponse<ConversationResponse>> getConversation(
        @PathVariable UUID conversationId) {
        return ResponseEntity.ok(ApiResponse.success(agentService.getConversation(
            authenticatedUserProvider.getUserId(), conversationId)));
    }
}
