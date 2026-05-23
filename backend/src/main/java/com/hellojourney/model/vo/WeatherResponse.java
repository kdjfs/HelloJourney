package com.hellojourney.model.vo;

import com.hellojourney.model.entity.WeatherInfo;
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
@Schema(description = "天气查询响应")
public class WeatherResponse {
    @Schema(description = "是否成功")
    private boolean success;
    @Builder.Default
    @Schema(description = "响应消息")
    private String message = "";
    @Schema(description = "天气信息列表")
    private List<WeatherInfo> data;
}
