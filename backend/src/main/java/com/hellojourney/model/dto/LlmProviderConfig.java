package com.hellojourney.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "LLM供应商配置")
public class LlmProviderConfig {
    @Schema(description = "供应商唯一标识", example = "openai")
    private String key;
    @Schema(description = "供应商显示名称", example = "GPT (OpenAI)")
    private String name;
    @Schema(description = "API密钥")
    private String apiKey;
    @Schema(description = "API基础URL", example = "https://api.openai.com/v1")
    private String baseUrl;
    @Schema(description = "模型名称", example = "gpt-4")
    private String model;

    public boolean isAvailable() {
        return apiKey != null && !apiKey.trim().isEmpty();
    }
}
