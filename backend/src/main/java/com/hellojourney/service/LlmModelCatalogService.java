package com.hellojourney.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * 拉取 OpenAI 兼容中转站（硅基流动等）的可用模型列表。
 *
 * <p>为什么必须走后端：模型列表接口需要携带 Bearer 密钥，浏览器直连会把密钥暴露在
 * Network 面板与前端存储里，且多数中转站不返回 CORS 头。这里由服务端代发请求，
 * 只把模型 id 回给前端。</p>
 */
@Slf4j
@Service
public class LlmModelCatalogService {

    /** 防御性上限：中转站模型可能上百个，避免一次响应撑爆前端下拉框。 */
    private static final int MAX_MODELS = 300;

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    public LlmModelCatalogService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .build();
    }

    /**
     * 查询 {@code {baseUrl}/models}。
     *
     * @throws IllegalArgumentException 地址非法
     * @throws IOException              网络或响应异常
     */
    public List<String> listModels(String baseUrl, String apiKey) throws IOException {
        String endpoint = resolveModelsUrl(baseUrl);
        Request request = new Request.Builder()
                .url(endpoint)
                .get()
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            String body = response.body() != null ? response.body().string() : "";
            if (!response.isSuccessful()) {
                // 不把密钥或完整响应写进日志，只留状态码与截断后的正文
                log.warn("拉取模型列表失败: status={} body={}", response.code(), abbreviate(body));
                throw new IOException("中转站返回 HTTP " + response.code() + "：" + abbreviate(body));
            }
            return parseModelIds(body);
        }
    }

    /** 把用户填写的地址补全成 /models 端点，同时容忍末尾斜杠与已带版本号的情况。 */
    static String resolveModelsUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("中转站地址不能为空");
        }
        String trimmed = baseUrl.trim().replaceAll("/+$", "");
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw new IllegalArgumentException("中转站地址需要以 http:// 或 https:// 开头");
        }
        if (lower.endsWith("/models")) return trimmed;
        if (lower.endsWith("/v1") || lower.endsWith("/v1beta") || lower.endsWith("/compatible-mode/v1")) {
            return trimmed + "/models";
        }
        return trimmed + "/v1/models";
    }

    /** 兼容 {@code data[].id}、{@code models[].id} 与纯数组三种返回。 */
    List<String> parseModelIds(String body) throws IOException {
        if (body == null || body.isBlank()) return List.of();

        JsonNode root = objectMapper.readTree(body);
        JsonNode list = null;
        if (root.isArray()) {
            list = root;
        } else if (root.has("data") && root.get("data").isArray()) {
            list = root.get("data");
        } else if (root.has("models") && root.get("models").isArray()) {
            list = root.get("models");
        }
        if (list == null) return List.of();

        Set<String> ids = new LinkedHashSet<>();
        for (JsonNode item : list) {
            String id = item.isTextual() ? item.asText() : item.path("id").asText("");
            if (id != null && !id.isBlank()) ids.add(id.trim());
            if (ids.size() >= MAX_MODELS) break;
        }
        List<String> result = new ArrayList<>(ids);
        result.sort(String::compareToIgnoreCase);
        return result;
    }

    private static String abbreviate(String value) {
        if (value == null) return "";
        String single = value.replaceAll("\\s+", " ").trim();
        return single.length() <= 200 ? single : single.substring(0, 200) + "…";
    }
}
