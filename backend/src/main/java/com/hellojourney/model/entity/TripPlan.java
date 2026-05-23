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
@Schema(description = "旅行计划")
public class TripPlan {
    @Schema(description = "主要城市")
    private String city;
    @Builder.Default
    @Schema(description = "途经城市列表")
    private List<String> cities = new ArrayList<>();
    @JsonProperty("start_date")
    @Schema(description = "出发日期")
    private String startDate;
    @JsonProperty("end_date")
    @Schema(description = "返回日期")
    private String endDate;
    @Schema(description = "每日行程列表")
    private List<DayPlan> days;
    @Builder.Default
    @JsonProperty("weather_info")
    @Schema(description = "天气信息列表")
    private List<WeatherInfo> weatherInfo = new ArrayList<>();
    @JsonProperty("overall_suggestions")
    @Schema(description = "总体建议")
    private String overallSuggestions;
    @Schema(description = "预算信息")
    private Budget budget;
}
