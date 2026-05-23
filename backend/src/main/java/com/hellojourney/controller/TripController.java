package com.hellojourney.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.agent.TripPlannerAgent;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.entity.TripPlan;
import com.hellojourney.model.vo.KnowledgeGraphData;
import com.hellojourney.model.vo.TripPlanResponse;
import com.hellojourney.service.KnowledgeGraphService;
import com.hellojourney.service.XhsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@RestController
@RequestMapping("/api/trip")
@RequiredArgsConstructor
@Tag(name = "旅行规划", description = "旅行计划生成、状态查询、历史记录")
public class TripController {
    private final TripPlannerAgent tripPlannerAgent;
    private final KnowledgeGraphService knowledgeGraphService;
    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;

    private static final Set<String> FINAL_TASK_STATUS = Set.of("completed", "failed");
    public final Map<String, TaskState> tasks = new ConcurrentHashMap<>();
    private static final String TASKS_DATA_DIR = "data/trip_tasks";

    @Data
    public static class TaskState {
        private String taskId;
        private String planId;
        private String status = "processing";
        private String stage = "submitted";
        private int progress = 0;
        private String message = "任务已提交，等待执行...";
        private Object result;
        private String error;
        private Object requestPayload;
        private final List<java.util.concurrent.BlockingQueue<Map<String, Object>>> subscribers = new java.util.ArrayList<>();
    }

