package com.hellojourney.model.llm;

import java.util.List;

/** Internal result. reasoningContent is retained only for protocol continuity. */
public record LlmChatResult(
        String content,
        String reasoningContent,
        List<LlmToolCall> toolCalls,
        String finishReason,
        String model,
        String responseId,
        String requestId,
        LlmUsage usage
) {
}
