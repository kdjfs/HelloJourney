package com.hellojourney.config;

import com.hellojourney.model.dto.LlmProviderConfig;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "app")
public class AppSettings {
    private String name = "HelloAgents智能旅行助手";
    private String version = "2.0.0";
    private boolean debug = false;
    private String corsOrigins = "http://localhost:5173,http://localhost:3000";
    private String host = "0.0.0.0";
    private int port = 8000;

    private TencentMapsConfig tencentMaps = new TencentMapsConfig();
    private GoogleMapsConfig googleMaps = new GoogleMapsConfig();
    private XhsConfig xhs = new XhsConfig();
    private LlmConfig llm = new LlmConfig();
    private SettingsSecurityConfig settings = new SettingsSecurityConfig();

    @Data
    public static class TencentMapsConfig {
        private String key = "";
    }

    @Data
    public static class GoogleMapsConfig {
        private String apiKey = "";
        private String proxy = "";
    }

    @Data
    public static class XhsConfig {
        private String cookie = "";
        private String xs = "";
        private String xsCommon = "";
        private String xt = "";
    }

    @Data
    public static class LlmConfig {
        private String activeProvider = "openai";
        private int timeout = 60;
        private Map<String, LlmProviderProps> providers = new LinkedHashMap<>();

        public LlmProviderConfig getActiveProviderConfig() {
            LlmProviderProps props = providers.get(activeProvider);
            if (props == null) {
                if (!providers.isEmpty()) {
                    Map.Entry<String, LlmProviderProps> first = providers.entrySet().iterator().next();
                    props = first.getValue();
                } else {
                    return null;
                }
            }
            String key = activeProvider;
            if (props == null) return null;
            return LlmProviderConfig.builder()
                    .key(key)
                    .name(props.getName())
                    .apiKey(props.getApiKey())
                    .baseUrl(props.getBaseUrl())
                    .model(props.getModel())
                    .build();
        }
    }

    @Data
    public static class LlmProviderProps {
        private String name = "";
        private String apiKey = "";
        private String baseUrl = "";
        private String model = "";
    }

    @Data
    public static class SettingsSecurityConfig {
        /** Sensitive runtime writes are opt-in even outside production. */
        private boolean allowSecretUpdates = false;
        /** Separate administrator credential; never returned by an API. */
        private String adminToken = "";
    }

    public List<String> getCorsOriginsList() {
        return Arrays.stream(corsOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public String getTencentMapsKey() { return tencentMaps.getKey(); }
    public void setTencentMapsKey(String v) { tencentMaps.setKey(v); }
    public String getGoogleMapsApiKey() { return googleMaps.getApiKey(); }
    public void setGoogleMapsApiKey(String v) { googleMaps.setApiKey(v); }
    public String getGoogleMapsProxy() { return googleMaps.getProxy(); }
    public void setGoogleMapsProxy(String v) { googleMaps.setProxy(v); }
    public String getXhsCookie() { return xhs.getCookie(); }
    public void setXhsCookie(String v) { xhs.setCookie(v); }
    public String getXhsXs() { return xhs.getXs(); }
    public void setXhsXs(String v) { xhs.setXs(v); }
    public String getXhsXsCommon() { return xhs.getXsCommon(); }
    public void setXhsXsCommon(String v) { xhs.setXsCommon(v); }
    public String getXhsXt() { return xhs.getXt(); }
    public void setXhsXt(String v) { xhs.setXt(v); }

    public String getLlmApiKey() {
        LlmProviderConfig c = llm.getActiveProviderConfig();
        return c != null ? c.getApiKey() : "";
    }
    public String getLlmBaseUrl() {
        LlmProviderConfig c = llm.getActiveProviderConfig();
        return c != null ? c.getBaseUrl() : "";
    }
    public String getLlmModel() {
        LlmProviderConfig c = llm.getActiveProviderConfig();
        return c != null ? c.getModel() : "";
    }
    public int getLlmTimeout() { return llm.getTimeout(); }
    public String getLlmActiveProvider() { return llm.getActiveProvider(); }
    public void setLlmActiveProvider(String v) { llm.setActiveProvider(v); }
}
