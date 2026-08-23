package com.hellojourney.agent.tool;

import com.hellojourney.model.llm.LlmUsage;

import java.util.List;

/** Deliberately excludes provider reasoning_content. */
public record AgentRunResult(
        String traceId,
        String content,
        int iterations,
        List<ToolResult> toolResults,
        LlmUsage usage
) {
}
