package com.hellojourney.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
@Schema(description = "旅行对话请求")
public class TripChatRequest {
    @NotBlank
    @Schema(description = "用户提问内容", example = "故宫的门票多少钱？", requiredMode = Schema.RequiredMode.REQUIRED)
    private String message;

    @NotNull
    @JsonProperty("trip_plan")
    @Schema(description = "当前旅行计划JSON上下文", requiredMode = Schema.RequiredMode.REQUIRED)
    private Map<String, Object> tripPlan;

    @Schema(description = "对话历史记录")
    private List<ChatMessage> history;
}
