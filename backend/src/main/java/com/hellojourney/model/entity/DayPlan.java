package com.hellojourney.model.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "每日行程计划")
public class DayPlan {
    @Schema(description = "日期")
    private String date;
    @JsonProperty("day_index")
    @Schema(description = "天数索引(从0开始)")
    private int dayIndex;
    @Builder.Default
    @Schema(description = "当天所在城市")
    private String city = "";
    @Builder.Default
    @JsonProperty("is_transfer_day")
    @Schema(description = "是否为城际转移日")
    private boolean isTransferDay = false;
    @Builder.Default
    @JsonProperty("transfer_info")
    @Schema(description = "城际转移信息")
    private String transferInfo = "";
    @Schema(description = "行程概述")
    private String description;
    @Schema(description = "交通方式")
    private String transportation;
    @Schema(description = "住宿类型")
    private String accommodation;
    @Schema(description = "酒店信息")
    private Hotel hotel;
    @Builder.Default
    @Schema(description = "景点列表")
    private List<Attraction> attractions = new ArrayList<>();
    @Builder.Default
    @Schema(description = "餐饮列表")
    private List<Meal> meals = new ArrayList<>();
}
