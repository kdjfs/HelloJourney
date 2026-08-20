package com.hellojourney.service;

import com.hellojourney.agent.TripPlannerAgent;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.vo.KnowledgeGraphData;
import com.hellojourney.model.vo.TripPlanResponse;
import com.hellojourney.util.TestDataFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripPlanningJobServiceTest {

    @Mock
    private TripPlannerAgent tripPlannerAgent;

    @Mock
    private KnowledgeGraphService knowledgeGraphService;

    @Test
    void planAsync_buildsPlanGraphAndForwardsSafeProgress() throws Exception {
        TripRequest request = TestDataFactory.buildTripRequest();
        TripPlan plan = TestDataFactory.buildTripPlan();
        KnowledgeGraphData graph = KnowledgeGraphData.builder().build();
        List<String> progress = new ArrayList<>();

        when(tripPlannerAgent.planTrip(eq(request), any())).thenAnswer(invocation -> {
            java.util.function.BiConsumer<String, Integer> callback = invocation.getArgument(1);
            callback.accept("正在搜索景点", 35);
            return plan;
        });
        when(knowledgeGraphService.buildKnowledgeGraph(plan, "zh")).thenReturn(graph);

        TripPlanningJobService service = new TripPlanningJobService(tripPlannerAgent, knowledgeGraphService);
        TripPlanResponse result = service.planAsync(
                "task-1",
                request,
                (message, percent) -> progress.add(message + ":" + percent),
                () -> false
        ).join();

        assertThat(result.getPlanId()).isEqualTo("task-1");
        assertThat(result.getData()).isSameAs(plan);
        assertThat(result.getGraphData()).isSameAs(graph);
        assertThat(progress).containsExactly("正在搜索景点:35", "正在构建知识图谱:95");
    }

    @Test
    void planAsync_stopsBeforeExternalWorkWhenCancelled() {
        TripPlanningJobService service = new TripPlanningJobService(tripPlannerAgent, knowledgeGraphService);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.planAsync(
                "task-1",
                TestDataFactory.buildTripRequest(),
                (message, percent) -> { },
                () -> true
        ))
                .isInstanceOf(java.util.concurrent.CancellationException.class)
                .hasMessageContaining("task-1");
    }
}
