package com.hellojourney.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
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
@Schema(description = "路线规划请求")
public class RouteRequest {
    @NotBlank
    @JsonProperty("origin_address")
    @Schema(description = "起点地址", example = "天安门", requiredMode = Schema.RequiredMode.REQUIRED)
    private String originAddress;

    @NotBlank
    @JsonProperty("destination_address")
    @Schema(description = "终点地址", example = "故宫博物院", requiredMode = Schema.RequiredMode.REQUIRED)
    private String destinationAddress;

    @JsonProperty("origin_city")
    @Schema(description = "起点城市", example = "北京")
    private String originCity;

    @JsonProperty("destination_city")
    @Schema(description = "终点城市", example = "北京")
    private String destinationCity;

    @Builder.Default
    @JsonProperty("route_type")
    @Schema(description = "路线类型: walking/driving/transit", example = "walking", defaultValue = "walking")
    private String routeType = "walking";
}
