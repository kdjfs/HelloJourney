package com.hellojourney.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "城市停留配置")
public class CityStay {
    @NotBlank
    @Schema(description = "城市名称", example = "北京", requiredMode = Schema.RequiredMode.REQUIRED)
    private String city;
    @Min(1) @Max(15)
    @Schema(description = "停留天数", example = "3", requiredMode = Schema.RequiredMode.REQUIRED)
    private int days;
}
