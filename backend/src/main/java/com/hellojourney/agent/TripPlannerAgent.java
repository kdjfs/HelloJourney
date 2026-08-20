package com.hellojourney.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.agent.planning.StructuredTripPlanResult;
import com.hellojourney.agent.planning.StructuredTripPlanService;
import com.hellojourney.agent.tool.AgentLoop;
import com.hellojourney.agent.tool.AgentRunResult;
import com.hellojourney.model.dto.CityStay;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.DayPlan;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.entity.WeatherInfo;
import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.XhsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CancellationException;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;

@Slf4j
@Component
public class TripPlannerAgent {
    private final XhsService xhsService;
    private final MapDispatcher mapDispatcher;
    private final ObjectMapper objectMapper;
    private final AgentLoop agentLoop;
    private final StructuredTripPlanService structuredTripPlanService;

    public TripPlannerAgent(XhsService xhsService, MapDispatcher mapDispatcher, ObjectMapper objectMapper,
                            AgentLoop agentLoop, StructuredTripPlanService structuredTripPlanService) {
        this.xhsService = xhsService;
        this.mapDispatcher = mapDispatcher;
        this.objectMapper = objectMapper;
        this.agentLoop = agentLoop;
        this.structuredTripPlanService = structuredTripPlanService;
        log.info("trip_planner_initialized mapProvider={}", mapDispatcher.getEffectiveMapProvider());
    }

    public synchronized void reset() {
        // Dependencies own their lifecycle; retained as a compatibility hook for runtime settings refresh.
    }

    public TripPlan planTrip(TripRequest request, BiConsumer<String, Integer> progressCallback) throws Exception {
        return planTrip(request, progressCallback, () -> false);
    }

    public TripPlan planTrip(TripRequest request, BiConsumer<String, Integer> progressCallback,
                             BooleanSupplier cancellationRequested) throws Exception {
        return planTripWithReview(request, progressCallback, cancellationRequested).plan();
    }

    public StructuredTripPlanResult planTripWithReview(
            TripRequest request,
            BiConsumer<String, Integer> progressCallback,
            BooleanSupplier cancellationRequested) throws Exception {
        List<CityStay> cities = request.getCities();
        int totalCities = cities.size();
        List<String> cityNames = cities.stream().map(CityStay::getCity).toList();
        log.info("trip_planning_started cityCount={} travelDays={}", totalCities, request.getTravelDays());

        String keywords = request.getPreferences() != null && !request.getPreferences().isEmpty()
                ? request.getPreferences().get(0) : "景点";
        String lang = (request.getLanguage() != null ? request.getLanguage() : "zh")
                .trim().toLowerCase().split("-")[0];
        Map<String, String> allAttractions = new LinkedHashMap<>();
        Map<String, String> allWeather = new LinkedHashMap<>();
        Map<String, String> allHotels = new LinkedHashMap<>();

        for (int index = 0; index < cities.size(); index++) {
            ensureActive(cancellationRequested);
            CityStay cityStay = cities.get(index);
            String city = cityStay.getCity();
            int progressBase = 10 + (index * 65 / totalCities);
            int progressStep = Math.max(65 / totalCities / 3, 3);
            String cityLabel = totalCities > 1 ? " (" + (index + 1) + "/" + totalCities + ")" : "";

            emitProgress(progressCallback, "正在搜索 " + city + " 的景点..." + cityLabel, progressBase);
            allAttractions.put(city, searchAttractions(city, keywords, lang));

            emitProgress(progressCallback, "正在查询 " + city + " 的天气..." + cityLabel,
                    progressBase + progressStep);
            allWeather.put(city, queryWeatherAgent(city, lang, cancellationRequested));

            emitProgress(progressCallback, "正在搜索 " + city + " 的酒店..." + cityLabel,
                    progressBase + progressStep * 2);
            allHotels.put(city, queryHotelAgent(city, request.getAccommodation(), lang, cancellationRequested));
        }

        emitProgress(progressCallback, totalCities > 1 ? "正在生成结构化多城市行程..." : "正在生成结构化行程...", 85);
        String researchContext = buildPlannerQuery(request, allAttractions, allWeather, allHotels);
        StructuredTripPlanResult generated = structuredTripPlanService.generate(
                request, researchContext, cancellationRequested);
        emitProgress(progressCallback, "Review Agent 已完成行程校验", 93);

        TripPlan tripPlan = generated.plan();
        if (tripPlan.getCities() == null || tripPlan.getCities().isEmpty()) {
            tripPlan.setCities(cityNames);
        }
        if (totalCities == 1 && tripPlan.getDays() != null) {
            for (DayPlan day : tripPlan.getDays()) {
                if (day.getCity() == null || day.getCity().isEmpty()) {
                    day.setCity(cityNames.get(0));
                }
            }
        }
        return generated;
    }

    private String searchAttractions(String city, String keywords, String lang) {
        try {
            return xhsService.searchXhsAttractions(city, keywords, lang);
        } catch (Exception exception) {
            log.warn("xhs_attraction_adapter_failed city={} type={} fallback=map",
                    city, exception.getClass().getSimpleName());
            try {
                return objectMapper.writeValueAsString(
                        mapDispatcher.searchPoiUnified(keywords, city, true).stream().limit(10).toList());
            } catch (Exception fallbackException) {
                return "景点资料暂不可用，所有建议必须标记为 needs_verification";
            }
        }
    }

