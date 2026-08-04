package com.financeai.backend.agent;

import com.financeai.backend.common.response.ApiResponse;
import com.financeai.backend.auth.AuthenticatedUserProvider;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

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

    @PostMapping(
        value = "/conversations/{conversationId}/messages/stream",
        produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public ResponseEntity<StreamingResponseBody> streamMessage(
        @PathVariable UUID conversationId,
        @Valid @RequestBody SendMessageRequest request
    ) {
        StreamingResponseBody stream = agentService.streamMessage(
            authenticatedUserProvider.getUserId(), conversationId, request);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header("X-Accel-Buffering", "no")
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .body(stream);
    }

    @GetMapping("/conversations/{conversationId}")
    public ResponseEntity<ApiResponse<ConversationResponse>> getConversation(
        @PathVariable UUID conversationId,
        @RequestParam(name = "page", defaultValue = "0") int page,
        @RequestParam(name = "size", defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(agentService.getConversation(
            authenticatedUserProvider.getUserId(), conversationId, page, size)));
    }

    @GetMapping("/conversations")
    public ResponseEntity<ApiResponse<ConversationPageResponse>> getConversations(
        @RequestParam(name = "page", defaultValue = "0") int page,
        @RequestParam(name = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(agentService.getConversations(
            authenticatedUserProvider.getUserId(), page, size)));
    }
}
