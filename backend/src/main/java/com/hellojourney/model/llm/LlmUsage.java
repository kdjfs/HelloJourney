package com.hellojourney.model.llm;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LlmUsage {
    @JsonProperty("prompt_tokens")
    private int promptTokens;
    @JsonProperty("completion_tokens")
    private int completionTokens;
    @JsonProperty("total_tokens")
    private int totalTokens;
    @JsonProperty("prompt_cache_hit_tokens")
    private int promptCacheHitTokens;
    @JsonProperty("prompt_cache_miss_tokens")
    private int promptCacheMissTokens;
}
