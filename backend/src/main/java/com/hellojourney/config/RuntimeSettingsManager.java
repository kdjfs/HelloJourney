package com.hellojourney.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.File;
import java.io.IOException;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class RuntimeSettingsManager {
    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;

    private static final Set<String> RUNTIME_SETTING_KEYS = Set.of(
            "tencent_maps_key",
            "google_maps_api_key", "amap_maps_key", "xhs_cookie",
            "xhs_xs", "xhs_xs_common", "xhs_xt",
            "llm_active_provider"
    );

    private Map<String, Object> overrides = new HashMap<>();
    private File settingsFile;

    @PostConstruct
    public void init() {
        settingsFile = resolveSettingsFile();
        loadOverrides();
        applyOverrides();
        log.info("运行时配置文件: {}", settingsFile.getAbsolutePath());
    }

    /**
     * 解析运行时配置落盘位置。
     *
     * <p>原实现固定写 CWD 下的 {@code runtime_settings.json}：容器里工作目录一变配置就"消失"，
     * 且相对路径容易被误提交进仓库。现在按以下顺序解析，并保留旧路径兼容，避免升级后需要重新填 Cookie：</p>
     * <ol>
     *   <li>环境变量 {@code RUNTIME_SETTINGS_FILE}（绝对路径，优先级最高）</li>
     *   <li>已存在的 {@code ./runtime_settings.json}（兼容老部署）</li>
     *   <li>{@code TRIP_TASK_DATA_DIR} 的上一级目录下（容器里通常是 /app/data）</li>
     *   <li>兜底：CWD</li>
     * </ol>
     */
    private File resolveSettingsFile() {
        String configured = System.getenv("RUNTIME_SETTINGS_FILE");
        if (configured != null && !configured.isBlank()) {
            return new File(configured.trim());
        }

        File legacy = new File("runtime_settings.json");
        if (legacy.isFile()) {
            return legacy;
        }

        try {
            String dataDir = appSettings.getTasks().getDataDir();
            if (dataDir != null && !dataDir.isBlank()) {
                File dir = new File(dataDir);
                File parent = dir.getAbsoluteFile().getParentFile();
                return new File(parent != null ? parent : dir, "runtime_settings.json");
            }
        } catch (RuntimeException exception) {
            log.debug("无法从任务配置解析数据目录，回退到当前工作目录: {}", exception.getMessage());
        }

        return legacy;
    }

    private void loadOverrides() {
        if (!settingsFile.exists()) return;
        try {
            Map<String, Object> data = objectMapper.readValue(settingsFile, Map.class);
            for (String key : RUNTIME_SETTING_KEYS) {
                if (data.containsKey(key)) {
                    overrides.put(key, data.get(key));
                }
            }
            if (data.containsKey("llm_providers")) {
                overrides.put("llm_providers", data.get("llm_providers"));
            }
        } catch (IOException e) {
            log.warn("读取运行时配置失败: {}", e.getMessage());
        }
    }

    private void persistOverrides() {
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(settingsFile, overrides);
        } catch (IOException e) {
            log.warn("持久化运行时配置失败: {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void applyOverrides() {
        applyIfPresent("tencent_maps_key", appSettings::setTencentMapsKey);
        applyIfPresent("google_maps_api_key", appSettings::setGoogleMapsApiKey);
        applyIfPresent("amap_maps_key", appSettings::setAmapMapsKey);
        applyIfPresent("xhs_cookie", appSettings::setXhsCookie);
        applyIfPresent("xhs_xs", appSettings::setXhsXs);
        applyIfPresent("xhs_xs_common", appSettings::setXhsXsCommon);
        applyIfPresent("xhs_xt", appSettings::setXhsXt);
        applyIfPresent("llm_active_provider", v -> appSettings.setLlmActiveProvider(v));

        Object providersObj = overrides.get("llm_providers");
        if (providersObj instanceof Map) {
            Map<String, Object> providersMap = (Map<String, Object>) providersObj;
            for (Map.Entry<String, Object> entry : providersMap.entrySet()) {
                String providerKey = entry.getKey();
                if (providerKey == null || providerKey.isBlank()) continue;
                if (!(entry.getValue() instanceof Map)) continue;
                Map<String, Object> providerOverrides = (Map<String, Object>) entry.getValue();
                // 允许运行时新增供应商（例如中转站），否则只能修改配置文件里已有的那几个
                AppSettings.LlmProviderProps props = appSettings.getLlm().getProviders()
                        .computeIfAbsent(providerKey, ignored -> new AppSettings.LlmProviderProps());
                if (providerOverrides.containsKey("name")) {
                    props.setName(String.valueOf(providerOverrides.get("name")));
                }
                if (providerOverrides.containsKey("api_key")) {
                    props.setApiKey(String.valueOf(providerOverrides.get("api_key")));
                }
                if (providerOverrides.containsKey("base_url")) {
                    props.setBaseUrl(String.valueOf(providerOverrides.get("base_url")));
                }
                if (providerOverrides.containsKey("model")) {
                    props.setModel(String.valueOf(providerOverrides.get("model")));
                }
            }
        }
    }

    private void applyIfPresent(String key, java.util.function.Consumer<String> setter) {
        Object value = overrides.get(key);
        if (value != null) {
            setter.accept(String.valueOf(value));
        }
    }

    public Map<String, Object> getRuntimeSettings() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tencent_maps_configured", isConfigured(appSettings.getTencentMapsKey()));
        result.put("google_maps_configured", isConfigured(appSettings.getGoogleMapsApiKey()));
        result.put("amap_maps_configured", isConfigured(appSettings.getAmapMapsKey()));
        result.put("xhs_configured", isConfigured(appSettings.getXhsCookie()));
        // 前端据此解释 403：敏感配置写入是否开启（不含任何密钥值）
        AppSettings.SettingsSecurityConfig security = appSettings.getSettings();
        result.put("secret_updates_enabled", security != null && security.isAllowSecretUpdates());
        result.put("llm_active_provider", safeGet(appSettings.getLlmActiveProvider()));

        List<Map<String, Object>> providersList = new ArrayList<>();
        for (Map.Entry<String, AppSettings.LlmProviderProps> entry : appSettings.getLlm().getProviders().entrySet()) {
            AppSettings.LlmProviderProps props = entry.getValue();
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("key", entry.getKey());
            p.put("name", props.getName());
            p.put("model", safeGet(props.getModel()));
            p.put("configured", isConfigured(props.getApiKey()));
            p.put("active", Objects.equals(entry.getKey(), appSettings.getLlmActiveProvider()));
            providersList.add(p);
        }
        result.put("llm_providers", providersList);

        return result;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> updateRuntimeSettings(Map<String, Object> updates) {
        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            String key = entry.getKey();
            if ("llm_providers".equals(key)) {
                if (entry.getValue() instanceof List) {
                    List<Object> providersList = (List<Object>) entry.getValue();
                    // 与已有条目合并：设置页只改模型的场景不会重填密钥，
                    // 若整表覆盖，api_key 会从持久化文件里消失，重启后 provider 变未配置。
                    Map<String, Object> providersMap = new LinkedHashMap<>();
                    Object existingRaw = overrides.get("llm_providers");
                    if (existingRaw instanceof Map) {
                        providersMap.putAll((Map<String, Object>) existingRaw);
                    }
                    for (Object item : providersList) {
                        if (item instanceof Map) {
                            Map<String, Object> p = (Map<String, Object>) item;
                            String providerKey = String.valueOf(p.getOrDefault("key", ""));
                            if (providerKey.isEmpty()) continue;
                            Map<String, Object> providerData = new LinkedHashMap<>();
                            Object previous = providersMap.get(providerKey);
                            if (previous instanceof Map) {
                                providerData.putAll((Map<String, Object>) previous);
                            }
                            if (p.containsKey("name")) providerData.put("name", String.valueOf(p.get("name")));
                            // 空字符串视为"不修改"，避免把已保存的密钥清空
                            if (p.containsKey("api_key")) {
                                String apiKey = String.valueOf(p.get("api_key"));
                                if (!apiKey.isBlank()) providerData.put("api_key", apiKey);
                            }
                            if (p.containsKey("base_url")) providerData.put("base_url", String.valueOf(p.get("base_url")));
                            if (p.containsKey("model")) providerData.put("model", String.valueOf(p.get("model")));
                            providersMap.put(providerKey, providerData);
                        }
                    }
                    overrides.put("llm_providers", providersMap);
                }
            } else if (RUNTIME_SETTING_KEYS.contains(key)) {
                String value = entry.getValue() != null ? String.valueOf(entry.getValue()).trim() : "";
                overrides.put(key, value);
            }
        }
        persistOverrides();
        applyOverrides();
        return getRuntimeSettings();
    }

    private String safeGet(String v) {
        return v != null ? v : "";
    }

    private boolean isConfigured(String value) {
        return value != null && !value.isBlank();
    }
}
