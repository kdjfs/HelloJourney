package com.hellojourney.agent.planning;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.llm.LlmChatRequest;
import com.hellojourney.model.llm.LlmChatResult;
import com.hellojourney.model.llm.LlmMessage;
import com.hellojourney.model.llm.LlmUsage;
import com.hellojourney.model.vo.review.TripReviewResult;
import com.hellojourney.service.LlmService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BooleanSupplier;

@Slf4j
@Service
public class StructuredTripPlanService {
    private final LlmService llmService;
    private final ObjectMapper objectMapper;
    private final TripPlanJsonSchemaValidator schemaValidator;
    private final TripReviewAgent reviewAgent;
    private final AppSettings appSettings;

    public StructuredTripPlanService(LlmService llmService, ObjectMapper objectMapper,
                                     TripPlanJsonSchemaValidator schemaValidator,
                                     TripReviewAgent reviewAgent, AppSettings appSettings) {
        this.llmService = llmService;
        this.objectMapper = objectMapper;
        this.schemaValidator = schemaValidator;
        this.reviewAgent = reviewAgent;
        this.appSettings = appSettings;
    }

    public StructuredTripPlanResult generate(TripRequest request, String researchContext,
                                             BooleanSupplier cancellationRequested) throws IOException {
        int maxRepairs = Math.max(0, appSettings.getAgent().getStructuredRepairAttempts());
        String systemPrompt = buildSystemPrompt();
        String userPrompt = researchContext;
        LlmUsage totalUsage = new LlmUsage();
        List<String> lastIssueCodes = List.of("unknown");

        for (int attempt = 0; attempt <= maxRepairs; attempt++) {
            ensureActive(cancellationRequested);
            LlmChatResult response = llmService.complete(LlmChatRequest.builder()
                    .messages(List.of(LlmMessage.system(systemPrompt), LlmMessage.user(userPrompt)))
                    .responseFormat(Map.of("type", "json_object"))
                    .maxTokens(8_000)
                    .build());
            addUsage(totalUsage, response.usage());

            ValidationOutcome outcome = validateResponse(response.content(), response.finishReason(), request);
            if (outcome.plan != null && outcome.review != null && outcome.review.pass()) {
                log.info("structured_plan_succeeded model={} responseId={} repairs={} totalTokens={} warnings={}",
                        response.model(), safeId(response.responseId()), attempt, totalUsage.getTotalTokens(),
                        outcome.review.warnings().size());
                return new StructuredTripPlanResult(outcome.plan, outcome.review, response.model(),
                        response.responseId(), totalUsage, attempt);
            }

            lastIssueCodes = outcome.issueCodes;
            if (attempt >= maxRepairs) {
                break;
            }
            log.warn("structured_plan_repair model={} responseId={} attempt={} issueCount={} issueCodes={} instructions={}",
                    response.model(), safeId(response.responseId()), attempt + 1, outcome.issueCodes.size(),
                    outcome.issueCodes, summarize(outcome.repairInstructions, 3, 180));
            userPrompt = buildRepairPrompt(response.content(), outcome.repairInstructions);
        }

        throw new StructuredPlanException("行程未通过结构化校验与 Review Agent",
                "structured_plan_rejected", lastIssueCodes, null);
    }

    private ValidationOutcome validateResponse(String content, String finishReason, TripRequest request) {
        if ("length".equals(finishReason)) {
            return ValidationOutcome.failure(List.of("response_truncated"),
                    List.of("返回完整 JSON，不得因 token 限制截断"));
        }
        JsonNode json;
        try {
            json = objectMapper.readTree(content);
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            return ValidationOutcome.failure(List.of("invalid_json"),
                    List.of("输出必须是一个完整、合法的 JSON object"));
        }
        json = normalizeTypes(json);
        List<SchemaViolation> violations = schemaValidator.validate(json);
        if (!violations.isEmpty()) {
            return ValidationOutcome.failure(
                    violations.stream().map(violation -> "schema:" + violation.keyword()).distinct().toList(),
                    violations.stream().limit(40)
                            .map(violation -> violation.path() + " [" + violation.keyword() + "]: " + violation.message())
                            .toList());
        }
        try {
            TripPlan plan = objectMapper.treeToValue(json, TripPlan.class);
            TripReviewResult review = reviewAgent.review(plan, request);
            if (!review.pass()) {
                return new ValidationOutcome(null, review,
                        review.errors().stream().map(issue -> "review:" + issue.code()).distinct().toList(),
                        review.errors().stream().map(issue -> issue.path() + " [" + issue.code() + "]: " + issue.message()).toList());
            }
            return new ValidationOutcome(plan, review, List.of(), List.of());
        } catch (JsonProcessingException exception) {
            return ValidationOutcome.failure(List.of("dto_mapping_failed"),
                    List.of("字段类型必须与 TripPlan contract 完全一致"));
        }
    }

