package com.hellojourney.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "运行时配置更新请求")
public class RuntimeSettingsPayload {
    @JsonProperty("tencent_maps_key")
    @Schema(description = "腾讯地图API Key")
    private String tencentMapsKey;

    @JsonProperty("google_maps_api_key")
    @Schema(description = "Google Maps API Key")
    private String googleMapsApiKey;

    @JsonProperty("xhs_cookie")
    @Schema(description = "小红书Cookie")
    private String xhsCookie;

    @JsonProperty("llm_active_provider")
    @Schema(description = "当前活跃LLM供应商标识", example = "deepseek")
    private String llmActiveProvider;

    @JsonProperty("llm_providers")
    @Schema(description = "LLM供应商配置列表")
    private List<Map<String, Object>> llmProviders;
}
