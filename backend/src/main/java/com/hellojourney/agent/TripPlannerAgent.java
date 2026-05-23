package com.hellojourney.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.CityStay;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.*;
import com.hellojourney.service.LlmService;
import com.hellojourney.service.MapDispatcher;
import com.hellojourney.service.XhsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.*;
import java.util.function.BiConsumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class TripPlannerAgent {
    private final LlmService llmService;
    private final AppSettings appSettings;
    private final XhsService xhsService;
    private final MapDispatcher mapDispatcher;
    private final ObjectMapper objectMapper;

    private static final String PLANNER_AGENT_PROMPT = "你是行程规划专家。你的任务是根据景点信息和天气信息,生成详细的旅行计划。支持单城市和多城市行程。\n\n"
            + "请严格按照以下JSON格式返回旅行计划:\n"
            + "```json\n"
            + "{\"city\": \"首个城市名称\", \"cities\": [\"城市1\", \"城市2\"], \"start_date\": \"YYYY-MM-DD\", \"end_date\": \"YYYY-MM-DD\", "
            + "\"days\": [{\"date\": \"YYYY-MM-DD\", \"day_index\": 0, \"city\": \"当天所在城市\", \"is_transfer_day\": false, \"transfer_info\": \"\", "
            + "\"description\": \"行程概述\", \"transportation\": \"交通方式\", \"accommodation\": \"住宿类型\", "
            + "\"hotel\": {\"name\": \"酒店名称\", \"address\": \"地址\", \"location\": {\"longitude\": 116.397128, \"latitude\": 39.916527}, "
            + "\"price_range\": \"300-500元\", \"rating\": \"4.5\", \"distance\": \"距离景点2公里\", \"type\": \"经济型酒店\", \"estimated_cost\": 400}, "
            + "\"attractions\": [{\"name\": \"景点名称\", \"address\": \"地址\", \"location\": {\"longitude\": 116.397128, \"latitude\": 39.916527}, "
            + "\"visit_duration\": 120, \"description\": \"描述\", \"category\": \"类别\", \"ticket_price\": 60, "
            + "\"reservation_required\": false, \"reservation_tips\": \"\"}], "
            + "\"meals\": [{\"type\": \"breakfast\", \"name\": \"早餐\", \"description\": \"描述\", \"estimated_cost\": 30}]}], "
            + "\"weather_info\": [{\"date\": \"YYYY-MM-DD\", \"city\": \"城市\", \"day_weather\": \"晴\", \"night_weather\": \"多云\", "
            + "\"day_temp\": 25, \"night_temp\": 15, \"wind_direction\": \"南风\", \"wind_power\": \"1-3级\"}], "
            + "\"overall_suggestions\": \"总体建议\", "
            + "\"budget\": {\"total_attractions\": 180, \"total_hotels\": 1200, \"total_meals\": 480, "
            + "\"total_transportation\": 200, \"total_inter_city_transport\": 0, \"total\": 2060}}\n```\n\n"
            + "**重要提示:**\n"
            + "1. weather_info必须包含每天的天气\n2. 温度必须是纯数字\n3. 每天安排2-3个景点\n4. 每天必须包含三餐\n"
            + "5. 必须包含预算信息\n6. budget中所有费用字段必须是纯数字\n7. 多城市行程每个day必须包含city字段\n"
            + "8. 城市切换当天设置is_transfer_day:true\n9. 不需要填写image_url字段";

    private static final Pattern JSON_BLOCK_PATTERN = Pattern.compile("```(?:json)?\\s*\\n([\\s\\S]*?)\\n```");
    private static final Pattern JSON_OBJECT_PATTERN = Pattern.compile("\\{[\\s\\S]*\\}");
    private static final Pattern JSON_ARRAY_PATTERN = Pattern.compile("\\[[\\s\\S]*\\]");

    public TripPlannerAgent(LlmService llmService, AppSettings appSettings, XhsService xhsService,
                            MapDispatcher mapDispatcher, ObjectMapper objectMapper) {
        this.llmService = llmService;
        this.appSettings = appSettings;
        this.xhsService = xhsService;
        this.mapDispatcher = mapDispatcher;
        this.objectMapper = objectMapper;
        log.info("多智能体旅行规划系统初始化成功 (供应商={})", mapDispatcher.getMapProvider());
    }

    public synchronized void reset() {
    }

    public TripPlan planTrip(TripRequest request, BiConsumer<String, Integer> progressCallback) throws Exception {
        List<CityStay> cities = request.getCities();
        int totalCities = cities.size();
        List<String> cityNames = cities.stream().map(CityStay::getCity).toList();

        log.info("开始多智能体协作规划旅行... 途经城市: {} 日期: {} 至 {} 天数: {}",
                String.join(" → ", cityNames), request.getStartDate(), request.getEndDate(), request.getTravelDays());

        String keywords = request.getPreferences() != null && !request.getPreferences().isEmpty()
                ? request.getPreferences().get(0) : "景点";
        String lang = (request.getLanguage() != null ? request.getLanguage() : "zh").trim().toLowerCase().split("-")[0];

        Map<String, String> allAttractions = new LinkedHashMap<>();
        Map<String, String> allWeather = new LinkedHashMap<>();
        Map<String, String> allHotels = new LinkedHashMap<>();

        for (int idx = 0; idx < cities.size(); idx++) {
            CityStay cityStay = cities.get(idx);
            String city = cityStay.getCity();
            int progressBase = 10 + (idx * 65 / totalCities);
            int progressStep = Math.max(65 / totalCities / 3, 3);
            String cityLabel = totalCities > 1 ? " (" + (idx + 1) + "/" + totalCities + ")" : "";

            emitProgress(progressCallback, "正在搜索 " + city + " 的景点..." + cityLabel, progressBase);
            String attractionResponse = xhsService.searchXhsAttractions(city, keywords, lang);
            allAttractions.put(city, attractionResponse);

            emitProgress(progressCallback, "正在查询 " + city + " 的天气..." + cityLabel, progressBase + progressStep);
            String weatherQuery = "请查询" + city + "的天气信息";
            String weatherResponse = queryWeatherAgent(city, lang);
            allWeather.put(city, weatherResponse);

            emitProgress(progressCallback, "正在搜索 " + city + " 的酒店..." + cityLabel, progressBase + progressStep * 2);
            String hotelQuery = "请搜索" + city + "的" + request.getAccommodation() + "酒店";
            String hotelResponse = queryHotelAgent(city, request.getAccommodation(), lang);
            allHotels.put(city, hotelResponse);
        }

        String planningLabel = totalCities > 1 ? "正在生成多城市行程计划..." : "正在生成旅行计划...";
        emitProgress(progressCallback, planningLabel, 85);

        String plannerResponse = runPlannerWithRetry(request, allAttractions, allWeather, allHotels);

        TripPlan tripPlan = parseResponse(plannerResponse, request);

        if (tripPlan.getCities() == null || tripPlan.getCities().isEmpty()) {
            tripPlan.setCities(cityNames);
        }
        if (totalCities == 1) {
            for (DayPlan day : tripPlan.getDays()) {
                if (day.getCity() == null || day.getCity().isEmpty()) {
                    day.setCity(cityNames.get(0));
                }
            }
        }

        return tripPlan;
    }

    private void emitProgress(BiConsumer<String, Integer> callback, String message, int progress) {
        if (callback != null) {
            callback.accept(message, progress);
        }
    }

    private String queryWeatherAgent(String city, String lang) {
        try {
            String weatherPrompt = buildWeatherPrompt(city);
            List<Map<String, String>> messages = List.of(
                    Map.of("role", "system", "content", weatherPrompt),
                    Map.of("role", "user", "content", "请查询" + city + "的天气信息")
            );
            return llmService.chat(messages, 0.1, 1000);
        } catch (Exception e) {
            log.error("天气查询失败: {}", e.getMessage());
            try {
                List<WeatherInfo> weather = mapDispatcher.getWeatherUnified(city);
                if (!weather.isEmpty()) {
                    return objectMapper.writeValueAsString(weather);
                }
            } catch (Exception ignored) {}
            return "天气查询失败: " + e.getMessage();
        }
    }

    private String queryHotelAgent(String city, String accommodation, String lang) {
        try {
            String hotelPrompt = buildHotelPrompt(city);
            List<Map<String, String>> messages = List.of(
                    Map.of("role", "system", "content", hotelPrompt),
                    Map.of("role", "user", "content", "请搜索" + city + "的" + accommodation + "酒店")
            );
            return llmService.chat(messages, 0.1, 1000);
        } catch (Exception e) {
            log.error("酒店搜索失败: {}", e.getMessage());
            return "酒店搜索失败: " + e.getMessage();
        }
    }

    private String buildWeatherPrompt(String city) {
        String toolPrefix = mapDispatcher.getMapProvider();
        String toolName = toolPrefix + "_maps_weather";
        return "你是天气查询专家。你的任务是查询指定城市的天气信息。\n\n"
                + "**重要提示:**\n1. 你必须使用工具来查询天气!不要自己编造天气信息!\n"
                + "2. 系统为你绑定的真实工具名称叫做 `" + toolName + "`，你只能而且必须原样输出这个名字。\n\n"
                + "**工具调用格式:**\n`[TOOL_CALL:" + toolName + ":city=城市名]`\n\n"
                + "**示例:**\n用户: \"查询北京天气\"\n你的回复: [TOOL_CALL:" + toolName + ":city=北京]";
    }

    private String buildHotelPrompt(String city) {
        String toolPrefix = mapDispatcher.getMapProvider();
        String toolName = toolPrefix + "_maps_text_search";
        return "你是酒店推荐专家。你的任务是根据城市和景点位置推荐合适的酒店。\n\n"
                + "**重要提示:**\n1. 你必须使用工具来搜索酒店!不要自己编造酒店信息!\n"
                + "2. 系统为你绑定的真实工具名称叫做 `" + toolName + "`，你只能而且必须原样输出这个名字。\n\n"
                + "**工具调用格式:**\n`[TOOL_CALL:" + toolName + ":keywords=酒店,city=城市名]`\n\n"
                + "**示例:**\n用户: \"搜索北京的酒店\"\n你的回复: [TOOL_CALL:" + toolName + ":keywords=酒店,city=北京]";
    }

    private String runPlannerWithRetry(TripRequest request, Map<String, String> attractions,
                                       Map<String, String> weather, Map<String, String> hotels) throws IOException {
        int timeout = Integer.parseInt(System.getenv().getOrDefault("TRIP_PLANNER_TIMEOUT", "180"));
        String plannerQuery = buildPlannerQuery(request, attractions, weather, hotels);

        try {
            List<Map<String, String>> messages = List.of(
                    Map.of("role", "system", "content", PLANNER_AGENT_PROMPT),
                    Map.of("role", "user", "content", plannerQuery)
            );
            return llmService.chatWithTimeout(messages, 0.2, 4000, timeout);
        } catch (Exception exc) {
            String errText = exc.getMessage().toLowerCase();
            if (!errText.contains("timeout") && !errText.contains("timed out")) {
                throw exc;
            }
            log.warn("首次行程规划超时，正在重试一次...");
            plannerQuery += "\n\n**补充要求:** 如果部分辅助信息不足，请使用保守、常见、可执行的建议补齐，但必须输出完整合法的 JSON，不要输出解释性文字。";
            List<Map<String, String>> messages = List.of(
                    Map.of("role", "system", "content", PLANNER_AGENT_PROMPT),
                    Map.of("role", "user", "content", plannerQuery)
            );
            return llmService.chatWithTimeout(messages, 0.2, 4000, timeout);
        }
    }

    private String buildPlannerQuery(TripRequest request, Map<String, String> attractions,
                                     Map<String, String> weather, Map<String, String> hotels) {
        List<CityStay> cities = request.getCities();
        int totalCities = cities.size();
        boolean isMultiCity = totalCities > 1;

        StringBuilder citiesDesc = new StringBuilder();
        int dayOffset = 0;
        for (CityStay cs : cities) {
            citiesDesc.append("- ").append(cs.getCity()).append(": 停留 ").append(cs.getDays())
                    .append(" 天 (第").append(dayOffset + 1).append("天 ~ 第").append(dayOffset + cs.getDays()).append("天)\n");
            dayOffset += cs.getDays();
        }

        String title = isMultiCity
                ? "跨城市旅行计划（" + String.join(" → ", cities.stream().map(CityStay::getCity).toList()) + "）"
                : cities.get(0).getCity() + "的" + request.getTravelDays() + "天旅行计划";

        StringBuilder query = new StringBuilder();
        query.append("请根据以下信息生成").append(title).append(":\n\n")
                .append("**基本信息:**\n- 途经城市及天数分配:\n").append(citiesDesc)
                .append("- 总天数: ").append(request.getTravelDays()).append("天\n")
                .append("- 日期: ").append(request.getStartDate()).append(" 至 ").append(request.getEndDate()).append("\n")
                .append("- 交通方式: ").append(request.getTransportation()).append("\n")
                .append("- 住宿: ").append(request.getAccommodation()).append("\n")
                .append("- 偏好: ").append(request.getPreferences() != null && !request.getPreferences().isEmpty()
                        ? String.join(", ", request.getPreferences()) : "无").append("\n");

        for (CityStay cs : cities) {
            String city = cs.getCity();
            if (isMultiCity) {
                query.append("\n--- ").append(city).append(" (").append(cs.getDays()).append("天) ---\n");
            }
            query.append("**").append(city).append(" 景点信息:**\n").append(attractions.getOrDefault(city, "无")).append("\n")
                    .append("**").append(city).append(" 天气信息:**\n").append(weather.getOrDefault(city, "无")).append("\n")
                    .append("**").append(city).append(" 酒店信息:**\n").append(hotels.getOrDefault(city, "无")).append("\n");
        }

        query.append("\n**要求:**\n1. 每天安排2-3个景点\n2. 每天必须包含早中晚三餐\n3. 每天推荐一个具体的酒店\n")
                .append("4. 考虑景点之间的距离和交通方式\n5. 返回完整的JSON格式数据\n6. 景点的经纬度坐标要真实准确\n")
                .append("7. 如果天气或酒店信息不足，请基于保守、通用的旅行建议补齐\n");

        if (isMultiCity) {
            query.append("\n**多城市特殊要求:**\n1. 每个day对象中必须包含\"city\"字段\n")
                    .append("2. 城市切换当天标记\"is_transfer_day\": true\n3. 城际移动日景点可减少为1-2个\n")
                    .append("4. budget中增加\"total_inter_city_transport\"字段\n5. \"cities\"数组列出所有途经城市\n");
        }

        if (request.getFreeTextInput() != null && !request.getFreeTextInput().isEmpty()) {
            query.append("\n**额外要求:** ").append(request.getFreeTextInput());
        }

        String lang = (request.getLanguage() != null ? request.getLanguage() : "zh").trim().toLowerCase().split("-")[0];
        if (!"zh".equals(lang)) {
            Map<String, String> langNames = Map.of("en", "English", "ja", "Japanese", "ko", "Korean", "fr", "French", "de", "German", "es", "Spanish");
            String targetLang = langNames.getOrDefault(lang, lang);
            query.append("\n\n**语言要求:**\n请用 ").append(targetLang).append(" 语言输出所有文字内容。JSON的key名称保持英文不变，只翻译value中的文字。");
        }

        return query.toString();
    }

    private TripPlan parseResponse(String response, TripRequest request) {
        try {
            String jsonStr = extractJsonFromResponse(response);
            jsonStr = sanitizeJsonStr(jsonStr);

            List<String> candidates = new ArrayList<>();
            candidates.add(jsonStr);

            String fixedQuotes = fixUnescapedQuotes(jsonStr);
            candidates.add(fixedQuotes);

            String repaired = repairTruncatedJson(jsonStr);
            if (!repaired.equals(jsonStr)) {
                candidates.add(repaired);
                String repairedFixed = fixUnescapedQuotes(repaired);
                if (!repairedFixed.equals(repaired)) {
                    candidates.add(repairedFixed);
                }
            }

            Matcher match = JSON_OBJECT_PATTERN.matcher(jsonStr);
            if (match.find()) {
                String brutal = sanitizeJsonStr(match.group());
                brutal = fixUnescapedQuotes(brutal);
                candidates.add(brutal);
            }

            Exception lastError = null;
            for (String candidate : candidates) {
                try {
                    return objectMapper.readValue(candidate, TripPlan.class);
                } catch (Exception e) {
                    lastError = e;
                }
            }

            log.warn("所有本地修复均失败，尝试使用 LLM 修复 JSON...");
            String llmFixed = llmRepairJson(jsonStr);
            llmFixed = sanitizeJsonStr(llmFixed);
            try {
                return objectMapper.readValue(llmFixed, TripPlan.class);
            } catch (Exception e) {
                throw new RuntimeException("行程 JSON 解析失败: " + lastError.getMessage(), lastError);
            }
        } catch (Exception e) {
            throw new RuntimeException("行程 JSON 解析失败: " + e.getMessage(), e);
        }
    }

    private String extractJsonFromResponse(String response) {
        Matcher blockMatch = JSON_BLOCK_PATTERN.matcher(response);
        if (blockMatch.find()) {
            return blockMatch.group(1).trim();
        }
        Matcher objMatch = JSON_OBJECT_PATTERN.matcher(response);
        if (objMatch.find()) {
            return objMatch.group();
        }
        throw new RuntimeException("响应中未找到JSON数据");
    }

    private String sanitizeJsonStr(String jsonStr) {
        jsonStr = jsonStr.replaceAll("^```(?:json)?\\s*", "");
        jsonStr = jsonStr.replaceAll("\\s*```$", "");
        jsonStr = jsonStr.replaceAll("//[^\n]*", "");
        jsonStr = jsonStr.replaceAll("/\\*.*?\\*/", "");
        jsonStr = jsonStr.replaceAll("[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]", "");
        jsonStr = jsonStr.replaceAll(",\\s*([\\]\\}])", "$1");
        jsonStr = jsonStr.replace('\u201c', '\'').replace('\u201d', '\'');
        jsonStr = jsonStr.replace('\u2018', '\'').replace('\u2019', '\'');
        jsonStr = jsonStr.replace('\uff1a', ':').replace('\uff0c', ',');

        Pattern arithPattern = Pattern.compile(":\\s*(\\d+(?:\\s*[+\\-*/]\\s*\\d+)+(?:\\s*=\\s*\\d+)?)");
        Matcher arithMatch = arithPattern.matcher(jsonStr);
        StringBuffer sb = new StringBuffer();
        while (arithMatch.find()) {
            String expr = arithMatch.group(1).trim();
            String replacement;
            if (expr.contains("=")) {
                replacement = expr.substring(expr.lastIndexOf("=") + 1).trim();
            } else {
                try {
                    replacement = String.valueOf(evalSimpleArithmetic(expr));
                } catch (Exception e2) {
                    replacement = expr;
                }
            }
            arithMatch.appendReplacement(sb, ": " + replacement);
        }
        arithMatch.appendTail(sb);
        return sb.toString();
    }

    private long evalSimpleArithmetic(String expr) {
        String[] parts = expr.split("[+]");
        long result = 0;
        for (String part : parts) {
            result += Long.parseLong(part.trim());
        }
        return result;
    }

    private String fixUnescapedQuotes(String jsonStr) {
        StringBuilder result = new StringBuilder();
        boolean inString = false;
        boolean escapeNext = false;

        for (int i = 0; i < jsonStr.length(); i++) {
            char ch = jsonStr.charAt(i);

            if (escapeNext) {
                result.append(ch);
                escapeNext = false;
                continue;
            }

            if (ch == '\\' && inString) {
                escapeNext = true;
                result.append(ch);
                continue;
            }

            if (ch == '"') {
                if (!inString) {
                    inString = true;
                    result.append(ch);
                } else {
                    String rest = jsonStr.substring(i + 1).trim();
                    if (rest.isEmpty() || !rest.isEmpty() && ",}]: ".indexOf(rest.charAt(0)) >= 0) {
                        inString = false;
                        result.append(ch);
                    } else {
                        result.append('\'');
                    }
                }
            } else {
                result.append(ch);
            }
        }
        return result.toString();
    }

    private String repairTruncatedJson(String jsonStr) {
        String s = jsonStr.trim();
        if (s.isEmpty()) return s;

        boolean inStr = false;
        boolean escape = false;
        for (char ch : s.toCharArray()) {
            if (escape) { escape = false; continue; }
            if (ch == '\\' && inStr) { escape = true; continue; }
            if (ch == '"') inStr = !inStr;
        }
        if (inStr) {
            s = s.replaceAll("\\\\+$", "");
            s += "\"";
        }

        for (int i = 0; i < 10; i++) {
            String stripped = s.trim();
            if (stripped.isEmpty()) break;
            char last = stripped.charAt(stripped.length() - 1);
            if ("}]\"0123456789els".indexOf(last) >= 0) break;
            s = stripped.substring(0, stripped.length() - 1);
        }

        s = s.replaceAll(",\\s*$", "");

        java.util.Stack<Character> stack = new java.util.Stack<>();
        boolean inStr2 = false;
        boolean esc2 = false;
        for (char ch : s.toCharArray()) {
            if (esc2) { esc2 = false; continue; }
            if (ch == '\\' && inStr2) { esc2 = true; continue; }
            if (ch == '"') { inStr2 = !inStr2; continue; }
            if (inStr2) continue;
            if (ch == '{' || ch == '[') stack.push(ch);
            else if (ch == '}' && !stack.isEmpty() && stack.peek() == '{') stack.pop();
            else if (ch == ']' && !stack.isEmpty() && stack.peek() == '[') stack.pop();
        }

        StringBuilder closing = new StringBuilder();
        while (!stack.isEmpty()) {
            char c = stack.pop();
            closing.append(c == '[' ? ']' : '}');
        }
        if (closing.length() > 0) {
            s += "\n" + closing;
        }

        return s;
    }

    private String llmRepairJson(String brokenJson) {
        try {
            String tail = brokenJson.length() > 2000 ? brokenJson.substring(brokenJson.length() - 2000) : brokenJson;
            String head = brokenJson.length() > 500 ? brokenJson.substring(0, 500) : brokenJson;

            String repairPrompt = "以下是一段被截断的旅行计划 JSON，请你补全它使其成为合法的 JSON。\n只输出修复后的完整 JSON，不要输出任何解释文字。\n\n"
                    + "开头部分:\n" + head + "\n\n...(中间省略)...\n\n尾部被截断部分:\n" + tail;

            List<Map<String, String>> messages = List.of(Map.of("role", "user", "content", repairPrompt));
            return llmService.chat(messages, 0.0, 1500);
        } catch (Exception e) {
            log.warn("LLM 修复 JSON 失败: {}", e.getMessage());
            return brokenJson;
        }
    }
}
