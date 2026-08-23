package com.hellojourney.model.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
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
@Schema(description = "景点信息")
public class Attraction {
    @Schema(description = "景点名称")
    private String name;
    @Schema(description = "景点地址")
    private String address;
    @Schema(description = "经纬度坐标")
    private Location location;
    @JsonProperty("visit_duration")
    @Schema(description = "游览时长(分钟)")
    private int visitDuration;
    @Schema(description = "景点描述")
    private String description;
    @Builder.Default
    @Schema(description = "景点类别")
    private String category = "景点";
    @Schema(description = "评分")
    private Double rating;
    @Schema(description = "照片URL列表")
    private List<String> photos;
    @Builder.Default
    @JsonProperty("poi_id")
    @Schema(description = "POI唯一标识")
    private String poiId = "";
    @JsonProperty("image_url")
    @Schema(description = "封面图片URL")
    private String imageUrl;
    @Builder.Default
    @JsonProperty("ticket_price")
    @Schema(description = "门票价格(元)")
    private int ticketPrice = 0;
    @Builder.Default
    @JsonProperty("reservation_required")
    @Schema(description = "是否需要预约")
    private Boolean reservationRequired = false;
    @Builder.Default
    @JsonProperty("reservation_tips")
    @Schema(description = "预约提示")
    private String reservationTips = "";
    @JsonProperty("start_time")
    @Schema(description = "建议开始时间(HH:mm)")
    private String startTime;
    @JsonProperty("end_time")
    @Schema(description = "建议结束时间(HH:mm)")
    private String endTime;
    @Builder.Default
    @Schema(description = "数据来源", example = "map_api")
    private String source = "ai";
    @Builder.Default
    @Schema(description = "数据提供方", example = "tencent")
    private String provider = "deepseek";
    @JsonProperty("verified_at")
    @Schema(description = "外部数据验证时间")
    private String verifiedAt;
    @Builder.Default
    @JsonProperty("verification_status")
    @Schema(description = "验证状态", example = "ai_suggested")
    private String verificationStatus = "ai_suggested";
}
