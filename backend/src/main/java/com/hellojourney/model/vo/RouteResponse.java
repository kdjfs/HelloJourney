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
@Schema(description = "路线规划响应")
public class RouteResponse {
    @Schema(description = "是否成功")
    private boolean success;
    @Builder.Default
    @Schema(description = "响应消息")
    private String message = "";
    @Schema(description = "路线信息")
    private RouteInfo data;
}
