package com.hellojourney.model.vo;

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
@Schema(description = "知识图谱数据")
public class KnowledgeGraphData {
    @Schema(description = "节点列表")
    private List<GraphNode> nodes;
    @Schema(description = "边列表")
    private List<GraphEdge> edges;
    @Schema(description = "分类列表")
    private List<GraphCategory> categories;
}
