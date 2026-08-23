package com.hellojourney.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.config.AppSettings;
import com.hellojourney.model.dto.TripRequest;
import com.hellojourney.model.vo.TripPlanResponse;
import com.hellojourney.service.TripPlanningJobService;
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
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.Valid;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Slf4j
@RestController
@RequestMapping("/api/trip")
@RequiredArgsConstructor
@Tag(name = "旅行规划", description = "旅行计划生成、状态查询、历史记录")
public class TripController {
    private final TripPlanningJobService tripPlanningJobService;
    private final AppSettings appSettings;
    private final ObjectMapper objectMapper;

    private static final Set<String> FINAL_TASK_STATUS = Set.of("completed", "failed", "cancelled");
    public final Map<String, TaskState> tasks = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<TripPlanResponse>> taskFutures = new ConcurrentHashMap<>();
    private final Map<String, String> idempotencyKeys = new ConcurrentHashMap<>();

    @Data
    public static class TaskState {
        private String taskId;
        private String planId;
        private volatile String status = "processing";
        private volatile String stage = "submitted";
        private volatile int progress = 0;
        private volatile String message = "任务已提交，等待执行...";
        private volatile Object result;
        private volatile String error;
        private Object requestPayload;
        private volatile boolean cancellationRequested;
        private final List<java.util.concurrent.BlockingQueue<Map<String, Object>>> subscribers = new java.util.concurrent.CopyOnWriteArrayList<>();
    }

