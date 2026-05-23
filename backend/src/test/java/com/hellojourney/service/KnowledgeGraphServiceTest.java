package com.hellojourney.service;

import com.hellojourney.model.entity.*;
import com.hellojourney.model.vo.GraphEdge;
import com.hellojourney.model.vo.GraphNode;
import com.hellojourney.model.vo.KnowledgeGraphData;
import com.hellojourney.util.TestDataFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

class KnowledgeGraphServiceTest {

    private final KnowledgeGraphService service = new KnowledgeGraphService();

    private GraphNode findNodeById(KnowledgeGraphData data, String id) {
        return data.getNodes().stream()
                .filter(n -> n.getId().equals(id))
                .findFirst()
                .orElse(null);
    }

    private List<GraphEdge> findEdgesFrom(KnowledgeGraphData data, String sourceId) {
        return data.getEdges().stream()
                .filter(e -> e.getSource().equals(sourceId))
                .collect(Collectors.toList());
    }

    private List<GraphEdge> findEdgesTo(KnowledgeGraphData data, String targetId) {
        return data.getEdges().stream()
                .filter(e -> e.getTarget().equals(targetId))
                .collect(Collectors.toList());
    }

    @Nested
    @DisplayName("Single city graph building")
    class SingleCity {

        @Test
        @DisplayName("Single city zh returns correct structure")
        void buildKnowledgeGraph_singleCity_zh_returnsCorrectStructure() {
            TripPlan plan = TestDataFactory.buildTripPlan();
            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, "zh");

            assertThat(data).isNotNull();
            assertThat(data.getNodes()).isNotEmpty();
            assertThat(data.getEdges()).isNotEmpty();
            assertThat(data.getCategories()).hasSize(8);

            GraphNode rootNode = findNodeById(data, "city_北京");
            assertThat(rootNode).isNotNull();
            assertThat(rootNode.getName()).isEqualTo("北京");
            assertThat(rootNode.getValue()).isEqualTo("2025-06-01 ~ 2025-06-03");

            GraphNode dayNode = findNodeById(data, "day_0");
            assertThat(dayNode).isNotNull();
            assertThat(dayNode.getName()).isEqualTo("第1天");

            List<GraphEdge> dayEdges = findEdgesFrom(data, "city_北京");
            assertThat(dayEdges).anyMatch(e -> e.getTarget().equals("day_0") && e.getLabel().equals("行程"));

            GraphNode attrNode = findNodeById(data, "attr_0_0_故宫博物院");
            assertThat(attrNode).isNotNull();
            assertThat(attrNode.getName()).isEqualTo("故宫博物院");

            List<GraphEdge> attrEdges = findEdgesFrom(data, "day_0");
            assertThat(attrEdges).anyMatch(e -> e.getTarget().equals("attr_0_0_故宫博物院") && e.getLabel().equals("游览"));

            GraphNode hotelNode = data.getNodes().stream()
                    .filter(n -> n.getId().startsWith("hotel_0_"))
                    .findFirst().orElse(null);
            assertThat(hotelNode).isNotNull();
            assertThat(hotelNode.getName()).isEqualTo("北京饭店");

            List<GraphEdge> hotelEdges = findEdgesFrom(data, "day_0");
            assertThat(hotelEdges).anyMatch(e -> e.getTarget().equals(hotelNode.getId()) && e.getLabel().equals("入住"));

            GraphNode mealNode = data.getNodes().stream()
                    .filter(n -> n.getId().startsWith("meal_0_"))
                    .findFirst().orElse(null);
            assertThat(mealNode).isNotNull();
            assertThat(mealNode.getName()).startsWith("早餐");

            GraphNode weatherNode = findNodeById(data, "weather_2025-06-01");
            assertThat(weatherNode).isNotNull();
            assertThat(weatherNode.getName()).contains("晴");

            List<GraphEdge> weatherEdges = findEdgesFrom(data, "day_0");
            assertThat(weatherEdges).anyMatch(e -> e.getTarget().equals("weather_2025-06-01") && e.getLabel().equals("天气"));

