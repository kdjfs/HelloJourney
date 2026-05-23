package com.hellojourney.model.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "POI搜索响应")
public class POISearchResponse {
    @Schema(description = "是否成功")
    private boolean success;
    @Builder.Default
    @Schema(description = "响应消息")
    private String message = "";
    @Schema(description = "POI信息列表")
    private List<POIInfo> data;
}