    /**
     * 类型归一化：模型输出常见的数字字段带引号/单位（"50元"、"32"）会导致 schema:type 失败。
     * 对已知数字字段做确定性纠错，减少无意义的修复循环。
     */
    private JsonNode normalizeTypes(JsonNode json) {
        if (json == null || !json.isObject()) {
            return json;
        }
        if (json instanceof com.fasterxml.jackson.databind.node.ObjectNode objectNode) {
            // 顶层 budget：6 个整数字段
            JsonNode budget = objectNode.get("budget");
            if (budget != null && budget.isObject()) {
                coerceIntFields((com.fasterxml.jackson.databind.node.ObjectNode) budget,
                        Set.of("total", "total_attractions", "total_hotels", "total_meals",
                                "total_transportation", "total_inter_city_transport"));
            }
            JsonNode weatherInfo = objectNode.get("weather_info");
            if (weatherInfo != null && weatherInfo.isArray()) {
                for (JsonNode weather : weatherInfo) {
                    if (weather.isObject()) {
                        coerceNumberFields((com.fasterxml.jackson.databind.node.ObjectNode) weather,
                                Set.of("day_temp", "night_temp"));
                    }
                }
            }
            JsonNode days = objectNode.get("days");
            if (days != null && days.isArray()) {
                for (JsonNode day : days) {
                    if (!day.isObject()) {
                        continue;
                    }
                    com.fasterxml.jackson.databind.node.ObjectNode dayNode =
                            (com.fasterxml.jackson.databind.node.ObjectNode) day;
                    coerceIntFields(dayNode, Set.of("day_index"));
                    normalizeAttractions(dayNode.get("attractions"));
                    normalizeMeals(dayNode.get("meals"));
                    JsonNode hotel = dayNode.get("hotel");
                    if (hotel != null && hotel.isObject()) {
                        com.fasterxml.jackson.databind.node.ObjectNode hotelNode =
                                (com.fasterxml.jackson.databind.node.ObjectNode) hotel;
                        coerceIntFields(hotelNode, Set.of("estimated_cost"));
                        // hotel.poi_id 必须是 string（schema 不允许 null/数字）
                        JsonNode hotelPoiId = hotelNode.get("poi_id");
                        if (hotelPoiId == null || hotelPoiId.isNull()) {
                            hotelNode.put("poi_id", "");
                        } else if (hotelPoiId.isNumber()) {
                            hotelNode.put("poi_id", hotelPoiId.asText());
                        }
                        // hotel.rating 必须是 string
                        JsonNode rating = hotelNode.get("rating");
                        if (rating == null || rating.isNull()) {
                            hotelNode.put("rating", "");
                        } else if (rating.isNumber()) {
                            hotelNode.put("rating", rating.asText());
                        }
                        normalizeLocation(hotelNode.get("location"), hotelNode);
                    }
                }
            }
        }
        return json;
    }

    private void normalizeAttractions(JsonNode attractions) {
        if (attractions == null || !attractions.isArray()) {
            return;
        }
        for (JsonNode attraction : attractions) {
            if (!attraction.isObject()) {
                continue;
            }
            com.fasterxml.jackson.databind.node.ObjectNode node =
                    (com.fasterxml.jackson.databind.node.ObjectNode) attraction;
            coerceIntFields(node, Set.of("visit_duration", "ticket_price"));
            // poi_id / reservation_tips 必须是 string（schema 不允许 null/数字）
            JsonNode poiId = node.get("poi_id");
            if (poiId == null || poiId.isNull()) {
                node.put("poi_id", "");
            } else if (poiId.isNumber()) {
                node.put("poi_id", poiId.asText());
            }
            JsonNode reservationTips = node.get("reservation_tips");
            if (reservationTips == null || reservationTips.isNull()) {
                node.put("reservation_tips", "");
            } else if (reservationTips.isNumber() || reservationTips.isBoolean()) {
                node.put("reservation_tips", reservationTips.asText());
            }
            // attraction.rating 是 number|null
            JsonNode rating = node.get("rating");
            if (rating != null && rating.isTextual()) {
                node.put("rating", parseNumberOrNull(rating.asText()));
            }
            normalizeLocation(node.get("location"), node);
        }
    }

    private void normalizeMeals(JsonNode meals) {
        if (meals == null || !meals.isArray()) {
            return;
        }
        for (JsonNode meal : meals) {
            if (!meal.isObject()) {
                continue;
            }
            com.fasterxml.jackson.databind.node.ObjectNode node =
                    (com.fasterxml.jackson.databind.node.ObjectNode) meal;
            coerceIntFields(node, Set.of("estimated_cost"));
            normalizeLocation(node.get("location"), node);
        }
    }

