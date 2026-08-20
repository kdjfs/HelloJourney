package com.hellojourney.model.llm;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class LlmChatResponse {
    private String id;
    private String model;
    private List<Choice> choices;
    private LlmUsage usage;
    @JsonProperty("system_fingerprint")
    private String systemFingerprint;

    @Data
    public static class Choice {
        private int index;
        @JsonProperty("finish_reason")
        private String finishReason;
        private LlmMessage message;
    }
}
