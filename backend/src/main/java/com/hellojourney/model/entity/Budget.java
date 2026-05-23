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
@Schema(description = "预算信息")
public class Budget {
    @Builder.Default
    @JsonProperty("total_attractions")
    @Schema(description = "景点总费用(元)")
    private int totalAttractions = 0;
    @Builder.Default
    @JsonProperty("total_hotels")
    @Schema(description = "酒店总费用(元)")
    private int totalHotels = 0;
    @Builder.Default
    @JsonProperty("total_meals")
    @Schema(description = "餐饮总费用(元)")
    private int totalMeals = 0;
    @Builder.Default
    @JsonProperty("total_transportation")
    @Schema(description = "市内交通总费用(元)")
    private int totalTransportation = 0;
    @Builder.Default
    @JsonProperty("total_inter_city_transport")
    @Schema(description = "城际交通总费用(元)")
    private int totalInterCityTransport = 0;
    @Builder.Default
    @Schema(description = "总预算(元)")
    private int total = 0;
}
