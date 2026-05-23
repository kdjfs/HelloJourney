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
@Schema(description = "路线信息")
public class RouteInfo {
    @Schema(description = "距离(米)")
    private double distance;
    @Schema(description = "耗时(秒)")
    private int duration;
    @JsonProperty("route_type")
    @Schema(description = "路线类型")
    private String routeType;
    @Schema(description = "路线描述")
    private String description;
}