    private void normalizeLocation(JsonNode location, com.fasterxml.jackson.databind.node.ObjectNode owner) {
        if (location != null && location.isObject()) {
            coerceNumberFields((com.fasterxml.jackson.databind.node.ObjectNode) location,
                    Set.of("longitude", "latitude"));
        }
    }

    private void coerceIntFields(com.fasterxml.jackson.databind.node.ObjectNode node, Set<String> fields) {
        for (String field : fields) {
            JsonNode value = node.get(field);
            if (value == null || value.isNull() || value.isNumber()) {
                continue;
            }
            if (value.isTextual()) {
                String text = value.asText().replaceAll("[^0-9.-]", "");
                if (!text.isEmpty()) {
                    try {
                        node.put(field, (int) Math.round(Double.parseDouble(text)));
                    } catch (NumberFormatException ignored) {
                        // 保留原值交给 schema 校验报告
                    }
                }
            }
        }
    }

    private void coerceNumberFields(com.fasterxml.jackson.databind.node.ObjectNode node, Set<String> fields) {
        for (String field : fields) {
            JsonNode value = node.get(field);
            if (value == null || value.isNull() || value.isNumber()) {
                continue;
            }
            if (value.isTextual()) {
                String text = value.asText().replaceAll("[^0-9.-]", "");
                if (!text.isEmpty()) {
                    node.put(field, parseNumberOrNull(text));
                }
            }
        }
    }

    private double parseNumberOrNull(String text) {
        try {
            return Double.parseDouble(text);
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private String summarize(List<String> instructions, int limit, int maxLen) {
        if (instructions == null || instructions.isEmpty()) {
            return "";
        }
        return instructions.stream()
                .limit(limit)
                .map(item -> item == null ? "" : item)
                .map(item -> item.length() <= maxLen ? item : item.substring(0, maxLen) + "…")
                .toList()
                .toString();
    }

    private String buildSystemPrompt() {        return """
                你是 HelloJourney 的结构化行程 Planner。请基于用户请求和已查询资料生成可执行的旅行计划。
                必须只输出一个 JSON object，不要 Markdown、代码围栏或解释文字。
                不得把 AI 建议伪装为真实地图或实时天气数据：未经工具确认时，source 使用 ai，provider 使用 deepseek，verification_status 使用 ai_suggested。
                budget.total 必须严格等于五个费用分项之和。日期必须连续；每天必须含早餐、午餐、晚餐；活动时间不得冲突。
                输出必须符合以下版本化 JSON Schema：
                """ + schemaValidator.schemaText();
    }

    private String buildRepairPrompt(String completeOriginalJson, List<String> instructions) {
        String safeOriginal = completeOriginalJson == null ? "null" : completeOriginalJson;
        return """
                上一次完整输出未通过校验。请根据下列问题修复，并重新输出完整 JSON object。
                不要只输出 patch，不要省略未修改字段，不要添加解释或 Markdown。

                校验问题：
                """ + String.join("\n", instructions) + "\n\n上一次完整输出：\n" + safeOriginal;
    }

    private void ensureActive(BooleanSupplier cancellationRequested) throws StructuredPlanException {
        if (Thread.currentThread().isInterrupted()
                || (cancellationRequested != null && cancellationRequested.getAsBoolean())) {
            throw new StructuredPlanException("结构化行程生成已取消", "cancelled", List.of("cancelled"), null);
        }
    }

    private void addUsage(LlmUsage total, LlmUsage current) {
        if (current == null) {
            return;
        }
        total.setPromptTokens(total.getPromptTokens() + current.getPromptTokens());
        total.setCompletionTokens(total.getCompletionTokens() + current.getCompletionTokens());
        total.setTotalTokens(total.getTotalTokens() + current.getTotalTokens());
        total.setPromptCacheHitTokens(total.getPromptCacheHitTokens() + current.getPromptCacheHitTokens());
        total.setPromptCacheMissTokens(total.getPromptCacheMissTokens() + current.getPromptCacheMissTokens());
    }

    private String safeId(String id) {
        if (id == null || id.isBlank()) {
            return "n/a";
        }
        String safe = id.replaceAll("[^A-Za-z0-9._:-]", "_");
        return safe.substring(0, Math.min(safe.length(), 128));
    }

    private record ValidationOutcome(TripPlan plan, TripReviewResult review,
                                     List<String> issueCodes, List<String> repairInstructions) {
        static ValidationOutcome failure(List<String> issueCodes, List<String> repairInstructions) {
            return new ValidationOutcome(null, null, List.copyOf(issueCodes), List.copyOf(repairInstructions));
        }
    }
}
