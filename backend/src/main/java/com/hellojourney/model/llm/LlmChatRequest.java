package com.hellojourney.model.llm;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LlmChatRequest {
    private String model;
    private List<LlmMessage> messages;
    private Double temperature;
    @JsonProperty("max_tokens")
    private Integer maxTokens;
    private Map<String, String> thinking;
    @JsonProperty("reasoning_effort")
    private String reasoningEffort;
    @JsonProperty("response_format")
    private Map<String, String> responseFormat;
    private List<LlmToolDefinition> tools;
    @JsonProperty("tool_choice")
    private String toolChoice;
    @JsonProperty("user_id")
    private String userId;
}
