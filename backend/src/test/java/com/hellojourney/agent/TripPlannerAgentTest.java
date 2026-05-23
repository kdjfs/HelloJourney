package com.hellojourney.agent;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.service.LlmService;
import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.XhsService;
import com.hellojourney.util.TestDataFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TripPlannerAgent")
class TripPlannerAgentTest {

    @Mock
    private LlmService llmService;

    @Mock
    private AppSettings appSettings;

    @Mock
    private XhsService xhsService;

    @Mock
    private MapDispatcher mapDispatcher;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @InjectMocks
    private TripPlannerAgent tripPlannerAgent;

    private void stubPlanTripSingleCity() throws Exception {
        when(xhsService.searchXhsAttractions(eq("北京"), anyString(), anyString())).thenReturn("故宫博物院等景点");
        when(llmService.chat(anyList(), anyDouble(), anyInt())).thenReturn("天气结果", "酒店结果");
        when(mapDispatcher.getMapProvider()).thenReturn("tencent");

        TripPlan expectedPlan = TestDataFactory.buildTripPlan();
        String planJson = objectMapper.writeValueAsString(expectedPlan);
        when(llmService.chatWithTimeout(anyList(), anyDouble(), anyInt(), anyInt())).thenReturn(planJson);
    }

    @Nested
    @DisplayName("planTrip")
    class PlanTripTests {

        @Test
        @DisplayName("planTrip_success_returnsTripPlan")
        void planTrip_success_returnsTripPlan() throws Exception {
            stubPlanTripSingleCity();

            TripRequest request = TestDataFactory.buildTripRequest();
            TripPlan result = tripPlannerAgent.planTrip(request, (msg, pct) -> {});

            assertThat(result).isNotNull();
            assertThat(result.getCity()).isEqualTo("北京");
            assertThat(result.getDays()).isNotEmpty();
            assertThat(result.getBudget()).isNotNull();
        }

        @Test
        @DisplayName("planTrip_progressCallback_invokedWithCorrectMessages")
        void planTrip_progressCallback_invokedWithCorrectMessages() throws Exception {
            stubPlanTripSingleCity();

            TripRequest request = TestDataFactory.buildTripRequest();
            List<String> messages = new ArrayList<>();
            List<Integer> progresses = new ArrayList<>();
            tripPlannerAgent.planTrip(request, (msg, pct) -> {
                messages.add(msg);
                progresses.add(pct);
            });

            assertThat(messages).anyMatch(m -> m.contains("景点"));
            assertThat(messages).anyMatch(m -> m.contains("天气"));
            assertThat(messages).anyMatch(m -> m.contains("酒店"));
            assertThat(messages).anyMatch(m -> m.contains("旅行计划"));
            assertThat(progresses).isNotEmpty();
            assertThat(progresses.stream().mapToInt(Integer::intValue).max().orElse(0)).isGreaterThanOrEqualTo(85);
        }

        @Test
        @DisplayName("planTrip_xhsCookieExpired_propagatesException")
        void planTrip_xhsCookieExpired_propagatesException() {
            when(xhsService.searchXhsAttractions(anyString(), anyString(), anyString()))
                    .thenThrow(new XhsService.XhsCookieExpiredError("小红书 Cookie 已过期"));

            TripRequest request = TestDataFactory.buildTripRequest();

            assertThatThrownBy(() -> tripPlannerAgent.planTrip(request, (msg, pct) -> {}))
                    .isInstanceOf(XhsService.XhsCookieExpiredError.class)
                    .hasMessageContaining("Cookie");
        }
    }

    @Nested
    @DisplayName("reset")
    class ResetTests {

