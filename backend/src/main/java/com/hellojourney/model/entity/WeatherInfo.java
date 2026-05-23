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
@Schema(description = "天气信息")
public class WeatherInfo {
    @Schema(description = "日期")
    private String date;
    @Builder.Default
    @Schema(description = "城市")
    private String city = "";
    @Builder.Default
    @JsonProperty("day_weather")
    @Schema(description = "白天天气")
    private String dayWeather = "";
    @Builder.Default
    @JsonProperty("night_weather")
    @Schema(description = "夜间天气")
    private String nightWeather = "";
    @Builder.Default
    @JsonProperty("day_temp")
    @Schema(description = "白天温度(℃)")
    private Object dayTemp = 0;
    @Builder.Default
    @JsonProperty("night_temp")
    @Schema(description = "夜间温度(℃)")
    private Object nightTemp = 0;
    @Builder.Default
    @JsonProperty("wind_direction")
    @Schema(description = "风向")
    private String windDirection = "";
    @Builder.Default
    @JsonProperty("wind_power")
    @Schema(description = "风力等级")
    private String windPower = "";

    public int parseTemperature(Object temp) {
        if (temp == null) {
            return 0;
        }
        if (temp instanceof Number) {
            return ((Number) temp).intValue();
        }
        try {
            String str = temp.toString();
            String cleaned = str.replaceAll("[^0-9\\-]", "");
            if (cleaned.isEmpty()) {
                return 0;
            }
            return Integer.parseInt(cleaned);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    public int getDayTempAsInt() {
        return parseTemperature(dayTemp);
    }

    public int getNightTempAsInt() {
        return parseTemperature(nightTemp);
    }
}
