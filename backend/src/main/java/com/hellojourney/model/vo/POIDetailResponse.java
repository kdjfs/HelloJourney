package com.hellojourney.model.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "POI详情响应")
public class POIDetailResponse {
    @Schema(description = "是否成功")
    private boolean success;
    @Schema(description = "响应消息")
    private String message;
    @Schema(description = "POI详情数据")
    private Map<String, Object> data;
}
