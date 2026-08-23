package com.hellojourney.agent.tool;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hellojourney.model.llm.LlmToolDefinition;

public record ToolDefinition(
        String name,
        String description,
        ObjectNode parameters,
        ToolAction action,
        AgentEventType eventType,
        String eventMessage
) {
    public LlmToolDefinition toLlmDefinition() {
        return LlmToolDefinition.builder()
                .type("function")
                .function(LlmToolDefinition.FunctionDefinition.builder()
                        .name(name)
                        .description(description)
                        .parameters(parameters)
                        .build())
                .build();
    }
}
