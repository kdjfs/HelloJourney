package com.hellojourney.model.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "知识图谱节点")
public class GraphNode {
    @Schema(description = "节点ID")
    private String id;
    @Schema(description = "节点名称")
    private String name;
    @Builder.Default
    @Schema(description = "分类索引")
    private int category = 0;
    @Builder.Default
    @Schema(description = "节点大小")
    private int symbolSize = 30;
    @Schema(description = "节点样式")
    private Map<String, Object> itemStyle;
    @Builder.Default
    @Schema(description = "附加信息")
    private String value = "";
}
