package com.hellojourney.agent.tool;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Component;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.BooleanSupplier;

@Slf4j
@Component
public class ToolExecutor {
    private static final long CANCELLATION_POLL_MS = 100;

    private final ToolRegistry registry;
    private final JsonSchemaArgumentValidator validator;
    private final ObjectMapper objectMapper;
    private final AppSettings appSettings;
    private final AsyncTaskExecutor taskExecutor;

    public ToolExecutor(ToolRegistry registry, JsonSchemaArgumentValidator validator,
                        ObjectMapper objectMapper, AppSettings appSettings,
                        @Qualifier("agentToolExecutor") AsyncTaskExecutor taskExecutor) {
        this.registry = registry;
        this.validator = validator;
        this.objectMapper = objectMapper;
        this.appSettings = appSettings;
        this.taskExecutor = taskExecutor;
    }

    public ToolResult execute(ToolCall call, String traceId, BooleanSupplier cancellationRequested) {
        ToolDefinition definition = registry.find(call.name()).orElse(null);
        if (definition == null) {
            return ToolResult.error(call, "tool_not_allowed");
        }
        JsonNode arguments;
        try {
            arguments = objectMapper.readTree(call.arguments());
        } catch (JsonProcessingException exception) {
            return ToolResult.error(call, "invalid_json_arguments");
        }
        String validationError = validator.validate(arguments, definition.parameters());
        if (validationError != null) {
            return ToolResult.error(call, validationError);
        }

        int maxRetries = Math.max(0, appSettings.getAgent().getToolMaxRetries());
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            if (isCancelled(cancellationRequested)) {
                return ToolResult.error(call, "cancelled");
            }
            try {
                JsonNode result = invokeWithTimeout(definition, arguments, cancellationRequested);
                if (result.toString().length() > appSettings.getAgent().getMaxToolResultChars()) {
                    return ToolResult.error(call, "result_too_large");
                }
                return ToolResult.success(call, result);
            } catch (ToolCancelledException exception) {
                return ToolResult.error(call, "cancelled");
            } catch (TimeoutException exception) {
                if (attempt >= maxRetries) {
                    return ToolResult.error(call, "timeout");
                }
                log.warn("agent_tool_retry traceId={} tool={} reason=timeout attempt={}",
                        traceId, call.name(), attempt + 1);
            } catch (Exception exception) {
                if (attempt >= maxRetries) {
                    log.warn("agent_tool_failed traceId={} tool={} type={}",
                            traceId, call.name(), exception.getClass().getSimpleName());
                    return ToolResult.error(call, "execution_error");
                }
                log.warn("agent_tool_retry traceId={} tool={} reason=execution_error attempt={}",
                        traceId, call.name(), attempt + 1);
            }
        }
        return ToolResult.error(call, "execution_error");
    }

    private JsonNode invokeWithTimeout(ToolDefinition definition, JsonNode arguments,
                                       BooleanSupplier cancellationRequested) throws Exception {
        Future<JsonNode> future;
        try {
            future = taskExecutor.submit(() -> definition.action().execute(arguments));
        } catch (RejectedExecutionException exception) {
            throw new IllegalStateException("tool_executor_unavailable", exception);
        }

        long timeoutNanos = TimeUnit.SECONDS.toNanos(
                Math.max(1, appSettings.getAgent().getToolTimeoutSeconds()));
        long deadline = System.nanoTime() + timeoutNanos;
        try {
            while (true) {
                if (isCancelled(cancellationRequested)) {
                    future.cancel(true);
                    throw new ToolCancelledException();
                }
                long remainingNanos = deadline - System.nanoTime();
                if (remainingNanos <= 0) {
                    future.cancel(true);
                    throw new TimeoutException("tool_timeout");
                }
                try {
                    return future.get(Math.min(CANCELLATION_POLL_MS,
                                    Math.max(1, TimeUnit.NANOSECONDS.toMillis(remainingNanos))),
                            TimeUnit.MILLISECONDS);
                } catch (TimeoutException pollTimeout) {
                    // Poll again so cancellation does not wait for the full provider timeout.
                } catch (ExecutionException exception) {
                    Throwable cause = exception.getCause();
                    if (cause instanceof Exception nested) {
                        throw nested;
                    }
                    throw exception;
                }
            }
        } catch (InterruptedException exception) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new ToolCancelledException();
        }
    }

    private boolean isCancelled(BooleanSupplier cancellationRequested) {
        return Thread.currentThread().isInterrupted()
                || (cancellationRequested != null && cancellationRequested.getAsBoolean());
    }

    private static class ToolCancelledException extends Exception {
    }
}