    @PostMapping("/plan")
    @Operation(summary = "提交旅行规划任务", description = "异步生成旅行计划，返回任务ID，可通过WebSocket或轮询获取进度")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "任务已提交"), @ApiResponse(responseCode = "400", description = "请求参数错误")})
    public ResponseEntity<Map<String, Object>> planTrip(@RequestBody TripRequest request) {
        request.normalizeCities();
        String taskId = UUID.randomUUID().toString().substring(0, 8);
        TaskState task = new TaskState();
        task.setTaskId(taskId);
        task.setPlanId(taskId);
        task.setRequestPayload(request);
        tasks.put(taskId, task);
        persistTaskState(taskId, task);

        String cityDisplay = request.getCities() != null && !request.getCities().isEmpty()
                ? String.join(" → ", request.getCities().stream().map(c -> c.getCity()).toList())
                : request.getCity();

        log.info("收到旅行规划请求 (task_id={}): 城市: {} 日期: {} - {} 天数: {}",
                taskId, cityDisplay, request.getStartDate(), request.getEndDate(), request.getTravelDays());

        updateTaskState(taskId, "processing", "submitted", 5, "任务已提交，正在初始化流程...", null, null);

        runTripPlanningAsync(taskId, request);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("task_id", taskId);
        response.put("plan_id", taskId);
        response.put("status", "processing");
        response.put("ws_url", "/api/trip/ws/" + taskId);
        response.put("message", "任务已提交，可通过 WebSocket /api/trip/ws/" + taskId + " 实时订阅状态");
        return ResponseEntity.ok(response);
    }

    @Async
    public void runTripPlanningAsync(String taskId, TripRequest request) {
        try {
            updateTaskState(taskId, "processing", "initializing", 10, "正在获取多智能体系统实例...", null, null);

            TripPlan tripPlan = tripPlannerAgent.planTrip(request, (message, progress) -> {
                String stage = "";
                if (message.contains("景点")) stage = "attraction_search";
                else if (message.contains("天气")) stage = "weather_search";
                else if (message.contains("酒店")) stage = "hotel_search";
                else if (message.contains("生成")) stage = "planning";
                else stage = "processing";
                updateTaskState(taskId, "processing", stage, progress, message, null, null);
            });

            updateTaskState(taskId, "processing", "graph_building", 95, "正在构建知识图谱...", null, null);

            String language = request.getLanguage() != null ? request.getLanguage() : "zh";
            KnowledgeGraphData graphData = knowledgeGraphService.buildKnowledgeGraph(tripPlan, language);

            TripPlanResponse tripResult = TripPlanResponse.builder()
                    .success(true)
                    .message("旅行计划生成成功")
                    .planId(taskId)
                    .data(tripPlan)
                    .graphData(graphData)
                    .build();

            log.info("任务 {} 完成", taskId);
            updateTaskState(taskId, "completed", "completed", 100, "旅行计划生成成功", tripResult, null);

        } catch (Exception e) {
            log.error("任务 {} 失败: {}", taskId, e.getMessage());
            String errorMsg = e.getMessage();
            if (e instanceof XhsService.XhsCookieExpiredError) {
                errorMsg = "【认证失败】" + errorMsg;
            }
            updateTaskState(taskId, "failed", "failed", 100, errorMsg, null, errorMsg);
        }
    }

    @GetMapping("/status/{taskId}")
    @Operation(summary = "查询任务状态", description = "通过任务ID查询旅行规划任务的当前状态和结果")
    public ResponseEntity<Map<String, Object>> getTaskStatus(@Parameter(name = "taskId", description = "任务ID", required = true, example = "abc12345") @PathVariable String taskId) {
        TaskState task = tasks.get(taskId);
        if (task == null) {
            task = loadTaskFromDisk(taskId);
        }
        if (task == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "任务不存在");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("task_id", taskId);
        response.put("plan_id", task.getPlanId());

        if ("completed".equals(task.getStatus())) {
            response.put("status", "completed");
            response.put("result", task.getResult());
        } else if ("failed".equals(task.getStatus())) {
            response.put("status", "failed");
            response.put("error", task.getError() != null ? task.getError() : "");
            response.put("request_payload", task.getRequestPayload());
        } else {
            response.put("status", "processing");
            response.put("stage", task.getStage());
            response.put("progress", task.getProgress());
            response.put("progress_text", task.getMessage());
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> getTripHistory(@RequestParam(defaultValue = "10") int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        List<Map<String, Object>> items = loadHistoryItems(safeLimit);
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/health")
    @Operation(summary = "旅行规划服务健康检查")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        try {
            return ResponseEntity.ok(Map.of(
                    "status", "healthy",
                    "service", "trip-planner"
            ));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "服务不可用: " + e.getMessage());
        }
    }

    synchronized void updateTaskState(String taskId, String status, String stage, int progress, String message, Object result, String error) {
        TaskState task = tasks.get(taskId);
        if (task == null) return;
        task.setStatus(status);
        task.setStage(stage);
        task.setProgress(progress);
        task.setMessage(message);
        if (result != null) task.setResult(result);
        if (error != null) task.setError(error);
        persistTaskState(taskId, task);

        Map<String, Object> event = buildTaskEvent(taskId, task, true);
        broadcastTaskEvent(taskId, event);
    }

    private Map<String, Object> buildTaskEvent(String taskId, TaskState task, boolean includeResult) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("task_id", taskId);
        event.put("plan_id", task.getPlanId());
        event.put("status", task.getStatus());
        event.put("stage", task.getStage());
        event.put("progress", task.getProgress());
        event.put("message", task.getMessage());
        if (task.getError() != null) event.put("error", task.getError());
        if (includeResult && task.getResult() != null) event.put("result", task.getResult());
        return event;
    }

    private void broadcastTaskEvent(String taskId, Map<String, Object> event) {
        TaskState task = tasks.get(taskId);
        if (task == null) return;
        List<java.util.concurrent.BlockingQueue<Map<String, Object>>> deadQueues = new java.util.ArrayList<>();
        for (java.util.concurrent.BlockingQueue<Map<String, Object>> queue : task.getSubscribers()) {
            try {
                queue.offer(event);
            } catch (Exception e) {
                deadQueues.add(queue);
            }
        }
        if (!deadQueues.isEmpty()) {
            task.getSubscribers().removeAll(deadQueues);
        }
    }

    private void persistTaskState(String taskId, TaskState task) {
        try {
            Path dir = Paths.get(TASKS_DATA_DIR);
            Files.createDirectories(dir);
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("task_id", taskId);
            payload.put("plan_id", task.getPlanId());
            payload.put("status", task.getStatus());
            payload.put("stage", task.getStage());
            payload.put("progress", task.getProgress());
            payload.put("message", task.getMessage());
            payload.put("result", task.getResult());
            payload.put("error", task.getError());
            payload.put("request_payload", task.getRequestPayload());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(dir.resolve(taskId + ".json").toFile(), payload);
        } catch (Exception e) {
            log.warn("持久化任务 {} 失败: {}", taskId, e.getMessage());
        }
    }

    public TaskState loadTaskFromDisk(String taskId) {
        Path path = Paths.get(TASKS_DATA_DIR, taskId + ".json");
        if (!Files.exists(path)) return null;
        try {
            Map<String, Object> payload = objectMapper.readValue(path.toFile(), Map.class);
            TaskState task = new TaskState();
            task.setTaskId(taskId);
            task.setPlanId((String) payload.getOrDefault("plan_id", taskId));
            task.setStatus((String) payload.getOrDefault("status", "failed"));
            task.setStage((String) payload.getOrDefault("stage", "failed"));
            task.setProgress((Integer) payload.getOrDefault("progress", 100));
            task.setMessage((String) payload.getOrDefault("message", ""));
            task.setResult(payload.get("result"));
            task.setError((String) payload.get("error"));
            task.setRequestPayload(payload.get("request_payload"));
            if (!FINAL_TASK_STATUS.contains(task.getStatus())) {
                task.setStatus("failed");
                task.setStage("failed");
                task.setProgress(100);
                task.setError("服务已重启，未完成的旅行规划任务无法恢复，请重新生成。");
                task.setMessage(task.getError());
            }
            tasks.put(taskId, task);
            return task;
        } catch (Exception e) {
            log.warn("读取任务 {} 失败: {}", taskId, e.getMessage());
            return null;
        }
    }

    private List<Map<String, Object>> loadHistoryItems(int limit) {
        Path dir = Paths.get(TASKS_DATA_DIR);
        if (!Files.exists(dir)) return Collections.emptyList();

        List<Map<String, Object>> items = new java.util.ArrayList<>();
        try (java.util.stream.Stream<Path> paths = Files.list(dir)) {
            List<Path> jsonFiles = paths.filter(p -> p.toString().endsWith(".json"))
                    .sorted((a, b) -> {
                        try { return Long.compare(Files.getLastModifiedTime(b).toMillis(), Files.getLastModifiedTime(a).toMillis()); }
                        catch (Exception e) { return 0; }
                    })
                    .limit(limit)
                    .toList();

            for (Path path : jsonFiles) {
                try {
                    Map<String, Object> payload = objectMapper.readValue(path.toFile(), Map.class);
                    if (!"completed".equals(payload.get("status"))) continue;
                    Map<String, Object> item = buildHistoryItem(payload, path);
                    if (item != null) items.add(item);
                    if (items.size() >= limit) break;
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
        return items;
    }

    private Map<String, Object> buildHistoryItem(Map<String, Object> payload, Path path) {
        try {
            Object resultObj = payload.get("result");
            Map<String, Object> result = resultObj instanceof Map ? (Map<String, Object>) resultObj : Map.of();
            Map<String, Object> plan = result.get("data") instanceof Map ? (Map<String, Object>) result.get("data") : Map.of();
            Map<String, Object> requestPayload = payload.get("request_payload") instanceof Map ? (Map<String, Object>) payload.get("request_payload") : Map.of();

            String city = (String) plan.getOrDefault("city", requestPayload.getOrDefault("city", ""));
            List<String> cities = plan.get("cities") instanceof List ? (List<String>) plan.get("cities") : List.of();
            String startDate = (String) plan.getOrDefault("start_date", requestPayload.getOrDefault("start_date", ""));
            String endDate = (String) plan.getOrDefault("end_date", requestPayload.getOrDefault("end_date", ""));
            String overallSuggestions = (String) plan.getOrDefault("overall_suggestions", result.getOrDefault("message", ""));

            if ((city == null || city.isEmpty()) && cities.isEmpty()) return null;

            String displayCity = cities.size() > 1 ? String.join(" → ", cities) : city;
            String updatedAt = Files.getLastModifiedTime(path).toInstant().toString();

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("plan_id", payload.getOrDefault("plan_id", path.getFileName().toString().replace(".json", "")));
            item.put("task_id", payload.getOrDefault("task_id", path.getFileName().toString().replace(".json", "")));
            item.put("city", displayCity);
            item.put("cities", cities);
            item.put("start_date", startDate);
            item.put("end_date", endDate);
            item.put("updated_at", updatedAt);
            item.put("overall_suggestions", overallSuggestions);
            return item;
        } catch (Exception e) {
            return null;
        }
    }
}
