package com.hellojourney.service;

import com.hellojourney.model.entity.*;
import com.hellojourney.model.vo.GraphCategory;
import com.hellojourney.model.vo.GraphEdge;
import com.hellojourney.model.vo.GraphNode;
import com.hellojourney.model.vo.KnowledgeGraphData;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class KnowledgeGraphService {
    private static final Map<String, String> NODE_COLORS = Map.of(
            "city", "#4A90D9", "day", "#5B8FF9", "attraction", "#5AD8A6",
            "hotel", "#F6BD16", "meal", "#E8684A", "weather", "#6DC8EC",
            "budget", "#FF9845", "preference", "#B37FEB"
    );

    private static final Map<String, Integer> NODE_SIZES = Map.of(
            "city", 70, "day", 45, "attraction", 35,
            "hotel", 35, "meal", 25, "weather", 28,
            "budget", 40, "preference", 30
    );

    private static final Map<String, Map<String, String>> I18N = Map.of(
            "zh", Map.ofEntries(
                    Map.entry("cat_city", "城市"), Map.entry("cat_day", "日程"), Map.entry("cat_attraction", "景点"),
                    Map.entry("cat_hotel", "酒店"), Map.entry("cat_meal", "餐饮"), Map.entry("cat_weather", "天气"),
                    Map.entry("cat_budget", "预算"), Map.entry("cat_preference", "偏好/建议"),
                    Map.entry("edge_itinerary", "行程"), Map.entry("edge_visit", "游览"), Map.entry("edge_next", "下一站"),
                    Map.entry("edge_checkin", "入住"), Map.entry("edge_weather", "天气"), Map.entry("edge_budget", "预算"),
                    Map.entry("edge_suggestion", "建议"),
                    Map.entry("day_n", "第{n}天"),
                    Map.entry("visit_duration", "游览{min}分钟"), Map.entry("ticket_price", "门票¥{price}"),
                    Map.entry("hotel_cost", "{range} | ¥{cost}/晚"),
                    Map.entry("total_budget", "总预算 ¥{total}"),
                    Map.entry("breakfast", "早餐"), Map.entry("lunch", "午餐"), Map.entry("dinner", "晚餐"), Map.entry("snack", "小吃"),
                    Map.entry("budget_attraction", "景点"), Map.entry("budget_hotel", "酒店"),
                    Map.entry("budget_meal", "餐饮"), Map.entry("budget_transport", "交通"), Map.entry("budget_inter_city", "城际交通")
            ),
            "en", Map.ofEntries(
                    Map.entry("cat_city", "City"), Map.entry("cat_day", "Schedule"), Map.entry("cat_attraction", "Attraction"),
                    Map.entry("cat_hotel", "Hotel"), Map.entry("cat_meal", "Dining"), Map.entry("cat_weather", "Weather"),
                    Map.entry("cat_budget", "Budget"), Map.entry("cat_preference", "Tips"),
                    Map.entry("edge_itinerary", "Itinerary"), Map.entry("edge_visit", "Visit"), Map.entry("edge_next", "Next"),
                    Map.entry("edge_checkin", "Check-in"), Map.entry("edge_weather", "Weather"), Map.entry("edge_budget", "Budget"),
                    Map.entry("edge_suggestion", "Tips"),
                    Map.entry("day_n", "Day {n}"),
                    Map.entry("visit_duration", "Visit {min} min"), Map.entry("ticket_price", "Ticket ¥{price}"),
                    Map.entry("hotel_cost", "{range} | ¥{cost}/night"),
                    Map.entry("total_budget", "Total Budget ¥{total}"),
                    Map.entry("breakfast", "Breakfast"), Map.entry("lunch", "Lunch"), Map.entry("dinner", "Dinner"), Map.entry("snack", "Snack"),
                    Map.entry("budget_attraction", "Attractions"), Map.entry("budget_hotel", "Hotels"),
                    Map.entry("budget_meal", "Dining"), Map.entry("budget_transport", "Transport"), Map.entry("budget_inter_city", "Inter-city")
            ),
            "ja", Map.ofEntries(
                    Map.entry("cat_city", "都市"), Map.entry("cat_day", "スケジュール"), Map.entry("cat_attraction", "観光地"),
                    Map.entry("cat_hotel", "ホテル"), Map.entry("cat_meal", "グルメ"), Map.entry("cat_weather", "天気"),
                    Map.entry("cat_budget", "予算"), Map.entry("cat_preference", "おすすめ"),
                    Map.entry("edge_itinerary", "旅程"), Map.entry("edge_visit", "観光"), Map.entry("edge_next", "次へ"),
                    Map.entry("edge_checkin", "宿泊"), Map.entry("edge_weather", "天気"), Map.entry("edge_budget", "予算"),
                    Map.entry("edge_suggestion", "提案"),
                    Map.entry("day_n", "{n}日目"),
                    Map.entry("visit_duration", "観光{min}分"), Map.entry("ticket_price", "入場料¥{price}"),
                    Map.entry("hotel_cost", "{range} | ¥{cost}/泊"),
                    Map.entry("total_budget", "総予算 ¥{total}"),
                    Map.entry("breakfast", "朝食"), Map.entry("lunch", "昼食"), Map.entry("dinner", "夕食"), Map.entry("snack", "軽食"),
                    Map.entry("budget_attraction", "観光地"), Map.entry("budget_hotel", "ホテル"),
                    Map.entry("budget_meal", "グルメ"), Map.entry("budget_transport", "交通"), Map.entry("budget_inter_city", "都市間交通")
            )
    );

    private String t(String key, String lang, Map<String, Object> kwargs) {
        Map<String, String> table = I18N.getOrDefault(lang, I18N.get("zh"));
        String template = table.getOrDefault(key, I18N.get("zh").getOrDefault(key, key));
        if (kwargs != null) {
            for (Map.Entry<String, Object> entry : kwargs.entrySet()) {
                template = template.replace("{" + entry.getKey() + "}", String.valueOf(entry.getValue()));
            }
        }
        return template;
    }

    public KnowledgeGraphData buildKnowledgeGraph(TripPlan tripPlan, String language) {
        String lang = (language == null ? "zh" : language).trim().toLowerCase().split("-")[0];
        List<GraphNode> nodes = new ArrayList<>();
        List<GraphEdge> edges = new ArrayList<>();
        Set<String> nodeIds = new HashSet<>();

        List<String> catKeys = List.of("cat_city", "cat_day", "cat_attraction", "cat_hotel", "cat_meal", "cat_weather", "cat_budget", "cat_preference");
        List<GraphCategory> categories = new ArrayList<>();
        Map<String, Integer> catMap = new HashMap<>();
        for (int i = 0; i < catKeys.size(); i++) {
            String name = t(catKeys.get(i), lang, null);
            categories.add(GraphCategory.builder().name(name).build());
            catMap.put(name, i);
        }

        Map<String, String> catStyleKey = new HashMap<>();
        catStyleKey.put(t("cat_city", lang, null), "city");
        catStyleKey.put(t("cat_day", lang, null), "day");
        catStyleKey.put(t("cat_attraction", lang, null), "attraction");
        catStyleKey.put(t("cat_hotel", lang, null), "hotel");
        catStyleKey.put(t("cat_meal", lang, null), "meal");
        catStyleKey.put(t("cat_weather", lang, null), "weather");
        catStyleKey.put(t("cat_budget", lang, null), "budget");
        catStyleKey.put(t("cat_preference", lang, null), "preference");

        String catCity = t("cat_city", lang, null);
        String catDay = t("cat_day", lang, null);
        String catAttraction = t("cat_attraction", lang, null);
        String catHotel = t("cat_hotel", lang, null);
        String catMeal = t("cat_meal", lang, null);
        String catWeather = t("cat_weather", lang, null);
        String catBudget = t("cat_budget", lang, null);
        String catPreference = t("cat_preference", lang, null);

        Map<String, String> cityNodeIds = new HashMap<>();
        List<String> citiesList = tripPlan.getCities() != null && !tripPlan.getCities().isEmpty() ? tripPlan.getCities() : List.of(tripPlan.getCity());
        String rootId;

        if (citiesList.size() > 1) {
            rootId = "trip_root";
            String rootName = String.join(" → ", citiesList);
            addNode(nodes, nodeIds, rootId, rootName, catCity, tripPlan.getStartDate() + " ~ " + tripPlan.getEndDate(), catMap, catStyleKey);
            for (String cityName : citiesList) {
                String cid = "city_" + cityName;
                addNode(nodes, nodeIds, cid, cityName, catCity, "", catMap, catStyleKey);
                edges.add(GraphEdge.builder().source(rootId).target(cid).label(t("edge_itinerary", lang, null)).build());
                cityNodeIds.put(cityName, cid);
            }
        } else {
            rootId = "city_" + tripPlan.getCity();
            addNode(nodes, nodeIds, rootId, tripPlan.getCity(), catCity, tripPlan.getStartDate() + " ~ " + tripPlan.getEndDate(), catMap, catStyleKey);
            cityNodeIds.put(tripPlan.getCity(), rootId);
        }

        for (DayPlan day : tripPlan.getDays()) {
            String dayId = "day_" + day.getDayIndex();
            String dayCity = day.getCity() != null && !day.getCity().isEmpty() ? day.getCity() : tripPlan.getCity();
            String parentId = cityNodeIds.getOrDefault(dayCity, rootId);

            addNode(nodes, nodeIds, dayId, t("day_n", lang, Map.of("n", day.getDayIndex() + 1)), catDay, day.getDate(), catMap, catStyleKey);
            edges.add(GraphEdge.builder().source(parentId).target(dayId).label(t("edge_itinerary", lang, null)).build());

            if (day.getAttractions() != null) {
                for (int i = 0; i < day.getAttractions().size(); i++) {
                    Attraction attr = day.getAttractions().get(i);
                    String attrId = "attr_" + day.getDayIndex() + "_" + i + "_" + attr.getName();
                    List<String> valueParts = new ArrayList<>();
                    if (attr.getAddress() != null && !attr.getAddress().isEmpty()) valueParts.add(attr.getAddress());
                    if (attr.getVisitDuration() > 0) valueParts.add(t("visit_duration", lang, Map.of("min", attr.getVisitDuration())));
                    if (attr.getTicketPrice() > 0) valueParts.add(t("ticket_price", lang, Map.of("price", attr.getTicketPrice())));
                    addNode(nodes, nodeIds, attrId, attr.getName(), catAttraction, String.join(" | ", valueParts), catMap, catStyleKey);
                    edges.add(GraphEdge.builder().source(dayId).target(attrId).label(t("edge_visit", lang, null)).build());
                    if (i > 0) {
                        Attraction prevAttr = day.getAttractions().get(i - 1);
                        String prevId = "attr_" + day.getDayIndex() + "_" + (i - 1) + "_" + prevAttr.getName();
                        edges.add(GraphEdge.builder().source(prevId).target(attrId).label(t("edge_next", lang, null)).build());
                    }
                }
            }

            if (day.getHotel() != null) {
                String hotelId = "hotel_" + day.getDayIndex() + "_" + day.getHotel().getName();
                String hotelValue = day.getHotel().getEstimatedCost() > 0
                        ? t("hotel_cost", lang, Map.of("range", day.getHotel().getPriceRange() != null ? day.getHotel().getPriceRange() : "", "cost", day.getHotel().getEstimatedCost()))
                        : (day.getHotel().getPriceRange() != null ? day.getHotel().getPriceRange() : "");
                addNode(nodes, nodeIds, hotelId, day.getHotel().getName(), catHotel, hotelValue, catMap, catStyleKey);
                edges.add(GraphEdge.builder().source(dayId).target(hotelId).label(t("edge_checkin", lang, null)).build());
            }

            if (day.getMeals() != null) {
                for (int j = 0; j < day.getMeals().size(); j++) {
                    Meal meal = day.getMeals().get(j);
                    String mealTypeLabel = List.of("breakfast", "lunch", "dinner", "snack").contains(meal.getType()) ? t(meal.getType(), lang, null) : meal.getType();
                    String mealId = "meal_" + day.getDayIndex() + "_" + j + "_" + meal.getName();
                    String mealValue = meal.getEstimatedCost() > 0 ? "¥" + meal.getEstimatedCost() : "";
                    addNode(nodes, nodeIds, mealId, mealTypeLabel + ": " + meal.getName(), catMeal, mealValue, catMap, catStyleKey);
                    edges.add(GraphEdge.builder().source(dayId).target(mealId).label(mealTypeLabel).build());
                }
            }
        }

        if (tripPlan.getWeatherInfo() != null) {
            for (WeatherInfo w : tripPlan.getWeatherInfo()) {
                String wId = "weather_" + w.getDate();
                addNode(nodes, nodeIds, wId, w.getDayWeather() + " " + w.getDayTempAsInt() + "°C", catWeather, w.getDate(), catMap, catStyleKey);
                for (DayPlan day : tripPlan.getDays()) {
                    if (day.getDate().equals(w.getDate())) {
                        edges.add(GraphEdge.builder().source("day_" + day.getDayIndex()).target(wId).label(t("edge_weather", lang, null)).build());
                        break;
                    }
                }
            }
        }

        if (tripPlan.getBudget() != null) {
            Budget b = tripPlan.getBudget();
            String budgetId = "budget_total";
            addNode(nodes, nodeIds, budgetId, t("total_budget", lang, Map.of("total", b.getTotal())), catBudget, "", catMap, catStyleKey);
            edges.add(GraphEdge.builder().source(rootId).target(budgetId).label(t("edge_budget", lang, null)).build());

            List<Map.Entry<String, Integer>> budgetItems = List.of(
                    Map.entry("budget_attraction", b.getTotalAttractions()),
                    Map.entry("budget_hotel", b.getTotalHotels()),
                    Map.entry("budget_meal", b.getTotalMeals()),
                    Map.entry("budget_transport", b.getTotalTransportation()),
                    Map.entry("budget_inter_city", b.getTotalInterCityTransport())
            );
            for (Map.Entry<String, Integer> item : budgetItems) {
                if (item.getValue() > 0) {
                    String label = t(item.getKey(), lang, null);
                    String subId = "budget_" + item.getKey();
                    addNode(nodes, nodeIds, subId, label + " ¥" + item.getValue(), catBudget, "", catMap, catStyleKey);
                    edges.add(GraphEdge.builder().source(budgetId).target(subId).label(label).build());
                }
            }
        }

        if (tripPlan.getOverallSuggestions() != null && !tripPlan.getOverallSuggestions().isEmpty()) {
            String sugId = "suggestion_overall";
            String sugText = tripPlan.getOverallSuggestions().length() > 30
                    ? tripPlan.getOverallSuggestions().substring(0, 30) + "..."
                    : tripPlan.getOverallSuggestions();
            addNode(nodes, nodeIds, sugId, sugText, catPreference, tripPlan.getOverallSuggestions(), catMap, catStyleKey);
            edges.add(GraphEdge.builder().source(rootId).target(sugId).label(t("edge_suggestion", lang, null)).build());
        }

        return KnowledgeGraphData.builder()
                .nodes(nodes)
                .edges(edges)
                .categories(categories)
                .build();
    }

    private void addNode(List<GraphNode> nodes, Set<String> nodeIds, String nid, String name, String categoryName, String extraValue, Map<String, Integer> catMap, Map<String, String> catStyleKey) {
        if (nodeIds.contains(nid)) return;
        nodeIds.add(nid);
        String catKey = catStyleKey.getOrDefault(categoryName, "city");
        nodes.add(GraphNode.builder()
                .id(nid)
                .name(name)
                .category(catMap.getOrDefault(categoryName, 0))
                .symbolSize(NODE_SIZES.getOrDefault(catKey, 30))
                .itemStyle(Map.of("color", NODE_COLORS.getOrDefault(catKey, "#999")))
                .value(extraValue)
                .build());
    }
}
