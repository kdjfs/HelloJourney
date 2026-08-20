package com.hellojourney.model.llm;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LlmToolDefinition {
    @Builder.Default
    private String type = "function";
    private FunctionDefinition function;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FunctionDefinition {
        private String name;
        private String description;
        private JsonNode parameters;
        private Boolean strict;
    }
}
