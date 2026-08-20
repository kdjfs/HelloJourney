package com.hellojourney.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.LlmProviderConfig;
import com.hellojourney.model.llm.LlmApiException;
import com.hellojourney.model.llm.LlmChatRequest;
import com.hellojourney.model.llm.LlmChatResponse;
import com.hellojourney.model.llm.LlmChatResult;
import com.hellojourney.model.llm.LlmMessage;
import com.hellojourney.model.llm.LlmUsage;
import lombok.extern.slf4j.Slf4j;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class LlmService {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private static final LlmUsage EMPTY_USAGE = new LlmUsage();

    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;
    private volatile OkHttpClient client;

    public LlmService(AppSettings appSettings, ObjectMapper objectMapper) {
        this.appSettings = appSettings;
        this.objectMapper = objectMapper;
        initClient();
    }

    public synchronized void reset() {
        OkHttpClient previous = client;
        initClient();
        if (previous != null) {
            previous.dispatcher().cancelAll();
            previous.dispatcher().executorService().shutdown();
            previous.connectionPool().evictAll();
        }
    }

    private void initClient() {
        int timeout = Math.max(1, appSettings.getLlmTimeout());
        this.client = new OkHttpClient.Builder()
                .connectTimeout(timeout, TimeUnit.SECONDS)
                .readTimeout(timeout, TimeUnit.SECONDS)
                .writeTimeout(timeout, TimeUnit.SECONDS)
                .callTimeout(timeout, TimeUnit.SECONDS)
                .addInterceptor(chain -> chain.proceed(chain.request().newBuilder()
                        .header("User-Agent", "HelloJourney/3.0")
                        .build()))
                .build();
        LlmProviderConfig active = appSettings.getLlm().getActiveProviderConfig();
        if (active != null) {
            log.info("llm_client_initialized provider={} model={}", active.getKey(), active.getModel());
        }
    }

    /**
     * Compatibility bridge for existing agents. New agent code should use complete() so
     * model, token usage, request ID and tool calls are not discarded.
     */
    public String chat(List<Map<String, String>> messages, double temperature, int maxTokens) throws IOException {
        return complete(toRequest(messages, temperature, maxTokens), appSettings.getLlmTimeout()).content();
    }

    public String chatWithTimeout(List<Map<String, String>> messages, double temperature,
                                  int maxTokens, int timeoutSeconds) throws IOException {
        return complete(toRequest(messages, temperature, maxTokens), timeoutSeconds).content();
    }

    public LlmChatResult complete(LlmChatRequest request) throws IOException {
        return complete(request, appSettings.getLlmTimeout());
    }

    public LlmChatResult complete(LlmChatRequest request, int timeoutSeconds) throws IOException {
        if (request == null || request.getMessages() == null || request.getMessages().isEmpty()) {
            throw configurationError("LLM 请求至少需要一条消息");
        }
        LlmProviderConfig provider = getActiveProvider();
        LlmChatRequest prepared = prepareRequest(request, provider);
        return executeWithRetries(provider, prepared, Math.max(1, timeoutSeconds));
    }

    private LlmChatRequest toRequest(List<Map<String, String>> messages, double temperature, int maxTokens) {
        List<LlmMessage> typedMessages = messages.stream()
                .map(message -> LlmMessage.builder()
                        .role(message.get("role"))
                        .content(message.get("content"))
                        .name(message.get("name"))
                        .build())
                .toList();
        return LlmChatRequest.builder()
                .messages(typedMessages)
                .temperature(temperature)
                .maxTokens(maxTokens)
                .build();
    }

    private LlmChatRequest prepareRequest(LlmChatRequest request, LlmProviderConfig provider) {
        LlmChatRequest.LlmChatRequestBuilder builder = request.toBuilder().model(provider.getModel());
        if (isDeepSeekV4(provider)) {
            builder.temperature(null);
            if (request.getThinking() == null) {
                builder.thinking(Map.of("type", "enabled"));
            }
            if (request.getReasoningEffort() == null) {
                builder.reasoningEffort("high");
            }
            // DeepSeek V4 thinking mode currently rejects tool_choice; omit it for compatibility.
            builder.toolChoice(null);
        }
        return builder.build();
    }

    private boolean isDeepSeekV4(LlmProviderConfig provider) {
        return provider.getModel() != null && provider.getModel().startsWith("deepseek-v4-");
    }

    private LlmChatResult executeWithRetries(LlmProviderConfig provider, LlmChatRequest request,
                                             int timeoutSeconds) throws IOException {
        int maxRetries = Math.max(0, appSettings.getLlm().getMaxRetries());
        for (int attempt = 0; ; attempt++) {
            try {
                return executeOnce(provider, request, timeoutSeconds);
            } catch (LlmApiException exception) {
                if (!exception.isRetryable() || attempt >= maxRetries) {
                    throw exception;
                }
                log.warn("llm_call_retry provider={} model={} status={} requestId={} attempt={}",
                        provider.getKey(), provider.getModel(), exception.getStatusCode(),
                        safeRequestId(exception.getRequestId()), attempt + 1);
                backoff(attempt);
            } catch (IOException exception) {
                if (attempt >= maxRetries) {
                    throw new LlmApiException("LLM 网络调用失败", -1, "transport_error", true,
                            null, exception);
                }
                log.warn("llm_call_retry provider={} model={} status=transport_error attempt={}",
                        provider.getKey(), provider.getModel(), attempt + 1);
                backoff(attempt);
            }
        }
    }

    private LlmChatResult executeOnce(LlmProviderConfig provider, LlmChatRequest chatRequest,
                                      int timeoutSeconds) throws IOException {
        String url = provider.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";
        String jsonBody = objectMapper.writeValueAsString(chatRequest);
        Request request;
        try {
            request = new Request.Builder()
                    .url(url)
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + provider.getApiKey())
                    .post(RequestBody.create(jsonBody, JSON))
                    .build();
        } catch (IllegalArgumentException exception) {
            throw new LlmApiException("LLM 供应商地址配置无效", -1, "invalid_base_url",
                    false, null, exception);
        }

        OkHttpClient timeoutClient = client.newBuilder()
                .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .callTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .build();
        long startedAt = System.nanoTime();
        try (Response response = timeoutClient.newCall(request).execute()) {
            long latencyMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
            String requestId = response.header("x-request-id", response.header("x-ds-request-id"));
            String responseBody = response.body() == null ? "" : response.body().string();
            if (!response.isSuccessful()) {
                String providerCode = parseProviderErrorCode(responseBody);
                boolean retryable = isRetryableStatus(response.code());
                log.warn("llm_call_failed provider={} model={} status={} requestId={} latencyMs={} retryable={}",
                        provider.getKey(), provider.getModel(), response.code(), safeRequestId(requestId),
                        latencyMs, retryable);
                throw new LlmApiException(
                        "LLM 调用失败（HTTP " + response.code() + "）",
                        response.code(), providerCode, retryable, requestId, null);
            }

            LlmChatResponse parsed = parseSuccessResponse(responseBody, requestId);
            LlmChatResponse.Choice choice = parsed.getChoices().get(0);
            LlmMessage message = choice.getMessage();
            LlmUsage usage = parsed.getUsage() == null ? EMPTY_USAGE : parsed.getUsage();
            log.info("llm_call_succeeded provider={} model={} status=200 requestId={} responseId={} "
                            + "latencyMs={} promptTokens={} completionTokens={} totalTokens={}",
                    provider.getKey(), parsed.getModel(), safeRequestId(requestId), safeRequestId(parsed.getId()),
                    latencyMs, usage.getPromptTokens(), usage.getCompletionTokens(), usage.getTotalTokens());
            return new LlmChatResult(
                    message.getContent() == null ? "" : message.getContent(),
                    message.getReasoningContent(),
                    message.getToolCalls() == null ? List.of() : List.copyOf(message.getToolCalls()),
                    choice.getFinishReason(), parsed.getModel(), parsed.getId(), requestId, usage);
        }
    }

    private LlmChatResponse parseSuccessResponse(String responseBody, String requestId) throws LlmApiException {
        try {
            LlmChatResponse response = objectMapper.readValue(responseBody, LlmChatResponse.class);
            if (response.getChoices() == null || response.getChoices().isEmpty()
                    || response.getChoices().get(0).getMessage() == null) {
                throw protocolError(requestId, null);
            }
            return response;
        } catch (JsonProcessingException exception) {
            throw protocolError(requestId, exception);
        }
    }

    private LlmApiException protocolError(String requestId, Throwable cause) {
        return new LlmApiException("LLM 返回了无法识别的响应", 502, "invalid_response",
                false, requestId, cause);
    }

    private String parseProviderErrorCode(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "unknown";
        }
        try {
            JsonNode error = objectMapper.readTree(responseBody).path("error");
            String code = error.path("code").asText("unknown");
            return code.length() > 64 ? "unknown" : code;
        } catch (JsonProcessingException ignored) {
            return "unknown";
        }
    }

    private boolean isRetryableStatus(int status) {
        return status == 429 || status == 500 || status == 502 || status == 503 || status == 504;
    }

    private void backoff(int attempt) throws LlmApiException {
        long baseDelay = Math.max(0, appSettings.getLlm().getRetryBaseDelayMs());
        long delay = Math.min(5_000, baseDelay * (1L << Math.min(attempt, 4)));
        try {
            Thread.sleep(delay);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new LlmApiException("LLM 调用已取消", -1, "interrupted",
                    false, null, exception);
        }
    }

    private String safeRequestId(String requestId) {
        if (requestId == null || requestId.isBlank()) {
            return "n/a";
        }
        String sanitized = requestId.replaceAll("[^A-Za-z0-9._:-]", "_");
        return sanitized.substring(0, Math.min(128, sanitized.length()));
    }

    private LlmProviderConfig getActiveProvider() throws LlmApiException {
        LlmProviderConfig provider = appSettings.getLlm().getActiveProviderConfig();
        if (provider == null || !provider.isAvailable()) {
            throw configurationError("当前活跃的 LLM 供应商未配置 API Key");
        }
        if (provider.getBaseUrl() == null || provider.getBaseUrl().isBlank()
                || provider.getModel() == null || provider.getModel().isBlank()) {
            throw configurationError("当前活跃的 LLM 供应商配置不完整");
        }
        return provider;
    }

    private LlmApiException configurationError(String message) {
        return new LlmApiException(message, -1, "configuration_error", false, null, null);
    }
}
