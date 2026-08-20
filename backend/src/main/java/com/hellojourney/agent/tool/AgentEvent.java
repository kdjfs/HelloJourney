package com.hellojourney.agent.tool;

import java.time.Instant;

/** Safe progress event: contains no prompt, reasoning content, secret or raw provider response. */
public record AgentEvent(
        String traceId,
        AgentEventType type,
        String status,
        String message,
        String toolName,
        int iteration,
        Instant occurredAt
) {
}
