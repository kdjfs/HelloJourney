package com.hellojourney.model.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "旅行对话响应")
public class TripChatResponse {
    @Builder.Default
    @Schema(description = "是否成功")
    private boolean success = true;
    @Schema(description = "AI回复内容")
    private String reply;
}
