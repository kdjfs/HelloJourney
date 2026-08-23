package com.hellojourney.model.llm;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LlmToolCall {
    private String id;
    @Builder.Default
    private String type = "function";
    private LlmFunctionCall function;
}
