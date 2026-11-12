package com.hellojourney.service;

import com.hellojourney.agent.TripPlannerAgent;
import com.hellojourney.agent.planning.StructuredTripPlanResult;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.vo.KnowledgeGraphData;
import com.hellojourney.model.vo.TripPlanResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;

@Service
@RequiredArgsConstructor
public class TripPlanningJobService {
    private final TripPlannerAgent tripPlannerAgent;
    private final KnowledgeGraphService knowledgeGraphService;

    @Async("tripPlanningExecutor")
    public CompletableFuture<TripPlanResponse> planAsync(
            String taskId,
            TripRequest request,
            BiConsumer<String, Integer> progressCallback,
            BooleanSupplier cancellationRequested) throws Exception {
        ensureActive(taskId, cancellationRequested);

        // 降级提示（如小红书 Cookie 失效）随响应一起返回，前端结果页会显示提示条
        List<String> warnings = Collections.synchronizedList(new ArrayList<>());

        StructuredTripPlanResult generated = tripPlannerAgent.planTripWithReview(request, (message, progress) -> {
            ensureActive(taskId, cancellationRequested);
            progressCallback.accept(message, progress);
        }, cancellationRequested, warnings);
        TripPlan tripPlan = generated.plan();

        ensureActive(taskId, cancellationRequested);
        progressCallback.accept("正在构建知识图谱", 95);
        String language = request.getLanguage() != null ? request.getLanguage() : "zh";
        KnowledgeGraphData graphData = knowledgeGraphService.buildKnowledgeGraph(tripPlan, language);

        ensureActive(taskId, cancellationRequested);
        return CompletableFuture.completedFuture(TripPlanResponse.builder()
                .success(true)
                .message("旅行计划生成成功")
                .planId(taskId)
                .data(tripPlan)
                .graphData(graphData)
                .review(generated.review())
                .warnings(List.copyOf(warnings))
                .build());
    }

    private void ensureActive(String taskId, BooleanSupplier cancellationRequested) {
        if (Thread.currentThread().isInterrupted() || cancellationRequested.getAsBoolean()) {
            throw new CancellationException("旅行规划任务已取消: " + taskId);
        }
    }
}
