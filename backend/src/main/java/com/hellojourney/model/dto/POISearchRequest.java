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
@Schema(description = "POI搜索请求")
public class POISearchRequest {
    @NotBlank
    @Schema(description = "搜索关键词", example = "故宫", requiredMode = Schema.RequiredMode.REQUIRED)
    private String keywords;
    @NotBlank
    @Schema(description = "城市名称", example = "北京", requiredMode = Schema.RequiredMode.REQUIRED)
    private String city;
    @Builder.Default
    @Schema(description = "是否限制在城市范围内", example = "true")
    private boolean citylimit = true;
}
