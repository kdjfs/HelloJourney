package com.hellojourney.agent.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.llm.LlmChatRequest;
import com.hellojourney.model.llm.LlmChatResult;
import com.hellojourney.model.llm.LlmFunctionCall;
import com.hellojourney.model.llm.LlmToolCall;
import com.hellojourney.model.llm.LlmUsage;
import com.hellojourney.service.LlmService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class AgentLoopTest {
    @Mock
    private LlmService llmService;
    @Mock
    private ToolRegistry registry;
    @Mock
    private ToolExecutor toolExecutor;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private AppSettings settings;
    private AgentLoop loop;
    private ToolDefinition weatherDefinition;

    @BeforeEach
    void setUp() {
        settings = new AppSettings();
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "object");
        weatherDefinition = new ToolDefinition("get_weather", "weather", schema,
                ignored -> objectMapper.createObjectNode(), AgentEventType.CHECKING_WEATHER, "正在查询实时天气");
        when(registry.definitions()).thenReturn(List.of(weatherDefinition));
        lenient().when(registry.find("get_weather")).thenReturn(Optional.of(weatherDefinition));
        loop = new AgentLoop(llmService, registry, toolExecutor, objectMapper, settings);
    }

    @Test
    void run_executesNativeToolCallAndPreservesReasoningOnlyInProtocolContext() throws Exception {
        LlmToolCall providerCall = call("call-1", "{\"city\":\"北京\"}");
        when(llmService.complete(any(LlmChatRequest.class)))
                .thenReturn(result("", "private chain", List.of(providerCall), "tool_calls", 10))
                .thenReturn(result("天气查询完成", "another private chain", List.of(), "stop", 5));
        when(toolExecutor.execute(any(), any(), any()))
                .thenReturn(ToolResult.success(ToolCall.from(providerCall),
                        objectMapper.readTree("{\"verified\":true}")));

        AgentRunResult result = loop.run("system", "北京天气", Set.of("get_weather"), () -> false, event -> { });

        assertThat(result.content()).isEqualTo("天气查询完成");
        assertThat(result.iterations()).isEqualTo(2);
        assertThat(result.usage().getTotalTokens()).isEqualTo(15);
        assertThat(objectMapper.writeValueAsString(result)).doesNotContain("private chain");

        ArgumentCaptor<LlmChatRequest> requests = ArgumentCaptor.forClass(LlmChatRequest.class);
        verify(llmService, times(2)).complete(requests.capture());
        LlmChatRequest continuation = requests.getAllValues().get(1);
        assertThat(continuation.getMessages()).hasSize(4);
        assertThat(continuation.getMessages().get(2).getReasoningContent()).isEqualTo("private chain");
        assertThat(continuation.getMessages().get(2).getToolCalls()).containsExactly(providerCall);
        assertThat(continuation.getMessages().get(3).getRole()).isEqualTo("tool");
        assertThat(continuation.getMessages().get(3).getToolCallId()).isEqualTo("call-1");
    }

    @Test
    void run_reusesDuplicateToolCallResultEvenWhenJsonFieldOrderDiffers() throws Exception {
        LlmToolCall first = call("call-1", "{\"city\":\"北京\",\"date\":\"2026-08-21\"}");
        LlmToolCall duplicate = call("call-2", "{\"date\":\"2026-08-21\",\"city\":\"北京\"}");
        when(llmService.complete(any(LlmChatRequest.class)))
                .thenReturn(result("", "reasoning", List.of(first, duplicate), "tool_calls", 1))
                .thenReturn(result("done", null, List.of(), "stop", 1));
        when(toolExecutor.execute(any(), any(), any()))
                .thenReturn(ToolResult.success(ToolCall.from(first), objectMapper.createObjectNode()));

        AgentRunResult result = loop.run("system", "weather", Set.of("get_weather"), () -> false, null);

        verify(toolExecutor, times(1)).execute(any(), any(), any());
        assertThat(result.toolResults()).hasSize(2);
        assertThat(result.toolResults().get(1).duplicate()).isTrue();
        assertThat(result.toolResults().get(1).callId()).isEqualTo("call-2");
    }

    @Test
    void run_rejectsCancellationBeforeCallingModel() {
        assertThatThrownBy(() -> loop.run("system", "weather", Set.of("get_weather"), () -> true, null))
                .isInstanceOf(AgentLoopException.class)
                .extracting(error -> ((AgentLoopException) error).getCode())
                .isEqualTo("cancelled");
        verifyNoInteractions(llmService);
    }

    @Test
    void run_stopsAtConfiguredMaximumIteration() throws Exception {
        settings.getAgent().setMaxIterations(1);
        LlmToolCall providerCall = call("call-1", "{\"city\":\"北京\"}");
        when(llmService.complete(any(LlmChatRequest.class)))
                .thenReturn(result("", "reasoning", List.of(providerCall), "tool_calls", 1));
        when(toolExecutor.execute(any(), any(), any()))
                .thenReturn(ToolResult.success(ToolCall.from(providerCall), objectMapper.createObjectNode()));

        assertThatThrownBy(() -> loop.run("system", "weather", Set.of("get_weather"), () -> false, null))
                .isInstanceOf(AgentLoopException.class)
                .extracting(error -> ((AgentLoopException) error).getCode())
                .isEqualTo("max_iterations_exceeded");
    }

    private LlmToolCall call(String id, String arguments) {
        return LlmToolCall.builder()
                .id(id)
                .type("function")
                .function(LlmFunctionCall.builder().name("get_weather").arguments(arguments).build())
                .build();
    }

    private LlmChatResult result(String content, String reasoning, List<LlmToolCall> calls,
                                 String finishReason, int tokens) {
        return new LlmChatResult(content, reasoning, calls, finishReason, "deepseek-v4-pro",
                "response-id", "request-id", new LlmUsage(tokens, 0, tokens, 0, tokens));
    }
}
