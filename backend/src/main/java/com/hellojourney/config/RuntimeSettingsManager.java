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
            "google_maps_api_key", "xhs_cookie",
            "xhs_xs", "xhs_xs_common", "xhs_xt",
            "llm_active_provider"
    );

    private Map<String, Object> overrides = new HashMap<>();
    private File settingsFile;

    @PostConstruct
    public void init() {
        settingsFile = new File("runtime_settings.json");
        loadOverrides();
        applyOverrides();
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
                AppSettings.LlmProviderProps props = appSettings.getLlm().getProviders().get(providerKey);
                if (props == null) continue;
                if (entry.getValue() instanceof Map) {
                    Map<String, Object> providerOverrides = (Map<String, Object>) entry.getValue();
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
        result.put("xhs_configured", isConfigured(appSettings.getXhsCookie()));
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
                    Map<String, Object> providersMap = new LinkedHashMap<>();
                    for (Object item : providersList) {
                        if (item instanceof Map) {
                            Map<String, Object> p = (Map<String, Object>) item;
                            String providerKey = String.valueOf(p.getOrDefault("key", ""));
                            if (providerKey.isEmpty()) continue;
                            Map<String, Object> providerData = new LinkedHashMap<>();
                            if (p.containsKey("api_key")) providerData.put("api_key", String.valueOf(p.get("api_key")));
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
