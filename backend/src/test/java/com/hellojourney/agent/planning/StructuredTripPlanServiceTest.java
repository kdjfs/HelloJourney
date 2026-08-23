package com.hellojourney.agent.planning;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.llm.LlmChatRequest;
import com.hellojourney.model.llm.LlmChatResult;
import com.hellojourney.model.llm.LlmUsage;
import com.hellojourney.service.LlmService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StructuredTripPlanServiceTest {
    @Mock
    private LlmService llmService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private AppSettings settings;
    private StructuredTripPlanService service;
    private String validJson;

    @BeforeEach
    void setUp() throws Exception {
        settings = new AppSettings();
        TripPlanJsonSchemaValidator schemaValidator = new TripPlanJsonSchemaValidator(objectMapper);
        service = new StructuredTripPlanService(llmService, objectMapper, schemaValidator,
                new TripReviewAgent(), settings);
        validJson = objectMapper.writeValueAsString(PlanningTestData.plan());
    }

    @Test
    void generate_usesJsonOutputAndReturnsReviewedPlan() throws Exception {
        when(llmService.complete(any(LlmChatRequest.class))).thenReturn(result(validJson, "stop", 30));

        StructuredTripPlanResult result = service.generate(
                PlanningTestData.request(), "research", () -> false);

        assertThat(result.plan().getCity()).isEqualTo("北京");
        assertThat(result.review().pass()).isTrue();
        assertThat(result.repairAttempts()).isZero();
        ArgumentCaptor<LlmChatRequest> request = ArgumentCaptor.forClass(LlmChatRequest.class);
        verify(llmService).complete(request.capture());
        assertThat(request.getValue().getResponseFormat()).containsEntry("type", "json_object");
        assertThat(request.getValue().getMessages().get(0).getContent()).contains("trip-plan-v3.schema.json");
    }

    @Test
    void generate_repairsInvalidOutputUsingCompleteOriginalJson() throws Exception {
        String invalid = "{\"city\":\"北京\"}";
        when(llmService.complete(any(LlmChatRequest.class)))
                .thenReturn(result(invalid, "stop", 5))
                .thenReturn(result(validJson, "stop", 30));

        StructuredTripPlanResult result = service.generate(
                PlanningTestData.request(), "research", () -> false);

        assertThat(result.repairAttempts()).isEqualTo(1);
        ArgumentCaptor<LlmChatRequest> requests = ArgumentCaptor.forClass(LlmChatRequest.class);
        verify(llmService, times(2)).complete(requests.capture());
        assertThat(requests.getAllValues().get(1).getMessages().get(1).getContent())
                .contains(invalid)
                .contains("required");
    }

    @Test
    void generate_blocksPlanAfterRepairBudgetIsExhausted() throws Exception {
        settings.getAgent().setStructuredRepairAttempts(0);
        when(llmService.complete(any(LlmChatRequest.class))).thenReturn(result("{}", "stop", 5));

        assertThatThrownBy(() -> service.generate(PlanningTestData.request(), "research", () -> false))
                .isInstanceOf(StructuredPlanException.class)
                .extracting(error -> ((StructuredPlanException) error).getCode())
                .isEqualTo("structured_plan_rejected");
    }

    private LlmChatResult result(String content, String finishReason, int tokens) {
        return new LlmChatResult(content, null, List.of(), finishReason, "deepseek-v4-pro",
                "response-1", "request-1", new LlmUsage(tokens, 0, tokens, 0, tokens));
    }
}
