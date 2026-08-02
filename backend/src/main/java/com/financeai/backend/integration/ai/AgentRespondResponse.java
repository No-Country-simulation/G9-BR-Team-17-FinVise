package com.financeai.backend.integration.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record AgentRespondResponse(
    @JsonProperty("message") MessageDto message,
    @JsonProperty("tool_calls") List<ToolCallDto> toolCalls,
    @JsonProperty("sources") List<RagSourceDto> sources,
    @JsonProperty("disclaimer") String disclaimer
) {
    public record MessageDto(
        @JsonProperty("role") String role,
        @JsonProperty("content") String content
    ) {}

    public record ToolCallDto(
        @JsonProperty("tool") String tool,
        @JsonProperty("arguments") Map<String, Object> arguments,
        @JsonProperty("result") Object result
    ) {}

    public record RagSourceDto(
        @JsonProperty("id") String id,
        @JsonProperty("source_id") String sourceId,
        @JsonProperty("source_name") String sourceName,
        @JsonProperty("chunk_type") String chunkType,
        @JsonProperty("score") Double score
    ) {}
}
