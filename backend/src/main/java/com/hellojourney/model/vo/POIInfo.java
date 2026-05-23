package com.hellojourney.model.vo;

import com.hellojourney.model.entity.Location;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "POI兴趣点信息")
public class POIInfo {
    @Schema(description = "POI唯一标识")
    private String id;
    @Schema(description = "POI名称")
    private String name;
    @Schema(description = "POI类型")
    private String type;
    @Schema(description = "地址")
    private String address;
    @Schema(description = "经纬度坐标")
    private Location location;
    @Schema(description = "联系电话")
    private String tel;
}
