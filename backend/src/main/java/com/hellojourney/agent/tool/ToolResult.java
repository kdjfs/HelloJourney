package com.hellojourney.agent.tool;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

public record ToolResult(
        String callId,
        String toolName,
        boolean success,
        JsonNode data,
        String errorCode,
        boolean duplicate
) {
    public static ToolResult success(ToolCall call, JsonNode data) {
        return new ToolResult(call.id(), call.name(), true, data, null, false);
    }

    public static ToolResult error(ToolCall call, String errorCode) {
        return new ToolResult(call.id(), call.name(), false, null, errorCode, false);
    }

    public ToolResult asDuplicate(String duplicateCallId) {
        return new ToolResult(duplicateCallId, toolName, success, data, errorCode, true);
    }

    public String toModelContent(ObjectMapper objectMapper, String traceId) {
        ObjectNode envelope = objectMapper.createObjectNode();
        envelope.put("ok", success);
        envelope.put("tool", toolName);
        envelope.put("trace_id", traceId);
        envelope.put("duplicate", duplicate);
        if (success) {
            envelope.set("data", data == null ? objectMapper.nullNode() : data);
        } else {
            envelope.put("error", errorCode == null ? "tool_error" : errorCode);
        }
        return envelope.toString();
    }
}
