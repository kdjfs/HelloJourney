package com.hellojourney.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.LlmProviderConfig;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class LlmService {
    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;
    private OkHttpClient client;

    public LlmService(AppSettings appSettings, ObjectMapper objectMapper) {
        this.appSettings = appSettings;
        this.objectMapper = objectMapper;
        initClient();
    }

    public synchronized void reset() {
        if (client != null) {
            client.dispatcher().executorService().shutdown();
        }
        initClient();
    }

    private void initClient() {
        this.client = new OkHttpClient.Builder()
                .connectTimeout(appSettings.getLlmTimeout(), TimeUnit.SECONDS)
                .readTimeout(appSettings.getLlmTimeout(), TimeUnit.SECONDS)
                .writeTimeout(appSettings.getLlmTimeout(), TimeUnit.SECONDS)
                .addInterceptor(chain -> {
                    Request original = chain.request();
                    Request request = original.newBuilder()
                            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                            .build();
                    return chain.proceed(request);
                })
                .build();
        LlmProviderConfig active = appSettings.getLlm().getActiveProviderConfig();
        if (active != null) {
            log.info("LLM服务初始化成功 - 供应商: {} 模型: {}", active.getName(), active.getModel());
        }
    }

    public String chat(List<Map<String, String>> messages, double temperature, int maxTokens) throws IOException {
        LlmProviderConfig provider = getActiveProvider();
        String url = provider.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";

        Map<String, Object> payload = Map.of(
                "model", provider.getModel(),
                "messages", messages,
                "temperature", temperature,
                "max_tokens", maxTokens
        );

        String jsonBody = objectMapper.writeValueAsString(payload);
        Request request = new Request.Builder()
                .url(url)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer " + provider.getApiKey())
                .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                .build();

        try (Response response = client.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "";
            if (!response.isSuccessful()) {
                log.error("LLM API返回错误: {} - {}", response.code(), responseBody);
                throw new IOException("LLM API error: " + response.code());
            }
            JsonNode node = objectMapper.readTree(responseBody);
            return node.path("choices").path(0).path("message").path("content").asText("");
        }
    }

    public String chatWithTimeout(List<Map<String, String>> messages, double temperature, int maxTokens, int timeoutSeconds) throws IOException {
        LlmProviderConfig provider = getActiveProvider();
        OkHttpClient timeoutClient = client.newBuilder()
                .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
                .build();

        String url = provider.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";
        Map<String, Object> payload = Map.of(
                "model", provider.getModel(),
                "messages", messages,
                "temperature", temperature,
                "max_tokens", maxTokens
        );

        String jsonBody = objectMapper.writeValueAsString(payload);
        Request request = new Request.Builder()
                .url(url)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer " + provider.getApiKey())
                .post(RequestBody.create(jsonBody, MediaType.parse("application/json")))
                .build();

        try (Response response = timeoutClient.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "";
            if (!response.isSuccessful()) {
                throw new IOException("LLM API error: " + response.code());
            }
            JsonNode node = objectMapper.readTree(responseBody);
            return node.path("choices").path(0).path("message").path("content").asText("");
        }
    }

    private LlmProviderConfig getActiveProvider() throws IOException {
        LlmProviderConfig provider = appSettings.getLlm().getActiveProviderConfig();
        if (provider == null || !provider.isAvailable()) {
            throw new IOException("当前活跃的LLM供应商未配置API Key，请先在设置页面完成配置");
        }
        return provider;
    }
}
