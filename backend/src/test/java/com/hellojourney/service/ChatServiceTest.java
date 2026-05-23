package com.hellojourney.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock
    private LlmService llmService;

    @Mock
    private AppSettings appSettings;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private ChatService chatService;

    @Nested
    @DisplayName("API key not configured")
    class ApiKeyNotConfigured {

        @Test
        @DisplayName("Returns config message when API key empty")
        void chatWithTripContext_apiKeyNotConfigured_returnsConfigMessage() {
            when(appSettings.getLlmApiKey()).thenReturn("");

            String result = chatService.chatWithTripContext("你好", Map.of(), null);

            assertThat(result).contains("AI 服务尚未配置 API Key");
            verifyNoInteractions(llmService);
        }
    }

    @Nested
    @DisplayName("Chat with history")
    class WithHistory {

        @Test
        @DisplayName("Includes all messages in correct order")
        void chatWithTripContext_withHistory_includesAllMessages() throws IOException {
            when(appSettings.getLlmApiKey()).thenReturn("test-key");
            when(objectMapper.writerWithDefaultPrettyPrinter()).thenReturn(new ObjectMapper().writerWithDefaultPrettyPrinter());
            when(llmService.chat(anyList(), anyDouble(), anyInt())).thenReturn("AI回复");

            List<Map<String, String>> history = List.of(
                    Map.of("role", "user", "content", "之前的问题"),
                    Map.of("role", "assistant", "content", "之前的回答")
            );

            chatService.chatWithTripContext("新问题", Map.of("city", "北京"), history);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<Map<String, String>>> captor = ArgumentCaptor.forClass(List.class);
            verify(llmService).chat(captor.capture(), eq(0.7), eq(1024));

            List<Map<String, String>> messages = captor.getValue();
            assertThat(messages).hasSize(5);
            assertThat(messages.get(0).get("role")).isEqualTo("system");
            assertThat(messages.get(1).get("role")).isEqualTo("user");
            assertThat(messages.get(1).get("content")).contains("当前旅行计划");
            assertThat(messages.get(2).get("role")).isEqualTo("user");
            assertThat(messages.get(2).get("content")).isEqualTo("之前的问题");
            assertThat(messages.get(3).get("role")).isEqualTo("assistant");
            assertThat(messages.get(3).get("content")).isEqualTo("之前的回答");
            assertThat(messages.get(4).get("role")).isEqualTo("user");
            assertThat(messages.get(4).get("content")).isEqualTo("新问题");
        }
    }

    @Nested
    @DisplayName("Null history handling")
    class NullHistory {

        @Test
        @DisplayName("Null history no NPE")
        void chatWithTripContext_nullHistory_noNPE() throws IOException {
            when(appSettings.getLlmApiKey()).thenReturn("test-key");
            when(objectMapper.writerWithDefaultPrettyPrinter()).thenReturn(new ObjectMapper().writerWithDefaultPrettyPrinter());
            when(llmService.chat(anyList(), anyDouble(), anyInt())).thenReturn("AI回复");

            String result = chatService.chatWithTripContext("你好", Map.of(), null);

            assertThat(result).isEqualTo("AI回复");

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<Map<String, String>>> captor = ArgumentCaptor.forClass(List.class);
            verify(llmService).chat(captor.capture(), eq(0.7), eq(1024));

            List<Map<String, String>> messages = captor.getValue();
            assertThat(messages).hasSize(3);
            assertThat(messages.get(0).get("role")).isEqualTo("system");
            assertThat(messages.get(1).get("role")).isEqualTo("user");
            assertThat(messages.get(2).get("role")).isEqualTo("user");
        }
    }

    @Nested
    @DisplayName("LLM error handling")
    class LlmError {

        @Test
        @DisplayName("LLM throws IOException returns error message")
        void chatWithTripContext_llmThrows_returnsErrorMessage() throws IOException {
            when(appSettings.getLlmApiKey()).thenReturn("test-key");
            when(objectMapper.writerWithDefaultPrettyPrinter()).thenReturn(new ObjectMapper().writerWithDefaultPrettyPrinter());
            when(llmService.chat(anyList(), anyDouble(), anyInt())).thenThrow(new IOException("connection failed"));

            String result = chatService.chatWithTripContext("你好", Map.of(), null);

            assertThat(result).contains("AI 出现了意外错误");
        }
    }

    @Nested
    @DisplayName("Temperature and max tokens")
    class TemperatureAndMaxTokens {

        @Test
        @DisplayName("Verify temperature 0.7 and maxTokens 1024")
        void chatWithTripContext_verifyTemperatureAndMaxTokens() throws IOException {
            when(appSettings.getLlmApiKey()).thenReturn("test-key");
            when(objectMapper.writerWithDefaultPrettyPrinter()).thenReturn(new ObjectMapper().writerWithDefaultPrettyPrinter());
            when(llmService.chat(anyList(), anyDouble(), anyInt())).thenReturn("ok");

            chatService.chatWithTripContext("你好", Map.of(), null);

            verify(llmService).chat(anyList(), eq(0.7), eq(1024));
        }
    }
}
