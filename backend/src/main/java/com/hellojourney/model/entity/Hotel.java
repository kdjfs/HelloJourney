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
@Schema(description = "酒店信息")
public class Hotel {
    @Schema(description = "酒店名称")
    private String name;
    @Builder.Default
    @Schema(description = "酒店地址")
    private String address = "";
    @Schema(description = "经纬度坐标")
    private Location location;
    @Builder.Default
    @JsonProperty("price_range")
    @Schema(description = "价格区间")
    private String priceRange = "";
    @Builder.Default
    @Schema(description = "评分")
    private String rating = "";
    @Builder.Default
    @Schema(description = "距景点距离")
    private String distance = "";
    @Builder.Default
    @Schema(description = "酒店类型")
    private String type = "";
    @Builder.Default
    @JsonProperty("estimated_cost")
    @Schema(description = "预估每晚费用(元)")
    private int estimatedCost = 0;
    @Builder.Default
    @JsonProperty("poi_id")
    private String poiId = "";
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