            GraphNode budgetNode = findNodeById(data, "budget_total");
            assertThat(budgetNode).isNotNull();
            assertThat(budgetNode.getName()).contains("总预算");

            GraphNode sugNode = findNodeById(data, "suggestion_overall");
            assertThat(sugNode).isNotNull();
        }
    }

    @Nested
    @DisplayName("Multi city graph building")
    class MultiCity {

        @Test
        @DisplayName("Multi city zh returns trip root node")
        void buildKnowledgeGraph_multiCity_zh_returnsTripRootNode() {
            TripPlan plan = TestDataFactory.buildMultiCityTripPlan();
            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, "zh");

            GraphNode rootNode = findNodeById(data, "trip_root");
            assertThat(rootNode).isNotNull();
            assertThat(rootNode.getName()).isEqualTo("北京 → 上海");

            GraphNode bjNode = findNodeById(data, "city_北京");
            assertThat(bjNode).isNotNull();
            assertThat(bjNode.getName()).isEqualTo("北京");

            GraphNode shNode = findNodeById(data, "city_上海");
            assertThat(shNode).isNotNull();
            assertThat(shNode.getName()).isEqualTo("上海");

            List<GraphEdge> rootEdges = findEdgesFrom(data, "trip_root");
            assertThat(rootEdges).anyMatch(e -> e.getTarget().equals("city_北京"));
            assertThat(rootEdges).anyMatch(e -> e.getTarget().equals("city_上海"));

            DayPlan transferDay = plan.getDays().get(2);
            assertThat(transferDay.isTransferDay()).isTrue();

            GraphNode day2Node = findNodeById(data, "day_2");
            assertThat(day2Node).isNotNull();
        }
    }

    @Nested
    @DisplayName("Language handling")
    class LanguageHandling {

        @Test
        @DisplayName("English labels returned for en")
        void buildKnowledgeGraph_en_returnsEnglishLabels() {
            TripPlan plan = TestDataFactory.buildTripPlan();
            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, "en");

            Set<String> catNames = data.getCategories().stream()
                    .map(c -> c.getName())
                    .collect(Collectors.toSet());
            assertThat(catNames).contains("City", "Schedule", "Attraction", "Hotel", "Dining", "Weather", "Budget", "Tips");

            GraphNode dayNode = findNodeById(data, "day_0");
            assertThat(dayNode.getName()).isEqualTo("Day 1");

            List<GraphEdge> dayEdges = findEdgesFrom(data, "city_北京");
            assertThat(dayEdges).anyMatch(e -> e.getLabel().equals("Itinerary"));

            List<GraphEdge> attrEdges = findEdgesFrom(data, "day_0");
            assertThat(attrEdges).anyMatch(e -> e.getLabel().equals("Visit"));
        }

        @Test
        @DisplayName("Japanese labels returned for ja")
        void buildKnowledgeGraph_ja_returnsJapaneseLabels() {
            TripPlan plan = TestDataFactory.buildTripPlan();
            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, "ja");

            Set<String> catNames = data.getCategories().stream()
                    .map(c -> c.getName())
                    .collect(Collectors.toSet());
            assertThat(catNames).contains("都市", "スケジュール", "観光地", "ホテル", "グルメ", "天気", "予算", "おすすめ");

            GraphNode dayNode = findNodeById(data, "day_0");
            assertThat(dayNode.getName()).isEqualTo("1日目");
        }

        @Test
        @DisplayName("Null language defaults to zh")
        void buildKnowledgeGraph_nullLanguage_defaultsToZh() {
            TripPlan plan = TestDataFactory.buildTripPlan();
            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, null);

            Set<String> catNames = data.getCategories().stream()
                    .map(c -> c.getName())
                    .collect(Collectors.toSet());
            assertThat(catNames).contains("城市", "日程", "景点", "酒店", "餐饮", "天气", "预算", "偏好/建议");
        }

        @Test
        @DisplayName("Language with region uses primary part")
        void buildKnowledgeGraph_languageWithRegion_usesPrimaryPart() {
            TripPlan plan = TestDataFactory.buildTripPlan();
            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, "zh-CN");

            Set<String> catNames = data.getCategories().stream()
                    .map(c -> c.getName())
                    .collect(Collectors.toSet());
            assertThat(catNames).contains("城市", "日程", "景点");
        }
    }

    @Nested
    @DisplayName("Null safety")
    class NullSafety {

        @Test
        @DisplayName("Null attractions no NPE")
        void buildKnowledgeGraph_nullAttractions_noNPE() {
            DayPlan day = DayPlan.builder()
                    .date("2025-06-01").dayIndex(0).city("北京")
                    .attractions(null)
                    .meals(List.of())
                    .build();
            TripPlan plan = TripPlan.builder()
                    .city("北京").cities(List.of("北京"))
                    .startDate("2025-06-01").endDate("2025-06-01")
                    .days(List.of(day))
                    .build();

            assertThatNoException().isThrownBy(() -> service.buildKnowledgeGraph(plan, "zh"));
            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, "zh");
            assertThat(data.getNodes()).isNotEmpty();
        }

        @Test
        @DisplayName("Null meals no NPE")
        void buildKnowledgeGraph_nullMeals_noNPE() {
            DayPlan day = DayPlan.builder()
                    .date("2025-06-01").dayIndex(0).city("北京")
                    .attractions(List.of())
                    .meals(null)
                    .build();
            TripPlan plan = TripPlan.builder()
                    .city("北京").cities(List.of("北京"))
                    .startDate("2025-06-01").endDate("2025-06-01")
                    .days(List.of(day))
                    .build();

            assertThatNoException().isThrownBy(() -> service.buildKnowledgeGraph(plan, "zh"));
            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, "zh");
            assertThat(data.getNodes()).isNotEmpty();
        }
    }

    @Nested
    @DisplayName("Edge cases")
    class EdgeCases {

        @Test
        @DisplayName("Suggestion over 30 chars truncated")
        void buildKnowledgeGraph_suggestionOver30Chars_truncated() {
            String longSuggestion = "这是一条非常长的建议内容已经超过了三十个字符的限制所以应该被截断处理掉多余的字符";
            TripPlan plan = TripPlan.builder()
                    .city("北京").cities(List.of("北京"))
                    .startDate("2025-06-01").endDate("2025-06-01")
                    .days(List.of(DayPlan.builder()
                            .date("2025-06-01").dayIndex(0).city("北京")
                            .attractions(List.of()).meals(List.of())
                            .build()))
                    .overallSuggestions(longSuggestion)
                    .build();

            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, "zh");
            GraphNode sugNode = findNodeById(data, "suggestion_overall");
            assertThat(sugNode).isNotNull();
            assertThat(sugNode.getName()).endsWith("...");
            assertThat(sugNode.getName().replace("...", "")).hasSize(30);
            assertThat(sugNode.getValue()).isEqualTo(longSuggestion);
        }

        @Test
        @DisplayName("Duplicate node ID not duplicated")
        void buildKnowledgeGraph_duplicateNodeId_notDuplicated() {
            Attraction a1 = Attraction.builder().name("故宫").visitDuration(120).ticketPrice(60).build();
            Attraction a2 = Attraction.builder().name("故宫").visitDuration(90).ticketPrice(40).build();
            DayPlan day = DayPlan.builder()
                    .date("2025-06-01").dayIndex(0).city("北京")
                    .attractions(List.of(a1, a2))
                    .meals(List.of())
                    .build();
            TripPlan plan = TripPlan.builder()
                    .city("北京").cities(List.of("北京"))
                    .startDate("2025-06-01").endDate("2025-06-01")
                    .days(List.of(day))
                    .build();

            KnowledgeGraphData data = service.buildKnowledgeGraph(plan, "zh");

            long count = data.getNodes().stream()
                    .filter(n -> n.getId().equals("attr_0_1_故宫"))
                    .count();
            assertThat(count).isEqualTo(1);
        }
    }
}
