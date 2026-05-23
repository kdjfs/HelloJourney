package com.hellojourney.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "聊天消息")
public class ChatMessage {
    @NotBlank
    @Schema(description = "角色: system/user/assistant", example = "user", requiredMode = Schema.RequiredMode.REQUIRED)
    private String role;
    @NotBlank
    @Schema(description = "消息内容", example = "你好", requiredMode = Schema.RequiredMode.REQUIRED)
    private String content;
}
