package com.hellojourney.agent.tool;

import com.hellojourney.model.llm.LlmToolCall;

public record ToolCall(String id, String name, String arguments) {
    public static ToolCall from(LlmToolCall providerCall) {
        if (providerCall == null || providerCall.getFunction() == null) {
            return new ToolCall("unknown", "", "{}");
        }
        return new ToolCall(
                providerCall.getId() == null ? "unknown" : providerCall.getId(),
                providerCall.getFunction().getName() == null ? "" : providerCall.getFunction().getName(),
                providerCall.getFunction().getArguments() == null ? "{}" : providerCall.getFunction().getArguments());
    }
}
