package com.hellojourney.model.vo;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "错误响应")
public class ErrorResponse {
    @Builder.Default
    @Schema(description = "是否成功")
    private boolean success = false;
    @Schema(description = "错误消息")
    private String message;
    @JsonProperty("error_code")
    @Schema(description = "错误码")
    private String errorCode;
}
