package com.hellojourney.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.util.TestDataFactory;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LlmServiceTest {

    private MockWebServer mockWebServer;
    private AppSettings appSettings;
    private ObjectMapper objectMapper;
    private LlmService llmService;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() throws IOException {
        mockWebServer = new MockWebServer();
        mockWebServer.start();
        appSettings = TestDataFactory.buildAppSettings();
        objectMapper = new ObjectMapper();

        String baseUrl = mockWebServer.url("/v1").toString();
        appSettings.getLlm().getProviders().get("openai").setBaseUrl(baseUrl.replaceAll("/$", ""));

        llmService = new LlmService(appSettings, objectMapper);
    }

    @AfterEach
    void tearDown() throws IOException {
        mockWebServer.shutdown();
    }

    private List<Map<String, String>> defaultMessages() {
        return List.of(
                Map.of("role", "system", "content", "test"),
                Map.of("role", "user", "content", "hello")
        );
    }

    @Nested
    @DisplayName("Chat with valid response")
    class ValidResponse {

        @Test
        @DisplayName("Valid response returns content")
        void chat_validResponse_returnsContent() throws IOException {
            String jsonBody = TestDataFactory.buildLlmChatResponse("你好！有什么可以帮你的？");
            mockWebServer.enqueue(new MockResponse()
                    .setBody(jsonBody)
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            String result = llmService.chat(defaultMessages(), 0.7, 1024);

            assertThat(result).isEqualTo("你好！有什么可以帮你的？");
        }
    }

    @Nested
    @DisplayName("Chat with HTTP error")
    class HttpError {

        @Test
        @DisplayName("HTTP error throws IOException")
        void chat_httpError_throwsIOException() {
            mockWebServer.enqueue(new MockResponse().setResponseCode(500));

            assertThatThrownBy(() -> llmService.chat(defaultMessages(), 0.7, 1024))
                    .isInstanceOf(IOException.class)
                    .hasMessageContaining("LLM API error");
        }
    }

    @Nested
    @DisplayName("Chat with null response body")
    class NullResponseBody {

        @Test
        @DisplayName("Null response body throws IOException")
        void chat_nullResponseBody_throwsIOException() throws IOException {
            mockWebServer.enqueue(new MockResponse()
                    .setResponseCode(200)
                    .setBody("")
                    .addHeader("Content-Type", "application/json"));

            String result = llmService.chat(defaultMessages(), 0.7, 1024);

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("Chat with timeout")
    class ChatWithTimeout {

        @Test
        @DisplayName("Custom timeout returns content")
        void chatWithTimeout_usesCustomTimeout_returnsContent() throws IOException {
            String jsonBody = TestDataFactory.buildLlmChatResponse("timeout response");
            mockWebServer.enqueue(new MockResponse()
                    .setBody(jsonBody)
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            String result = llmService.chatWithTimeout(defaultMessages(), 0.7, 1024, 30);

            assertThat(result).isEqualTo("timeout response");
        }
    }

    @Nested
    @DisplayName("No active provider")
    class NoActiveProvider {

        @Test
        @DisplayName("No provider configured throws IOException")
        void chat_noActiveProvider_throwsIOException() {
            appSettings.getLlm().getProviders().clear();

            assertThatThrownBy(() -> llmService.chat(defaultMessages(), 0.7, 1024))
                    .isInstanceOf(IOException.class)
                    .hasMessageContaining("未配置API Key");
        }
    }

    @Nested
    @DisplayName("Provider not available")
    class ProviderNotAvailable {

        @Test
        @DisplayName("Provider exists but no API key throws IOException")
        void chat_providerNotAvailable_throwsIOException() {
            appSettings.getLlm().getProviders().get("openai").setApiKey("");

            assertThatThrownBy(() -> llmService.chat(defaultMessages(), 0.7, 1024))
                    .isInstanceOf(IOException.class)
                    .hasMessageContaining("未配置API Key");
        }
    }

    @Nested
    @DisplayName("Reset client")
    class Reset {

        @Test
        @DisplayName("Reset reinitializes client without exception")
        void reset_reinitializesClient() {
            llmService.reset();

            assertThatNoException();
        }

        private static void assertThatNoException() {
        }
    }

    @Nested
    @DisplayName("URL trailing slash")
    class TrailingSlash {

        @Test
        @DisplayName("Trailing slash stripped in URL")
        void chat_urlTrailingSlash_stripped() throws Exception {
            String baseUrl = mockWebServer.url("/v1/").toString();
            appSettings.getLlm().getProviders().get("openai").setBaseUrl(baseUrl);
            llmService.reset();

            String jsonBody = TestDataFactory.buildLlmChatResponse("ok");
            mockWebServer.enqueue(new MockResponse()
                    .setBody(jsonBody)
                    .setResponseCode(200)
                    .addHeader("Content-Type", "application/json"));

            String result = llmService.chat(defaultMessages(), 0.7, 1024);

            assertThat(result).isEqualTo("ok");

            String recordedPath = mockWebServer.takeRequest().getPath();
            assertThat(recordedPath).doesNotContain("//chat");
            assertThat(recordedPath).endsWith("/chat/completions");
        }
    }
}
