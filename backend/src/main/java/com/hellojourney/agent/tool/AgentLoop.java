package com.hellojourney.agent.tool;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.llm.LlmChatRequest;
import com.hellojourney.model.llm.LlmChatResult;
import com.hellojourney.model.llm.LlmMessage;
import com.hellojourney.model.llm.LlmToolCall;
import com.hellojourney.model.llm.LlmUsage;
import com.hellojourney.service.LlmService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

@Slf4j
@Component
public class AgentLoop {
    private final LlmService llmService;
    private final ToolRegistry registry;
    private final ToolExecutor toolExecutor;
    private final ObjectMapper objectMapper;
    private final AppSettings appSettings;

    public AgentLoop(LlmService llmService, ToolRegistry registry, ToolExecutor toolExecutor,
                     ObjectMapper objectMapper, AppSettings appSettings) {
        this.llmService = llmService;
        this.registry = registry;
        this.toolExecutor = toolExecutor;
        this.objectMapper = objectMapper;
        this.appSettings = appSettings;
    }

    public AgentRunResult run(String systemPrompt, String userMessage,
                              BooleanSupplier cancellationRequested,
                              Consumer<AgentEvent> eventConsumer) throws IOException {
        Set<String> allTools = new HashSet<>();
        registry.definitions().forEach(definition -> allTools.add(definition.name()));
        return run(systemPrompt, userMessage, allTools, cancellationRequested, eventConsumer);
    }

    public AgentRunResult run(String systemPrompt, String userMessage, Set<String> allowedTools,
                              BooleanSupplier cancellationRequested,
                              Consumer<AgentEvent> eventConsumer) throws IOException {
        String traceId = UUID.randomUUID().toString();
        Set<String> allowlist = Set.copyOf(allowedTools == null ? Set.of() : allowedTools);
        List<ToolDefinition> definitions = registry.definitions().stream()
                .filter(definition -> allowlist.contains(definition.name()))
                .toList();
        if (definitions.size() != allowlist.size()) {
            throw new AgentLoopException("Agent 工具白名单包含未注册工具", "invalid_allowlist");
        }

        List<LlmMessage> messages = new ArrayList<>();
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            messages.add(LlmMessage.system(systemPrompt));
        }
        messages.add(LlmMessage.user(userMessage));
        List<ToolResult> executedResults = new ArrayList<>();
        Map<String, ToolResult> resultCache = new HashMap<>();
        LlmUsage totalUsage = new LlmUsage();
        emit(eventConsumer, new AgentEvent(traceId, AgentEventType.UNDERSTANDING_REQUEST,
                "running", "正在理解旅行需求", null, 0, Instant.now()));

        int maxIterations = Math.max(1, appSettings.getAgent().getMaxIterations());
        for (int iteration = 1; iteration <= maxIterations; iteration++) {
            ensureNotCancelled(cancellationRequested);
            LlmChatResult response = llmService.complete(LlmChatRequest.builder()
                    .messages(List.copyOf(messages))
                    .tools(definitions.stream().map(ToolDefinition::toLlmDefinition).toList())
                    .maxTokens(4096)
                    .build());
            addUsage(totalUsage, response.usage());

            List<LlmToolCall> providerCalls = response.toolCalls() == null ? List.of() : response.toolCalls();
            messages.add(LlmMessage.builder()
                    .role("assistant")
                    .content(response.content())
                    // Required by DeepSeek thinking + tool call continuation. Never emitted as an AgentEvent/result.
                    .reasoningContent(response.reasoningContent())
                    .toolCalls(providerCalls.isEmpty() ? null : providerCalls)
                    .build());

            if (providerCalls.isEmpty()) {
                if (response.content() == null || response.content().isBlank()) {
                    throw new AgentLoopException("Agent 未返回最终结果", "empty_final_response");
                }
                emit(eventConsumer, new AgentEvent(traceId, AgentEventType.COMPLETED,
                        "completed", "规划信息收集完成", null, iteration, Instant.now()));
                log.info("agent_loop_completed traceId={} iterations={} toolCalls={} totalTokens={}",
                        traceId, iteration, executedResults.size(), totalUsage.getTotalTokens());
                return new AgentRunResult(traceId, response.content(), iteration,
                        List.copyOf(executedResults), totalUsage);
            }

            for (LlmToolCall providerCall : providerCalls) {
                ensureNotCancelled(cancellationRequested);
                ToolCall call = ToolCall.from(providerCall);
                ToolDefinition definition = registry.find(call.name()).orElse(null);
                if (definition == null || !allowlist.contains(call.name())) {
                    ToolResult denied = ToolResult.error(call, "tool_not_allowed");
                    executedResults.add(denied);
                    messages.add(LlmMessage.tool(call.id(), denied.toModelContent(objectMapper, traceId)));
                    continue;
                }

                emit(eventConsumer, new AgentEvent(traceId, definition.eventType(), "running",
                        definition.eventMessage(), definition.name(), iteration, Instant.now()));
                String signature = callSignature(call);
                ToolResult result = resultCache.get(signature);
                if (result == null) {
                    result = toolExecutor.execute(call, traceId, cancellationRequested);
                    resultCache.put(signature, result);
                } else {
                    result = result.asDuplicate(call.id());
                }
                executedResults.add(result);
                messages.add(LlmMessage.tool(call.id(), result.toModelContent(objectMapper, traceId)));
                emit(eventConsumer, new AgentEvent(traceId, definition.eventType(),
                        result.success() ? "completed" : "failed",
                        result.success() ? definition.eventMessage() + "完成" : definition.eventMessage() + "失败",
                        definition.name(), iteration, Instant.now()));
            }
        }