    @PostMapping("/plan")
    @Operation(summary = "提交旅行规划任务", description = "异步生成旅行计划，返回任务ID，可通过WebSocket或轮询获取进度")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "任务已提交"), @ApiResponse(responseCode = "400", description = "请求参数错误")})
    public ResponseEntity<Map<String, Object>> planTrip(
            @Valid @RequestBody TripRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        request.normalizeCities();
        String normalizedKey = idempotencyKey != null ? idempotencyKey.trim() : "";
        if (normalizedKey.length() > 128) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key 不能超过 128 个字符");
        }
        if (!normalizedKey.isEmpty()) {
            String existingTaskId = idempotencyKeys.get(normalizedKey);
            if (existingTaskId != null) {
                return acceptedTask(existingTaskId, true);
            }
        }

        String taskId = UUID.randomUUID().toString();
        if (!normalizedKey.isEmpty()) {
            String existingTaskId = idempotencyKeys.putIfAbsent(normalizedKey, taskId);
            if (existingTaskId != null) {
                return acceptedTask(existingTaskId, true);
            }
        }
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

        CompletableFuture<TripPlanResponse> future;
        try {
            future = tripPlanningJobService.planAsync(
                    taskId,
                    request,
                    (message, progress) -> handleProgress(taskId, message, progress),
                    task::isCancellationRequested
            );
        } catch (Exception e) {
            handleTaskCompletion(taskId, null, e);
            return acceptedTask(taskId, false);
        }

        int timeoutSeconds = Math.max(1, appSettings.getTasks().getExecutionTimeoutSeconds());
        future.orTimeout(timeoutSeconds, TimeUnit.SECONDS);
        taskFutures.put(taskId, future);
        future.whenComplete((result, error) -> handleTaskCompletion(taskId, result, error));
        return acceptedTask(taskId, false);
    }

    private ResponseEntity<Map<String, Object>> acceptedTask(String taskId, boolean duplicate) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("task_id", taskId);
        response.put("plan_id", taskId);
        response.put("status", tasks.containsKey(taskId) ? tasks.get(taskId).getStatus() : "processing");
        response.put("ws_url", "/api/trip/ws/" + taskId);
        response.put("duplicate", duplicate);
        response.put("message", duplicate ? "已返回相同请求的现有任务" : "任务已提交，可订阅实时状态");
        return ResponseEntity.accepted().body(response);
    }

    private void handleProgress(String taskId, String message, int progress) {
        TaskState task = tasks.get(taskId);
        if (task == null || task.isCancellationRequested()) {
            throw new CancellationException("旅行规划任务已取消: " + taskId);
        }
        String stage;
        if (message.contains("景点")) stage = "attraction_search";
        else if (message.contains("天气")) stage = "weather_search";
        else if (message.contains("酒店")) stage = "hotel_search";
        else if (message.contains("知识图谱")) stage = "graph_building";
        else if (message.contains("生成")) stage = "planning";
        else stage = "processing";
        updateTaskState(taskId, "processing", stage, progress, message, null, null);
    }

    private void handleTaskCompletion(String taskId, TripPlanResponse result, Throwable throwable) {
        taskFutures.remove(taskId);
        TaskState task = tasks.get(taskId);
        if (task == null || task.isCancellationRequested() || "cancelled".equals(task.getStatus())) return;

        if (throwable == null) {
            log.info("任务 {} 完成", taskId);
            updateTaskState(taskId, "completed", "completed", 100, "旅行计划生成成功", result, null);
            return;
        }

        Throwable cause = unwrap(throwable);
        if (cause instanceof CancellationException) {
            updateTaskState(taskId, "cancelled", "cancelled", task.getProgress(), "旅行规划已取消", null, null);
        } else if (cause instanceof TimeoutException) {
            task.setCancellationRequested(true);
            log.warn("任务 {} 超时", taskId);
            updateTaskState(taskId, "failed", "failed", 100, "旅行规划超时，请重试", null, "旅行规划超时，请重试");
        } else {
            log.error("任务 {} 失败 (type={})", taskId, cause.getClass().getSimpleName());
            updateTaskState(taskId, "failed", "failed", 100, "旅行规划失败，请稍后重试", null, "旅行规划失败，请稍后重试");
        }
    }

    private Throwable unwrap(Throwable throwable) {
        Throwable current = throwable;
        while ((current instanceof CompletionException || current instanceof java.util.concurrent.ExecutionException)
                && current.getCause() != null) {
            current = current.getCause();
        }
        return current;
    }

    @DeleteMapping("/tasks/{taskId}")
    @Operation(summary = "取消旅行规划任务")
    public ResponseEntity<Map<String, Object>> cancelTrip(@PathVariable String taskId) {
        TaskState task = tasks.get(taskId);
        if (task == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "任务不存在");
        }
        if (FINAL_TASK_STATUS.contains(task.getStatus())) {
            return ResponseEntity.ok(Map.of(
                    "task_id", taskId,
                    "status", task.getStatus(),
                    "message", "任务已经结束"
            ));
        }

        task.setCancellationRequested(true);
        CompletableFuture<TripPlanResponse> future = taskFutures.remove(taskId);
        if (future != null) future.cancel(true);
        updateTaskState(taskId, "cancelled", "cancelled", task.getProgress(), "旅行规划已取消", null, null);
        return ResponseEntity.ok(Map.of(
                "task_id", taskId,
                "status", "cancelled",
                "message", "旅行规划已取消"
        ));
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
        } else if ("failed".equals(task.getStatus()) || "cancelled".equals(task.getStatus())) {
            response.put("status", task.getStatus());
            response.put("error", task.getError() != null ? task.getError() : "");
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

    void updateTaskState(String taskId, String status, String stage, int progress, String message, Object result, String error) {
        TaskState task = tasks.get(taskId);
        if (task == null) return;
        synchronized (task) {
            task.setStatus(status);
            task.setStage(stage);
            task.setProgress(progress);
            task.setMessage(message);
            if (result != null) task.setResult(result);
            if (error != null) task.setError(error);
            persistTaskState(taskId, task);
        }

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
            if (!queue.offer(event)) {
                queue.poll();
                if (!queue.offer(event)) {
                    deadQueues.add(queue);
                }
            }
        }
        if (!deadQueues.isEmpty()) {
            task.getSubscribers().removeAll(deadQueues);
        }
    }

    private void persistTaskState(String taskId, TaskState task) {
        Path temporaryFile = null;
        try {
            Path dir = taskDataDirectory();
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
            temporaryFile = Files.createTempFile(dir, taskId + "-", ".tmp");
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(temporaryFile.toFile(), payload);
            Path target = taskFile(taskId);
            try {
                Files.move(temporaryFile, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(temporaryFile, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (Exception e) {
            log.warn("持久化任务 {} 失败 (type={})", taskId, e.getClass().getSimpleName());
        } finally {
            if (temporaryFile != null) {
                try {
                    Files.deleteIfExists(temporaryFile);
                } catch (Exception ignored) {
                    log.debug("临时任务文件清理失败 (task_id={})", taskId);
                }
            }
        }
    }

    public TaskState loadTaskFromDisk(String taskId) {
        if (!isValidTaskId(taskId)) return null;
        Path path = taskFile(taskId);
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
        Path dir = taskDataDirectory();
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

    private Path taskDataDirectory() {
        return Paths.get(appSettings.getTasks().getDataDir()).toAbsolutePath().normalize();
    }

    private Path taskFile(String taskId) {
        if (!isValidTaskId(taskId)) {
            throw new IllegalArgumentException("无效的任务 ID");
        }
        Path directory = taskDataDirectory();
        Path path = directory.resolve(taskId + ".json").normalize();
        if (!path.getParent().equals(directory)) {
            throw new IllegalArgumentException("无效的任务路径");
        }
        return path;
    }

    private boolean isValidTaskId(String taskId) {
        return taskId != null && taskId.matches("[A-Za-z0-9-]{8,64}");
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
            int travelDays = requestPayload.get("travel_days") instanceof Number number
                    ? number.intValue()
                    : plan.get("days") instanceof List<?> days ? days.size() : 0;

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
            item.put("travel_days", travelDays);
            item.put("updated_at", updatedAt);
            item.put("overall_suggestions", overallSuggestions);
            return item;
        } catch (Exception e) {
            return null;
        }
    }
}