        @Test
        @DisplayName("reset_noException")
        void reset_noException() {
            assertThatCode(() -> tripPlannerAgent.reset()).doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("extractJsonFromResponse")
    class ExtractJsonFromResponseTests {

        private String invokeExtractJsonFromResponse(String response) throws Exception {
            Method method = TripPlannerAgent.class.getDeclaredMethod("extractJsonFromResponse", String.class);
            method.setAccessible(true);
            return (String) method.invoke(tripPlannerAgent, response);
        }

        @Test
        @DisplayName("extractJsonFromResponse_codeBlock_extractsJson")
        void extractJsonFromResponse_codeBlock_extractsJson() throws Exception {
            String response = "这是规划结果：\n```json\n{\"city\": \"北京\"}\n```\n以上是结果。";
            String result = invokeExtractJsonFromResponse(response);
            assertThat(result).isEqualTo("{\"city\": \"北京\"}");
        }

        @Test
        @DisplayName("extractJsonFromResponse_noCodeBlock_extractsJsonObject")
        void extractJsonFromResponse_noCodeBlock_extractsJsonObject() throws Exception {
            String response = "结果如下：\n{\"city\": \"上海\", \"days\": []}\n结束";
            String result = invokeExtractJsonFromResponse(response);
            assertThat(result).contains("\"city\"");
            assertThat(result).contains("\"上海\"");
        }

        @Test
        @DisplayName("extractJsonFromResponse_noJson_throwsRuntimeException")
        void extractJsonFromResponse_noJson_throwsRuntimeException() throws Exception {
            String response = "这段文字没有任何JSON内容";
            Method method = TripPlannerAgent.class.getDeclaredMethod("extractJsonFromResponse", String.class);
            method.setAccessible(true);
            Throwable cause = catchThrowable(() -> method.invoke(tripPlannerAgent, response));
            assertThat(cause).isInstanceOf(InvocationTargetException.class);
            assertThat(((InvocationTargetException) cause).getCause()).isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("未找到JSON");
        }
    }

    @Nested
    @DisplayName("sanitizeJsonStr")
    class SanitizeJsonStrTests {

        private String invokeSanitizeJsonStr(String jsonStr) throws Exception {
            Method method = TripPlannerAgent.class.getDeclaredMethod("sanitizeJsonStr", String.class);
            method.setAccessible(true);
            return (String) method.invoke(tripPlannerAgent, jsonStr);
        }

        @Test
        @DisplayName("sanitizeJsonStr_trailingCommas_removed")
        void sanitizeJsonStr_trailingCommas_removed() throws Exception {
            String json = "{\"city\": \"北京\", \"days\": [1, 2,],}";
            String result = invokeSanitizeJsonStr(json);
            assertThat(result).doesNotContain(",]");
            assertThat(result).doesNotContain(",}");
        }

        @Test
        @DisplayName("sanitizeJsonStr_comments_removed")
        void sanitizeJsonStr_comments_removed() throws Exception {
            String json = "{\"city\": \"北京\" // 这是注释\n, \"days\": [] /* 块注释 */}";
            String result = invokeSanitizeJsonStr(json);
            assertThat(result).doesNotContain("// 这是注释");
            assertThat(result).doesNotContain("/* 块注释 */");
        }
    }

    @Nested
    @DisplayName("repairTruncatedJson")
    class RepairTruncatedJsonTests {

        private String invokeRepairTruncatedJson(String jsonStr) throws Exception {
            Method method = TripPlannerAgent.class.getDeclaredMethod("repairTruncatedJson", String.class);
            method.setAccessible(true);
            return (String) method.invoke(tripPlannerAgent, jsonStr);
        }

        @Test
        @DisplayName("repairTruncatedJson_unclosedBrackets_closesThem")
        void repairTruncatedJson_unclosedBrackets_closesThem() throws Exception {
            String truncated = "{\"city\": \"北京\", \"days\": [{\"date\": \"2025-06-01\"";
            String result = invokeRepairTruncatedJson(truncated);
            assertThat(result).contains("}").contains("]");
            assertThat(result).doesNotEndWith("\"2025-06-01\"");
        }

        @Test
        @DisplayName("repairTruncatedJson_completeJson_unchanged")
        void repairTruncatedJson_completeJson_unchanged() throws Exception {
            String complete = "{\"city\": \"北京\"}";
            String result = invokeRepairTruncatedJson(complete);
            assertThat(result).isEqualTo(complete);
        }
    }

    @Nested
    @DisplayName("evalSimpleArithmetic")
    class EvalSimpleArithmeticTests {

        private long invokeEvalSimpleArithmetic(String expr) throws Exception {
            Method method = TripPlannerAgent.class.getDeclaredMethod("evalSimpleArithmetic", String.class);
            method.setAccessible(true);
            return (long) method.invoke(tripPlannerAgent, expr);
        }

        @Test
        @DisplayName("evalSimpleArithmetic_simpleAddition_returnsSum")
        void evalSimpleArithmetic_simpleAddition_returnsSum() throws Exception {
            long result = invokeEvalSimpleArithmetic("100 + 200 + 50");
            assertThat(result).isEqualTo(350);
        }

        @Test
        @DisplayName("evalSimpleArithmetic_singleNumber_returnsNumber")
        void evalSimpleArithmetic_singleNumber_returnsNumber() throws Exception {
            long result = invokeEvalSimpleArithmetic("42");
            assertThat(result).isEqualTo(42);
        }
    }
}
