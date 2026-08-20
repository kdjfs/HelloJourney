package com.hellojourney.model.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
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
@Schema(description = "旅行规划请求")
public class TripRequest {
    @Builder.Default
    @Schema(description = "目的地城市(单城市时使用)", example = "北京")
    private String city = "";

    @Builder.Default
    @JsonProperty("cities")
    @Schema(description = "多城市行程配置(多城市时使用)")
    private List<CityStay> cities = new ArrayList<>();

    @NotBlank
    @JsonProperty("start_date")
    @Schema(description = "出发日期", example = "2025-06-01", requiredMode = Schema.RequiredMode.REQUIRED)
    private String startDate;

    @NotBlank
    @JsonProperty("end_date")
    @Schema(description = "返回日期", example = "2025-06-05", requiredMode = Schema.RequiredMode.REQUIRED)
    private String endDate;

    @Min(1) @Max(30)
    @JsonProperty("travel_days")
    @Schema(description = "旅行天数", example = "5", requiredMode = Schema.RequiredMode.REQUIRED)
    private int travelDays;

    @NotBlank
    @Schema(description = "交通方式", example = "公共交通", requiredMode = Schema.RequiredMode.REQUIRED)
    private String transportation;

    @NotBlank
    @Schema(description = "住宿类型", example = "经济型酒店", requiredMode = Schema.RequiredMode.REQUIRED)
    private String accommodation;

    @Builder.Default
    @Min(1) @Max(20)
    @Schema(description = "出行人数", example = "2", defaultValue = "1")
    private int travelers = 1;

    @Min(0)
    @JsonProperty("budget_limit")
    @Schema(description = "整趟行程预算上限（人民币）", example = "8000")
    private Integer budgetLimit;

    @Builder.Default
    @Schema(description = "旅行偏好列表", example = "[\"历史文化\", \"美食\"]")
    private List<String> preferences = new ArrayList<>();

    @JsonProperty("free_text_input")
    @Schema(description = "自由文本额外要求", example = "希望行程不要太紧凑")
    private String freeTextInput;

    @Builder.Default
    @Schema(description = "输出语言", example = "zh", defaultValue = "zh")
    private String language = "zh";

    public void normalizeCities() {
        if ((cities == null || cities.isEmpty()) && city != null && !city.isBlank()) {
            cities = new ArrayList<>();
            cities.add(CityStay.builder().city(city).days(travelDays).build());
        } else if (cities != null && !cities.isEmpty() && (city == null || city.isBlank())) {
            city = cities.get(0).getCity();
        }
    }

    @JsonProperty("cities")
    public List<CityStay> getCities() {
        normalizeCities();
        return this.cities;
    }
}
