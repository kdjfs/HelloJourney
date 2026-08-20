package com.hellojourney.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.model.dto.replan.PartialReplanContracts;
import com.hellojourney.model.entity.Attraction;
import com.hellojourney.model.entity.DayPlan;
import com.hellojourney.model.entity.Location;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.llm.LlmChatResult;
import com.hellojourney.model.llm.LlmUsage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PartialReplanServiceTest {
    private LlmService llmService;
    private PartialReplanService service;

    @BeforeEach
    void setUp() {
        llmService = mock(LlmService.class);
        service = new PartialReplanService(llmService, new ObjectMapper());
    }

    @Test
    void propose_returnsValidatedChangeSetWithoutModelSuppliedId() throws Exception {
        when(llmService.complete(any())).thenReturn(result("""
                {
                  "id":"model-controlled",
                  "title":"减少步行",
                  "summary":"把故宫调整到上午",
                  "operations":[{
                    "type":"attraction.update",
                    "dayIndex":0,
                    "attractionIndex":0,
                    "patch":{"start_time":"09:00","end_time":"11:00"}
                  }]
                }
                """));

        PartialReplanContracts.ChangeSet changeSet = service.propose(request(plan()));

        assertThat(changeSet.id()).startsWith("change-").isNotEqualTo("model-controlled");
        assertThat(changeSet.operations()).hasSize(1);
        assertThat(changeSet.operations().get(0).type()).isEqualTo("attraction.update");
    }

    @Test
    void propose_rejectsPatchThatCanForgeVerificationMetadata() throws Exception {
        when(llmService.complete(any())).thenReturn(result("""
                {
                  "title":"伪造核验",
                  "summary":"不应被接受",
                  "operations":[{
                    "type":"attraction.update",
                    "dayIndex":0,
                    "attractionIndex":0,
                    "patch":{"verification_status":"verified"}
                  }]
                }
                """));

        assertThatThrownBy(() -> service.propose(request(plan())))
                .isInstanceOf(PartialReplanService.PartialReplanException.class)
                .hasMessage("AI 变更未通过安全校验");
    }

    @Test
    void propose_downgradesNewAttractionToAiSuggested() throws Exception {
        when(llmService.complete(any())).thenReturn(result("""
                {
                  "title":"新增公园",
                  "summary":"增加轻松活动",
                  "operations":[{
                    "type":"attraction.add",
                    "dayIndex":0,
                    "attraction":{
                      "name":"北海公园","address":"北京市西城区","visit_duration":90,
                      "description":"散步","location":{"longitude":116.38,"latitude":39.93},
                      "source":"map_api","provider":"tencent","verification_status":"verified"
                    }
                  }]
                }
                """));

        Attraction attraction = service.propose(request(plan())).operations().get(0).attraction();
        assertThat(attraction.getSource()).isEqualTo("ai");
        assertThat(attraction.getProvider()).isEqualTo("deepseek");
        assertThat(attraction.getVerificationStatus()).isEqualTo("ai_suggested");
        assertThat(attraction.getVerifiedAt()).isNull();
    }

    private PartialReplanContracts.Request request(TripPlan plan) {
        return new PartialReplanContracts.Request("下午少走路", "day", 0, plan);
    }

    private TripPlan plan() {
        Attraction attraction = Attraction.builder()
                .name("故宫").address("北京市东城区")
                .location(new Location(116.4, 39.9)).visitDuration(120).description("历史建筑")
                .build();
        DayPlan day = DayPlan.builder()
                .date("2026-09-01").dayIndex(0).description("北京一日")
                .transportation("地铁").accommodation("酒店")
                .attractions(new ArrayList<>(List.of(attraction))).meals(new ArrayList<>()).build();
        return TripPlan.builder().city("北京").cities(List.of("北京"))
                .startDate("2026-09-01").endDate("2026-09-01")
                .days(new ArrayList<>(List.of(day))).weatherInfo(new ArrayList<>()).build();
    }

    private LlmChatResult result(String content) {
        return new LlmChatResult(content, null, List.of(), "stop", "deepseek-v4-pro",
                "response-1", "request-1", new LlmUsage());
    }
}
