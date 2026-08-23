package com.hellojourney.agent;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.agent.planning.StructuredPlanException;
import com.hellojourney.agent.planning.StructuredTripPlanResult;
import com.hellojourney.agent.planning.StructuredTripPlanService;
import com.hellojourney.model.vo.review.TripReviewResult;
import com.hellojourney.agent.tool.AgentLoop;
import com.hellojourney.agent.tool.AgentRunResult;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.llm.LlmUsage;
import com.hellojourney.model.vo.POIInfo;
import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.XhsService;
import com.hellojourney.util.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class TripPlannerAgentTest {
    @Mock
    private XhsService xhsService;
    @Mock
    private MapDispatcher mapDispatcher;
    @Mock
    private AgentLoop agentLoop;
    @Mock
    private StructuredTripPlanService structuredTripPlanService;
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private TripPlannerAgent agent;

    @BeforeEach
    void setUp() {
        agent = new TripPlannerAgent(xhsService, mapDispatcher, objectMapper, agentLoop,
                structuredTripPlanService);
    }

    @Test
    void planTrip_returnsStructuredReviewedPlan() throws Exception {
        TripRequest request = TestDataFactory.buildTripRequest();
        TripPlan expected = stubSuccessfulPlanning(request);

        TripPlan result = agent.planTrip(request, (message, progress) -> { });

        assertThat(result).isSameAs(expected);
        verify(structuredTripPlanService).generate(eq(request), anyString(), any(BooleanSupplier.class));
    }

    @Test
    void planTrip_emitsResearchStructuredPlanningAndReviewProgress() throws Exception {
        TripRequest request = TestDataFactory.buildTripRequest();
        stubSuccessfulPlanning(request);
        List<String> messages = new ArrayList<>();
        List<Integer> progress = new ArrayList<>();

        agent.planTrip(request, (message, percent) -> {
            messages.add(message);
            progress.add(percent);
        });

        assertThat(messages).anyMatch(message -> message.contains("景点"));
        assertThat(messages).anyMatch(message -> message.contains("天气"));
        assertThat(messages).anyMatch(message -> message.contains("酒店"));
        assertThat(messages).anyMatch(message -> message.contains("结构化"));
        assertThat(messages).anyMatch(message -> message.contains("Review Agent"));
        assertThat(progress).contains(85, 93);
    }

    @Test
    void planTrip_xhsFailureFallsBackToCoreMapAgent() throws Exception {
        TripRequest request = TestDataFactory.buildTripRequest();
        stubSuccessfulPlanning(request);
        when(xhsService.searchXhsAttractions(anyString(), anyString(), anyString()))
                .thenThrow(new XhsService.XhsCookieExpiredError("cookie expired"));
        when(mapDispatcher.searchPoiUnified(anyString(), eq("北京"), eq(true)))
                .thenReturn(List.of(POIInfo.builder().id("poi-1").name("故宫").build()));

        TripPlan result = agent.planTrip(request, null);

        assertThat(result).isNotNull();
        verify(mapDispatcher).searchPoiUnified(anyString(), eq("北京"), eq(true));
    }

    @Test
    void planTrip_doesNotReturnPlanRejectedByReviewAgent() throws Exception {
        TripRequest request = TestDataFactory.buildTripRequest();
        when(xhsService.searchXhsAttractions(anyString(), anyString(), anyString())).thenReturn("景点资料");
        stubResearchAgents();
        when(structuredTripPlanService.generate(eq(request), anyString(), any(BooleanSupplier.class)))
                .thenThrow(new StructuredPlanException("rejected", "structured_plan_rejected",
                        List.of("budget_total_mismatch"), null));

        assertThatThrownBy(() -> agent.planTrip(request, null))
                .isInstanceOf(StructuredPlanException.class);
    }

    private TripPlan stubSuccessfulPlanning(TripRequest request) throws Exception {
        lenient().when(xhsService.searchXhsAttractions(eq("北京"), anyString(), anyString())).thenReturn("故宫等景点");
        stubResearchAgents();
        TripPlan plan = TestDataFactory.buildTripPlan();
        TripReviewResult review = new TripReviewResult(true, List.of(), List.of(), List.of());
        when(structuredTripPlanService.generate(eq(request), anyString(), any(BooleanSupplier.class)))
                .thenReturn(new StructuredTripPlanResult(plan, review, "deepseek-v4-pro",
                        "response-1", new LlmUsage(), 0));
        return plan;
    }

    private void stubResearchAgents() throws Exception {
        when(agentLoop.run(anyString(), anyString(), anySet(), any(BooleanSupplier.class), isNull()))
                .thenReturn(new AgentRunResult("trace-weather", "天气结果", 2, List.of(), new LlmUsage()))
                .thenReturn(new AgentRunResult("trace-hotel", "酒店结果", 2, List.of(), new LlmUsage()));
    }
}
