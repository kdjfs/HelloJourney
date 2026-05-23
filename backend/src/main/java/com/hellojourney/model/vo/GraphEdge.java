package com.hellojourney.model.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Schema(description = "知识图谱边")
public class GraphEdge {
    @Schema(description = "源节点ID")
    private String source;
    @Schema(description = "目标节点ID")
    private String target;
    @Builder.Default
    @Schema(description = "边标签")
    private String label = "";
}
