package com.hellojourney.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.llm.LlmApiException;
import com.hellojourney.model.llm.LlmChatRequest;
import com.hellojourney.model.llm.LlmChatResult;
import com.hellojourney.model.llm.LlmMessage;
import com.hellojourney.util.TestDataFactory;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LlmServiceTest {

    private MockWebServer server;
    private AppSettings appSettings;
    private ObjectMapper objectMapper;
    private LlmService service;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        appSettings = TestDataFactory.buildAppSettings();
        objectMapper = new ObjectMapper();
        var provider = appSettings.getLlm().getProviders().get("openai");
        provider.setName("DeepSeek");
        provider.setApiKey("test-only-api-key");
        provider.setBaseUrl(server.url("/").toString().replaceAll("/$", ""));
        provider.setModel("deepseek-v4-pro");
        appSettings.getLlm().setMaxRetries(1);
        appSettings.getLlm().setRetryBaseDelayMs(1);
        service = new LlmService(appSettings, objectMapper);
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    void complete_usesV4ProtocolAndReturnsMetadata() throws Exception {
        server.enqueue(jsonResponse(200, """
                {
                  "id":"chatcmpl-request-123",
                  "model":"deepseek-v4-pro",
                  "choices":[{"index":0,"finish_reason":"stop","message":{
                    "role":"assistant","content":"北京三日行程", "reasoning_content":"private reasoning"
                  }}],
                  "usage":{"prompt_tokens":20,"completion_tokens":8,"total_tokens":28,
                    "prompt_cache_hit_tokens":5,"prompt_cache_miss_tokens":15}
                }
                """).addHeader("x-request-id", "gateway-request-456"));

        LlmChatResult result = service.complete(LlmChatRequest.builder()
                .messages(List.of(LlmMessage.system("请规划行程"), LlmMessage.user("北京三天")))
                .maxTokens(1024)
                .build());

        assertThat(result.content()).isEqualTo("北京三日行程");
        assertThat(result.reasoningContent()).isEqualTo("private reasoning");
        assertThat(result.model()).isEqualTo("deepseek-v4-pro");
        assertThat(result.responseId()).isEqualTo("chatcmpl-request-123");
        assertThat(result.requestId()).isEqualTo("gateway-request-456");
        assertThat(result.finishReason()).isEqualTo("stop");
        assertThat(result.usage().getTotalTokens()).isEqualTo(28);

        RecordedRequest recorded = server.takeRequest(1, TimeUnit.SECONDS);
        assertThat(recorded).isNotNull();
        assertThat(recorded.getPath()).isEqualTo("/chat/completions");
        assertThat(recorded.getHeader("Authorization")).isEqualTo("Bearer test-only-api-key");
        JsonNode payload = objectMapper.readTree(recorded.getBody().readUtf8());
        assertThat(payload.path("model").asText()).isEqualTo("deepseek-v4-pro");
        assertThat(payload.path("thinking").path("type").asText()).isEqualTo("enabled");
        assertThat(payload.path("reasoning_effort").asText()).isEqualTo("high");
        assertThat(payload.has("temperature")).isFalse();
    }

    @Test
    void complete_retriesRateLimitThenSucceeds() throws Exception {
        server.enqueue(jsonResponse(429, "{\"error\":{\"message\":\"slow down\",\"code\":\"rate_limit\"}}"));
        server.enqueue(successResponse("ok"));

        LlmChatResult result = service.complete(defaultRequest());

        assertThat(result.content()).isEqualTo("ok");
        assertThat(server.getRequestCount()).isEqualTo(2);
    }

    @Test
    void complete_doesNotRetryAuthenticationFailureOrExposeProviderBody() {
        server.enqueue(jsonResponse(401, "{\"error\":{\"message\":\"bad test-only-api-key\",\"code\":\"auth\"}}"));

        assertThatThrownBy(() -> service.complete(defaultRequest()))
                .isInstanceOf(LlmApiException.class)
                .satisfies(error -> {
                    LlmApiException apiError = (LlmApiException) error;
                    assertThat(apiError.getStatusCode()).isEqualTo(401);
                    assertThat(apiError.isRetryable()).isFalse();
                    assertThat(apiError.getMessage()).doesNotContain("test-only-api-key");
                    assertThat(apiError.getMessage()).doesNotContain("bad");
                });
        assertThat(server.getRequestCount()).isEqualTo(1);
    }

    @Test
    void legacyChat_returnsOnlyFinalContent() throws Exception {
        server.enqueue(successResponse("final only"));

        String content = service.chat(defaultLegacyMessages(), 0.7, 1024);

        assertThat(content).isEqualTo("final only");
    }

    @Test
    void chatWithTimeout_usesCompatibilityEntryPoint() throws Exception {
        server.enqueue(successResponse("custom timeout"));

        String content = service.chatWithTimeout(defaultLegacyMessages(), 0.7, 1024, 5);

        assertThat(content).isEqualTo("custom timeout");
    }

    @Test
    void complete_stripsTrailingSlashFromProviderUrl() throws Exception {
        appSettings.getLlm().getProviders().get("openai")
                .setBaseUrl(server.url("/v1/").toString());
        service.reset();
        server.enqueue(successResponse("ok"));

        service.complete(defaultRequest());

        assertThat(server.takeRequest(1, TimeUnit.SECONDS).getPath())
                .isEqualTo("/v1/chat/completions");
    }

    @Test
    void reset_reinitializesClientAndKeepsServiceUsable() throws Exception {
        service.reset();
        server.enqueue(successResponse("after reset"));

        assertThat(service.complete(defaultRequest()).content()).isEqualTo("after reset");
    }

    @Test
    void complete_rejectsMissingProviderCredentialWithoutNetworkCall() {
        appSettings.getLlm().getProviders().get("openai").setApiKey("");

        assertThatThrownBy(() -> service.complete(defaultRequest()))
                .isInstanceOf(LlmApiException.class)
                .hasMessageContaining("未配置");
        assertThat(server.getRequestCount()).isZero();
    }

    private LlmChatRequest defaultRequest() {
        return LlmChatRequest.builder()
                .messages(List.of(LlmMessage.user("hello")))
                .maxTokens(256)
                .build();
    }

    private List<Map<String, String>> defaultLegacyMessages() {
        return List.of(Map.of("role", "user", "content", "hello"));
    }

    private MockResponse successResponse(String content) {
        return jsonResponse(200, """
                {"id":"id-1","model":"deepseek-v4-pro",
                 "choices":[{"index":0,"finish_reason":"stop","message":{"role":"assistant","content":"%s"}}],
                 "usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}
                """.formatted(content));
    }

    private MockResponse jsonResponse(int status, String body) {
        return new MockResponse()
                .setResponseCode(status)
                .addHeader("Content-Type", "application/json")
                .setBody(body);
    }
}
