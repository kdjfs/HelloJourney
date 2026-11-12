package com.hellojourney.model.vo;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.vo.review.TripReviewResult;
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
@Schema(description = "旅行计划响应")
public class TripPlanResponse {
    @Schema(description = "是否成功")
    private boolean success;
    @Builder.Default
    @Schema(description = "响应消息")
    private String message = "";
    @JsonProperty("plan_id")
    @Schema(description = "计划ID")
    private String planId;
    @Schema(description = "旅行计划数据")
    private TripPlan data;
    @JsonProperty("graph_data")
    @Schema(description = "知识图谱数据")
    private KnowledgeGraphData graphData;
    @Schema(description = "Review Agent 结构化校验结果")
    private TripReviewResult review;

    /**
     * 生成过程中的降级提示（例如小红书 Cookie 失效导致景点数据退化为地图 POI）。
     * 为空表示全链路数据源均正常；前端在结果页顶部以提示条展示。
     */
    @Builder.Default
    @Schema(description = "生成过程中的降级提示")
    private List<String> warnings = new ArrayList<>();
}
