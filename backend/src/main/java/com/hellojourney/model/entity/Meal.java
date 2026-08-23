package com.hellojourney.model.entity;

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
@Schema(description = "餐饮信息")
public class Meal {
    @Schema(description = "餐食类型(breakfast/lunch/dinner/snack)")
    private String type;
    @Schema(description = "餐厅名称")
    private String name;
    @Schema(description = "餐厅地址")
    private String address;
    @Schema(description = "经纬度坐标")
    private Location location;
    @Schema(description = "餐饮描述")
    private String description;
    @Builder.Default
    @JsonProperty("estimated_cost")
    @Schema(description = "预估人均消费(元)")
    private int estimatedCost = 0;
    @Builder.Default
    private String source = "ai";
    @Builder.Default
    private String provider = "deepseek";
    @JsonProperty("verified_at")
    private String verifiedAt;
    @Builder.Default
    @JsonProperty("verification_status")
    private String verificationStatus = "ai_suggested";
}