        emit(eventConsumer, new AgentEvent(traceId, AgentEventType.FAILED,
                "failed", "Agent 达到最大工具调用轮次", null, maxIterations, Instant.now()));
        throw new AgentLoopException("Agent 达到最大工具调用轮次", "max_iterations_exceeded");
    }

    private void ensureNotCancelled(BooleanSupplier cancellationRequested) throws AgentLoopException {
        if (Thread.currentThread().isInterrupted()
                || (cancellationRequested != null && cancellationRequested.getAsBoolean())) {
            throw new AgentLoopException("Agent 调用已取消", "cancelled");
        }
    }

    private String callSignature(ToolCall call) {
        String canonicalArguments = call.arguments();
        try {
            canonicalArguments = canonicalize(objectMapper.readTree(call.arguments())).toString();
        } catch (Exception ignored) {
            canonicalArguments = call.arguments().substring(0, Math.min(4_096, call.arguments().length()));
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(
                    (call.name() + "\0" + canonicalArguments).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }

    private JsonNode canonicalize(JsonNode node) {
        if (node == null || node.isNull()) {
            return objectMapper.nullNode();
        }
        if (node.isObject()) {
            ObjectNode sorted = objectMapper.createObjectNode();
            List<Map.Entry<String, JsonNode>> fields = new ArrayList<>();
            node.fields().forEachRemaining(fields::add);
            fields.stream().sorted(Comparator.comparing(Map.Entry::getKey))
                    .forEach(entry -> sorted.set(entry.getKey(), canonicalize(entry.getValue())));
            return sorted;
        }
        if (node.isArray()) {
            ArrayNode array = objectMapper.createArrayNode();
            node.forEach(item -> array.add(canonicalize(item)));
            return array;
        }
        return node;
    }

    private void addUsage(LlmUsage total, LlmUsage current) {
        if (current == null) {
            return;
        }
        total.setPromptTokens(total.getPromptTokens() + current.getPromptTokens());
        total.setCompletionTokens(total.getCompletionTokens() + current.getCompletionTokens());
        total.setTotalTokens(total.getTotalTokens() + current.getTotalTokens());
        total.setPromptCacheHitTokens(total.getPromptCacheHitTokens() + current.getPromptCacheHitTokens());
        total.setPromptCacheMissTokens(total.getPromptCacheMissTokens() + current.getPromptCacheMissTokens());
    }

    private void emit(Consumer<AgentEvent> consumer, AgentEvent event) {
        if (consumer == null) {
            return;
        }
        try {
            consumer.accept(event);
        } catch (RuntimeException exception) {
            log.warn("agent_event_consumer_failed traceId={} type={}", event.traceId(), event.type());
        }
    }
}
