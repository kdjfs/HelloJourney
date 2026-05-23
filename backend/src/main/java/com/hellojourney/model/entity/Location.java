package com.hellojourney.model.entity;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "经纬度坐标")
public class Location {
    @Schema(description = "经度", example = "116.397128")
    private double longitude;
    @Schema(description = "纬度", example = "39.916527")
    private double latitude;
}
