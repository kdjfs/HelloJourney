package com.hellojourney.agent.tool;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hellojourney.service.MapDispatcher;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class ToolRegistry {
    private static final int MAX_SEARCH_RESULTS = 10;

    private final Map<String, ToolDefinition> tools;

    public ToolRegistry(MapDispatcher mapDispatcher, ObjectMapper objectMapper) {
        Map<String, ToolDefinition> registered = new LinkedHashMap<>();
        register(registered, new ToolDefinition(
                "get_weather",
                "查询指定城市的实时天气预报。天气事实必须来自该工具。",
                schema(objectMapper, Map.of("city", stringProperty(objectMapper, "城市名称", 80)), List.of("city")),
                args -> sourced(objectMapper, mapDispatcher, objectMapper.valueToTree(
                        mapDispatcher.getWeatherUnified(requiredText(args, "city")))),
                AgentEventType.CHECKING_WEATHER, "正在查询实时天气"));
        register(registered, new ToolDefinition(
                "search_poi",
                "从地图服务搜索真实景点或地点。",
                schema(objectMapper, Map.of(
                        "keywords", stringProperty(objectMapper, "搜索关键词", 120),
                        "city", stringProperty(objectMapper, "城市名称", 80),
                        "citylimit", booleanProperty(objectMapper, "是否限制在城市内")),
                        List.of("keywords", "city")),
                args -> sourced(objectMapper, mapDispatcher, objectMapper.valueToTree(
                        mapDispatcher.searchPoiUnified(requiredText(args, "keywords"), requiredText(args, "city"),
                                        args.path("citylimit").asBoolean(true)).stream().limit(MAX_SEARCH_RESULTS).toList())),
                AgentEventType.SEARCHING_ATTRACTIONS, "正在搜索真实地点"));
        register(registered, new ToolDefinition(
                "search_hotel",
                "从地图服务搜索真实酒店候选。",
                schema(objectMapper, Map.of(
                        "city", stringProperty(objectMapper, "城市名称", 80),
                        "query", stringProperty(objectMapper, "住宿偏好，可选", 120)), List.of("city")),
                args -> sourced(objectMapper, mapDispatcher, objectMapper.valueToTree(
                        mapDispatcher.searchPoiUnified(searchKeywords("酒店", args.path("query").asText("")),
                                        requiredText(args, "city"), true).stream().limit(MAX_SEARCH_RESULTS).toList())),
                AgentEventType.COMPARING_HOTELS, "正在比较真实酒店"));
        register(registered, new ToolDefinition(
                "search_restaurant",
                "从地图服务搜索真实餐厅候选。",
                schema(objectMapper, Map.of(
                        "city", stringProperty(objectMapper, "城市名称", 80),
                        "query", stringProperty(objectMapper, "菜系或餐饮偏好，可选", 120)), List.of("city")),
                args -> sourced(objectMapper, mapDispatcher, objectMapper.valueToTree(
                        mapDispatcher.searchPoiUnified(searchKeywords("餐厅", args.path("query").asText("")),
                                        requiredText(args, "city"), true).stream().limit(MAX_SEARCH_RESULTS).toList())),
                AgentEventType.SEARCHING_RESTAURANTS, "正在搜索真实餐厅"));
        register(registered, new ToolDefinition(
                "geocode",
                "将地址解析为真实地图坐标。",
                schema(objectMapper, Map.of(
                        "address", stringProperty(objectMapper, "完整地址", 200),
                        "city", stringProperty(objectMapper, "城市名称，可选", 80)), List.of("address")),
                args -> sourced(objectMapper, mapDispatcher, objectMapper.valueToTree(
                        mapDispatcher.geocodeUnified(requiredText(args, "address"), optionalText(args, "city"),
                                requiredText(args, "address"), requiredText(args, "address")))),
                AgentEventType.GEOCODING, "正在验证地点坐标"));
        register(registered, new ToolDefinition(
                "route_plan",
                "通过地图服务计算两个地点之间的真实路线。",
                routeSchema(objectMapper),
                args -> sourced(objectMapper, mapDispatcher, objectMapper.valueToTree(
                        mapDispatcher.planRouteUnified(requiredText(args, "origin"), requiredText(args, "destination"),
                                optionalText(args, "origin_city"), optionalText(args, "destination_city"),
                                args.path("route_type").asText("walking")))),
                AgentEventType.CALCULATING_ROUTE, "正在计算真实路线"));
        this.tools = Map.copyOf(registered);
    }

    public Optional<ToolDefinition> find(String name) {
        return Optional.ofNullable(tools.get(name));
    }

    public List<ToolDefinition> definitions() {
        return List.copyOf(tools.values());
    }

    public boolean contains(String name) {
        return tools.containsKey(name);
    }

    private static void register(Map<String, ToolDefinition> tools, ToolDefinition definition) {
        if (tools.putIfAbsent(definition.name(), definition) != null) {
            throw new IllegalArgumentException("Duplicate tool: " + definition.name());
        }
    }

    private static JsonNode sourced(ObjectMapper mapper, MapDispatcher dispatcher, JsonNode data) {
        ObjectNode result = mapper.createObjectNode();
        result.put("source", "map_api");
        result.put("provider", dispatcher.getEffectiveMapProvider());
        result.put("verified_at", Instant.now().toString());
        result.put("verified", hasData(data));
        result.set("items", data);
        return result;
    }

    private static boolean hasData(JsonNode data) {
        return data != null && !data.isNull()
                && (!data.isContainerNode() || data.size() > 0);
    }

    private static String searchKeywords(String category, String query) {
        return query == null || query.isBlank() ? category : category + " " + query.trim();
    }

    private static String requiredText(JsonNode arguments, String field) {
        return arguments.path(field).asText().trim();
    }

    private static String optionalText(JsonNode arguments, String field) {
        String value = arguments.path(field).asText("").trim();
        return value.isEmpty() ? null : value;
    }

    private static ObjectNode schema(ObjectMapper mapper, Map<String, ObjectNode> properties, List<String> required) {
        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        ObjectNode propertyNode = schema.putObject("properties");
        properties.forEach(propertyNode::set);
        ArrayNode requiredNode = schema.putArray("required");
        required.forEach(requiredNode::add);
        schema.put("additionalProperties", false);
        return schema;
    }

    private static ObjectNode routeSchema(ObjectMapper mapper) {
        ObjectNode routeType = stringProperty(mapper, "交通方式", 20);
        ArrayNode values = routeType.putArray("enum");
        List.of("walking", "driving", "transit", "bicycling").forEach(values::add);
        return schema(mapper, Map.of(
                "origin", stringProperty(mapper, "起点地址", 200),
                "destination", stringProperty(mapper, "终点地址", 200),
                "origin_city", stringProperty(mapper, "起点城市，可选", 80),
                "destination_city", stringProperty(mapper, "终点城市，可选", 80),
                "route_type", routeType), List.of("origin", "destination"));
    }

    private static ObjectNode stringProperty(ObjectMapper mapper, String description, int maxLength) {
        ObjectNode property = mapper.createObjectNode();
        property.put("type", "string");
        property.put("description", description);
        property.put("minLength", 1);
        property.put("maxLength", maxLength);
        return property;
    }

    private static ObjectNode booleanProperty(ObjectMapper mapper, String description) {
        ObjectNode property = mapper.createObjectNode();
        property.put("type", "boolean");
        property.put("description", description);
        return property;
    }
}
