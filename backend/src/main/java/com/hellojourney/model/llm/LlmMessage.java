package com.hellojourney.model.llm;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LlmMessage {
    private String role;
    private String content;
    private String name;
    @JsonProperty("reasoning_content")
    private String reasoningContent;
    @JsonProperty("tool_calls")
    private List<LlmToolCall> toolCalls;
    @JsonProperty("tool_call_id")
    private String toolCallId;

    public static LlmMessage system(String content) {
        return LlmMessage.builder().role("system").content(content).build();
    }

    public static LlmMessage user(String content) {
        return LlmMessage.builder().role("user").content(content).build();
    }

    public static LlmMessage assistant(String content) {
        return LlmMessage.builder().role("assistant").content(content).build();
    }

    public static LlmMessage tool(String toolCallId, String content) {
        return LlmMessage.builder().role("tool").toolCallId(toolCallId).content(content).build();
    }
}
