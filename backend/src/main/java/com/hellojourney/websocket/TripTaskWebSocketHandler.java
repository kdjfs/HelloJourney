package com.hellojourney.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hellojourney.controller.TripController;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class TripTaskWebSocketHandler extends TextWebSocketHandler {
    private final TripController tripController;
    private final ObjectMapper objectMapper;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String path = session.getUri().getPath();
        String taskId = path.substring(path.lastIndexOf("/") + 1);

        TripController.TaskState task = tripController.tasks.get(taskId);
        if (task == null) {
            task = tripController.loadTaskFromDisk(taskId);
        }

        if (task == null) {
            Map<String, Object> errorEvent = new LinkedHashMap<>();
            errorEvent.put("task_id", taskId);
            errorEvent.put("plan_id", taskId);
            errorEvent.put("status", "failed");
            errorEvent.put("stage", "failed");
            errorEvent.put("progress", 100);
            errorEvent.put("message", "任务不存在");
            errorEvent.put("error", "任务不存在");
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(errorEvent)));
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        BlockingQueue<Map<String, Object>> queue = new LinkedBlockingQueue<>();
        task.getSubscribers().add(queue);

        Map<String, Object> snapshot = buildTaskEvent(taskId, task, true);
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(snapshot)));

        if ("completed".equals(task.getStatus()) || "failed".equals(task.getStatus())) {
            session.close();
            task.getSubscribers().remove(queue);
            return;
        }

        session.getAttributes().put("taskId", taskId);
        session.getAttributes().put("queue", queue);

        TripController.TaskState finalTask = task;
        new Thread(() -> {
            try {
                while (session.isOpen()) {
                    Map<String, Object> event = queue.poll(30, TimeUnit.SECONDS);
                    if (event != null) {
                        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(event)));
                        if ("completed".equals(event.get("status")) || "failed".equals(event.get("status"))) {
                            break;
                        }
                    }
                }
            } catch (Exception e) {
            } finally {
                finalTask.getSubscribers().remove(queue);
                try { session.close(); } catch (Exception ignored) {}
            }
        }).start();
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String taskId = (String) session.getAttributes().get("taskId");
        if (taskId != null) {
            TripController.TaskState task = tripController.tasks.get(taskId);
            if (task != null) {
                BlockingQueue<Map<String, Object>> queue = (BlockingQueue<Map<String, Object>>) session.getAttributes().get("queue");
                if (queue != null) {
                    task.getSubscribers().remove(queue);
                }
            }
        }
    }

    private Map<String, Object> buildTaskEvent(String taskId, TripController.TaskState task, boolean includeResult) {
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
}