    private String queryWeatherAgent(String city, String lang, BooleanSupplier cancellationRequested) {
        try {
            AgentRunResult result = agentLoop.run(
                    "你是旅行天气研究助手。必须调用 get_weather 获取事实，不得编造天气；最后简洁总结工具结果。",
                    "查询 " + city + " 的旅行日期天气信息，输出语言为 " + lang + "。",
                    Set.of("get_weather"), cancellationRequested, null);
            return result.content();
        } catch (Exception exception) {
            ensureActive(cancellationRequested);
            log.warn("weather_agent_failed city={} type={} fallback=map",
                    city, exception.getClass().getSimpleName());
            try {
                List<WeatherInfo> weather = mapDispatcher.getWeatherUnified(city);
                if (!weather.isEmpty()) {
                    return objectMapper.writeValueAsString(weather);
                }
            } catch (Exception ignored) {
                // A safe status is returned below; provider exception details stay out of the prompt and API.
            }
            return "天气信息暂不可用，必须标记为 needs_verification";
        }
    }

    private String queryHotelAgent(String city, String accommodation, String lang,
                                   BooleanSupplier cancellationRequested) {
        try {
            AgentRunResult result = agentLoop.run(
                    "你是住宿研究助手。必须调用 search_hotel 获取真实候选，不得编造酒店；最后简洁比较工具结果。",
                    "搜索 " + city + " 的 " + accommodation + " 酒店，输出语言为 " + lang + "。",
                    Set.of("search_hotel"), cancellationRequested, null);
            return result.content();
        } catch (Exception exception) {
            ensureActive(cancellationRequested);
            log.warn("hotel_agent_failed city={} type={} fallback=map",
                    city, exception.getClass().getSimpleName());
            try {
                return objectMapper.writeValueAsString(
                        mapDispatcher.searchPoiUnified("酒店 " + accommodation, city, true).stream().limit(10).toList());
            } catch (Exception ignored) {
                return "酒店信息暂不可用，必须标记为 needs_verification";
            }
        }
    }

    private String buildPlannerQuery(TripRequest request, Map<String, String> attractions,
                                     Map<String, String> weather, Map<String, String> hotels) {
        List<CityStay> cities = request.getCities();
        boolean multiCity = cities.size() > 1;
        StringBuilder context = new StringBuilder();
        context.append("旅行请求：\n")
                .append("- 城市与停留天数：\n");
        int dayOffset = 0;
        for (CityStay city : cities) {
            context.append("  - ").append(city.getCity()).append(": ").append(city.getDays())
                    .append(" 天（第 ").append(dayOffset + 1).append(" 至 ")
                    .append(dayOffset + city.getDays()).append(" 天）\n");
            dayOffset += city.getDays();
        }
        context.append("- 日期：").append(request.getStartDate()).append(" 至 ").append(request.getEndDate()).append('\n')
                .append("- 总天数：").append(request.getTravelDays()).append('\n')
                .append("- 出行人数：").append(request.getTravelers()).append('\n')
                .append("- 预算上限：").append(request.getBudgetLimit() == null ? "未指定" : "¥" + request.getBudgetLimit()).append('\n')
                .append("- 交通：").append(request.getTransportation()).append('\n')
                .append("- 住宿：").append(request.getAccommodation()).append('\n')
                .append("- 偏好：").append(request.getPreferences() == null ? "无" : String.join("、", request.getPreferences())).append('\n');

        for (CityStay cityStay : cities) {
            String city = cityStay.getCity();
            context.append("\n【").append(city).append(" 已收集资料】\n")
                    .append("景点资料：").append(attractions.getOrDefault(city, "无")).append('\n')
                    .append("天气资料：").append(weather.getOrDefault(city, "无")).append('\n')
                    .append("酒店资料：").append(hotels.getOrDefault(city, "无")).append('\n');
        }
        context.append("\n规划要求：每天 1-3 个景点，包含早中晚三餐和具体酒店；安排明确、无冲突的活动时间；")
                .append("预算总额必须可复算；未经地图或天气工具确认的数据必须标记为 ai_suggested 或 needs_verification。\n");
        if (multiCity) {
            context.append("多城市切换日必须设置 is_transfer_day=true 并填写 transfer_info。\n");
        }
        if (request.getFreeTextInput() != null && !request.getFreeTextInput().isBlank()) {
            context.append("用户额外要求：").append(request.getFreeTextInput()).append('\n');
        }
        if (!"zh".equals((request.getLanguage() == null ? "zh" : request.getLanguage()).toLowerCase())) {
            context.append("所有自然语言 value 使用用户要求的语言 ").append(request.getLanguage())
                    .append("，JSON key 保持 contract 定义。\n");
        }
        return context.toString();
    }

    private void emitProgress(BiConsumer<String, Integer> callback, String message, int progress) {
        if (callback != null) {
            callback.accept(message, progress);
        }
    }

    private void ensureActive(BooleanSupplier cancellationRequested) {
        if (Thread.currentThread().isInterrupted()
                || (cancellationRequested != null && cancellationRequested.getAsBoolean())) {
            throw new CancellationException("旅行规划任务已取消");
        }
    }
}
